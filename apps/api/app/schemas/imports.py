from __future__ import annotations

import uuid
from typing import Any

from pydantic import BaseModel

from app.schemas.book import BookSummary
from app.schemas.common import ORMModel


class ConversionReport(BaseModel):
    pages_total: int = 0
    pages_clean: int = 0
    images: int = 0
    warnings: list[str] = []
    confidence: float = 0.0


class ImportedDocumentOut(ORMModel):
    id: uuid.UUID
    filename: str
    source_type: str
    conversion_status: str
    original_url: str
    conversion_report: dict[str, Any] | None = None
    book_id: uuid.UUID | None = None


class ImportResult(BaseModel):
    document: ImportedDocumentOut
    book: BookSummary | None
    report: ConversionReport
