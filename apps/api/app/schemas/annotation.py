from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel

HighlightColorName = Literal["yellow", "green", "blue", "pink", "red", "purple", "black"]


class HighlightIn(BaseModel):
    page_id: uuid.UUID | None = None
    anchor: dict[str, Any]
    color: HighlightColorName = "yellow"


class HighlightUpdate(BaseModel):
    color: HighlightColorName


class HighlightOut(ORMModel):
    id: uuid.UUID
    book_id: uuid.UUID
    page_id: uuid.UUID | None
    anchor: dict[str, Any]
    color: str
    created_at: datetime
    note_id: uuid.UUID | None = None


class AttachmentIn(BaseModel):
    kind: Literal["link", "image", "quote"]
    url: str | None = None
    title: str | None = Field(default=None, max_length=300)
    preview: str | None = None


class AttachmentOut(ORMModel):
    id: uuid.UUID
    kind: str
    url: str | None
    title: str | None
    preview: str | None
    storage_key: str | None


class NoteIn(BaseModel):
    highlight_id: uuid.UUID | None = None
    page_id: uuid.UUID | None = None
    anchor: dict[str, Any] | None = None
    body: dict[str, Any]
    attachments: list[AttachmentIn] = Field(default_factory=list)


class NoteUpdate(BaseModel):
    body: dict[str, Any] | None = None
    anchor: dict[str, Any] | None = None


class NoteOut(ORMModel):
    id: uuid.UUID
    highlight_id: uuid.UUID | None
    book_id: uuid.UUID
    page_id: uuid.UUID | None
    anchor: dict[str, Any] | None
    body: dict[str, Any]
    attachments: list[AttachmentOut] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    highlight_color: str | None = None
