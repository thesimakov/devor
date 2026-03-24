from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import os
from random import randint

import httpx
import jwt
from fastapi import HTTPException, status
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from models import User, UserRole, VerificationLevel
from schemas import PHONE_REGEX


JWT_SECRET = "devor-super-secret-key-change-me"
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60 * 24 * 7
JWT_SECRET = os.getenv("JWT_SECRET", JWT_SECRET)
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", str(JWT_EXPIRE_MINUTES)))

OTP_STORE: dict[str, str] = {}
OTP_TTL_SECONDS = int(os.getenv("OTP_TTL_SECONDS", "300"))

SMS_PROVIDER = os.getenv("SMS_PROVIDER", "twilio_verify")
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_VERIFY_SERVICE_SID = os.getenv("TWILIO_VERIFY_SERVICE_SID", "")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@dataclass
class SMSCodeSendResult:
    success: bool
    expires_in_sec: int = OTP_TTL_SECONDS


def normalize_phone(phone: str) -> str:
    import re

    if not re.match(PHONE_REGEX, phone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Телефон должен быть в формате +992 ** *** ** **",
        )
    return phone


def _request_sms_code_mock(phone: str) -> SMSCodeSendResult:
    phone = normalize_phone(phone)
    code = str(randint(1000, 9999))
    OTP_STORE[phone] = code
    if os.getenv("SHOW_DEBUG_OTP", "false").lower() == "true":
        print(f"[DEBUG OTP] {phone} -> {code}")
    return SMSCodeSendResult(success=True, expires_in_sec=OTP_TTL_SECONDS)


def _verify_sms_code_mock(phone: str, code: str) -> bool:
    phone = normalize_phone(phone)
    stored = OTP_STORE.get(phone)
    if not stored or stored != code:
        return False
    OTP_STORE.pop(phone, None)
    return True


def _request_sms_code_twilio_verify(phone: str) -> SMSCodeSendResult:
    phone = normalize_phone(phone)
    if not (TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_VERIFY_SERVICE_SID):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не настроен SMS провайдер Twilio Verify",
        )

    url = f"https://verify.twilio.com/v2/Services/{TWILIO_VERIFY_SERVICE_SID}/Verifications"
    response = httpx.post(
        url,
        auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN),
        data={"To": phone, "Channel": "sms"},
        timeout=20.0,
    )
    if response.status_code >= 400:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Ошибка SMS провайдера")
    return SMSCodeSendResult(success=True, expires_in_sec=OTP_TTL_SECONDS)


def _verify_sms_code_twilio_verify(phone: str, code: str) -> bool:
    phone = normalize_phone(phone)
    if not (TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_VERIFY_SERVICE_SID):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не настроен SMS провайдер Twilio Verify",
        )

    url = f"https://verify.twilio.com/v2/Services/{TWILIO_VERIFY_SERVICE_SID}/VerificationCheck"
    response = httpx.post(
        url,
        auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN),
        data={"To": phone, "Code": code},
        timeout=20.0,
    )
    if response.status_code >= 400:
        return False

    payload = response.json()
    return payload.get("status") == "approved"


def request_sms_code(phone: str) -> SMSCodeSendResult:
    if SMS_PROVIDER == "mock":
        return _request_sms_code_mock(phone)
    return _request_sms_code_twilio_verify(phone)


def verify_sms_code(phone: str, code: str) -> bool:
    if SMS_PROVIDER == "mock":
        return _verify_sms_code_mock(phone, code)
    return _verify_sms_code_twilio_verify(phone, code)


def get_or_create_user(db: Session, phone: str, name: str | None = None) -> User:
    phone = normalize_phone(phone)
    user = db.query(User).filter(User.phone == phone).first()
    if user:
        if name and not user.name:
            user.name = name
            db.commit()
            db.refresh(user)
        return user

    user = User(
        login=f"user_{phone.replace(' ', '').replace('+', '')}",
        password_hash=hash_password("change_me_123"),
        phone=phone,
        name=name or "Пользователь",
        role=UserRole.USER,
        verification_level=VerificationLevel.PHONE,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def register_user(db: Session, login: str, password: str, name: str | None = None) -> User:
    existing = db.query(User).filter(User.login == login).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Логин уже занят")

    user = User(
        login=login,
        password_hash=hash_password(password),
        name=name or login,
        role=UserRole.USER,
        phone=None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, login: str, password: str) -> User:
    user = db.query(User).filter(User.login == login).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный логин или пароль")
    return user


def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "login": user.login,
        "phone": user.phone,
        "role": user.role.value,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=JWT_EXPIRE_MINUTES)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный токен") from exc
