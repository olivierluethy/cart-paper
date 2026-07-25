from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DbSession, MaybeUser
from app.models import Book, BookStatus, Comment, Note, Page, Rating, User
from app.schemas.annotation import AttachmentOut, NoteOut
from app.schemas.book import BookSummary
from app.schemas.comment import CommentOut
from app.schemas.profile import ProfileOut, TrailEntry, TrailPage
from app.schemas.reading import ReadingStats
from app.services import books as svc
from app.services.stats import reading_stats

router = APIRouter(prefix="/users", tags=["profile"])


async def _load_user(db: AsyncSession, handle: str) -> User:
    user = await db.scalar(select(User).where(User.handle == handle))
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such reader.")
    return user


@router.get("/{handle}", response_model=ProfileOut)
async def profile(handle: str, db: DbSession, viewer: MaybeUser) -> ProfileOut:
    user = await _load_user(db, handle)
    books = list(
        await db.scalars(
            select(Book)
            .options(selectinload(Book.author))
            .where(Book.author_id == user.id, Book.status == BookStatus.published)
            .order_by(Book.published_at.desc().nullslast())
        )
    )
    summaries = [BookSummary.model_validate(item) for item in await svc.summarize(db, books, viewer)]

    average = await db.scalar(
        select(func.avg(Rating.value))
        .join(Book, Book.id == Rating.book_id)
        .where(Book.author_id == user.id)
    )
    comment_count = (
        await db.scalar(
            select(func.count())
            .select_from(Comment)
            .where(Comment.author_id == user.id, Comment.is_deleted.is_(False))
        )
        or 0
    )

    return ProfileOut(
        user=user,
        published_books=summaries,
        book_count=len(summaries),
        average_rating=round(float(average), 2) if average else 0.0,
        comment_count=int(comment_count),
        is_me=viewer is not None and viewer.id == user.id,
        stats_visible=user.stats_visible,
    )


@router.get("/{handle}/comments", response_model=list[CommentOut])
async def public_comments(handle: str, db: DbSession, limit: int = Query(30, ge=1, le=100)):
    """Public comments only — on published books, and never a deleted one."""
    user = await _load_user(db, handle)
    rows = await db.scalars(
        select(Comment)
        .options(selectinload(Comment.author))
        .join(Book, Book.id == Comment.book_id)
        .where(
            Comment.author_id == user.id,
            Comment.is_deleted.is_(False),
            Book.status == BookStatus.published,
        )
        .order_by(Comment.created_at.desc())
        .limit(limit)
    )
    return [
        CommentOut(
            id=row.id,
            book_id=row.book_id,
            page_id=row.page_id,
            parent_id=row.parent_id,
            thread_id=row.thread_id,
            author=row.author,
            body=row.body,
            anchor=row.anchor,
            is_deleted=False,
            created_at=row.created_at,
            edited_at=row.edited_at,
        )
        for row in rows
    ]


@router.get("/{handle}/stats", response_model=ReadingStats)
async def public_stats(handle: str, db: DbSession, viewer: MaybeUser) -> ReadingStats:
    user = await _load_user(db, handle)
    mine = viewer is not None and viewer.id == user.id
    if not mine and not user.stats_visible:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This reader keeps their statistics private.")
    return await reading_stats(db, user.id)


@router.get("/me/trail", response_model=TrailPage)
async def my_trail(
    db: DbSession,
    user: CurrentUser,
    kind: str = Query("all", pattern="^(all|comment|note)$"),
    book_id: uuid.UUID | None = None,
    anchored_only: bool = False,
    limit: int = Query(40, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> TrailPage:
    """The signature screen: every comment and note in the order it was written.

    Each entry keeps the passage it was attached to, so the trail reads as a
    thought process rather than a list of fragments.
    """
    entries: list[tuple[Any, str]] = []

    if kind in {"all", "comment"}:
        query = (
            select(Comment)
            .options(selectinload(Comment.author))
            .where(Comment.author_id == user.id, Comment.is_deleted.is_(False))
        )
        if book_id:
            query = query.where(Comment.book_id == book_id)
        if anchored_only:
            query = query.where(Comment.anchor.isnot(None))
        entries += [(row, "comment") for row in await db.scalars(query)]

    if kind in {"all", "note"}:
        query = (
            select(Note)
            .options(selectinload(Note.attachments), selectinload(Note.highlight))
            .where(Note.user_id == user.id)
        )
        if book_id:
            query = query.where(Note.book_id == book_id)
        if anchored_only:
            query = query.where(Note.anchor.isnot(None))
        entries += [(row, "note") for row in await db.scalars(query)]

    entries.sort(key=lambda item: item[0].created_at, reverse=True)
    total = len(entries)
    window = entries[offset : offset + limit]

    book_ids = {row.book_id for row, _ in window}
    books = {
        book.id: book
        for book in await db.scalars(select(Book).where(Book.id.in_(book_ids or [None])))
    }
    page_ids = {row.page_id for row, _ in window if row.page_id}
    page_indexes = {
        page_id: index
        for page_id, index in await db.execute(
            select(Page.id, Page.index).where(Page.id.in_(page_ids or [None]))
        )
    }

    # Which comment a reply was answering — the trail should read as a dialogue.
    parent_ids = {row.parent_id for row, kind_ in window if kind_ == "comment" and row.parent_id}
    parents = {
        parent.id: parent
        for parent in await db.scalars(
            select(Comment)
            .options(selectinload(Comment.author))
            .where(Comment.id.in_(parent_ids or [None]))
        )
    }

    items: list[TrailEntry] = []
    for row, entry_kind in window:
        book = books.get(row.book_id)
        if book is None:
            continue
        anchor = row.anchor or {}
        reply_to = None
        if entry_kind == "comment" and row.parent_id and row.parent_id in parents:
            parent = parents[row.parent_id]
            reply_to = {
                "id": parent.id,
                "author": parent.author.display_name if parent.author and not parent.is_deleted else None,
                "excerpt": (parent.body or "")[:120],
            }

        items.append(
            TrailEntry(
                kind=entry_kind,
                at=row.created_at,
                book={"id": book.id, "slug": book.slug, "title": book.title},
                page_index=page_indexes.get(row.page_id) if row.page_id else None,
                page_id=row.page_id,
                quote=anchor.get("quote"),
                comment=(
                    CommentOut(
                        id=row.id,
                        book_id=row.book_id,
                        page_id=row.page_id,
                        parent_id=row.parent_id,
                        thread_id=row.thread_id,
                        author=row.author,
                        body=row.body,
                        anchor=row.anchor,
                        is_deleted=False,
                        created_at=row.created_at,
                        edited_at=row.edited_at,
                    )
                    if entry_kind == "comment"
                    else None
                ),
                note=_note_payload(row) if entry_kind == "note" else None,
                reply_to=reply_to,
            )
        )

    return TrailPage(items=items, total=total, limit=limit, offset=offset)


def _note_payload(note: Note) -> NoteOut:
    color = None
    if note.highlight is not None:
        color = (
            note.highlight.color.value
            if hasattr(note.highlight.color, "value")
            else note.highlight.color
        )
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
