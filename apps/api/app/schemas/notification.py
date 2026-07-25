from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.schemas.common import ORMModel
from app.schemas.user import UserPublic


class NotificationOut(ORMModel):
    id: uuid.UUID
    type: str
    actor: UserPublic | None
    book: dict[str, Any] | None
    comment_id: uuid.UUID | None
    page_id: uuid.UUID | None
    page_index: int | None
    excerpt: str | None
    quote: str | None
    read_at: datetime | None
    created_at: datetime


class UnreadCount(BaseModel):
    unread: int
