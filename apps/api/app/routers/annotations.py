from __future__ import annotations

import mimetypes
import uuid

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DbSession, InviteToken
from app.models import AttachmentKind, Highlight, HighlightColor, Note, NoteAttachment, Page
from app.schemas.annotation import (
    AttachmentIn,
    AttachmentOut,
    HighlightIn,
    HighlightOut,
    HighlightUpdate,
    NoteIn,
    NoteOut,
    NoteUpdate,
)
from app.schemas.common import Ok
from app.services import books as svc
from app.services.storage import DOCUMENT_MIMES, IMAGE_MIMES, check_size, storage

router = APIRouter(tags=["annotations"])


def _note_out(note: Note, color: str | None = None) -> NoteOut:
    return NoteOut(
        id=note.id,
        highlight_id=note.highlight_id,
        book_id=note.book_id,
        page_id=note.page_id,
        anchor=note.anchor,
        body=note.body,
        attachments=[AttachmentOut.model_validate(item) for item in note.attachments],
        created_at=note.created_at,
        updated_at=note.updated_at,
        highlight_color=color,
    )


# ------------------------------------------------------------------ highlights
@router.get("/books/{ref}/highlights", response_model=list[HighlightOut])
async def list_highlights(
    ref: str, db: DbSession, user: CurrentUser, invite: InviteToken
) -> list[HighlightOut]:
    """Only ever the caller's own — a highlight is private to the reader who made it."""
    book = await svc.load_book(db, ref)
    await svc.access_for(db, book, user, invite)

    rows = list(
        await db.scalars(
            select(Highlight)
            .where(Highlight.book_id == book.id, Highlight.user_id == user.id)
            .order_by(Highlight.created_at)
        )
    )
    note_ids = {
        highlight_id: note_id
        for highlight_id, note_id in await db.execute(
            select(Note.highlight_id, Note.id).where(
                Note.user_id == user.id, Note.highlight_id.in_([row.id for row in rows] or [None])
            )
        )
    }
    return [
        HighlightOut(
            id=row.id,
            book_id=row.book_id,
            page_id=row.page_id,
            anchor=row.anchor,
            color=row.color.value if hasattr(row.color, "value") else row.color,
            created_at=row.created_at,
            note_id=note_ids.get(row.id),
        )
        for row in rows
    ]


@router.post("/books/{ref}/highlights", response_model=HighlightOut, status_code=201)
async def create_highlight(
    ref: str, payload: HighlightIn, db: DbSession, user: CurrentUser, invite: InviteToken
) -> HighlightOut:
    book = await svc.load_book(db, ref)
    await svc.access_for(db, book, user, invite)

    highlight = Highlight(
        user_id=user.id,
        book_id=book.id,
        page_id=payload.page_id,
        anchor=payload.anchor,
        color=HighlightColor(payload.color),
    )
    db.add(highlight)
    await db.flush()
    return HighlightOut(
        id=highlight.id,
        book_id=highlight.book_id,
        page_id=highlight.page_id,
        anchor=highlight.anchor,
        color=payload.color,
        created_at=highlight.created_at,
        note_id=None,
    )


@router.patch("/highlights/{highlight_id}", response_model=HighlightOut)
async def update_highlight(
    highlight_id: uuid.UUID, payload: HighlightUpdate, db: DbSession, user: CurrentUser
) -> HighlightOut:
    highlight = await _own_highlight(db, highlight_id, user.id)
    highlight.color = HighlightColor(payload.color)
    await db.flush()
    note_id = await db.scalar(select(Note.id).where(Note.highlight_id == highlight.id))
    return HighlightOut(
        id=highlight.id,
        book_id=highlight.book_id,
        page_id=highlight.page_id,
        anchor=highlight.anchor,
        color=payload.color,
        created_at=highlight.created_at,
        note_id=note_id,
    )


@router.delete("/highlights/{highlight_id}", response_model=Ok)
async def delete_highlight(highlight_id: uuid.UUID, db: DbSession, user: CurrentUser) -> Ok:
    highlight = await _own_highlight(db, highlight_id, user.id)
    await db.delete(highlight)
    return Ok()


async def _own_highlight(db: AsyncSession, highlight_id: uuid.UUID, user_id: uuid.UUID) -> Highlight:
    highlight = await db.scalar(select(Highlight).where(Highlight.id == highlight_id))
    if highlight is None or highlight.user_id != user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such highlight.")
    return highlight


# ----------------------------------------------------------------------- notes
@router.get("/books/{ref}/notes", response_model=list[NoteOut])
async def list_notes(
    ref: str, db: DbSession, user: CurrentUser, invite: InviteToken
) -> list[NoteOut]:
    """In reading order — page first, then position on the page."""
    book = await svc.load_book(db, ref)
    await svc.access_for(db, book, user, invite)

    rows = list(
        await db.scalars(
            select(Note)
            .options(selectinload(Note.attachments), selectinload(Note.highlight))
            .where(Note.book_id == book.id, Note.user_id == user.id)
        )
    )
    indexes = {
        page_id: index
        for page_id, index in await db.execute(select(Page.id, Page.index).where(Page.book_id == book.id))
    }

    def sort_key(note: Note) -> tuple[int, int]:
        page_index = indexes.get(note.page_id, 10_000) if note.page_id else 10_000
        start = (note.anchor or {}).get("from")
        return (page_index, start if isinstance(start, int) else 10_000_000)

    rows.sort(key=sort_key)
    return [
        _note_out(
            note,
            (note.highlight.color.value if hasattr(note.highlight.color, "value") else note.highlight.color)
            if note.highlight
            else None,
        )
        for note in rows
    ]


@router.post("/books/{ref}/notes", response_model=NoteOut, status_code=201)
async def create_note(
    ref: str, payload: NoteIn, db: DbSession, user: CurrentUser, invite: InviteToken
) -> NoteOut:
    book = await svc.load_book(db, ref)
    await svc.access_for(db, book, user, invite)

    anchor = payload.anchor
    color: str | None = None
    if payload.highlight_id is not None:
        highlight = await _own_highlight(db, payload.highlight_id, user.id)
        anchor = anchor or highlight.anchor
        color = highlight.color.value if hasattr(highlight.color, "value") else highlight.color

    note = Note(
        highlight_id=payload.highlight_id,
        user_id=user.id,
        book_id=book.id,
        page_id=payload.page_id,
        anchor=anchor,
        body=payload.body,
    )
    db.add(note)
    await db.flush()
    for item in payload.attachments:
        db.add(_attachment(note.id, item))
    await db.flush()
    await db.refresh(note, ["attachments"])
    return _note_out(note, color)


@router.patch("/notes/{note_id}", response_model=NoteOut)
async def update_note(
    note_id: uuid.UUID, payload: NoteUpdate, db: DbSession, user: CurrentUser
) -> NoteOut:
    note = await _own_note(db, note_id, user.id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(note, field, value)
    await db.flush()
    await db.refresh(note, ["attachments"])
    return _note_out(note)


@router.delete("/notes/{note_id}", response_model=Ok)
async def delete_note(note_id: uuid.UUID, db: DbSession, user: CurrentUser) -> Ok:
    note = await _own_note(db, note_id, user.id)
    await db.delete(note)
    return Ok()


# ----------------------------------------------------------------- attachments
@router.post("/notes/{note_id}/attachments", response_model=AttachmentOut, status_code=201)
async def add_attachment(
    note_id: uuid.UUID, payload: AttachmentIn, db: DbSession, user: CurrentUser
) -> AttachmentOut:
    note = await _own_note(db, note_id, user.id)
    row = _attachment(note.id, payload)
    db.add(row)
    await db.flush()
    return AttachmentOut.model_validate(row)


@router.post("/notes/{note_id}/attachments/file", response_model=AttachmentOut, status_code=201)
async def upload_attachment(
    note_id: uuid.UUID, db: DbSession, user: CurrentUser, file: UploadFile = File(...)
) -> AttachmentOut:
    """Images and documents can sit next to the passage they belong to."""
    note = await _own_note(db, note_id, user.id)
    mime = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"
    data = await file.read()
    check_size(data)

    suffix = IMAGE_MIMES.get(mime) or DOCUMENT_MIMES.get(mime) or ""
    key = storage.save(data, suffix=suffix, prefix="notes")
    row = NoteAttachment(
        note_id=note.id,
        kind=AttachmentKind.image if mime in IMAGE_MIMES else AttachmentKind.file,
        url=storage.url(key),
        title=file.filename or "attachment",
        storage_key=key,
    )
    db.add(row)
    await db.flush()
    return AttachmentOut.model_validate(row)


@router.delete("/note-attachments/{attachment_id}", response_model=Ok)
async def delete_attachment(attachment_id: uuid.UUID, db: DbSession, user: CurrentUser) -> Ok:
    row = await db.scalar(select(NoteAttachment).where(NoteAttachment.id == attachment_id))
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such attachment.")
    await _own_note(db, row.note_id, user.id)
    if row.storage_key:
        storage.delete(row.storage_key)
    await db.delete(row)
    return Ok()


def _attachment(note_id: uuid.UUID, payload: AttachmentIn) -> NoteAttachment:
    return NoteAttachment(
        note_id=note_id,
        kind=AttachmentKind(payload.kind),
        url=payload.url,
        title=payload.title,
        preview=payload.preview,
    )


async def _own_note(db: AsyncSession, note_id: uuid.UUID, user_id: uuid.UUID) -> Note:
    note = await db.scalar(
        select(Note).options(selectinload(Note.attachments)).where(Note.id == note_id)
    )
    if note is None or note.user_id != user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such note.")
    return note
