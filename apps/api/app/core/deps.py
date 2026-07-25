from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import ACCESS_COOKIE, decode_token
from app.db.session import get_db
from app.models import User

DbSession = Annotated[AsyncSession, Depends(get_db)]


async def _user_from_request(request: Request, db: AsyncSession) -> User | None:
    token = request.cookies.get(ACCESS_COOKIE)
    if not token:
        # Bearer is accepted too — handy for curl and the smoke checks.
        header = request.headers.get("authorization", "")
        if header.lower().startswith("bearer "):
            token = header[7:]
    if not token:
        return None
    user_id = decode_token(token, "access")
    if user_id is None:
        return None
    return await db.scalar(select(User).where(User.id == user_id))


async def current_user_optional(request: Request, db: DbSession) -> User | None:
    """Anonymous visitors are first-class here — published books are public."""
    return await _user_from_request(request, db)


async def current_user(request: Request, db: DbSession) -> User:
    user = await _user_from_request(request, db)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign in to continue.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


CurrentUser = Annotated[User, Depends(current_user)]
MaybeUser = Annotated[User | None, Depends(current_user_optional)]


def invite_token_from(request: Request) -> str | None:
    """Draft previews carry their invite token as a query param or header."""
    return request.query_params.get("invite") or request.headers.get("x-cart-invite")


InviteToken = Annotated[str | None, Depends(invite_token_from)]


def parse_uuid(value: str, what: str = "id") -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Malformed {what}.") from exc
