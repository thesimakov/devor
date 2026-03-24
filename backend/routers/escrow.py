"""Тестовый эскроу: удержание на балансе заказчика, выплата исполнителю, споры."""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from dependencies import get_current_staff, get_current_user, get_db
from models import (
    BillingLedger,
    BillingLedgerKind,
    EscrowStatus,
    EscrowTransaction,
    JobWorkflowStatus,
    Listing,
    ListingKind,
    User,
    UserRole,
)
from schemas import (
    AdminEscrowResolveRequest,
    DisputeOpenRequest,
    EscrowCreateRequest,
    EscrowOut,
    EscrowSimulatePayOut,
)
from telegram_notify import notify_user_by_id

router = APIRouter(prefix="/escrow", tags=["escrow"])


def _escrow_to_out(row: EscrowTransaction) -> EscrowOut:
    return EscrowOut(
        id=row.id,
        listing_id=row.listing_id,
        customer_id=row.customer_id,
        executor_id=row.executor_id,
        amount_som=row.amount_som,
        status=row.status,
        payment_ref=row.payment_ref,
        dispute_reason=row.dispute_reason,
        dispute_opened_at=row.dispute_opened_at,
        dispute_resolved_at=row.dispute_resolved_at,
        resolution_note=row.resolution_note,
        created_at=row.created_at,
    )


@router.post("/listings/{listing_id}", response_model=EscrowOut, status_code=status.HTTP_201_CREATED)
def create_escrow_for_listing(
    listing_id: int,
    payload: EscrowCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    if listing.kind != ListingKind.REQUEST:
        raise HTTPException(status_code=400, detail="Эскроу только для заявок заказчика")
    if listing.user_id != user.id:
        raise HTTPException(status_code=403, detail="Создавать оплату может автор заявки")
    if listing.workflow_status != JobWorkflowStatus.IN_PROGRESS:
        raise HTTPException(status_code=400, detail="Сначала назначьте исполнителя")
    if not listing.assigned_executor_id:
        raise HTTPException(status_code=400, detail="Исполнитель не назначен")

    existing = db.query(EscrowTransaction).filter(EscrowTransaction.listing_id == listing_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Эскроу по этой заявке уже создан")

    amt = payload.amount_som
    if amt <= 0:
        raise HTTPException(status_code=400, detail="Сумма должна быть больше 0")

    row = EscrowTransaction(
        listing_id=listing_id,
        customer_id=user.id,
        executor_id=listing.assigned_executor_id,
        amount_som=amt,
        status=EscrowStatus.AWAITING_PAYMENT,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    notify_user_by_id(db, listing.assigned_executor_id, f"По заявке «{listing.title}» создана безопасная оплата на {amt} сом.")
    return _escrow_to_out(row)


@router.get("/listings/{listing_id}", response_model=Optional[EscrowOut])
def get_escrow_for_listing(
    listing_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.query(EscrowTransaction).filter(EscrowTransaction.listing_id == listing_id).first()
    if not row:
        return None
    if user.role not in (UserRole.ADMIN, UserRole.MANAGER) and user.id not in (
        row.customer_id,
        row.executor_id,
    ):
        raise HTTPException(status_code=403, detail="Нет доступа")
    return _escrow_to_out(row)


@router.post("/{escrow_id}/simulate-pay", response_model=EscrowSimulatePayOut)
def simulate_gateway_payment(
    escrow_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.query(EscrowTransaction).filter(EscrowTransaction.id == escrow_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Эскроу не найден")
    if row.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Оплатить может заказчик")
    if row.status != EscrowStatus.AWAITING_PAYMENT:
        raise HTTPException(status_code=400, detail="Оплата недоступна в текущем статусе")

    bal = user.balance_som or Decimal("0")
    if bal < row.amount_som:
        raise HTTPException(
            status_code=400,
            detail=f"Недостаточно средств на кошельке (нужно {row.amount_som} сом). Пополните демо-баланс.",
        )

    user.balance_som = bal - row.amount_som
    db.add(
        BillingLedger(
            user_id=user.id,
            listing_id=row.listing_id,
            delta_som=-row.amount_som,
            balance_after_som=user.balance_som,
            kind=BillingLedgerKind.ESCROW_HOLD,
            note=f"Эскроу удержание по заявке #{row.listing_id}",
            package_id=None,
        )
    )
    ref = f"sim_{uuid4().hex[:16]}"
    row.status = EscrowStatus.FUNDED
    row.payment_ref = ref
    db.commit()
    db.refresh(row)
    notify_user_by_id(db, row.executor_id, f"Заказчик оплатил в эскроу {row.amount_som} сом по заявке #{row.listing_id}.")
    return EscrowSimulatePayOut(escrow=_escrow_to_out(row), payment_ref=ref)


@router.post("/{escrow_id}/confirm-complete")
def confirm_work_completed(
    escrow_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.query(EscrowTransaction).filter(EscrowTransaction.id == escrow_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Эскроу не найден")
    if row.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Подтвердить может заказчик")
    if row.status != EscrowStatus.FUNDED:
        raise HTTPException(status_code=400, detail="Средства не в эскроу или спор")

    executor = db.query(User).filter(User.id == row.executor_id).first()
    if not executor:
        raise HTTPException(status_code=400, detail="Исполнитель не найден")

    executor.balance_som = (executor.balance_som or Decimal("0")) + row.amount_som
    db.add(
        BillingLedger(
            user_id=executor.id,
            listing_id=row.listing_id,
            delta_som=row.amount_som,
            balance_after_som=executor.balance_som,
            kind=BillingLedgerKind.ESCROW_RELEASE,
            note=f"Выплата по эскроу заявка #{row.listing_id}",
            package_id=None,
        )
    )
    row.status = EscrowStatus.RELEASED
    listing = db.query(Listing).filter(Listing.id == row.listing_id).first()
    if listing:
        listing.workflow_status = JobWorkflowStatus.COMPLETED
    db.commit()
    notify_user_by_id(db, row.executor_id, f"Заказчик подтвердил работу. {row.amount_som} сом зачислены на ваш кошелёк.")
    return {"ok": True, "message": "Выплата исполнителю выполнена"}


@router.post("/{escrow_id}/dispute")
def open_dispute(
    escrow_id: int,
    payload: DisputeOpenRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.query(EscrowTransaction).filter(EscrowTransaction.id == escrow_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Эскроу не найден")
    if user.id not in (row.customer_id, row.executor_id):
        raise HTTPException(status_code=403, detail="Спор может открыть участник сделки")
    if row.status != EscrowStatus.FUNDED:
        raise HTTPException(status_code=400, detail="Спор возможен только при удержании средств")
    row.status = EscrowStatus.DISPUTED
    row.dispute_reason = payload.reason
    row.dispute_opened_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}


@router.post("/{escrow_id}/admin-resolve", response_model=EscrowOut)
def admin_resolve_dispute(
    escrow_id: int,
    payload: AdminEscrowResolveRequest,
    user: User = Depends(get_current_staff),
    db: Session = Depends(get_db),
):
    row = db.query(EscrowTransaction).filter(EscrowTransaction.id == escrow_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Эскроу не найден")
    if row.status != EscrowStatus.DISPUTED:
        raise HTTPException(status_code=400, detail="Нет активного спора")

    decision = payload.decision

    customer = db.query(User).filter(User.id == row.customer_id).first()
    executor = db.query(User).filter(User.id == row.executor_id).first()
    if not customer or not executor:
        raise HTTPException(status_code=400, detail="Участники не найдены")

    note = payload.resolution_note or ""

    if decision == "refund":
        customer.balance_som = (customer.balance_som or Decimal("0")) + row.amount_som
        db.add(
            BillingLedger(
                user_id=customer.id,
                listing_id=row.listing_id,
                delta_som=row.amount_som,
                balance_after_som=customer.balance_som,
                kind=BillingLedgerKind.ESCROW_REFUND,
                note=f"Возврат по спору эскроу #{row.id}",
                package_id=None,
            )
        )
        row.status = EscrowStatus.REFUNDED
    else:
        executor.balance_som = (executor.balance_som or Decimal("0")) + row.amount_som
        db.add(
            BillingLedger(
                user_id=executor.id,
                listing_id=row.listing_id,
                delta_som=row.amount_som,
                balance_after_som=executor.balance_som,
                kind=BillingLedgerKind.ESCROW_RELEASE,
                note=f"Выплата по решению админа, эскроу #{row.id}",
                package_id=None,
            )
        )
        row.status = EscrowStatus.RELEASED
        listing = db.query(Listing).filter(Listing.id == row.listing_id).first()
        if listing:
            listing.workflow_status = JobWorkflowStatus.COMPLETED

    row.dispute_resolved_at = datetime.now(timezone.utc)
    row.resolution_note = note
    row.resolved_by_id = user.id
    db.commit()
    db.refresh(row)
    return _escrow_to_out(row)
