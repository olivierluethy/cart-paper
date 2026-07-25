from __future__ import annotations

from slugify import slugify


def safe_filename(title: str, fallback: str = "cart-paper-book") -> str:
    """A download name that survives every filesystem and Content-Disposition."""
    return slugify(title, max_length=80) or fallback
