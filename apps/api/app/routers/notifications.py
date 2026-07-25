from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DbSession
from app.models import Comment, Notification, Page
from app.schemas.common import Ok
from app.schemas.notification import NotificationOut, UnreadCount

router = APIRouter(prefix="/notifications", tags=["notifications"])

EXCERPT_CHARS = 140


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    db: DbSession,
    user: CurrentUser,
    limit: int = Query(30, ge=1, le=100),
    unread_only: bool = False,
) -> list[NotificationOut]:
    query = (
        select(Notification)
        .options(selectinload(Notification.actor), selectinload(Notification.book))
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    if unread_only:
        query = query.where(Notification.read_at.is_(None))
    rows = list(await db.scalars(query))

    comment_ids = [row.comment_id for row in rows if row.comment_id]
    comments = {
        comment.id: comment
        for comment in await db.scalars(select(Comment).where(Comment.id.in_(comment_ids or [None])))
    }
    page_indexes = {
        page_id: index
        for page_id, index in await db.execute(
            select(Page.id, Page.index).where(
                Page.id.in_([c.page_id for c in comments.values() if c.page_id] or [None])
            )
        )
    }

    out: list[NotificationOut] = []
    for row in rows:
        comment = comments.get(row.comment_id) if row.comment_id else None
        excerpt = None
        if comment is not None and not comment.is_deleted:
            body = comment.body.strip().replace("\n", " ")
            excerpt = body[: EXCERPT_CHARS - 1] + "…" if len(body) > EXCERPT_CHARS else body
        out.append(
            NotificationOut(
                id=row.id,
                type=row.type.value if hasattr(row.type, "value") else row.type,
                actor=row.actor,
                book=(
                    {"id": row.book.id, "slug": row.book.slug, "title": row.book.title}
                    if row.book
                    else None
                ),
                comment_id=row.comment_id,
                page_id=comment.page_id if comment else None,
                page_index=page_indexes.get(comment.page_id) if comment and comment.page_id else None,
                excerpt=excerpt,
                quote=(comment.anchor or {}).get("quote") if comment and comment.anchor else None,
                read_at=row.read_at,
                created_at=row.created_at,
            )
        )
    return out


@router.get("/unread-count", response_model=UnreadCount)
async def unread_count(db: DbSession, user: CurrentUser) -> UnreadCount:
    """Polled every 60s and on focus — deliberately the cheapest query here."""
    count = await db.scalar(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user.id, Notification.read_at.is_(None))
    )
    return UnreadCount(unread=count or 0)


@router.post("/read", response_model=Ok)
async def mark_all_read(db: DbSession, user: CurrentUser) -> Ok:
    now = datetime.now(UTC)
    rows = await db.scalars(
        select(Notification).where(
            Notification.user_id == user.id, Notification.read_at.is_(None)
        )
    )
    for row in rows:
        row.read_at = now
    return Ok()


@router.post("/{notification_id}/read", response_model=Ok)
async def mark_read(notification_id: uuid.UUID, db: DbSession, user: CurrentUser) -> Ok:
    row = await db.scalar(select(Notification).where(Notification.id == notification_id))
    if row is None or row.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such notification.")
    row.read_at = row.read_at or datetime.now(UTC)
    return Ok()
