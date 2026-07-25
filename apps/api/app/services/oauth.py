"""Google and Facebook sign-in.

Everything except the credentials is built: the table, the linking rules, the
session issuing and the UI. Turning a provider on is a configuration change —
fill in the client id and secret, restart. See docs/ARCHITECTURE.md for the
exact registration steps.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from authlib.integrations.starlette_client import OAuth
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import OAuthAccount, OAuthProvider, User
from app.services.handles import unique_handle


@dataclass(frozen=True)
class ProviderConfig:
    name: str
    client_id: str
    client_secret: str
    #: OpenID discovery document, or None for providers without one.
    metadata_url: str | None
    authorize_url: str | None
    token_url: str | None
    userinfo_url: str | None
    scope: str

    @property
    def configured(self) -> bool:
        return bool(self.client_id and self.client_secret)


def providers() -> dict[str, ProviderConfig]:
    return {
        "google": ProviderConfig(
            name="google",
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret,
            metadata_url="https://accounts.google.com/.well-known/openid-configuration",
            authorize_url=None,
            token_url=None,
            userinfo_url=None,
            scope="openid email profile",
        ),
        "facebook": ProviderConfig(
            name="facebook",
            client_id=settings.facebook_app_id,
            client_secret=settings.facebook_app_secret,
            metadata_url=None,
            authorize_url="https://www.facebook.com/v19.0/dialog/oauth",
            token_url="https://graph.facebook.com/v19.0/oauth/access_token",
            userinfo_url="https://graph.facebook.com/me?fields=id,name,email",
            scope="email public_profile",
        ),
    }


_oauth: OAuth | None = None


def client(provider: str):
    """Registered lazily so an unconfigured provider never has to exist."""
    global _oauth
    config = providers().get(provider)
    if config is None or not config.configured:
        return None

    if _oauth is None:
        _oauth = OAuth()

    existing = getattr(_oauth, provider, None)
    if existing is not None:
        return existing

    kwargs: dict = {
        "name": provider,
        "client_id": config.client_id,
        "client_secret": config.client_secret,
        "client_kwargs": {"scope": config.scope},
    }
    if config.metadata_url:
        kwargs["server_metadata_url"] = config.metadata_url
    else:
        kwargs["authorize_url"] = config.authorize_url
        kwargs["access_token_url"] = config.token_url
        kwargs["api_base_url"] = "https://graph.facebook.com/v19.0/"
    _oauth.register(**kwargs)
    return getattr(_oauth, provider)


def redirect_uri(provider: str) -> str:
    base = (settings.oauth_redirect_base_url or settings.public_api_url).rstrip("/")
    return f"{base}/auth/oauth/{provider}/callback"


@dataclass
class ProviderIdentity:
    provider: OAuthProvider
    account_id: str
    email: str | None
    email_verified: bool
    display_name: str
    avatar_url: str | None


async def upsert_user(db: AsyncSession, identity: ProviderIdentity) -> User:
    """Find, link or create — in that order.

    Linking by email only happens when the provider says the address is
    verified. An unverified address would let anyone who can type your email
    address into a provider account walk into your library.
    """
    existing = await db.scalar(
        select(OAuthAccount).where(
            OAuthAccount.provider == identity.provider,
            OAuthAccount.provider_account_id == identity.account_id,
        )
    )
    if existing is not None:
        user = await db.scalar(select(User).where(User.id == existing.user_id))
        if user is not None:
            return user

    user: User | None = None
    if identity.email and identity.email_verified:
        user = await db.scalar(
            select(User).where(func.lower(User.email) == identity.email.lower())
        )

    if user is None:
        email = identity.email or f"{identity.provider.value}-{identity.account_id}@oauth.invalid"
        user = User(
            email=email.lower(),
            handle=await unique_handle(db, identity.display_name),
            password_hash=None,
            display_name=identity.display_name,
            avatar_url=identity.avatar_url,
        )
        db.add(user)
        await db.flush()

    db.add(
        OAuthAccount(
            id=uuid.uuid4(),
            user_id=user.id,
            provider=identity.provider,
            provider_account_id=identity.account_id,
            email=identity.email,
        )
    )
    await db.flush()
    return user
