from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.book import _enum
from app.models.enums import ConversionStatus, SourceType


class ImportedDocument(Base):
    """The original upload is kept forever; the converted book is a best effort on top of it."""

    __tablename__ = "imported_documents"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    book_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("books.id", ondelete="SET NULL"), index=True, nullable=True
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    source_type: Mapped[SourceType] = mapped_column(_enum(SourceType, "source_type"), nullable=False)
    original_storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    conversion_status: Mapped[ConversionStatus] = mapped_column(
        _enum(ConversionStatus, "conversion_status"), default=ConversionStatus.pending, nullable=False
    )
    conversion_report: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
