from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import or_, text
from sqlalchemy.orm import Session

from dependencies import get_current_user, get_db
from routers.auction import settle_auction_if_needed
from listing_presenters import build_listing_category_meta, listing_to_out, load_images_for_listings, order_listing_boosted_first
from models import (
    Category,
    JobWorkflowStatus,
    Listing,
    ListingImage,
    ListingKind,
    ListingResponse,
    ListingStatus,
    Section,
    TranscriptionStatus,
    User,
    UserRole,
)
from schemas import (
    AssignExecutorRequest,
    ListingCreate,
    ListingImageOut,
    ListingsPage,
    ListingOut,
    ListingUpdate,
    ListingWithContact,
)
from storage import save_listing_image, save_listing_voice
from tasks.transcription import run_transcription_stub
from telegram_notify import notify_user_by_id


router = APIRouter(prefix="/listings", tags=["listings"])


def _staff_can_manage_listing(user: User, listing: Listing) -> bool:
    if listing.user_id == user.id:
        return True
    return user.role in (UserRole.ADMIN, UserRole.MANAGER)


@router.get("", response_model=ListingsPage)
def get_listings(
    section: str | None = Query(default=None, description="Фильтр по разделу: services/realty/transport"),
    category_id: int | None = None,
    city: str | None = None,
    price_from: float | None = Query(default=None, ge=0),
    price_to: float | None = Query(default=None, ge=0),
    q: str | None = None,
    kind: ListingKind | None = Query(default=None, description="offer — услуга исполнителя, request — заявка заказчика"),
    include_finished: bool = Query(
        default=False,
        description="Показывать завершённые и отменённые (по умолчанию в ленте скрыты)",
    ),
    lat: float | None = Query(default=None, ge=-90, le=90),
    lng: float | None = Query(default=None, ge=-180, le=180),
    radius_km: float | None = Query(default=None, ge=0.5, le=500),
    beauty_scope: bool = Query(
        default=False,
        description="Только категории красоты: slug krasota или префикс beauty-",
    ),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    sort_by: str = Query(default="created_at", pattern="^(created_at|price|views_count)$"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
):
    query = db.query(Listing).filter(Listing.status == ListingStatus.ACTIVE)

    if not include_finished:
        query = query.filter(
            Listing.workflow_status.notin_([JobWorkflowStatus.COMPLETED, JobWorkflowStatus.CANCELLED])
        )

    category_joined = False
    if section:
        query = query.join(Category, Category.id == Listing.category_id).join(Section, Section.id == Category.section_id)
        query = query.filter(Section.key == section)
        category_joined = True

    if beauty_scope:
        if not category_joined:
            query = query.join(Category, Category.id == Listing.category_id)
        query = query.filter(or_(Category.slug == "krasota", Category.slug.like("beauty-%")))

    if category_id:
        query = query.filter(Listing.category_id == category_id)
    if city:
        query = query.filter(Listing.city.ilike(city.strip()))
    if kind is not None:
        query = query.filter(Listing.kind == kind)
    if price_from is not None:
        query = query.filter(Listing.price >= price_from)
    if price_to is not None:
        query = query.filter(Listing.price <= price_to)
    if q:
        like_pattern = f"%{q.strip()}%"
        query = query.filter((Listing.title.ilike(like_pattern)) | (Listing.description.ilike(like_pattern)))

    if lat is not None and lng is not None and radius_km is not None:
        query = query.filter(Listing.latitude.isnot(None), Listing.longitude.isnot(None)).filter(
            text(
                """
                (6371.0 * acos(LEAST(1.0, GREATEST(-1.0,
                    cos(radians(:lat)) * cos(radians(listings.latitude)) * cos(radians(listings.longitude) - radians(:lng)) +
                    sin(radians(:lat)) * sin(radians(listings.latitude))
                ))) <= :radius_km
                """
            ).bindparams(lat=lat, lng=lng, radius_km=radius_km)
        )

    order_map = {
        "created_at": Listing.created_at,
        "price": Listing.price,
        "views_count": Listing.views_count,
    }
    order_column = order_map[sort_by]
    order_expr = order_column.asc() if sort_order == "asc" else order_column.desc()
    boost = order_listing_boosted_first()

    total = query.count()
    items = query.order_by(boost.desc(), order_expr).offset((page - 1) * page_size).limit(page_size).all()
    listing_ids = [item.id for item in items]
    images_by_listing = load_images_for_listings(db, listing_ids)

    return ListingsPage(
        items=[listing_to_out(item, images_by_listing) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{listing_id}", response_model=ListingWithContact)
def get_listing(listing_id: int, db: Session = Depends(get_db)):
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Объявление не найдено")

    if listing.deadline_at is not None:
        settle_auction_if_needed(db, listing)
        db.refresh(listing)

    listing.views_count += 1
    db.commit()
    db.refresh(listing)

    seller = db.query(User).filter(User.id == listing.user_id).first()
    images_by_listing = load_images_for_listings(db, [listing.id])
    crumbs, sk, sn = build_listing_category_meta(listing.category)
    base = listing_to_out(listing, images_by_listing, section_key=sk, section_name_ru=sn, category_path=crumbs)
    return ListingWithContact(
        **base.model_dump(),
        phone=seller.phone if seller else "",
        seller_name=seller.name if seller else None,
    )


@router.post("", response_model=ListingOut, status_code=status.HTTP_201_CREATED)
def create_listing(
    payload: ListingCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    category = db.query(Category).filter(Category.id == payload.category_id).first()
    if not category:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неверная категория")

    data = payload.model_dump()
    data["workflow_status"] = JobWorkflowStatus.ACTIVE
    listing = Listing(**data, user_id=user.id)
    db.add(listing)
    db.commit()
    db.refresh(listing)
    images_by_listing = load_images_for_listings(db, [listing.id])
    return listing_to_out(listing, images_by_listing)


@router.put("/{listing_id}", response_model=ListingOut)
def update_listing(
    listing_id: int,
    payload: ListingUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Объявление не найдено")
    if not _staff_can_manage_listing(user, listing):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Можно редактировать только свои объявления")

    update_data = payload.model_dump(exclude_unset=True)
    if "category_id" in update_data:
        category_exists = db.query(Category.id).filter(Category.id == update_data["category_id"]).first()
        if not category_exists:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неверная категория")

    for field, value in update_data.items():
        setattr(listing, field, value)

    db.commit()
    db.refresh(listing)
    images_by_listing = load_images_for_listings(db, [listing.id])
    return listing_to_out(listing, images_by_listing)


@router.delete("/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_listing(
    listing_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Объявление не найдено")

    if not _staff_can_manage_listing(user, listing):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Удаление запрещено")

    db.delete(listing)
    db.commit()
    return None


@router.post("/{listing_id}/images", response_model=ListingImageOut, status_code=status.HTTP_201_CREATED)
def upload_listing_image(
    listing_id: int,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Объявление не найдено")
    if not _staff_can_manage_listing(user, listing):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Можно загружать фото только в свои объявления")

    file_url = save_listing_image(file)
    has_images = db.query(ListingImage.id).filter(ListingImage.listing_id == listing_id).first() is not None
    max_sort = db.query(ListingImage.sort_order).filter(ListingImage.listing_id == listing_id).order_by(ListingImage.sort_order.desc()).first()
    next_sort = (max_sort[0] + 1) if max_sort else 0

    image = ListingImage(
        listing_id=listing_id,
        file_url=file_url,
        is_primary=not has_images,
        sort_order=next_sort,
    )
    db.add(image)
    db.commit()
    db.refresh(image)
    return image


@router.post("/{listing_id}/voice", response_model=ListingOut)
def upload_listing_voice(
    listing_id: int,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Объявление не найдено")
    if not _staff_can_manage_listing(user, listing):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Можно загружать аудио только к своим объявлениям")

    listing.voice_url = save_listing_voice(file)
    listing.transcription_status = TranscriptionStatus.PENDING
    db.commit()
    db.refresh(listing)
    background_tasks.add_task(run_transcription_stub, listing.id)
    images_by_listing = load_images_for_listings(db, [listing.id])
    return listing_to_out(listing, images_by_listing)


@router.post("/{listing_id}/assign-executor", response_model=ListingOut)
def assign_executor(
    listing_id: int,
    payload: AssignExecutorRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Объявление не найдено")
    if listing.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Назначать исполнителя может автор заявки")
    if listing.kind != ListingKind.REQUEST:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Только для заявок заказчика")
    if listing.workflow_status != JobWorkflowStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Заявка не в статусе «активна»")

    responded = (
        db.query(ListingResponse)
        .filter(
            ListingResponse.listing_id == listing_id,
            ListingResponse.executor_id == payload.executor_user_id,
        )
        .first()
    )
    if not responded:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сначала исполнитель должен оставить отклик на заявку",
        )

    listing.assigned_executor_id = payload.executor_user_id
    listing.workflow_status = JobWorkflowStatus.IN_PROGRESS
    db.commit()
    db.refresh(listing)
    notify_user_by_id(
        db,
        payload.executor_user_id,
        f"Вас выбрали исполнителем по заявке: {listing.title}. Откройте чат в приложении.",
    )
    images_by_listing = load_images_for_listings(db, [listing.id])
    return listing_to_out(listing, images_by_listing)
