"""Аукционы по объявлениям с deadline_at: ставки, завершение, корзина победителя."""

from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from dependencies import get_current_user, get_db, get_optional_user
from listing_presenters import listing_to_out, load_images_for_listings
from models import (
    AuctionBid,
    BillingLedger,
    BillingLedgerKind,
    CartItem,
    CartItemSource,
    Listing,
    User,
    VerificationLevel,
)
from schemas import AuctionStateOut, CartItemOut, ListingOut, PlaceBidRequest

router = APIRouter(tags=["auctions"])

AUCTION_VERIFY_THRESHOLD_SOM = Decimal("1000")


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_dt(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _q2(x: Decimal) -> Decimal:
    return x.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _has_ever_topped_wallet(db: Session, user_id: int) -> bool:
    return (
        db.query(BillingLedger)
        .filter(
            BillingLedger.user_id == user_id,
            BillingLedger.kind == BillingLedgerKind.TOPUP_DEMO,
            BillingLedger.delta_som > 0,
        )
        .first()
        is not None
    )


def _can_participate_auction(db: Session, user: User) -> tuple[bool, str]:
    bal = user.balance_som or Decimal("0")
    if bal > 0:
        return True, ""
    if _has_ever_topped_wallet(db, user.id):
        return True, ""
    return False, "Пополните кошелёк, чтобы участвовать в аукционе."


def _check_high_bid_verification(user: User, amount: Decimal) -> tuple[bool, str]:
    if amount > AUCTION_VERIFY_THRESHOLD_SOM and user.verification_level != VerificationLevel.EXTENDED:
        return (
            False,
            "Для ставок свыше 1000 сом. нужна подтверждённая учётная запись (верификация).",
        )
    return True, ""


def settle_auction_if_needed(db: Session, listing: Listing) -> None:
    if listing.deadline_at is None:
        return
    dl = _normalize_dt(listing.deadline_at)
    if dl is None:
        return
    if _now_utc() <= dl:
        return
    if listing.auction_settled_at is not None:
        return

    settled_at = _now_utc()
    listing.auction_settled_at = settled_at

    best = (
        db.query(AuctionBid)
        .filter(AuctionBid.listing_id == listing.id)
        .order_by(AuctionBid.amount_som.desc(), AuctionBid.id.asc())
        .first()
    )
    if best:
        existing = db.query(CartItem).filter(CartItem.listing_id == listing.id).first()
        if not existing:
            db.add(
                CartItem(
                    user_id=best.user_id,
                    listing_id=listing.id,
                    price_som=best.amount_som,
                    source=CartItemSource.AUCTION,
                )
            )
    db.commit()
    db.refresh(listing)


def _starting_price(listing: Listing) -> Decimal:
    if listing.price is not None and listing.price > 0:
        return _q2(listing.price)
    return Decimal("1.00")


def _auction_metrics(db: Session, listing: Listing) -> tuple[Decimal | None, int, Decimal]:
    start = _starting_price(listing)
    row = (
        db.query(func.max(AuctionBid.amount_som), func.count(AuctionBid.id))
        .filter(AuctionBid.listing_id == listing.id)
        .one()
    )
    highest = row[0]
    cnt = int(row[1] or 0)
    if highest is None:
        min_next = start
    else:
        min_next = _q2(Decimal(str(highest)) + Decimal("0.01"))
    return (Decimal(str(highest)) if highest is not None else None, cnt, min_next)


def _build_state(
    db: Session,
    listing: Listing,
    user: User | None,
) -> AuctionStateOut:
    dl = _normalize_dt(listing.deadline_at)
    now = _now_utc()
    deadline_passed = dl is not None and now > dl
    settled = listing.auction_settled_at is not None

    highest, bid_count, min_next = _auction_metrics(db, listing)

    can_bid = False
    reason: str | None = None
    if listing.deadline_at is None:
        reason = "Не аукционное объявление."
    elif settled or deadline_passed:
        reason = "Аукцион завершён."
    elif user is None:
        reason = "Войдите, чтобы делать ставки."
    elif user.id == listing.user_id:
        reason = "Нельзя делать ставки на своё объявление."
    else:
        ok, msg = _can_participate_auction(db, user)
        if not ok:
            reason = msg
        else:
            can_bid = True
            reason = None

    winner_user_id: int | None = None
    if settled:
        cart_row = (
            db.query(CartItem)
            .filter(CartItem.listing_id == listing.id, CartItem.source == CartItemSource.AUCTION)
            .first()
        )
        if cart_row:
            winner_user_id = cart_row.user_id

    contacts_available = True
    if listing.deadline_at is not None:
        contacts_available = False
        if user is not None and user.id == listing.user_id:
            contacts_available = True
        elif winner_user_id is not None and user is not None and user.id == winner_user_id:
            contacts_available = True

    return AuctionStateOut(
        listing_id=listing.id,
        deadline_at=listing.deadline_at,
        deadline_passed=deadline_passed,
        settled=settled,
        starting_price_som=_starting_price(listing),
        current_highest_bid_som=highest,
        bid_count=bid_count,
        min_next_bid_som=min_next,
        can_bid=can_bid,
        bid_block_reason=reason,
        winner_user_id=winner_user_id,
        contacts_available=contacts_available,
    )


@router.get("/auctions/listings/{listing_id}/state", response_model=AuctionStateOut)
def get_auction_state(
    listing_id: int,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Объявление не найдено")
    if listing.deadline_at is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="У объявления не задан дедлайн аукциона")

    settle_auction_if_needed(db, listing)
    db.refresh(listing)
    return _build_state(db, listing, user)


@router.post("/auctions/listings/{listing_id}/bid", response_model=AuctionStateOut)
def place_bid(
    listing_id: int,
    payload: PlaceBidRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Объявление не найдено")
    if listing.deadline_at is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="У объявления не задан дедлайн аукциона")

    if user.id == listing.user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нельзя делать ставки на своё объявление")

    ok, msg = _can_participate_auction(db, user)
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

    amount = _q2(payload.amount_som)
    okv, msgv = _check_high_bid_verification(user, amount)
    if not okv:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msgv)

    settle_auction_if_needed(db, listing)
    db.refresh(listing)

    if listing.auction_settled_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Аукцион уже завершён")

    dl = _normalize_dt(listing.deadline_at)
    if dl and _now_utc() >= dl:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Время аукциона истекло")

    _, _, min_next = _auction_metrics(db, listing)
    if amount < min_next:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Минимальная ставка: {min_next} сом.",
        )

    db.add(
        AuctionBid(
            listing_id=listing.id,
            user_id=user.id,
            amount_som=amount,
        )
    )
    db.commit()

    return _build_state(db, listing, user)


@router.get("/users/me/cart", response_model=list[CartItemOut])
def get_my_cart(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(CartItem)
        .options(joinedload(CartItem.listing))
        .filter(CartItem.user_id == user.id)
        .order_by(CartItem.created_at.desc())
        .all()
    )
    if not rows:
        return []
    listing_ids = [r.listing_id for r in rows]
    images = load_images_for_listings(db, listing_ids)
    out: list[CartItemOut] = []
    for row in rows:
        lo = listing_to_out(row.listing, images)
        out.append(
            CartItemOut(
                id=row.id,
                listing_id=row.listing_id,
                price_som=row.price_som,
                source=row.source.value,
                created_at=row.created_at,
                listing=lo,
            )
        )
    return out


@router.delete("/users/me/cart/{cart_item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cart_item(
    cart_item_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(CartItem)
        .filter(CartItem.id == cart_item_id, CartItem.user_id == user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Позиция не найдена")
    db.delete(row)
    db.commit()
    return None
