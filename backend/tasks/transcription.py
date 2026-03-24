"""Фоновая «транскрипция» голоса (заглушка; в проде — Yandex SpeechKit / Whisper)."""

import logging
import time
from datetime import datetime, timezone

from database import SessionLocal
from models import Listing, TranscriptionStatus

logger = logging.getLogger(__name__)


def run_transcription_stub(listing_id: int) -> None:
    """Синхронная задача для BackgroundTasks."""
    db = SessionLocal()
    try:
        listing = db.query(Listing).filter(Listing.id == listing_id).first()
        if not listing or not listing.voice_url:
            return
        listing.transcription_status = TranscriptionStatus.PROCESSING
        db.commit()

        time.sleep(1.5)

        listing = db.query(Listing).filter(Listing.id == listing_id).first()
        if not listing:
            return
        stub = (
            "[Авто-транскрипция, демо] Заявка озвучена. Полный текст можно уточнить у заказчика в чате. "
            f"Файл: {listing.voice_url[-40:]}"
        )
        if not listing.voice_transcript or listing.voice_transcript.strip() == "":
            listing.voice_transcript = stub
        listing.transcription_status = TranscriptionStatus.DONE
        db.commit()
    except Exception as exc:
        logger.exception("transcription failed: %s", exc)
        try:
            listing = db.query(Listing).filter(Listing.id == listing_id).first()
            if listing:
                listing.transcription_status = TranscriptionStatus.FAILED
                db.commit()
        except Exception:
            pass
    finally:
        db.close()
