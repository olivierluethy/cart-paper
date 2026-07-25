from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, DbSession
from app.models import NotificationType, Rating
from app.schemas.rating import RatingIn, RatingSummary
from app.services import books as svc
from app.services.notifications import notify

router = APIRouter(tags=["ratings"])


async def _summary(db: AsyncSession, book_id: uuid.UUID, user_id: uuid.UUID) -> RatingSummary:
    rows = await db.execute(
        select(Rating.value, func.count()).where(Rating.book_id == book_id).group_by(Rating.value)
    )
    distribution = {str(value): 0 for value in range(1, 6)}
    total = 0
    weighted = 0
    for value, count in rows:
        distribution[str(value)] = count
        total += count
        weighted += value * count
    mine = await db.scalar(
        select(Rating.value).where(Rating.book_id == book_id, Rating.user_id == user_id)
    )
    return RatingSummary(
        average=round(weighted / total, 2) if total else 0.0,
        count=total,
        distribution=distribution,
        my_rating=mine,
    )


@router.put("/books/{ref}/rating", response_model=RatingSummary)
async def rate(ref: str, payload: RatingIn, db: DbSession, user: CurrentUser) -> RatingSummary:
    """One rating per user per book, editable. Rating your own book is not a review."""
    book = await svc.load_book(db, ref)
    await svc.access_for(db, book, user)
    if book.author_id == user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot rate your own book.")

    existing = await db.scalar(
        select(Rating).where(Rating.book_id == book.id, Rating.user_id == user.id)
    )
    first_time = existing is None
    if existing is None:
        db.add(Rating(user_id=user.id, book_id=book.id, value=payload.value))
    else:
        existing.value = payload.value
    await db.flush()

    # Only announce a new rating; changing your mind is not worth a notification.
    if first_time:
        await notify(
            db,
            user_id=book.author_id,
            type=NotificationType.book_rating,
            actor_id=user.id,
            book_id=book.id,
        )

    return await _summary(db, book.id, user.id)


@router.delete("/books/{ref}/rating", response_model=RatingSummary)
async def unrate(ref: str, db: DbSession, user: CurrentUser) -> RatingSummary:
    book = await svc.load_book(db, ref)
    existing = await db.scalar(
        select(Rating).where(Rating.book_id == book.id, Rating.user_id == user.id)
    )
    if existing is not None:
        await db.delete(existing)
        await db.flush()
    return await _summary(db, book.id, user.id)


@router.get("/books/{ref}/rating", response_model=RatingSummary)
async def rating_summary(ref: str, db: DbSession, user: CurrentUser) -> RatingSummary:
    book = await svc.load_book(db, ref)
    await svc.access_for(db, book, user)
    return await _summary(db, book.id, user.id)
