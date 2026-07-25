from __future__ import annotations

from fastapi import APIRouter, Query
from fastapi.responses import HTMLResponse, Response
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import DbSession, InviteToken, MaybeUser
from app.models import Highlight, Note, Page
from app.services import books as svc
from app.services.export import build_html, render_pdf
from app.slug import safe_filename

router = APIRouter(tags=["export"])


async def _collect(
    db: AsyncSession, ref: str, user, invite: str | None, marks: bool
):
    book = await svc.load_book(db, ref)
    await svc.access_for(db, book, user, invite)
    await db.refresh(book, ["author"])

    pages = list(await db.scalars(select(Page).where(Page.book_id == book.id).order_by(Page.index)))
    indexes = {page.id: page.index for page in pages}

    highlights: list[Highlight] = []
    notes: list[Note] = []
    if marks and user is not None:
        # Only ever the caller's own marks — an export is a personal copy.
        highlights = list(
            await db.scalars(
                select(Highlight).where(Highlight.book_id == book.id, Highlight.user_id == user.id)
            )
        )
        notes = list(
            await db.scalars(
                select(Note)
                .options(selectinload(Note.attachments))
                .where(Note.book_id == book.id, Note.user_id == user.id)
            )
        )
        order = {page_id: index for page_id, index in indexes.items()}
        highlights.sort(key=lambda item: order.get(item.page_id, 10_000))
        notes.sort(key=lambda item: order.get(item.page_id, 10_000))

    return book, pages, highlights, notes, indexes


@router.get("/books/{ref}/export.pdf")
async def export_pdf(
    ref: str,
    db: DbSession,
    user: MaybeUser,
    invite: InviteToken,
    marks: bool = Query(False, description="Append your own highlights and notes as an index"),
) -> Response:
    book, pages, highlights, notes, indexes = await _collect(db, ref, user, invite, marks)
    html = build_html(book, pages, highlights=highlights, notes=notes, page_indexes=indexes)
    pdf = render_pdf(html)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{safe_filename(book.title)}.pdf"'},
    )


@router.get("/books/{ref}/export.html", include_in_schema=False)
async def export_html(
    ref: str, db: DbSession, user: MaybeUser, invite: InviteToken, marks: bool = False
) -> HTMLResponse:
    """The same document WeasyPrint renders — handy for checking a layout."""
    book, pages, highlights, notes, indexes = await _collect(db, ref, user, invite, marks)
    return HTMLResponse(build_html(book, pages, highlights=highlights, notes=notes, page_indexes=indexes))
