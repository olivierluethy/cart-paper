from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel
from app.schemas.user import UserPublic

EMPTY_DOC: dict[str, Any] = {"type": "doc", "content": [{"type": "paragraph"}]}


class CoverDesign(BaseModel):
    kind: Literal["color", "gradient", "image"] = "gradient"
    color: str | None = None
    gradient: list[str] | None = None
    angle: int | None = None
    image_url: str | None = None
    preset: Literal["classic", "modern", "plate", "stamp"] = "classic"
    title_color: str | None = None
    show_author: bool = True
    text: str | None = None

    model_config = {"extra": "allow"}


class BookCreate(BaseModel):
    title: str = Field(default="Untitled", min_length=1, max_length=240)
    subtitle: str | None = Field(default=None, max_length=240)
    description: str | None = None
    language: str = Field(default="en", max_length=12)
    tags: list[str] = Field(default_factory=list)


class BookUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=240)
    subtitle: str | None = Field(default=None, max_length=240)
    description: str | None = None
    language: str | None = Field(default=None, max_length=12)
    tags: list[str] | None = None
    front_cover: CoverDesign | None = None
    back_cover: CoverDesign | None = None


class BookSummary(ORMModel):
    id: uuid.UUID
    slug: str
    title: str
    subtitle: str | None
    description: str | None
    status: str
    language: str
    tags: list[str]
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime
    front_cover: dict[str, Any] | None
    author: UserPublic
    page_count: int = 0
    rating_average: float = 0.0
    rating_count: int = 0
    comment_count: int = 0
    favorite_count: int = 0
    is_favorite: bool = False
    my_rating: int | None = None


class ImportedDocumentRef(ORMModel):
    id: uuid.UUID
    filename: str
    source_type: str
    conversion_status: str
    original_url: str


class ProgressOut(ORMModel):
    book_id: uuid.UUID
    page_id: uuid.UUID | None
    page_index: int = 0
    anchor: dict[str, Any] | None
    percent: float
    completed_at: datetime | None = None
    restarted_count: int = 0
    updated_at: datetime


class BookDetail(BookSummary):
    back_cover: dict[str, Any] | None = None
    rating_distribution: dict[str, int] = Field(default_factory=dict)
    can_edit: bool = False
    progress: ProgressOut | None = None
    import_source: ImportedDocumentRef | None = None


class PageSummary(ORMModel):
    id: uuid.UUID
    index: int
    title: str | None
    updated_at: datetime


class PageOut(PageSummary):
    book_id: uuid.UUID
    content: dict[str, Any]
    created_at: datetime


class PageCreate(BaseModel):
    index: int | None = None
    title: str | None = Field(default=None, max_length=240)
    content: dict[str, Any] | None = None


class PageUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=240)
    content: dict[str, Any] | None = None


class PageReorder(BaseModel):
    """Full ordering of the book's pages, first to last."""

    page_ids: list[uuid.UUID]
