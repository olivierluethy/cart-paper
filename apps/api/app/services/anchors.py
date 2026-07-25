"""Server-side anchor construction.

The web app builds anchors from a live ProseMirror selection. The seeder (and
anything else that needs to point at a passage without a browser) needs the same
positions, so this walks the document with ProseMirror's own position rules:
a node occupies one token for its opening, its content, then one for its close;
text nodes occupy exactly their length; the root document's content starts at 0.
"""

from __future__ import annotations

from typing import Any

CONTEXT_CHARS = 40


def _walk(node: dict[str, Any], pos: int, out: list[tuple[int, str]]) -> int:
    if node.get("type") == "text":
        text = node.get("text") or ""
        out.append((pos, text))
        return pos + len(text)

    inner = pos + 1
    for child in node.get("content") or []:
        inner = _walk(child, inner, out)
    return inner + 1


def flatten(doc: dict[str, Any]) -> tuple[str, list[int]]:
    """Plain text of a document plus a char-index → document-position map."""
    pieces: list[tuple[int, str]] = []
    pos = 0
    for child in doc.get("content") or []:
        pos = _walk(child, pos, pieces)

    text = ""
    positions: list[int] = []
    for start, value in pieces:
        for offset, char in enumerate(value):
            text += char
            positions.append(start + offset)
    return text, positions


def anchor_for(doc: dict[str, Any], page_id: Any, needle: str) -> dict[str, Any] | None:
    """Build an exact anchor for the first occurrence of ``needle``."""
    text, positions = flatten(doc)
    at = text.find(needle)
    if at == -1:
        return None
    start = positions[at]
    end = positions[at + len(needle) - 1] + 1
    return {
        "page_id": str(page_id),
        "from": start,
        "to": end,
        "quote": needle,
        "prefix": text[max(0, at - CONTEXT_CHARS) : at],
        "suffix": text[at + len(needle) : at + len(needle) + CONTEXT_CHARS],
    }
