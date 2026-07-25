"""HTML → ProseMirror JSON.

Used by the DOCX importer. Deliberately conservative: anything it does not
recognise becomes a paragraph rather than being dropped, because losing a
sentence during an import is much worse than losing its styling.
"""

from __future__ import annotations

from typing import Any

from bs4 import BeautifulSoup, NavigableString, Tag

INLINE_MARKS = {
    "strong": "bold",
    "b": "bold",
    "em": "italic",
    "i": "italic",
    "u": "underline",
    "s": "strike",
    "strike": "strike",
    "del": "strike",
    "code": "code",
    "sup": "superscript",
    "sub": "subscript",
}

HEADINGS = {"h1": 1, "h2": 2, "h3": 3, "h4": 4, "h5": 4, "h6": 4}


def _text_node(text: str, marks: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not text:
        return None
    node: dict[str, Any] = {"type": "text", "text": text}
    if marks:
        node["marks"] = marks
    return node


def _inline(node: Tag | NavigableString, marks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if isinstance(node, NavigableString):
        item = _text_node(str(node), marks)
        return [item] if item else []

    name = node.name.lower()
    if name == "br":
        return [{"type": "hardBreak"}]
    if name == "img":
        src = node.get("src")
        return (
            [
                {
                    "type": "cartImage",
                    "attrs": {
                        "src": src,
                        "alt": node.get("alt"),
                        "caption": None,
                        "align": "center",
                        "width": 100,
                        "wrap": False,
                    },
                }
            ]
            if src
            else []
        )

    next_marks = list(marks)
    if name in INLINE_MARKS:
        next_marks.append({"type": INLINE_MARKS[name]})
    elif name == "a" and node.get("href"):
        next_marks.append({"type": "link", "attrs": {"href": node.get("href")}})

    out: list[dict[str, Any]] = []
    for child in node.children:
        out.extend(_inline(child, next_marks))
    return out


def _block(node: Tag) -> list[dict[str, Any]]:
    name = node.name.lower()

    if name in HEADINGS:
        content = _inline(node, [])
        return [{"type": "heading", "attrs": {"level": HEADINGS[name]}, "content": content}] if content else []

    if name in {"ul", "ol"}:
        items = []
        for li in node.find_all("li", recursive=False):
            inner = _blocks_of(li) or [{"type": "paragraph", "content": _inline(li, [])}]
            items.append({"type": "listItem", "content": inner})
        if not items:
            return []
        return [{"type": "bulletList" if name == "ul" else "orderedList", "content": items}]

    if name == "blockquote":
        inner = _blocks_of(node) or [{"type": "paragraph", "content": _inline(node, [])}]
        return [{"type": "blockquote", "content": inner}]

    if name == "pre":
        text = node.get_text()
        return [{"type": "codeBlock", "content": [{"type": "text", "text": text}]}] if text.strip() else []

    if name == "hr":
        return [{"type": "horizontalRule"}]

    if name == "table":
        # Tables are not a CART block type; keep the words, drop the grid.
        rows = [
            " · ".join(cell.get_text(" ", strip=True) for cell in row.find_all(["td", "th"]))
            for row in node.find_all("tr")
        ]
        return [
            {"type": "paragraph", "content": [{"type": "text", "text": line}]}
            for line in rows
            if line.strip()
        ]

    if name == "img":
        return _inline(node, [])

    content = _inline(node, [])
    # A bare image is a block of its own, not an empty paragraph wrapping one.
    if len(content) == 1 and content[0].get("type") == "cartImage":
        return content
    images = [item for item in content if item.get("type") == "cartImage"]
    inline = [item for item in content if item.get("type") != "cartImage"]
    out: list[dict[str, Any]] = []
    if any((item.get("text") or "").strip() for item in inline if item.get("type") == "text"):
        out.append({"type": "paragraph", "content": inline})
    out.extend(images)
    return out


def _blocks_of(parent: Tag) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for child in parent.children:
        if isinstance(child, NavigableString):
            text = str(child).strip()
            if text:
                out.append({"type": "paragraph", "content": [{"type": "text", "text": text}]})
        elif isinstance(child, Tag):
            out.extend(_block(child))
    return out


def html_to_doc(html: str) -> dict[str, Any]:
    soup = BeautifulSoup(html, "lxml")
    root = soup.body or soup
    blocks = _blocks_of(root)
    if not blocks:
        blocks = [{"type": "paragraph"}]
    return {"type": "doc", "content": blocks}


def split_into_pages(doc: dict[str, Any], max_blocks: int = 24) -> list[dict[str, Any]]:
    """One CART page per H1 section, falling back to a block budget.

    A wall of text is worse to read than slightly arbitrary page breaks, so a
    section longer than ``max_blocks`` is split rather than left whole.
    """
    pages: list[list[dict[str, Any]]] = []
    current: list[dict[str, Any]] = []

    for block in doc.get("content", []):
        starts_section = block.get("type") == "heading" and block.get("attrs", {}).get("level") == 1
        if current and (starts_section or len(current) >= max_blocks):
            pages.append(current)
            current = []
        current.append(block)
    if current:
        pages.append(current)
    if not pages:
        pages = [[{"type": "paragraph"}]]

    return [{"type": "doc", "content": blocks} for blocks in pages]
