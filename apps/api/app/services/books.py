"""Book access rules and the aggregate counters every book card needs."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any, Literal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Book,
    BookInvite,
    BookStatus,
    Comment,
    Favorite,
    ImportedDocument,
    Page,
    Rating,
    ReadingProgress,
    User,
)

Access = Literal["owner", "reader", "invited"]


async def load_book(db: AsyncSession, ref: str) -> Book:
    """Books are addressable by uuid or slug — the public routes use the slug."""
    try:
        book_id = uuid.UUID(ref)
        book = await db.scalar(select(Book).where(Book.id == book_id))
    except ValueError:
        book = await db.scalar(select(Book).where(Book.slug == ref))
    if book is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That book does not exist.")
    return book


async def valid_invite(db: AsyncSession, book_id: uuid.UUID, token: str | None) -> BookInvite | None:
    if not token:
        return None
    invite = await db.scalar(
        select(BookInvite).where(BookInvite.token == token, BookInvite.book_id == book_id)
    )
    if invite is None or invite.revoked_at is not None:
        return None
    if invite.expires_at is not None and invite.expires_at < datetime.now(UTC):
        return None
    return invite


async def access_for(
    db: AsyncSession,
    book: Book,
    user: User | None,
    invite_token: str | None = None,
) -> Access:
    """Raises 404 rather than 403 for drafts — an unlisted draft should not be discoverable."""
    if user is not None and book.author_id == user.id:
        return "owner"
    if book.status == BookStatus.published:
        return "reader"
    if await valid_invite(db, book.id, invite_token) is not None:
        return "invited"
    raise HTTPException(status.HTTP_404_NOT_FOUND, "That book does not exist.")


def require_owner(book: Book, user: User) -> None:
    if book.author_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the author can change this book.")


# --------------------------------------------------------------------- aggregates
async def aggregates(
    db: AsyncSession, book_ids: list[uuid.UUID], user: User | None
) -> dict[uuid.UUID, dict[str, Any]]:
    """One grouped query per counter, so a shelf of 40 books is still 6 queries."""
    blank: dict[str, Any] = {
        "page_count": 0,
        "rating_average": 0.0,
        "rating_count": 0,
        "comment_count": 0,
        "favorite_count": 0,
        "is_favorite": False,
        "my_rating": None,
    }
    out: dict[uuid.UUID, dict[str, Any]] = {bid: dict(blank) for bid in book_ids}
    if not book_ids:
        return out

    pages = await db.execute(
        select(Page.book_id, func.count()).where(Page.book_id.in_(book_ids)).group_by(Page.book_id)
    )
    for book_id, count in pages:
        out[book_id]["page_count"] = count

    ratings = await db.execute(
        select(Rating.book_id, func.avg(Rating.value), func.count())
        .where(Rating.book_id.in_(book_ids))
        .group_by(Rating.book_id)
    )
    for book_id, average, count in ratings:
        out[book_id]["rating_average"] = round(float(average), 2)
        out[book_id]["rating_count"] = count

    comments = await db.execute(
        select(Comment.book_id, func.count())
        .where(Comment.book_id.in_(book_ids), Comment.is_deleted.is_(False))
        .group_by(Comment.book_id)
    )
    for book_id, count in comments:
        out[book_id]["comment_count"] = count

    favorites = await db.execute(
        select(Favorite.book_id, func.count())
        .where(Favorite.book_id.in_(book_ids))
        .group_by(Favorite.book_id)
    )
    for book_id, count in favorites:
        out[book_id]["favorite_count"] = count

    if user is not None:
        mine = await db.execute(
            select(Favorite.book_id).where(
                Favorite.book_id.in_(book_ids), Favorite.user_id == user.id
            )
        )
        for (book_id,) in mine:
            out[book_id]["is_favorite"] = True

        my_ratings = await db.execute(
            select(Rating.book_id, Rating.value).where(
                Rating.book_id.in_(book_ids), Rating.user_id == user.id
            )
        )
        for book_id, value in my_ratings:
            out[book_id]["my_rating"] = value

    return out


async def summarize(db: AsyncSession, books: list[Book], user: User | None) -> list[dict[str, Any]]:
    stats = await aggregates(db, [b.id for b in books], user)
    return [
        {
            "id": book.id,
            "slug": book.slug,
            "title": book.title,
            "subtitle": book.subtitle,
            "description": book.description,
            "status": book.status.value if hasattr(book.status, "value") else book.status,
            "language": book.language,
            "tags": book.tags or [],
            "published_at": book.published_at,
            "created_at": book.created_at,
            "updated_at": book.updated_at,
            "front_cover": book.front_cover,
            "author": book.author,
            **stats[book.id],
        }
        for book in books
    ]


async def detail(
    db: AsyncSession, book: Book, user: User | None, access: Access
) -> dict[str, Any]:
    base = (await summarize(db, [book], user))[0]

    distribution = {str(value): 0 for value in range(1, 6)}
    rows = await db.execute(
        select(Rating.value, func.count()).where(Rating.book_id == book.id).group_by(Rating.value)
    )
    for value, count in rows:
        distribution[str(value)] = count

    progress = None
    if user is not None:
        row = await db.scalar(
            select(ReadingProgress).where(
                ReadingProgress.user_id == user.id, ReadingProgress.book_id == book.id
            )
        )
        if row is not None:
            index = 0
            if row.page_id is not None:
                index = await db.scalar(select(Page.index).where(Page.id == row.page_id)) or 0
            progress = {
                "book_id": book.id,
                "page_id": row.page_id,
                "page_index": index,
                "anchor": row.anchor,
                "percent": row.percent,
                "updated_at": row.updated_at,
            }

    import_source = None
    doc = await db.scalar(
        select(ImportedDocument).where(ImportedDocument.book_id == book.id).limit(1)
    )
    if doc is not None:
        import_source = {
            "id": doc.id,
            "filename": doc.filename,
            "source_type": doc.source_type.value if hasattr(doc.source_type, "value") else doc.source_type,
            "conversion_status": (
                doc.conversion_status.value
                if hasattr(doc.conversion_status, "value")
                else doc.conversion_status
            ),
            "original_url": f"/media/{doc.original_storage_key}",
        }

    return {
        **base,
        "back_cover": book.back_cover,
        "rating_distribution": distribution,
        "can_edit": access == "owner",
        "progress": progress,
        "import_source": import_source,
    }
