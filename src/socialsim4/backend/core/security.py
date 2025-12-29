from __future__ import annotations

from datetime import datetime, timedelta, timezone

import bcrypt
from jose import jwt

from .config import get_settings

settings = get_settings()

_MAX_PASSWORD_BYTES = 72


def _normalize_password(password: str) -> bytes:
    encoded = password.encode("utf-8")
    if len(encoded) > _MAX_PASSWORD_BYTES:
        raise ValueError("password must be at most 72 bytes when encoded as utf-8")
    return encoded


def create_access_token(subject: str, expires_delta: timedelta | None = None) -> tuple[str, datetime]:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_exp_minutes)
    )
    payload = {"sub": subject, "exp": expire}
    token = jwt.encode(
        payload,
        settings.jwt_signing_key.get_secret_value(),
        algorithm=settings.jwt_algorithm,
    )
    return token, expire


def create_refresh_token(subject: str) -> tuple[str, datetime]:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.refresh_token_exp_minutes
    )
    payload = {"sub": subject, "exp": expire, "type": "refresh"}
    token = jwt.encode(
        payload,
        settings.jwt_signing_key.get_secret_value(),
        algorithm=settings.jwt_algorithm,
    )
    return token, expire


def verify_password(plain_password: str, hashed_password: str) -> bool:
    encoded = _normalize_password(plain_password)
    return bcrypt.checkpw(encoded, hashed_password.encode("utf-8"))


def hash_password(password: str) -> str:
    encoded = _normalize_password(password)
    hashed = bcrypt.hashpw(encoded, bcrypt.gensalt())
    return hashed.decode("utf-8")
