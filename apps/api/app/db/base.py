"""Declarative base + shared column helpers.

Importing this module also imports every model module, which is what Alembic's
autogenerate needs in order to see the full metadata.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    # Fetch server-generated values (created_at, and especially the
    # onupdate=now() on updated_at) with RETURNING, in the same statement.
    #
    # Without this, SQLAlchemy expires updated_at after an UPDATE and reloads it
    # lazily on first access — which, under asyncio, means IO outside the
    # greenlet and a MissingGreenlet error the moment the response is
    # serialised. That is the autosave path: every PATCH of a page, a book or a
    # note. RETURNING costs nothing extra on PostgreSQL.
    __mapper_args__ = {"eager_defaults": True}


def uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


def import_models() -> None:
    """Import all model modules for their side effect of registering tables."""
    from app import models  # noqa: F401,PLC0415
