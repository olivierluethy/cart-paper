from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.book import _enum
from app.models.enums import AttachmentKind, HighlightColor

if TYPE_CHECKING:
    from app.models.user import User


class Comment(Base):
    """Book-level when ``anchor`` is null; anchored to an exact passage when it is not."""

    __tablename__ = "comments"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    book_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE"), index=True, nullable=False
    )
    page_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("pages.id", ondelete="CASCADE"), index=True, nullable=True
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("comments.id", ondelete="CASCADE"), index=True, nullable=True
    )
    # Root of the thread: the anchored (or book-level) comment this reply hangs under.
    # Denormalised so a whole thread is one indexed query.
    thread_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True), index=True, nullable=True)
    author_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    anchor: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    author: Mapped["User"] = relationship(lazy="joined")
    replies: Mapped[list["Comment"]] = relationship(
        back_populates="parent", cascade="all, delete-orphan", passive_deletes=True
    )
    parent: Mapped["Comment | None"] = relationship(back_populates="replies", remote_side=[id])

    __table_args__ = (Index("ix_comments_book_page", "book_id", "page_id"),)


class Highlight(Base):
    __tablename__ = "highlights"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    book_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE"), index=True, nullable=False
    )
    page_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("pages.id", ondelete="CASCADE"), index=True, nullable=True
    )
    anchor: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    color: Mapped[HighlightColor] = mapped_column(
        _enum(HighlightColor, "highlight_color"), default=HighlightColor.yellow, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    notes: Mapped[list["Note"]] = relationship(
        back_populates="highlight", cascade="all, delete-orphan", passive_deletes=True
    )

    __table_args__ = (Index("ix_highlights_user_book", "user_id", "book_id"),)


class Note(Base):
    """A reader's private note. Rich text, optionally hung off a highlight."""

    __tablename__ = "notes"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    highlight_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("highlights.id", ondelete="CASCADE"), index=True, nullable=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    book_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE"), index=True, nullable=False
    )
    page_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("pages.id", ondelete="CASCADE"), nullable=True
    )
    anchor: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    body: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    highlight: Mapped["Highlight | None"] = relationship(back_populates="notes")
    attachments: Mapped[list["NoteAttachment"]] = relationship(
        back_populates="note", cascade="all, delete-orphan", passive_deletes=True
    )

    __table_args__ = (Index("ix_notes_user_book", "user_id", "book_id"),)


class NoteAttachment(Base):
    __tablename__ = "note_attachments"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    note_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("notes.id", ondelete="CASCADE"), index=True, nullable=False
    )
    kind: Mapped[AttachmentKind] = mapped_column(_enum(AttachmentKind, "attachment_kind"), nullable=False)
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    title: Mapped[str | None] = mapped_column(String(300), nullable=True)
    preview: Mapped[str | None] = mapped_column(Text, nullable=True)
    storage_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    note: Mapped["Note"] = relationship(back_populates="attachments")
