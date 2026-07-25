from __future__ import annotations

import mimetypes
import uuid

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from sqlalchemy import select

from app.core.deps import CurrentUser, DbSession
from app.models import Book, BookStatus, ConversionStatus, ImportedDocument, Page, SourceType
from app.schemas.book import BookSummary
from app.schemas.imports import ImportResult, ImportedDocumentOut
from app.services import books as svc
from app.services.handles import unique_book_slug
from app.services.importers import Conversion, convert_docx, convert_pdf
from app.services.storage import DOCUMENT_MIMES, check_size, storage

router = APIRouter(tags=["imports"])

# Below this share of pages converting cleanly, the reader is pointed at the
# original file instead of a bad transcription.
LOW_CONFIDENCE = 0.6


def _doc_out(document: ImportedDocument) -> ImportedDocumentOut:
    return ImportedDocumentOut(
        id=document.id,
        filename=document.filename,
        source_type=document.source_type.value
        if hasattr(document.source_type, "value")
        else document.source_type,
        conversion_status=document.conversion_status.value
        if hasattr(document.conversion_status, "value")
        else document.conversion_status,
        original_url=storage.url(document.original_storage_key),
        conversion_report=document.conversion_report,
        book_id=document.book_id,
    )


@router.post("/imports", response_model=ImportResult, status_code=status.HTTP_201_CREATED)
async def import_document(
    db: DbSession, user: CurrentUser, file: UploadFile = File(...)
) -> ImportResult:
    """Imported documents are always private drafts. Nothing uploaded is ever published."""
    mime = file.content_type or mimetypes.guess_type(file.filename or "")[0] or ""
    name = (file.filename or "document").strip()
    if mime not in DOCUMENT_MIMES and not name.lower().endswith((".pdf", ".docx")):
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Only PDF and Word (.docx) files can be imported."
        )

    data = await file.read()
    check_size(data)

    is_pdf = mime == "application/pdf" or name.lower().endswith(".pdf")
    source = SourceType.pdf if is_pdf else SourceType.docx
    key = storage.save(data, suffix=".pdf" if is_pdf else ".docx", prefix="originals")

    document = ImportedDocument(
        user_id=user.id,
        filename=name,
        source_type=source,
        original_storage_key=key,
        conversion_status=ConversionStatus.processing,
    )
    db.add(document)
    await db.flush()

    conversion: Conversion = convert_pdf(data) if is_pdf else convert_docx(data)
    document.conversion_report = conversion.report()

    if not conversion.pages or conversion.confidence <= 0:
        document.conversion_status = ConversionStatus.failed
        await db.flush()
        return ImportResult(document=_doc_out(document), book=None, report=conversion.report())

    title = conversion.title or name.rsplit(".", 1)[0]
    book = Book(
        author_id=user.id,
        title=title[:240],
        description=None,
        slug=await unique_book_slug(db, title),
        status=BookStatus.draft,
        tags=["imported"],
    )
    db.add(book)
    await db.flush()

    for index, page in enumerate(conversion.pages):
        db.add(Page(book_id=book.id, index=index, content=page))

    document.book_id = book.id
    document.conversion_status = (
        ConversionStatus.low_confidence
        if conversion.confidence < LOW_CONFIDENCE
        else ConversionStatus.converted
    )
    await db.flush()
    await db.refresh(book, ["author"])

    summary = (await svc.summarize(db, [book], user))[0]
    return ImportResult(
        document=_doc_out(document),
        book=BookSummary.model_validate(summary),
        report=conversion.report(),
    )


@router.get("/imports", response_model=list[ImportedDocumentOut])
async def list_imports(db: DbSession, user: CurrentUser) -> list[ImportedDocumentOut]:
    rows = await db.scalars(
        select(ImportedDocument)
        .where(ImportedDocument.user_id == user.id)
        .order_by(ImportedDocument.created_at.desc())
    )
    return [_doc_out(row) for row in rows]


@router.get("/imports/{document_id}", response_model=ImportedDocumentOut)
async def get_import(
    document_id: uuid.UUID, db: DbSession, user: CurrentUser
) -> ImportedDocumentOut:
    document = await db.scalar(select(ImportedDocument).where(ImportedDocument.id == document_id))
    if document is None or document.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such import.")
    return _doc_out(document)
