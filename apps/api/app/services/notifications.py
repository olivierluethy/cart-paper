"""Notification writes.

Database-backed and delivered by polling — no WebSockets in v1. Everything that
should reach a user goes through :func:`notify`, which quietly drops
self-notifications so nobody is told about their own actions.
"""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Notification, NotificationType


async def notify(
    db: AsyncSession,
    *,
    user_id: uuid.UUID | None,
    type: NotificationType,
    actor_id: uuid.UUID | None = None,
    book_id: uuid.UUID | None = None,
    comment_id: uuid.UUID | None = None,
) -> Notification | None:
    if user_id is None:
        return None
    if actor_id is not None and actor_id == user_id:
        return None
    row = Notification(
        user_id=user_id,
        type=type,
        actor_id=actor_id,
        book_id=book_id,
        comment_id=comment_id,
    )
    db.add(row)
    return row
