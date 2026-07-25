from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel
from app.schemas.user import UserPublic


class CommentIn(BaseModel):
    body: str = Field(min_length=1, max_length=8000)
    page_id: uuid.UUID | None = None
    parent_id: uuid.UUID | None = None
    anchor: dict[str, Any] | None = None


class CommentUpdate(BaseModel):
    body: str = Field(min_length=1, max_length=8000)


class CommentOut(ORMModel):
    id: uuid.UUID
    book_id: uuid.UUID
    page_id: uuid.UUID | None
    parent_id: uuid.UUID | None
    thread_id: uuid.UUID | None
    author: UserPublic | None
    body: str
    anchor: dict[str, Any] | None
    is_deleted: bool
    created_at: datetime
    edited_at: datetime | None
    reply_count: int = 0


class CommentThread(BaseModel):
    root: CommentOut
    replies: list[CommentOut] = Field(default_factory=list)
