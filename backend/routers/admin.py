"""Панель администратора и менеджеров: модерация объявлений, роли (с секретом операций)."""

import os

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from dependencies import get_current_user, get_db
from listing_presenters import listing_to_out, load_images_for_listings
from datetime import datetime, timezone

from models import (
    Category,
    Listing,
    Section,
    User,
    UserRole,
    VerificationDocStatus,
    VerificationDocument,
    VerificationLevel,
)
from schemas import (
    AdminCategoryCreate,
    AdminCategoryUpdate,
    AdminListingStatusUpdate,
    AdminSectionCreate,
    AdminUserRoleUpdate,
    CategoryAdminRow,
    ListingsPage,
    ListingOut,
    SectionOut,
    UserOut,
    VerificationDecisionRequest,
    VerificationDocumentOut,
)

router = APIRouter(prefix="/admin", tags=["admin"])

OPS_SECRET = os.getenv("DEVOR_OPS_SECRET", "devor-local-ops-secret-change-me")


def _is_staff(user: User) -> bool:
    return user.role in (UserRole.ADMIN, UserRole.MANAGER)


def _is_super_admin(user: User) -> bool:
    return user.role == UserRole.ADMIN


def get_current_staff(user: User = Depends(get_current_user)) -> User:
    if not _is_staff(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Нужна роль менеджера или главного администратора",
        )
    return user


def _verify_ops_admin(user: User, secret: str | None) -> User:
    if not _is_super_admin(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только главный администратор (создатели проекта)",
        )
    if not secret or secret.strip() != OPS_SECRET:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Неверный или отсутствует секрет операций (заголовок X-Devor-Ops-Secret)",
        )
    return user


def get_ops_authorized_creator(
    user: User = Depends(get_current_user),
    x_devor_ops_secret: str | None = Header(None, alias="X-Devor-Ops-Secret"),
) -> User:
    return _verify_ops_admin(user, x_devor_ops_secret)


@router.get("/me")
def admin_me(user: User = Depends(get_current_staff)):
    return {
        "role": user.role.value,
        "is_super_admin": _is_super_admin(user),
        "is_manager": user.role == UserRole.MANAGER,
        "login": user.login,
        "name": user.name,
    }


@router.get("/listings", response_model=ListingsPage)
def admin_list_listings(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: str | None = None,
    listing_status: str | None = Query(None, alias="status"),
    user: User = Depends(get_current_staff),
    db: Session = Depends(get_db),
):
    query = db.query(Listing)
    if q and q.strip():
        t = f"%{q.strip()}%"
        query = query.filter(or_(Listing.title.ilike(t), Listing.description.ilike(t)))
    if listing_status in ("active", "archived", "moderated"):
        query = query.filter(Listing.status == listing_status)
    total = query.count()
    rows = query.order_by(Listing.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    ids = [x.id for x in rows]
    images = load_images_for_listings(db, ids)
    items = [listing_to_out(x, images, db=db) for x in rows]
    return ListingsPage(items=items, total=total, page=page, page_size=page_size)


@router.patch("/listings/{listing_id}/status", response_model=ListingOut)
def admin_set_listing_status(
    listing_id: int,
    payload: AdminListingStatusUpdate,
    user: User = Depends(get_current_staff),
    db: Session = Depends(get_db),
):
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Объявление не найдено")
    listing.status = payload.status
    db.commit()
    db.refresh(listing)
    images = load_images_for_listings(db, [listing.id])
    return listing_to_out(listing, images, db=db)


@router.get("/ops/ping")
def admin_ops_ping(user: User = Depends(get_ops_authorized_creator)):
    return {"ok": True, "detail": "Секрет операций принят, доступ к функциям создателей открыт"}


@router.get("/users", response_model=list[UserOut])
def admin_list_users(
    user: User = Depends(get_ops_authorized_creator),
    db: Session = Depends(get_db),
):
    return db.query(User).order_by(User.id.asc()).all()


@router.patch("/users/{target_id}/role", response_model=UserOut)
def admin_set_user_role(
    target_id: int,
    payload: AdminUserRoleUpdate,
    user: User = Depends(get_ops_authorized_creator),
    db: Session = Depends(get_db),
):
    target = db.query(User).filter(User.id == target_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
    if target.id == user.id and payload.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя снять с себя роль главного администратора",
        )
    if payload.role not in (UserRole.USER, UserRole.MANAGER, UserRole.ADMIN):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Недопустимая роль")
    target.role = payload.role
    db.commit()
    db.refresh(target)
    return target


# --- Каталог: разделы и категории (только admin + секрет операций) ---


@router.get("/catalog/sections", response_model=list[SectionOut])
def admin_catalog_list_sections(
    user: User = Depends(get_ops_authorized_creator),
    db: Session = Depends(get_db),
):
    return db.query(Section).order_by(Section.id.asc()).all()


@router.post("/catalog/sections", response_model=SectionOut)
def admin_catalog_create_section(
    payload: AdminSectionCreate,
    user: User = Depends(get_ops_authorized_creator),
    db: Session = Depends(get_db),
):
    if db.query(Section).filter(Section.key == payload.key).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Раздел с таким key уже существует")
    if db.query(Section).filter(Section.slug == payload.slug).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Раздел с таким slug уже существует")
    row = Section(key=payload.key, name_ru=payload.name_ru, name_tj=payload.name_tj, slug=payload.slug)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/catalog/categories", response_model=list[CategoryAdminRow])
def admin_catalog_list_categories(
    section_key: str = Query(..., description="Ключ раздела, например services"),
    user: User = Depends(get_ops_authorized_creator),
    db: Session = Depends(get_db),
):
    sec = db.query(Section).filter(Section.key == section_key).first()
    if not sec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Раздел не найден")
    rows = (
        db.query(Category)
        .filter(Category.section_id == sec.id)
        .order_by(Category.level.asc(), Category.name_ru.asc())
        .all()
    )
    return [
        CategoryAdminRow(
            id=c.id,
            section_id=c.section_id,
            section_key=sec.key,
            parent_id=c.parent_id,
            level=c.level,
            name_ru=c.name_ru,
            name_tj=c.name_tj,
            slug=c.slug,
        )
        for c in rows
    ]


@router.post("/catalog/categories", response_model=CategoryAdminRow)
def admin_catalog_create_category(
    payload: AdminCategoryCreate,
    user: User = Depends(get_ops_authorized_creator),
    db: Session = Depends(get_db),
):
    sec = db.query(Section).filter(Section.key == payload.section_key).first()
    if not sec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Раздел не найден")
    if db.query(Category).filter(Category.section_id == sec.id, Category.slug == payload.slug).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="В этом разделе категория с таким slug уже есть",
        )
    level = 0
    parent_id = payload.parent_id
    if parent_id is not None:
        parent = db.query(Category).filter(Category.id == parent_id, Category.section_id == sec.id).first()
        if not parent:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Родительская категория не найдена в разделе")
        level = parent.level + 1
    cat = Category(
        section_id=sec.id,
        name_ru=payload.name_ru,
        name_tj=payload.name_tj,
        slug=payload.slug,
        parent_id=parent_id,
        level=level,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return CategoryAdminRow(
        id=cat.id,
        section_id=cat.section_id,
        section_key=sec.key,
        parent_id=cat.parent_id,
        level=cat.level,
        name_ru=cat.name_ru,
        name_tj=cat.name_tj,
        slug=cat.slug,
    )


@router.patch("/catalog/categories/{category_id}", response_model=CategoryAdminRow)
def admin_catalog_update_category(
    category_id: int,
    payload: AdminCategoryUpdate,
    user: User = Depends(get_ops_authorized_creator),
    db: Session = Depends(get_db),
):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Категория не найдена")
    sec = db.query(Section).filter(Section.id == cat.section_id).first()
    if not sec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Раздел не найден")

    data = payload.model_dump(exclude_unset=True)
    if "slug" in data and data["slug"] != cat.slug:
        taken = (
            db.query(Category.id)
            .filter(Category.section_id == cat.section_id, Category.slug == data["slug"], Category.id != cat.id)
            .first()
        )
        if taken:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Slug уже занят в разделе")
    for k, v in data.items():
        setattr(cat, k, v)
    db.commit()
    db.refresh(cat)
    return CategoryAdminRow(
        id=cat.id,
        section_id=cat.section_id,
        section_key=sec.key,
        parent_id=cat.parent_id,
        level=cat.level,
        name_ru=cat.name_ru,
        name_tj=cat.name_tj,
        slug=cat.slug,
    )


@router.delete("/catalog/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_catalog_delete_category(
    category_id: int,
    user: User = Depends(get_ops_authorized_creator),
    db: Session = Depends(get_db),
):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Категория не найдена")
    child = db.query(Category.id).filter(Category.parent_id == cat.id).first()
    if child:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сначала удалите или перенесите подкатегории",
        )
    listing = db.query(Listing.id).filter(Listing.category_id == cat.id).first()
    if listing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя удалить категорию с объявлениями",
        )
    db.delete(cat)
    db.commit()
    return None


@router.get("/verification/pending", response_model=list[VerificationDocumentOut])
def admin_verification_pending(
    user: User = Depends(get_current_staff),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(VerificationDocument)
        .filter(VerificationDocument.status == VerificationDocStatus.PENDING)
        .order_by(VerificationDocument.created_at.asc())
        .all()
    )
    return [
        VerificationDocumentOut(
            id=r.id,
            kind=r.kind.value,
            file_url=r.file_url,
            status=r.status.value,
            admin_note=r.admin_note,
            created_at=r.created_at,
            reviewed_at=r.reviewed_at,
        )
        for r in rows
    ]


@router.post("/verification/{doc_id}/decision", response_model=VerificationDocumentOut)
def admin_verification_decide(
    doc_id: int,
    payload: VerificationDecisionRequest,
    user: User = Depends(get_current_staff),
    db: Session = Depends(get_db),
):
    doc = db.query(VerificationDocument).filter(VerificationDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Документ не найден")

    if payload.status == "approved":
        doc.status = VerificationDocStatus.APPROVED
        u = db.query(User).filter(User.id == doc.user_id).first()
        if u:
            u.verification_level = VerificationLevel.EXTENDED
    else:
        doc.status = VerificationDocStatus.REJECTED

    doc.admin_note = payload.admin_note
    doc.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(doc)
    return VerificationDocumentOut(
        id=doc.id,
        kind=doc.kind.value,
        file_url=doc.file_url,
        status=doc.status.value,
        admin_note=doc.admin_note,
        created_at=doc.created_at,
        reviewed_at=doc.reviewed_at,
    )
