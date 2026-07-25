"""ProseMirror JSON → HTML, for the server-side PDF export.

Mirrors the class names the web app uses so the printed page and the screen
stay recognisably the same book.
"""

from __future__ import annotations

from html import escape
from typing import Any

MARK_TAGS = {
    "bold": ("<strong>", "</strong>"),
    "italic": ("<em>", "</em>"),
    "underline": ("<u>", "</u>"),
    "strike": ("<s>", "</s>"),
    "code": ("<code>", "</code>"),
    "superscript": ("<sup>", "</sup>"),
    "subscript": ("<sub>", "</sub>"),
}


def _marks(text: str, marks: list[dict[str, Any]] | None) -> str:
    out = escape(text)
    for mark in marks or []:
        kind = mark.get("type")
        if kind == "link":
            href = escape(str(mark.get("attrs", {}).get("href", "")), quote=True)
            out = f'<a href="{href}">{out}</a>'
        elif kind == "textStyle":
            scale = mark.get("attrs", {}).get("scale")
            if scale:
                out = f'<span data-scale="{escape(str(scale), quote=True)}">{out}</span>'
        elif kind in MARK_TAGS:
            open_tag, close_tag = MARK_TAGS[kind]
            out = f"{open_tag}{out}{close_tag}"
    return out


def _children(node: dict[str, Any], media_base: str) -> str:
    return "".join(node_to_html(child, media_base) for child in node.get("content", []) or [])


def node_to_html(node: dict[str, Any], media_base: str = "") -> str:  # noqa: PLR0911, PLR0912
    kind = node.get("type")
    attrs = node.get("attrs", {}) or {}

    if kind == "text":
        return _marks(node.get("text", ""), node.get("marks"))
    if kind == "hardBreak":
        return "<br/>"
    if kind == "horizontalRule":
        return "<hr/>"

    if kind == "paragraph":
        style = attrs.get("blockStyle")
        align = attrs.get("textAlign")
        parts = []
        if style:
            parts.append(f'data-block="{escape(str(style), quote=True)}"')
        if align and align != "left":
            parts.append(f'style="text-align:{escape(str(align), quote=True)}"')
        extra = (" " + " ".join(parts)) if parts else ""
        return f"<p{extra}>{_children(node, media_base)}</p>"

    if kind == "heading":
        level = min(max(int(attrs.get("level", 2)), 1), 4)
        return f"<h{level}>{_children(node, media_base)}</h{level}>"

    if kind == "blockquote":
        return f"<blockquote>{_children(node, media_base)}</blockquote>"
    if kind == "bulletList":
        return f"<ul>{_children(node, media_base)}</ul>"
    if kind == "orderedList":
        return f"<ol>{_children(node, media_base)}</ol>"
    if kind == "listItem":
        return f"<li>{_children(node, media_base)}</li>"
    if kind == "taskList":
        return f'<ul class="task">{_children(node, media_base)}</ul>'
    if kind == "taskItem":
        box = "☑" if attrs.get("checked") else "☐"
        return f'<li class="task"><span class="box">{box}</span>{_children(node, media_base)}</li>'
    if kind == "codeBlock":
        return f"<pre><code>{escape(_plain(node))}</code></pre>"

    if kind == "cartImage":
        src = str(attrs.get("src", ""))
        if src.startswith("/"):
            src = f"{media_base.rstrip('/')}{src}"
        caption = attrs.get("caption")
        figure = (
            f'<figure data-cart-image data-align="{escape(str(attrs.get("align", "center")), quote=True)}"'
            f' data-width="{escape(str(attrs.get("width", 100)), quote=True)}"'
            f' data-wrap="{escape(str(attrs.get("wrap", False)).lower(), quote=True)}">'
            f'<img src="{escape(src, quote=True)}" alt="{escape(str(attrs.get("alt") or ""), quote=True)}"/>'
        )
        if caption:
            figure += f"<figcaption>{escape(str(caption))}</figcaption>"
        return figure + "</figure>"

    if kind == "doc":
        return _children(node, media_base)

    # Unknown node: keep the words.
    return _children(node, media_base)


def _plain(node: dict[str, Any]) -> str:
    if node.get("type") == "text":
        return node.get("text", "")
    return "".join(_plain(child) for child in node.get("content", []) or [])


def doc_to_html(doc: dict[str, Any] | None, media_base: str = "") -> str:
    if not doc:
        return ""
    return node_to_html(doc, media_base)


def doc_to_text(doc: dict[str, Any] | None) -> str:
    return _plain(doc or {})
