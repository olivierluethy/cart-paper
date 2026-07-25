from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DbSession, InviteToken, MaybeUser
from app.models import Book, Page, ReadingProgress, ReadingSession
from app.schemas.book import BookSummary, ProgressOut
from app.schemas.common import Ok
from app.schemas.reading import ContinueReading, HeartbeatIn, ProgressIn
from app.services import books as svc

router = APIRouter(tags=["reading"])

# A gap longer than this starts a new reading session rather than extending one.
SESSION_GAP = timedelta(minutes=3)


@router.get("/books/{ref}/progress", response_model=ProgressOut | None)
async def get_progress(
    ref: str, db: DbSession, user: MaybeUser, invite: InviteToken
) -> ProgressOut | None:
    book = await svc.load_book(db, ref)
    await svc.access_for(db, book, user, invite)
    if user is None:
        return None
    row = await db.scalar(
        select(ReadingProgress).where(
            ReadingProgress.user_id == user.id, ReadingProgress.book_id == book.id
        )
    )
    if row is None:
        return None
    index = 0
    if row.page_id is not None:
        index = await db.scalar(select(Page.index).where(Page.id == row.page_id)) or 0
    return ProgressOut(
        book_id=book.id,
        page_id=row.page_id,
        page_index=index,
        anchor=row.anchor,
        percent=row.percent,
        completed_at=row.completed_at,
        restarted_count=row.restarted_count or 0,
        updated_at=row.updated_at,
    )


@router.patch("/books/{ref}/progress", response_model=ProgressOut)
async def set_progress(
    ref: str, payload: ProgressIn, db: DbSession, user: CurrentUser, invite: InviteToken
) -> ProgressOut:
    """Called continuously while reading — upsert, never a round trip to read first.

    **Monotonic.** The stored position is a high-water mark: paging backwards,
    clicking past the last page or reloading must never lower it, and nothing
    here ever clears ``completed_at``. Without that, a reader who flicks back to
    re-read chapter one would lose their place on the next reload.
    """
    book = await svc.load_book(db, ref)
    await svc.access_for(db, book, user, invite)

    row = await db.scalar(
        select(ReadingProgress).where(
            ReadingProgress.user_id == user.id, ReadingProgress.book_id == book.id
        )
    )
    if row is None:
        row = ReadingProgress(user_id=user.id, book_id=book.id)
        db.add(row)

    if payload.percent >= (row.percent or 0.0):
        row.page_id = payload.page_id
        row.anchor = payload.anchor
        row.percent = payload.percent

    # Finished when the reader confirms the last page, or when progress is
    # unambiguously at the end. Never unset.
    if (payload.completed or payload.percent >= 0.999) and row.completed_at is None:
        row.completed_at = datetime.now(UTC)

    row.updated_at = datetime.now(UTC)
    await db.flush()
    return await _progress_out(db, book.id, row)


@router.put("/books/{ref}/progress", response_model=ProgressOut, include_in_schema=False)
async def set_progress_put(
    ref: str, payload: ProgressIn, db: DbSession, user: CurrentUser, invite: InviteToken
) -> ProgressOut:
    """Alias for PATCH — kept so existing callers keep working."""
    return await set_progress(ref, payload, db, user, invite)


@router.post("/books/{ref}/progress/restart", response_model=ProgressOut)
async def restart_progress(
    ref: str, db: DbSession, user: CurrentUser, invite: InviteToken
) -> ProgressOut:
    """Read it again from page one.

    Keeps ``completed_at`` — a finished book stays finished — and keeps every
    highlight, note and discussion. Only the position moves.
    """
    book = await svc.load_book(db, ref)
    await svc.access_for(db, book, user, invite)

    row = await db.scalar(
        select(ReadingProgress).where(
            ReadingProgress.user_id == user.id, ReadingProgress.book_id == book.id
        )
    )
    if row is None:
        row = ReadingProgress(user_id=user.id, book_id=book.id)
        db.add(row)

    first = await db.scalar(
        select(Page.id).where(Page.book_id == book.id).order_by(Page.index).limit(1)
    )
    row.page_id = first
    row.anchor = None
    row.percent = 0.0
    row.restarted_count = (row.restarted_count or 0) + 1
    row.updated_at = datetime.now(UTC)
    await db.flush()
    return await _progress_out(db, book.id, row)


async def _progress_out(db, book_id, row: ReadingProgress) -> ProgressOut:
    index = 0
    if row.page_id is not None:
        index = await db.scalar(select(Page.index).where(Page.id == row.page_id)) or 0
    return ProgressOut(
        book_id=book_id,
        page_id=row.page_id,
        page_index=index,
        anchor=row.anchor,
        percent=row.percent,
        completed_at=row.completed_at,
        restarted_count=row.restarted_count or 0,
        updated_at=row.updated_at,
    )


@router.post("/books/{ref}/heartbeat", response_model=Ok)
async def heartbeat(
    ref: str, payload: HeartbeatIn, db: DbSession, user: CurrentUser, invite: InviteToken
) -> Ok:
    """Passive time tracking. Never surfaces in the reader — no timers, no popups."""
    book = await svc.load_book(db, ref)
    await svc.access_for(db, book, user, invite)

    now = datetime.now(UTC)
    session = await db.scalar(
        select(ReadingSession)
        .where(ReadingSession.user_id == user.id, ReadingSession.book_id == book.id)
        .order_by(ReadingSession.started_at.desc())
        .limit(1)
    )
    last_seen = session.ended_at or session.started_at if session else None
    if session is None or last_seen is None or now - last_seen > SESSION_GAP:
        session = ReadingSession(
            user_id=user.id,
            book_id=book.id,
            started_at=now,
            ended_at=now,
            active_seconds=payload.seconds,
            pages_turned=payload.pages_turned,
        )
        db.add(session)
    else:
        session.active_seconds += payload.seconds
        session.pages_turned += payload.pages_turned
        session.ended_at = now
    return Ok()


@router.get("/reading/continue", response_model=list[ContinueReading])
async def continue_reading(db: DbSession, user: CurrentUser) -> list[ContinueReading]:
    rows = (
        await db.execute(
            select(ReadingProgress, Book)
            .join(Book, Book.id == ReadingProgress.book_id)
            .options(selectinload(Book.author))
            .where(ReadingProgress.user_id == user.id)
            .order_by(ReadingProgress.updated_at.desc())
            .limit(12)
        )
    ).all()

    books = [book for _, book in rows]
    summaries = {
        item["id"]: BookSummary.model_validate(item)
        for item in await svc.summarize(db, books, user)
    }

    out: list[ContinueReading] = []
    for progress, book in rows:
        index = 0
        if progress.page_id is not None:
            index = await db.scalar(select(Page.index).where(Page.id == progress.page_id)) or 0
        out.append(
            ContinueReading(
                book_id=book.id,
                page_id=progress.page_id,
                page_index=index,
                anchor=progress.anchor,
                percent=progress.percent,
                completed_at=progress.completed_at,
                restarted_count=progress.restarted_count or 0,
                updated_at=progress.updated_at,
                book=summaries[book.id],
            )
        )
    return out
