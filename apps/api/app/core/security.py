from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from fastapi import Response

from app.core.config import settings

ACCESS_COOKIE = "cp_access"
REFRESH_COOKIE = "cp_refresh"
ALGORITHM = "HS256"

_hasher = PasswordHasher()

TokenKind = Literal["access", "refresh"]


# --------------------------------------------------------------------------- passwords
def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        _hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False
    return True


def needs_rehash(password_hash: str) -> bool:
    try:
        return _hasher.check_needs_rehash(password_hash)
    except InvalidHashError:
        return True


# --------------------------------------------------------------------------- tokens
def _lifetime(kind: TokenKind) -> timedelta:
    if kind == "access":
        return timedelta(minutes=settings.access_token_minutes)
    return timedelta(days=settings.refresh_token_days)


def create_token(user_id: uuid.UUID, kind: TokenKind) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "kind": kind,
        "iat": int(now.timestamp()),
        "exp": int((now + _lifetime(kind)).timestamp()),
        "jti": secrets.token_urlsafe(12),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_token(token: str, expect: TokenKind) -> uuid.UUID | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None
    if payload.get("kind") != expect:
        return None
    try:
        return uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        return None


# --------------------------------------------------------------------------- cookies
def _cookie_kwargs(max_age: int) -> dict[str, Any]:
    return {
        "httponly": True,
        "secure": settings.cookie_secure,
        "samesite": settings.cookie_samesite,
        "max_age": max_age,
        "path": "/",
    }


def set_auth_cookies(response: Response, user_id: uuid.UUID) -> None:
    """Both tokens are httpOnly — the browser never sees them from JS."""
    response.set_cookie(
        ACCESS_COOKIE,
        create_token(user_id, "access"),
        **_cookie_kwargs(settings.access_token_minutes * 60),
    )
    response.set_cookie(
        REFRESH_COOKIE,
        create_token(user_id, "refresh"),
        **_cookie_kwargs(settings.refresh_token_days * 24 * 3600),
    )


def clear_auth_cookies(response: Response) -> None:
    for name in (ACCESS_COOKIE, REFRESH_COOKIE):
        response.delete_cookie(
            name,
            path="/",
            httponly=True,
            secure=settings.cookie_secure,
            samesite=settings.cookie_samesite,
        )


def new_invite_token() -> str:
    return secrets.token_urlsafe(24)
