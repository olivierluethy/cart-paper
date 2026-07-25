from __future__ import annotations

import secrets

from slugify import slugify
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Book, User

RESERVED = {"me", "admin", "api", "write", "read", "u", "books", "new", "settings", "notifications"}


async def unique_handle(db: AsyncSession, display_name: str) -> str:
    base = slugify(display_name, max_length=40) or "reader"
    if base in RESERVED:
        base = f"{base}-1"
    candidate = base
    for _ in range(6):
        taken = await db.scalar(select(User.id).where(User.handle == candidate))
        if taken is None:
            return candidate
        candidate = f"{base}-{secrets.randbelow(9000) + 1000}"
    return f"{base}-{secrets.token_hex(4)}"


async def unique_book_slug(db: AsyncSession, title: str) -> str:
    base = slugify(title, max_length=200) or "untitled"
    candidate = base
    for _ in range(6):
        taken = await db.scalar(select(Book.id).where(Book.slug == candidate))
        if taken is None:
            return candidate
        candidate = f"{base}-{secrets.randbelow(9000) + 1000}"
    return f"{base}-{secrets.token_hex(4)}"
