"""
Telegram-бот: привязка аккаунта по /start <token> (токен из POST /integrations/telegram/link-request).

Запуск локально:
  export TELEGRAM_BOT_TOKEN=...
  export TELEGRAM_BOT_USERNAME=YourBotName
  python telegram_bot.py

В Docker см. docker-compose сервис telegram.
"""

import logging
import os
import sys
from datetime import datetime, timezone

from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

# импорт моделей после настройки cwd
sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal
from models import TelegramLinkToken, User

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return
    if not context.args:
        await update.message.reply_text(
            "Привет! Откройте приложение Devor и нажмите «Получить код в Telegram», затем перейдите по ссылке."
        )
        return

    token = context.args[0].strip()
    db = SessionLocal()
    try:
        row = db.query(TelegramLinkToken).filter(TelegramLinkToken.token == token).first()
        now = datetime.now(timezone.utc)
        if not row or row.used_at is not None or row.expires_at < now:
            await update.message.reply_text("Ссылка недействительна или истекла. Запросите новую в приложении.")
            return

        user = db.query(User).filter(User.id == row.user_id).first()
        if not user:
            await update.message.reply_text("Пользователь не найден.")
            return

        chat_id = str(update.effective_chat.id)
        user.telegram_chat_id = chat_id
        if update.effective_user and update.effective_user.username:
            user.telegram_username = update.effective_user.username
        row.used_at = now
        db.commit()
        await update.message.reply_text("✅ Telegram привязан. Буду присылать уведомления о заявках и сообщениях.")
    except Exception as exc:
        logger.exception(exc)
        await update.message.reply_text("Ошибка привязки. Попробуйте позже.")
    finally:
        db.close()


def main() -> None:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    if not token:
        logger.error("Задайте TELEGRAM_BOT_TOKEN")
        sys.exit(1)
    app = Application.builder().token(token).build()
    app.add_handler(CommandHandler("start", start))
    logger.info("Telegram-бот запущен (polling)")
    app.run_polling()


if __name__ == "__main__":
    main()
