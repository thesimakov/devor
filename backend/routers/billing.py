from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from dependencies import get_current_user, get_db
from listing_presenters import listing_to_out, load_images_for_listings
from models import BillingLedger, BillingLedgerKind, Listing, ListingStatus, User
from monetization import (
    DEMO_TOPUP_ENABLED,
    MAX_TOPUP_SOM,
    MIN_TOPUP_SOM,
    PROMOTION_PACKAGES,
    TOPUP_PRESETS_SOM,
    get_promotion_package,
)
from schemas import (
    BillingLedgerOut,
    ListingOut,
    PromoteListingRequest,
    PromotionPackageOut,
    TopUpDemoRequest,
    WalletOut,
)

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/packages", response_model=list[PromotionPackageOut])
def list_promotion_packages():
    return [PromotionPackageOut(**pkg) for pkg in PROMOTION_PACKAGES]


@router.get("/topup-presets", response_model=list[int])
def list_topup_presets():
    return TOPUP_PRESETS_SOM


@router.get("/wallet", response_model=WalletOut)
def get_wallet(user: User = Depends(get_current_user)):
    return WalletOut(balance_som=user.balance_som, demo_topup_enabled=DEMO_TOPUP_ENABLED)


@router.get("/wallet/ledger", response_model=list[BillingLedgerOut])
def get_ledger(
    limit: int = Query(default=40, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(BillingLedger)
        .filter(BillingLedger.user_id == user.id)
        .order_by(BillingLedger.id.desc())
        .limit(limit)
        .all()
    )
    return rows


@router.post("/wallet/topup-demo", response_model=WalletOut)
def topup_demo_wallet(
    payload: TopUpDemoRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not DEMO_TOPUP_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Демо-пополнение отключено. Подключите платежи (DEVOR_DEMO_TOPUP=false).",
        )
    amt = payload.amount_som
    if amt < MIN_TOPUP_SOM or amt > MAX_TOPUP_SOM:
        raise HTTPException(status_code=400, detail="Сумма вне допустимого диапазона")

    user.balance_som = (user.balance_som or Decimal("0")) + amt
    db.add(
        BillingLedger(
            user_id=user.id,
            listing_id=None,
            delta_som=amt,
            balance_after_som=user.balance_som,
            kind=BillingLedgerKind.TOPUP_DEMO,
            note=f"Демо-пополнение +{amt} сом.",
            package_id=None,
        )
    )
    db.commit()
    db.refresh(user)
    return WalletOut(balance_som=user.balance_som, demo_topup_enabled=DEMO_TOPUP_ENABLED)


@router.post("/listings/{listing_id}/promote", response_model=ListingOut)
def promote_listing(
    listing_id: int,
    payload: PromoteListingRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pkg = get_promotion_package(payload.package_id)
    if not pkg:
        raise HTTPException(status_code=400, detail="Неизвестный пакет продвижения")

    price: Decimal = pkg["price_som"]
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Объявление не найдено")
    if listing.user_id != user.id:
        raise HTTPException(status_code=403, detail="Можно продвигать только свои объявления")
    if listing.status != ListingStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Нельзя продвигать неактивное объявление")

    balance = user.balance_som or Decimal("0")
    if balance < price:
        raise HTTPException(
            status_code=400,
            detail=f"Недостаточно средств. Нужно {price} сом., на счёте {balance} сом.",
        )

    now = datetime.now(timezone.utc)
    base = listing.promoted_until if listing.promoted_until and listing.promoted_until > now else now
    listing.promoted_until = base + timedelta(days=int(pkg["days"]))

    user.balance_som = balance - price
    db.add(
        BillingLedger(
            user_id=user.id,
            listing_id=listing.id,
            delta_som=-price,
            balance_after_som=user.balance_som,
            kind=BillingLedgerKind.PROMOTION,
            note=f'Продвижение «{pkg["title"]}» ({pkg["days"]} дн.)',
            package_id=pkg["id"],
        )
    )
    db.commit()
    db.refresh(listing)
    db.refresh(user)

    images = load_images_for_listings(db, [listing.id])
    return listing_to_out(listing, images)
