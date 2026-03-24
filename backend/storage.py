import os
from pathlib import Path
from uuid import uuid4

import boto3
from fastapi import HTTPException, UploadFile, status


STORAGE_MODE = os.getenv("STORAGE_MODE", "local")  # local | s3
MEDIA_ROOT = Path(os.getenv("MEDIA_ROOT", "media"))
MEDIA_URL_PREFIX = os.getenv("MEDIA_URL_PREFIX", "/media")

S3_BUCKET = os.getenv("S3_BUCKET", "")
S3_REGION = os.getenv("S3_REGION", "eu-central-1")
S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL") or None
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")


def _build_filename(original_name: str) -> str:
    ext = Path(original_name).suffix.lower() or ".jpg"
    return f"{uuid4().hex}{ext}"


def _validate_image(file: UploadFile) -> None:
    allowed = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Разрешены только JPEG, PNG, WEBP",
        )


def save_verification_document(file: UploadFile) -> str:
    """Фото паспорта / селфи для верификации исполнителя."""
    _validate_image(file)
    if STORAGE_MODE == "s3":
        return _save_verification_to_s3(file)
    return _save_verification_to_local(file)


def _save_verification_to_local(file: UploadFile) -> str:
    MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
    filename = _build_filename(file.filename or "doc.jpg")
    relative = f"verification/{filename}"
    output_path = MEDIA_ROOT / "verification"
    output_path.mkdir(parents=True, exist_ok=True)
    destination = output_path / filename
    with destination.open("wb") as f:
        f.write(file.file.read())
    return f"{MEDIA_URL_PREFIX}/{relative}"


def _save_verification_to_s3(file: UploadFile) -> str:
    if not S3_BUCKET:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="S3_BUCKET не задан")
    filename = _build_filename(file.filename or "doc.jpg")
    key = f"verification/{filename}"
    client = boto3.client(
        "s3",
        region_name=S3_REGION,
        endpoint_url=S3_ENDPOINT_URL,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    )
    client.upload_fileobj(
        file.file,
        S3_BUCKET,
        key,
        ExtraArgs={"ContentType": file.content_type},
    )
    if S3_ENDPOINT_URL:
        return f"{S3_ENDPOINT_URL.rstrip('/')}/{S3_BUCKET}/{key}"
    return f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{key}"


def save_listing_image(file: UploadFile) -> str:
    _validate_image(file)
    if STORAGE_MODE == "s3":
        return _save_to_s3(file)
    return _save_to_local(file)


def _save_to_local(file: UploadFile) -> str:
    MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
    filename = _build_filename(file.filename or "image.jpg")
    relative = f"listings/{filename}"
    output_path = MEDIA_ROOT / "listings"
    output_path.mkdir(parents=True, exist_ok=True)
    destination = output_path / filename

    with destination.open("wb") as f:
        f.write(file.file.read())

    return f"{MEDIA_URL_PREFIX}/{relative}"


def _save_to_s3(file: UploadFile) -> str:
    if not S3_BUCKET:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="S3_BUCKET не задан")

    filename = _build_filename(file.filename or "image.jpg")
    key = f"listings/{filename}"
    client = boto3.client(
        "s3",
        region_name=S3_REGION,
        endpoint_url=S3_ENDPOINT_URL,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    )
    client.upload_fileobj(
        file.file,
        S3_BUCKET,
        key,
        ExtraArgs={"ContentType": file.content_type},
    )

    if S3_ENDPOINT_URL:
        return f"{S3_ENDPOINT_URL.rstrip('/')}/{S3_BUCKET}/{key}"
    return f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{key}"


def _validate_voice(file: UploadFile) -> None:
    allowed = {"audio/webm", "audio/mpeg", "audio/mp3", "audio/ogg", "audio/wav", "audio/x-wav"}
    ct = (file.content_type or "").split(";")[0].strip().lower()
    if ct not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Разрешены аудио: WebM, MP3, OGG, WAV",
        )


def save_listing_voice(file: UploadFile) -> str:
    """Сохранение голосового по заявке (локально или S3 — как и фото)."""
    _validate_voice(file)
    if STORAGE_MODE == "s3":
        return _save_voice_to_s3(file)
    return _save_voice_to_local(file)


def _save_voice_to_local(file: UploadFile) -> str:
    MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename or "voice.webm").suffix.lower()
    if ext not in (".webm", ".mp3", ".ogg", ".wav", ".mpeg"):
        ext = ".webm"
    filename = f"{uuid4().hex}{ext}"
    relative = f"voices/{filename}"
    output_path = MEDIA_ROOT / "voices"
    output_path.mkdir(parents=True, exist_ok=True)
    destination = output_path / filename
    with destination.open("wb") as f:
        f.write(file.file.read())
    return f"{MEDIA_URL_PREFIX}/{relative}"


def _save_voice_to_s3(file: UploadFile) -> str:
    if not S3_BUCKET:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="S3_BUCKET не задан")
    ext = Path(file.filename or "voice.webm").suffix.lower() or ".webm"
    filename = f"{uuid4().hex}{ext}"
    key = f"voices/{filename}"
    client = boto3.client(
        "s3",
        region_name=S3_REGION,
        endpoint_url=S3_ENDPOINT_URL,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    )
    content_type = file.content_type or "audio/webm"
    client.upload_fileobj(
        file.file,
        S3_BUCKET,
        key,
        ExtraArgs={"ContentType": content_type.split(";")[0].strip()},
    )
    if S3_ENDPOINT_URL:
        return f"{S3_ENDPOINT_URL.rstrip('/')}/{S3_BUCKET}/{key}"
    return f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{key}"
