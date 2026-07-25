from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.book import Book


DEFAULT_READING_SETTINGS: dict[str, Any] = {
    "font_size": 18,
    "line_height": 1.75,
    "width": 34,
    "typeface": "serif",
    "hide_statistics": False,
}


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    handle: Mapped[str] = mapped_column(String(48), unique=True, index=True, nullable=False)
    # Nullable: an account created through Google or Facebook has no password.
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    stats_visible: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    reading_settings: Mapped[dict[str, Any]] = mapped_column(
        JSONB, default=lambda: dict(DEFAULT_READING_SETTINGS), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    books: Mapped[list["Book"]] = relationship(
        back_populates="author", cascade="all, delete-orphan", passive_deletes=True
    )
