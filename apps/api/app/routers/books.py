from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DbSession, InviteToken, MaybeUser
from app.models import Book, BookStatus, Page
from app.schemas.book import (
    EMPTY_DOC,
    BookCreate,
    BookDetail,
    BookSummary,
    BookUpdate,
    PageCreate,
    PageOut,
    PageReorder,
    PageSummary,
    PageUpdate,
)
from app.schemas.common import Ok, Page as PageEnvelope
from app.services import books as svc
from app.services.handles import unique_book_slug

router = APIRouter(prefix="/books", tags=["books"])


# ------------------------------------------------------------------ collections
@router.get("", response_model=PageEnvelope[BookSummary])
async def list_books(
    db: DbSession,
    user: MaybeUser,
    limit: int = Query(24, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> PageEnvelope[BookSummary]:
    """The public library: published books only. Search and filters land in step 18."""
    where = Book.status == BookStatus.published
    total = await db.scalar(select(func.count()).select_from(Book).where(where)) or 0
    rows = (
        await db.scalars(
            select(Book)
            .options(selectinload(Book.author))
            .where(where)
            .order_by(Book.published_at.desc().nullslast(), Book.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    items = await svc.summarize(db, list(rows), user)
    return PageEnvelope[BookSummary](
        items=[BookSummary.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/mine", response_model=list[BookSummary])
async def my_books(
    db: DbSession,
    user: CurrentUser,
    status_filter: str | None = Query(None, alias="status", pattern="^(draft|published)$"),
) -> list[BookSummary]:
    query = select(Book).options(selectinload(Book.author)).where(Book.author_id == user.id)
    if status_filter:
        query = query.where(Book.status == BookStatus(status_filter))
    rows = (await db.scalars(query.order_by(Book.updated_at.desc()))).all()
    return [BookSummary.model_validate(item) for item in await svc.summarize(db, list(rows), user)]


@router.post("", response_model=BookDetail, status_code=status.HTTP_201_CREATED)
async def create_book(payload: BookCreate, db: DbSession, user: CurrentUser) -> BookDetail:
    """A new book is a draft with one empty page — never an empty workspace."""
    book = Book(
        author_id=user.id,
        title=payload.title.strip() or "Untitled",
        subtitle=payload.subtitle,
        description=payload.description,
        language=payload.language,
        tags=payload.tags,
        slug=await unique_book_slug(db, payload.title),
        status=BookStatus.draft,
    )
    db.add(book)
    await db.flush()
    db.add(Page(book_id=book.id, index=0, content=dict(EMPTY_DOC)))
    await db.flush()
    await db.refresh(book, ["author"])
    return BookDetail.model_validate(await svc.detail(db, book, user, "owner"))


# ------------------------------------------------------------------ single book
@router.get("/{ref}", response_model=BookDetail)
async def get_book(ref: str, db: DbSession, user: MaybeUser, invite: InviteToken) -> BookDetail:
    book = await svc.load_book(db, ref)
    access = await svc.access_for(db, book, user, invite)
    await db.refresh(book, ["author"])
    return BookDetail.model_validate(await svc.detail(db, book, user, access))


@router.patch("/{ref}", response_model=BookDetail)
async def update_book(ref: str, payload: BookUpdate, db: DbSession, user: CurrentUser) -> BookDetail:
    book = await svc.load_book(db, ref)
    svc.require_owner(book, user)

    data = payload.model_dump(exclude_unset=True)
    if "front_cover" in data and payload.front_cover is not None:
        data["front_cover"] = payload.front_cover.model_dump()
    if "back_cover" in data and payload.back_cover is not None:
        data["back_cover"] = payload.back_cover.model_dump()
    for field, value in data.items():
        setattr(book, field, value)

    await db.flush()
    await db.refresh(book, ["author"])
    return BookDetail.model_validate(await svc.detail(db, book, user, "owner"))


@router.delete("/{ref}", response_model=Ok)
async def delete_book(ref: str, db: DbSession, user: CurrentUser) -> Ok:
    book = await svc.load_book(db, ref)
    svc.require_owner(book, user)
    await db.delete(book)
    return Ok()


# ----------------------------------------------------------------------- pages
@router.get("/{ref}/pages", response_model=list[PageSummary])
async def list_pages(ref: str, db: DbSession, user: MaybeUser, invite: InviteToken) -> list[PageSummary]:
    book = await svc.load_book(db, ref)
    await svc.access_for(db, book, user, invite)
    rows = await db.scalars(select(Page).where(Page.book_id == book.id).order_by(Page.index))
    return [PageSummary.model_validate(row) for row in rows]


@router.get("/{ref}/pages/full", response_model=list[PageOut])
async def list_pages_full(ref: str, db: DbSession, user: MaybeUser, invite: InviteToken) -> list[PageOut]:
    """Whole book in one request — the reader wants every page up front."""
    book = await svc.load_book(db, ref)
    await svc.access_for(db, book, user, invite)
    rows = await db.scalars(select(Page).where(Page.book_id == book.id).order_by(Page.index))
    return [PageOut.model_validate(row) for row in rows]


@router.post("/{ref}/pages", response_model=PageOut, status_code=status.HTTP_201_CREATED)
async def create_page(ref: str, payload: PageCreate, db: DbSession, user: CurrentUser) -> PageOut:
    book = await svc.load_book(db, ref)
    svc.require_owner(book, user)

    existing = list(await db.scalars(select(Page).where(Page.book_id == book.id).order_by(Page.index)))
    at = len(existing) if payload.index is None else max(0, min(payload.index, len(existing)))
    for page in existing[at:]:
        page.index += 1

    page = Page(
        book_id=book.id,
        index=at,
        title=payload.title,
        content=payload.content or dict(EMPTY_DOC),
    )
    db.add(page)
    await db.flush()
    return PageOut.model_validate(page)


@router.post("/{ref}/pages/reorder", response_model=list[PageSummary])
async def reorder_pages(
    ref: str, payload: PageReorder, db: DbSession, user: CurrentUser
) -> list[PageSummary]:
    book = await svc.load_book(db, ref)
    svc.require_owner(book, user)

    pages = {p.id: p for p in await db.scalars(select(Page).where(Page.book_id == book.id))}
    if set(payload.page_ids) != set(pages):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "The new order must list every page of this book exactly once."
        )
    # Two passes through a negative range: index is not unique-constrained, but
    # keeping the intermediate state disjoint keeps it safe to add one later.
    for offset, page_id in enumerate(payload.page_ids):
        pages[page_id].index = -(offset + 1)
    await db.flush()
    for offset, page_id in enumerate(payload.page_ids):
        pages[page_id].index = offset
    await db.flush()

    rows = await db.scalars(select(Page).where(Page.book_id == book.id).order_by(Page.index))
    return [PageSummary.model_validate(row) for row in rows]


@router.post("/{ref}/pages/{page_id}/duplicate", response_model=PageOut, status_code=201)
async def duplicate_page(
    ref: str, page_id: uuid.UUID, db: DbSession, user: CurrentUser
) -> PageOut:
    book = await svc.load_book(db, ref)
    svc.require_owner(book, user)
    source = await _page_of(db, book.id, page_id)

    later = await db.scalars(
        select(Page).where(Page.book_id == book.id, Page.index > source.index).order_by(Page.index)
    )
    for page in later:
        page.index += 1

    copy = Page(
        book_id=book.id,
        index=source.index + 1,
        title=f"{source.title} (copy)" if source.title else None,
        content=source.content,
    )
    db.add(copy)
    await db.flush()
    return PageOut.model_validate(copy)


@router.get("/{ref}/pages/{page_id}", response_model=PageOut)
async def get_page(
    ref: str, page_id: uuid.UUID, db: DbSession, user: MaybeUser, invite: InviteToken
) -> PageOut:
    book = await svc.load_book(db, ref)
    await svc.access_for(db, book, user, invite)
    return PageOut.model_validate(await _page_of(db, book.id, page_id))


@router.patch("/{ref}/pages/{page_id}", response_model=PageOut)
async def update_page(
    ref: str, page_id: uuid.UUID, payload: PageUpdate, db: DbSession, user: CurrentUser
) -> PageOut:
    book = await svc.load_book(db, ref)
    svc.require_owner(book, user)
    page = await _page_of(db, book.id, page_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(page, field, value)
    await db.flush()
    return PageOut.model_validate(page)


@router.delete("/{ref}/pages/{page_id}", response_model=Ok)
async def delete_page(ref: str, page_id: uuid.UUID, db: DbSession, user: CurrentUser) -> Ok:
    book = await svc.load_book(db, ref)
    svc.require_owner(book, user)
    page = await _page_of(db, book.id, page_id)

    count = await db.scalar(select(func.count()).select_from(Page).where(Page.book_id == book.id))
    if (count or 0) <= 1:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A book needs at least one page.")

    removed_index = page.index
    await db.delete(page)
    await db.flush()
    later = await db.scalars(
        select(Page).where(Page.book_id == book.id, Page.index > removed_index).order_by(Page.index)
    )
    for item in later:
        item.index -= 1
    return Ok()


async def _page_of(db: AsyncSession, book_id: uuid.UUID, page_id: uuid.UUID) -> Page:
    page = await db.scalar(select(Page).where(Page.id == page_id, Page.book_id == book_id))
    if page is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That page is not in this book.")
    return page
