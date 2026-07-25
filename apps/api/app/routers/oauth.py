from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.config import settings
from app.core.deps import CurrentUser, DbSession
from app.core.security import set_auth_cookies
from app.models import OAuthAccount, OAuthProvider
from app.schemas.common import Ok
from app.services.oauth import ProviderIdentity, client, providers, redirect_uri, upsert_user

router = APIRouter(prefix="/auth", tags=["auth"])


class ProviderOut(BaseModel):
    provider: str
    configured: bool
    label: str


class LinkedAccountOut(BaseModel):
    id: uuid.UUID
    provider: str
    email: str | None
    created_at: str


LABELS = {"google": "Google", "facebook": "Facebook"}


@router.get("/providers", response_model=list[ProviderOut])
async def list_providers() -> list[ProviderOut]:
    """The UI asks before rendering, so a dead button is never shown as live."""
    return [
        ProviderOut(provider=name, configured=config.configured, label=LABELS.get(name, name.title()))
        for name, config in providers().items()
    ]


@router.get("/oauth/{provider}/start")
async def start(provider: str, request: Request):
    config = providers().get(provider)
    if config is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown provider.")
    if not config.configured:
        # Explicitly "not built yet" rather than a generic failure.
        raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "provider_not_configured")

    oauth_client = client(provider)
    return await oauth_client.authorize_redirect(request, redirect_uri(provider))


@router.get("/oauth/{provider}/callback")
async def callback(provider: str, request: Request, db: DbSession):
    config = providers().get(provider)
    if config is None or not config.configured:
        raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "provider_not_configured")

    oauth_client = client(provider)
    try:
        token = await oauth_client.authorize_access_token(request)
    except Exception as exc:  # noqa: BLE001 — a failed consent must not 500
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That sign-in did not complete.") from exc

    identity = await _identity(provider, oauth_client, token)
    user = await upsert_user(db, identity)

    # Exactly the same session a password login issues — same cookies, same
    # lifetimes, so everything downstream is oblivious to how you signed in.
    response = RedirectResponse(url=settings.public_web_url.rstrip("/") + "/", status_code=302)
    set_auth_cookies(response, user.id)
    return response


async def _identity(provider: str, oauth_client, token: dict) -> ProviderIdentity:
    if provider == "google":
        info = token.get("userinfo") or await oauth_client.userinfo(token=token)
        return ProviderIdentity(
            provider=OAuthProvider.google,
            account_id=str(info["sub"]),
            email=info.get("email"),
            email_verified=bool(info.get("email_verified")),
            display_name=info.get("name") or info.get("email") or "Reader",
            avatar_url=info.get("picture"),
        )

    response = await oauth_client.get("me?fields=id,name,email", token=token)
    info = response.json()
    return ProviderIdentity(
        provider=OAuthProvider.facebook,
        account_id=str(info["id"]),
        email=info.get("email"),
        # Facebook only returns an address it has already verified.
        email_verified=bool(info.get("email")),
        display_name=info.get("name") or "Reader",
        avatar_url=None,
    )


@router.get("/linked", response_model=list[LinkedAccountOut])
async def linked(db: DbSession, user: CurrentUser) -> list[LinkedAccountOut]:
    rows = await db.scalars(
        select(OAuthAccount).where(OAuthAccount.user_id == user.id).order_by(OAuthAccount.created_at)
    )
    return [
        LinkedAccountOut(
            id=row.id,
            provider=row.provider.value if hasattr(row.provider, "value") else row.provider,
            email=row.email,
            created_at=row.created_at.isoformat(),
        )
        for row in rows
    ]


@router.delete("/linked/{account_id}", response_model=Ok)
async def unlink(account_id: uuid.UUID, db: DbSession, user: CurrentUser) -> Ok:
    row = await db.scalar(select(OAuthAccount).where(OAuthAccount.id == account_id))
    if row is None or row.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such connected account.")

    others = await db.scalar(
        select(func.count())
        .select_from(OAuthAccount)
        .where(OAuthAccount.user_id == user.id, OAuthAccount.id != account_id)
    )
    # Disconnecting the only way in would lock the account out entirely.
    if not user.password_hash and not others:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This is the only way you can sign in. Set a password first.",
        )

    await db.delete(row)
    return Ok()

