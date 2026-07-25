from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.book import BookSummary, ProgressOut


class ProgressIn(BaseModel):
    page_id: uuid.UUID | None = None
    anchor: dict[str, Any] | None = None
    percent: float = Field(default=0.0, ge=0.0, le=1.0)


class HeartbeatIn(BaseModel):
    """Sent every 15s while the reader is visible and focused."""

    seconds: int = Field(default=15, ge=1, le=120)
    pages_turned: int = Field(default=0, ge=0, le=200)


class ContinueReading(ProgressOut):
    book: BookSummary


class BookStats(BaseModel):
    book: dict[str, Any]
    active_seconds: int
    sessions: int
    pages_turned: int
    last_read_at: datetime | None


class ReadingStats(BaseModel):
    total_seconds: int
    sessions: int
    pages_turned: int
    longest_streak_days: int
    current_streak_days: int
    average_session_seconds: int
    books_started: int
    books: list[BookStats]
