"""Привязка Telegram: одноразовая ссылка https://t.me/<bot>?start=<token>."""

import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from dependencies import get_current_user, get_db
from models import TelegramLinkToken, User
from schemas import TelegramLinkStartOut

router = APIRouter(prefix="/integrations/telegram", tags=["integrations"])

BOT_USERNAME = os.getenv("TELEGRAM_BOT_USERNAME", "DevorLocalBot").lstrip("@")


@router.post("/link-request", response_model=TelegramLinkStartOut)
def request_telegram_link(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not os.getenv("TELEGRAM_BOT_TOKEN"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Telegram-бот не настроен (TELEGRAM_BOT_TOKEN)",
        )
    token = secrets.token_hex(24)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    db.add(TelegramLinkToken(user_id=user.id, token=token, expires_at=expires_at))
    db.commit()
    deep_link = f"https://t.me/{BOT_USERNAME}?start={token}"
    return TelegramLinkStartOut(
        bot_username=BOT_USERNAME,
        start_param=token,
        deep_link=deep_link,
        expires_at=expires_at,
    )
