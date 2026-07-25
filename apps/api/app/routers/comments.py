from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DbSession, InviteToken, MaybeUser
from app.models import Comment, NotificationType
from app.schemas.comment import CommentIn, CommentOut, CommentThread, CommentUpdate
from app.schemas.common import Ok
from app.services import books as svc
from app.services.notifications import notify

router = APIRouter(tags=["comments"])

TOMBSTONE = "[deleted]"


def _out(comment: Comment, reply_count: int = 0) -> CommentOut:
    """A deleted comment with replies survives as a tombstone so the thread holds."""
    return CommentOut(
        id=comment.id,
        book_id=comment.book_id,
        page_id=comment.page_id,
        parent_id=comment.parent_id,
        thread_id=comment.thread_id,
        author=None if comment.is_deleted else comment.author,
        body=TOMBSTONE if comment.is_deleted else comment.body,
        anchor=comment.anchor,
        is_deleted=comment.is_deleted,
        created_at=comment.created_at,
        edited_at=comment.edited_at,
        reply_count=reply_count,
    )


@router.get("/books/{ref}/comments", response_model=list[CommentThread])
async def list_comments(
    ref: str,
    db: DbSession,
    user: MaybeUser,
    invite: InviteToken,
    scope: str = Query("all", pattern="^(all|book|page)$"),
    page_id: uuid.UUID | None = None,
) -> list[CommentThread]:
    """`book` gives the whole-book conversation, `page` the passages on one page."""
    book = await svc.load_book(db, ref)
    await svc.access_for(db, book, user, invite)

    query = (
        select(Comment)
        .options(selectinload(Comment.author))
        .where(Comment.book_id == book.id)
        .order_by(Comment.created_at)
    )
    if scope == "book":
        query = query.where(Comment.anchor.is_(None), Comment.page_id.is_(None))
    elif scope == "page":
        if page_id is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "page_id is required for scope=page.")
        query = query.where(Comment.page_id == page_id)

    rows = list(await db.scalars(query))
    roots = [row for row in rows if row.parent_id is None]
    by_thread: dict[uuid.UUID, list[Comment]] = {}
    for row in rows:
        if row.parent_id is None:
            continue
        by_thread.setdefault(row.thread_id or row.parent_id, []).append(row)

    threads: list[CommentThread] = []
    for root in roots:
        replies = by_thread.get(root.id, [])
        # A thread whose root was deleted and which has no replies left is gone.
        if root.is_deleted and not replies:
            continue
        threads.append(
            CommentThread(
                root=_out(root, len(replies)),
                replies=[_out(reply) for reply in replies],
            )
        )
    return threads


@router.get("/comments/{comment_id}/thread", response_model=CommentThread)
async def get_thread(
    comment_id: uuid.UUID, db: DbSession, user: MaybeUser, invite: InviteToken
) -> CommentThread:
    comment = await _load(db, comment_id)
    book = await svc.load_book(db, str(comment.book_id))
    await svc.access_for(db, book, user, invite)

    root_id = comment.thread_id or comment.id
    root = await _load(db, root_id)
    replies = list(
        await db.scalars(
            select(Comment)
            .options(selectinload(Comment.author))
            .where(Comment.thread_id == root_id, Comment.id != root_id)
            .order_by(Comment.created_at)
        )
    )
    return CommentThread(root=_out(root, len(replies)), replies=[_out(reply) for reply in replies])


@router.post("/books/{ref}/comments", response_model=CommentOut, status_code=201)
async def create_comment(
    ref: str, payload: CommentIn, db: DbSession, user: CurrentUser, invite: InviteToken
) -> CommentOut:
    """Anchored when it carries a passage, book-level when it does not.

    Anchored comments are the point of the product: the discussion belongs to
    one line, and everyone reading that line finds it.
    """
    book = await svc.load_book(db, ref)
    await svc.access_for(db, book, user, invite)

    parent: Comment | None = None
    if payload.parent_id is not None:
        parent = await _load(db, payload.parent_id)
        if parent.book_id != book.id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "That reply belongs to another book.")

    comment = Comment(
        book_id=book.id,
        # A reply always inherits the passage it hangs under, so a whole thread
        # stays anchored even if the reply itself was written from the sidebar.
        page_id=parent.page_id if parent else payload.page_id,
        parent_id=parent.id if parent else None,
        author_id=user.id,
        body=payload.body.strip(),
        anchor=parent.anchor if parent else payload.anchor,
    )
    db.add(comment)
    await db.flush()
    comment.thread_id = (parent.thread_id or parent.id) if parent else comment.id
    await db.flush()

    if parent is not None:
        await notify(
            db,
            user_id=parent.author_id,
            type=NotificationType.comment_reply,
            actor_id=user.id,
            book_id=book.id,
            comment_id=comment.id,
        )
    if parent is None or parent.author_id != book.author_id:
        await notify(
            db,
            user_id=book.author_id,
            type=NotificationType.book_comment,
            actor_id=user.id,
            book_id=book.id,
            comment_id=comment.id,
        )

    await db.refresh(comment, ["author"])
    return _out(comment)


@router.patch("/comments/{comment_id}", response_model=CommentOut)
async def edit_comment(
    comment_id: uuid.UUID, payload: CommentUpdate, db: DbSession, user: CurrentUser
) -> CommentOut:
    comment = await _load(db, comment_id)
    if comment.author_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only edit your own comments.")
    if comment.is_deleted:
        raise HTTPException(status.HTTP_410_GONE, "That comment was deleted.")
    comment.body = payload.body.strip()
    comment.edited_at = datetime.now(UTC)
    await db.flush()
    await db.refresh(comment, ["author"])
    return _out(comment)


@router.delete("/comments/{comment_id}", response_model=Ok)
async def delete_comment(comment_id: uuid.UUID, db: DbSession, user: CurrentUser) -> Ok:
    """Soft delete when replies exist — hard delete when the comment is a leaf."""
    comment = await _load(db, comment_id)
    book = await svc.load_book(db, str(comment.book_id))
    if comment.author_id != user.id and book.author_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "That comment is not yours to delete.")

    replies = await db.scalar(
        select(func.count()).select_from(Comment).where(Comment.parent_id == comment.id)
    )
    if replies:
        comment.is_deleted = True
        comment.body = ""
    else:
        await db.delete(comment)
    return Ok()


async def _load(db: AsyncSession, comment_id: uuid.UUID) -> Comment:
    comment = await db.scalar(
        select(Comment).options(selectinload(Comment.author)).where(Comment.id == comment_id)
    )
    if comment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such comment.")
    return comment
