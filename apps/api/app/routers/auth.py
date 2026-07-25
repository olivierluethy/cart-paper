from __future__ import annotations

import secrets

from fastapi import APIRouter, HTTPException, Request, Response, status
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DbSession
from app.core.security import (
    REFRESH_COOKIE,
    clear_auth_cookies,
    decode_token,
    hash_password,
    needs_rehash,
    set_auth_cookies,
    verify_password,
)
from app.models import User
from app.schemas.common import Ok
from app.schemas.user import (
    LoginIn,
    PasswordResetIn,
    ProfileUpdate,
    ReadingSettingsIn,
    RegisterIn,
    UserMe,
)
from app.services import mail
from app.services.handles import unique_handle
from app.services.password_policy import validate as validate_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserMe, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterIn, response: Response, db: DbSession) -> User:
    """One step: create the account **and** return an authenticated session.

    There is no confirmation mail and no second login form — the caller is
    signed in by the time this responds.
    """
    problem = validate_password(payload.password)
    if problem:
        # Field-level, so the form can point at the password input itself.
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            [{"loc": ["body", "password"], "msg": problem, "type": "value_error"}],
        )

    email = payload.email.strip().lower()
    existing = await db.scalar(select(User.id).where(func.lower(User.email) == email))
    if existing is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "An account already exists for that email. Sign in instead.",
        )

    user = User(
        email=email,
        handle=await unique_handle(db, payload.display_name),
        password_hash=hash_password(payload.password),
        display_name=payload.display_name.strip(),
    )
    db.add(user)
    await db.flush()
    set_auth_cookies(response, user.id)
    return user


@router.post("/login", response_model=UserMe)
async def login(payload: LoginIn, response: Response, db: DbSession) -> User:
    email = payload.email.strip().lower()
    user = await db.scalar(select(User).where(func.lower(User.email) == email))
    if user is None or not verify_password(payload.password, user.password_hash):
        # Same message either way — do not leak which emails exist.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "That email and password do not match.")
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(payload.password)
    set_auth_cookies(response, user.id)
    return user


@router.post("/logout", response_model=Ok)
async def logout(response: Response) -> Ok:
    clear_auth_cookies(response)
    return Ok()


@router.post("/refresh", response_model=UserMe)
async def refresh(request: Request, response: Response, db: DbSession) -> User:
    token = request.cookies.get(REFRESH_COOKIE)
    user_id = decode_token(token, "refresh") if token else None
    user = await db.scalar(select(User).where(User.id == user_id)) if user_id else None
    if user is None:
        clear_auth_cookies(response)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Your session has expired.")
    set_auth_cookies(response, user.id)
    return user


@router.get("/me", response_model=UserMe)
async def me(user: CurrentUser) -> User:
    return user


@router.patch("/me", response_model=UserMe)
async def update_me(payload: ProfileUpdate, user: CurrentUser) -> User:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    return user


@router.patch("/me/reading-settings", response_model=UserMe)
async def update_reading_settings(payload: ReadingSettingsIn, user: CurrentUser) -> User:
    merged = dict(user.reading_settings or {})
    merged.update(payload.model_dump(exclude_unset=True))
    user.reading_settings = merged
    return user


@router.post("/forgot-password", response_model=Ok)
async def forgot_password(payload: PasswordResetIn, db: DbSession) -> Ok:
    """Stub: mints a token and logs it. Real delivery is deferred for v1."""
    user = await db.scalar(select(User).where(func.lower(User.email) == payload.email.lower()))
    if user is not None:
        mail.send_password_reset(user.email, secrets.token_urlsafe(24))
    # Always ok, so the endpoint cannot be used to enumerate accounts.
    return Ok()
