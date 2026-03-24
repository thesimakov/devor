from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from dependencies import get_current_user, get_db
from models import JobWorkflowStatus, Listing, ListingKind, ListingResponse, User, UserRole
from schemas import ListingResponseCreate, ListingResponseOut
from telegram_notify import notify_user_by_id

router = APIRouter(prefix="/listings", tags=["listing-responses"])


def _response_to_out(row: ListingResponse, executor: User | None) -> ListingResponseOut:
    return ListingResponseOut(
        id=row.id,
        listing_id=row.listing_id,
        executor_id=row.executor_id,
        proposed_price=row.proposed_price,
        comment=row.comment,
        created_at=row.created_at,
        executor_name=executor.name if executor else None,
        executor_login=executor.login if executor else "",
    )


@router.get("/{listing_id}/responses", response_model=list[ListingResponseOut])
def list_responses(
    listing_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Объявление не найдено")

    if listing.kind != ListingKind.REQUEST:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Отклики только на заявки заказчика")

    is_owner = listing.user_id == user.id
    is_staff = user.role in (UserRole.ADMIN, UserRole.MANAGER)
    if not is_owner and not is_staff:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Список откликов доступен автору заявки")

    rows = (
        db.query(ListingResponse)
        .filter(ListingResponse.listing_id == listing_id)
        .order_by(ListingResponse.created_at.desc())
        .all()
    )
    out: list[ListingResponseOut] = []
    for row in rows:
        ex = db.query(User).filter(User.id == row.executor_id).first()
        out.append(_response_to_out(row, ex))
    return out


@router.post("/{listing_id}/responses", response_model=ListingResponseOut, status_code=status.HTTP_201_CREATED)
def create_response(
    listing_id: int,
    payload: ListingResponseCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Объявление не найдено")
    if listing.kind != ListingKind.REQUEST:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Отклик возможен только на заявку заказчика")
    if listing.workflow_status != JobWorkflowStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Заявка не принимает отклики")
    if listing.user_id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нельзя откликаться на собственную заявку")

    existing = (
        db.query(ListingResponse)
        .filter(ListingResponse.listing_id == listing_id, ListingResponse.executor_id == user.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Вы уже откликались")

    row = ListingResponse(
        listing_id=listing_id,
        executor_id=user.id,
        proposed_price=payload.proposed_price,
        comment=payload.comment or "",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    ex = db.query(User).filter(User.id == user.id).first()
    notify_user_by_id(db, listing.user_id, f"Новый отклик на заявку «{listing.title}».")
    return _response_to_out(row, ex)


@router.delete("/{listing_id}/responses/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_response(
    listing_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(ListingResponse)
        .filter(ListingResponse.listing_id == listing_id, ListingResponse.executor_id == user.id)
        .first()
    )
    if not row:
        return None
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if listing and listing.workflow_status != JobWorkflowStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нельзя отозвать отклик после начала работ")
    db.delete(row)
    db.commit()
    return None
