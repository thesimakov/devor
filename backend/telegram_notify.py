"""Отправка сообщений в Telegram через Bot API (если задан TELEGRAM_BOT_TOKEN)."""

import os
from typing import Any

import httpx

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()


def send_telegram_message(chat_id: str, text: str, **kwargs: Any) -> bool:
    if not BOT_TOKEN or not chat_id:
        return False
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    try:
        r = httpx.post(url, json={"chat_id": chat_id, "text": text, **kwargs}, timeout=15.0)
        return r.status_code == 200
    except Exception:
        return False


def notify_user_by_id(db, user_id: int, text: str) -> None:
    from models import User

    u = db.query(User).filter(User.id == user_id).first()
    if u and u.telegram_chat_id:
        send_telegram_message(u.telegram_chat_id, text)
