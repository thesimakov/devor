"""Отзывы после завершённой сделки."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from dependencies import get_current_user, get_db
from models import JobWorkflowStatus, Listing, ListingKind, Review, User
from schemas import ReviewCreate, ReviewOut

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.get("/listing/{listing_id}", response_model=list[ReviewOut])
def list_reviews_for_listing(listing_id: int, db: Session = Depends(get_db)):
    rows = db.query(Review).filter(Review.listing_id == listing_id).order_by(Review.created_at.desc()).all()
    return rows


@router.post("", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
def create_review(
    payload: ReviewCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    listing = db.query(Listing).filter(Listing.id == payload.listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    if listing.kind != ListingKind.REQUEST:
        raise HTTPException(status_code=400, detail="Отзывы только по заявкам")
    if listing.workflow_status != JobWorkflowStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Отзыв можно оставить после завершения заказа")

    if user.id not in (listing.user_id, listing.assigned_executor_id):
        raise HTTPException(status_code=403, detail="Только участник сделки может оставить отзыв")

    other_id = listing.assigned_executor_id if user.id == listing.user_id else listing.user_id
    if other_id is None or payload.target_user_id != other_id:
        raise HTTPException(status_code=400, detail="target_user_id должен быть второй стороной сделки")

    dup = (
        db.query(Review)
        .filter(Review.listing_id == payload.listing_id, Review.author_id == user.id)
        .first()
    )
    if dup:
        raise HTTPException(status_code=409, detail="Вы уже оставили отзыв по этой заявке")

    row = Review(
        listing_id=payload.listing_id,
        author_id=user.id,
        target_user_id=payload.target_user_id,
        stars=payload.stars,
        text_ru=payload.text_ru,
        text_tj=payload.text_tj,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
