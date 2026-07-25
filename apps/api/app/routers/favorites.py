from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DbSession
from app.models import Book, BookStatus, Favorite
from app.schemas.book import BookSummary
from app.schemas.common import Ok
from app.services import books as svc

router = APIRouter(tags=["favorites"])


@router.post("/books/{ref}/favorite", response_model=Ok, status_code=201)
async def add_favorite(ref: str, db: DbSession, user: CurrentUser) -> Ok:
    book = await svc.load_book(db, ref)
    await svc.access_for(db, book, user)
    existing = await db.scalar(
        select(Favorite).where(Favorite.user_id == user.id, Favorite.book_id == book.id)
    )
    if existing is None:
        db.add(Favorite(user_id=user.id, book_id=book.id))
    return Ok()


@router.delete("/books/{ref}/favorite", response_model=Ok)
async def remove_favorite(ref: str, db: DbSession, user: CurrentUser) -> Ok:
    book = await svc.load_book(db, ref)
    existing = await db.scalar(
        select(Favorite).where(Favorite.user_id == user.id, Favorite.book_id == book.id)
    )
    if existing is not None:
        await db.delete(existing)
    return Ok()


@router.get("/favorites", response_model=list[BookSummary])
async def my_favorites(db: DbSession, user: CurrentUser) -> list[BookSummary]:
    rows = (
        await db.scalars(
            select(Book)
            .options(selectinload(Book.author))
            .join(Favorite, Favorite.book_id == Book.id)
            .where(Favorite.user_id == user.id, Book.status == BookStatus.published)
            .order_by(Favorite.created_at.desc())
        )
    ).all()
    return [BookSummary.model_validate(item) for item in await svc.summarize(db, list(rows), user)]
