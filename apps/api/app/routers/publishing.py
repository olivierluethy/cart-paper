from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DbSession, MaybeUser
from app.core.security import new_invite_token
from app.models import Book, BookInvite, BookStatus, NotificationType, Page
from app.schemas.book import BookDetail
from app.schemas.common import Ok
from app.schemas.invite import InviteCreate, InviteOut
from app.core.config import settings
from app.services import books as svc
from app.services import mail
from app.services.notifications import notify

router = APIRouter(tags=["publishing"])


def _invite_url(book: Book, token: str) -> str:
    return f"{settings.public_web_url.rstrip('/')}/books/{book.slug}?invite={token}"


def _as_out(book: Book, invite: BookInvite) -> InviteOut:
    return InviteOut(
        id=invite.id,
        token=invite.token,
        url=_invite_url(book, invite.token),
        label=invite.label,
        invited_email=invite.invited_email,
        accepted_count=invite.accepted_count,
        expires_at=invite.expires_at,
        revoked_at=invite.revoked_at,
        created_at=invite.created_at,
    )


# ------------------------------------------------------------------ publishing
@router.post("/books/{ref}/publish", response_model=BookDetail)
async def publish(ref: str, db: DbSession, user: CurrentUser) -> BookDetail:
    book = await svc.load_book(db, ref)
    svc.require_owner(book, user)

    pages = await db.scalars(select(Page).where(Page.book_id == book.id))
    if not any(_has_text(page.content) for page in pages):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "There is nothing to read yet — write at least one page before publishing.",
        )

    book.status = BookStatus.published
    # Keep the first publication date so re-publishing does not rewrite history.
    if book.published_at is None:
        book.published_at = datetime.now(UTC)
    await db.flush()
    await db.refresh(book, ["author"])
    return BookDetail.model_validate(await svc.detail(db, book, user, "owner"))


@router.post("/books/{ref}/unpublish", response_model=BookDetail)
async def unpublish(ref: str, db: DbSession, user: CurrentUser) -> BookDetail:
    """Reversible: the book returns to a private draft, nothing is deleted."""
    book = await svc.load_book(db, ref)
    svc.require_owner(book, user)
    book.status = BookStatus.draft
    await db.flush()
    await db.refresh(book, ["author"])
    return BookDetail.model_validate(await svc.detail(db, book, user, "owner"))


def _has_text(content: dict | None) -> bool:
    if not content:
        return False

    def walk(node: dict) -> bool:
        if node.get("type") == "text" and (node.get("text") or "").strip():
            return True
        if node.get("type") in {"cartImage", "horizontalRule"}:
            return True
        return any(walk(child) for child in node.get("content", []) or [])

    return walk(content)


# --------------------------------------------------------------------- invites
@router.get("/books/{ref}/invites", response_model=list[InviteOut])
async def list_invites(ref: str, db: DbSession, user: CurrentUser) -> list[InviteOut]:
    book = await svc.load_book(db, ref)
    svc.require_owner(book, user)
    rows = await db.scalars(
        select(BookInvite).where(BookInvite.book_id == book.id).order_by(BookInvite.created_at.desc())
    )
    return [_as_out(book, invite) for invite in rows]


@router.post("/books/{ref}/invites", response_model=InviteOut, status_code=status.HTTP_201_CREATED)
async def create_invite(
    ref: str, payload: InviteCreate, db: DbSession, user: CurrentUser
) -> InviteOut:
    """A preview link grants read **and comment** access to a draft.

    Comments are the point of a preview — a reader who cannot answer back is
    just a proofreader.
    """
    book = await svc.load_book(db, ref)
    svc.require_owner(book, user)

    invite = BookInvite(
        book_id=book.id,
        token=new_invite_token(),
        invited_email=payload.invited_email,
        created_by=user.id,
        label=payload.label,
        expires_at=(
            datetime.now(UTC) + timedelta(days=payload.expires_in_days)
            if payload.expires_in_days
            else None
        ),
    )
    db.add(invite)
    await db.flush()

    if invite.invited_email:
        mail.send_invite(invite.invited_email, book.title, _invite_url(book, invite.token))

    return _as_out(book, invite)


@router.delete("/invites/{invite_id}", response_model=Ok)
async def revoke_invite(invite_id: uuid.UUID, db: DbSession, user: CurrentUser) -> Ok:
    invite = await db.scalar(select(BookInvite).where(BookInvite.id == invite_id))
    if invite is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such invite.")
    if invite.created_by != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "That invite is not yours to revoke.")
    invite.revoked_at = datetime.now(UTC)
    return Ok()


@router.post("/invites/{token}/accept", response_model=Ok)
async def accept_invite(token: str, db: DbSession, user: MaybeUser) -> Ok:
    """Called once when an invited reader actually opens the draft."""
    invite = await db.scalar(select(BookInvite).where(BookInvite.token == token))
    if invite is None or invite.revoked_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That preview link is no longer active.")
    if invite.expires_at is not None and invite.expires_at < datetime.now(UTC):
        raise HTTPException(status.HTTP_410_GONE, "That preview link has expired.")

    invite.accepted_count = (invite.accepted_count or 0) + 1
    book = await db.scalar(select(Book).where(Book.id == invite.book_id))
    if book is not None:
        await notify(
            db,
            user_id=book.author_id,
            type=NotificationType.invite_accepted,
            actor_id=user.id if user else None,
            book_id=book.id,
        )
    return Ok()


@router.get("/books/{ref}/invite-count", response_model=dict)
async def invite_count(ref: str, db: DbSession, user: CurrentUser) -> dict:
    book = await svc.load_book(db, ref)
    svc.require_owner(book, user)
    active = await db.scalar(
        select(func.count())
        .select_from(BookInvite)
        .where(BookInvite.book_id == book.id, BookInvite.revoked_at.is_(None))
    )
    return {"active": active or 0}
