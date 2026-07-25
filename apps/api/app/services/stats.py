"""Reading statistics, derived from the passive heartbeat sessions."""

from __future__ import annotations

import uuid
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Book, ReadingProgress, ReadingSession
from app.schemas.reading import BookStats, ReadingStats


def _streaks(days: set[date]) -> tuple[int, int]:
    """Longest run of consecutive reading days, and the run ending today/yesterday."""
    if not days:
        return 0, 0
    ordered = sorted(days)
    longest = run = 1
    for previous, current in zip(ordered, ordered[1:], strict=False):
        run = run + 1 if current - previous == timedelta(days=1) else 1
        longest = max(longest, run)

    today = date.today()
    current_run = 0
    cursor = today if today in days else today - timedelta(days=1)
    while cursor in days:
        current_run += 1
        cursor -= timedelta(days=1)
    return longest, current_run


async def reading_stats(db: AsyncSession, user_id: uuid.UUID) -> ReadingStats:
    totals = (
        await db.execute(
            select(
                func.coalesce(func.sum(ReadingSession.active_seconds), 0),
                func.count(),
                func.coalesce(func.sum(ReadingSession.pages_turned), 0),
            ).where(ReadingSession.user_id == user_id)
        )
    ).one()
    total_seconds, sessions, pages_turned = int(totals[0]), int(totals[1]), int(totals[2])

    day_rows = await db.scalars(
        select(func.date(ReadingSession.started_at)).where(ReadingSession.user_id == user_id)
    )
    days = {row if isinstance(row, date) else date.fromisoformat(str(row)) for row in day_rows}
    longest, current = _streaks(days)

    books_started = (
        await db.scalar(
            select(func.count()).select_from(ReadingProgress).where(ReadingProgress.user_id == user_id)
        )
        or 0
    )

    per_book = await db.execute(
        select(
            Book.id,
            Book.slug,
            Book.title,
            func.coalesce(func.sum(ReadingSession.active_seconds), 0),
            func.count(ReadingSession.id),
            func.coalesce(func.sum(ReadingSession.pages_turned), 0),
            func.max(ReadingSession.ended_at),
        )
        .join(ReadingSession, ReadingSession.book_id == Book.id)
        .where(ReadingSession.user_id == user_id)
        .group_by(Book.id, Book.slug, Book.title)
        .order_by(func.sum(ReadingSession.active_seconds).desc())
    )

    return ReadingStats(
        total_seconds=total_seconds,
        sessions=sessions,
        pages_turned=pages_turned,
        longest_streak_days=longest,
        current_streak_days=current,
        average_session_seconds=round(total_seconds / sessions) if sessions else 0,
        books_started=int(books_started),
        books=[
            BookStats(
                book={"id": book_id, "slug": slug, "title": title},
                active_seconds=int(seconds),
                sessions=int(count),
                pages_turned=int(turned),
                last_read_at=last,
            )
            for book_id, slug, title, seconds, count, turned, last in per_book
        ],
    )
