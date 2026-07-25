from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel

from app.schemas.annotation import NoteOut
from app.schemas.book import BookSummary
from app.schemas.comment import CommentOut
from app.schemas.user import UserPublic


class ProfileOut(BaseModel):
    user: UserPublic
    published_books: list[BookSummary]
    book_count: int
    average_rating: float
    comment_count: int
    is_me: bool
    stats_visible: bool


class TrailBook(BaseModel):
    id: uuid.UUID
    slug: str
    title: str


class TrailEntry(BaseModel):
    """One step of a reader's thought process, in the order it happened."""

    kind: Literal["comment", "note"]
    at: datetime
    book: TrailBook
    page_index: int | None
    page_id: uuid.UUID | None
    quote: str | None
    comment: CommentOut | None = None
    note: NoteOut | None = None
    reply_to: dict[str, Any] | None = None


class TrailPage(BaseModel):
    items: list[TrailEntry]
    total: int
    limit: int
    offset: int
