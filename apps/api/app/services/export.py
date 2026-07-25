"""Server-side PDF export with WeasyPrint.

The printed book is deliberately light-on-white: a dark page is right on a
screen at night and wrong on paper. Covers are reproduced with their designed
background, one page break per book page, and the reader's own highlights and
notes can be appended as an index rather than smeared through the text.
"""

from __future__ import annotations

from html import escape
from typing import Any

from app.core.config import settings
from app.services.doc_to_html import doc_to_html

PRINT_CSS = """
@page {
  size: A5;
  margin: 18mm 16mm 20mm;
  @bottom-center { content: counter(page); font-family: 'DejaVu Serif', serif; font-size: 8pt; color: #777; }
}
@page :first { margin: 0; @bottom-center { content: none; } }

body { font-family: 'DejaVu Serif', Georgia, serif; font-size: 10.5pt; line-height: 1.55; color: #1b1a17; }
h1, h2, h3, h4 { font-family: 'DejaVu Serif', Georgia, serif; line-height: 1.2; break-after: avoid; }
h1 { font-size: 18pt; margin: 0 0 .4em; }
h2 { font-size: 14pt; margin: 1.4em 0 .3em; }
h3 { font-size: 12pt; margin: 1.2em 0 .3em; }
h4 { font-size: 11pt; margin: 1em 0 .3em; }
p { margin: 0 0 .75em; orphans: 2; widows: 2; }
blockquote { margin: 1em 0 1em 1em; padding-left: .9em; border-left: 2px solid #c9a227; font-style: italic; }
ul, ol { margin: 0 0 .8em 1.2em; padding: 0; }
li { margin-bottom: .25em; }
li.task { list-style: none; }
li.task .box { margin-right: .4em; }
pre { background: #f4f2ee; padding: .7em .9em; border-radius: 3px; font-family: 'DejaVu Sans Mono', monospace; font-size: 9pt; white-space: pre-wrap; }
code { font-family: 'DejaVu Sans Mono', monospace; font-size: .9em; }
hr { border: 0; text-align: center; margin: 1.6em 0; }
hr::before { content: '❦'; color: #999; }
a { color: #8a5a12; text-decoration: none; }

[data-block='callout'] { background: #faf4e6; border: 1px solid #e6d7b0; padding: .8em 1em; border-radius: 3px; }
[data-block='epigraph'] { text-align: center; font-style: italic; color: #57534b; max-width: 30ch; margin: 1.5em auto; }
[data-block='verse'] { white-space: pre-wrap; padding-left: 1.2em; font-style: italic; }
[data-scale='s'] { font-size: .86em; }
[data-scale='l'] { font-size: 1.2em; }

figure[data-cart-image] { margin: 1em 0; break-inside: avoid; }
figure[data-cart-image] img { width: 100%; }
figure[data-width='25'] { width: 25%; }
figure[data-width='50'] { width: 50%; }
figure[data-width='75'] { width: 75%; }
figure[data-align='center'] { margin-left: auto; margin-right: auto; }
figure[data-align='right'] { margin-left: auto; }
figcaption { font-size: 8.5pt; text-align: center; color: #6b6760; margin-top: .35em; }

.cover { height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;
         text-align: center; padding: 24mm; color: #fff; break-after: page; }
.cover h1 { font-size: 26pt; margin-bottom: .3em; }
.cover .subtitle { font-style: italic; opacity: .85; margin-bottom: 2em; }
.cover .author { text-transform: uppercase; letter-spacing: .16em; font-size: 9pt; opacity: .9; }

.page { break-after: page; }
.page:last-of-type { break-after: auto; }

.appendix { break-before: page; }
.appendix h2 { border-bottom: 1px solid #ddd; padding-bottom: .3em; }
.mark { margin: 0 0 1.1em; padding-left: .9em; border-left: 3px solid #c9a227; break-inside: avoid; }
.mark .where { font-size: 8.5pt; color: #8a857c; margin-bottom: .2em; }
.mark .quote { font-style: italic; margin-bottom: .3em; }
.mark .note { font-size: 9.5pt; }
"""


def _cover_style(design: dict[str, Any] | None) -> str:
    if not design:
        return "background: linear-gradient(150deg, #2b2118, #100c08);"
    kind = design.get("kind")
    if kind == "color" and design.get("color"):
        return f"background: {escape(str(design['color']), quote=True)};"
    if kind == "image" and design.get("image_url"):
        url = str(design["image_url"])
        if url.startswith("/"):
            url = f"{settings.public_api_url.rstrip('/')}{url}"
        return (
            "background-image: linear-gradient(rgba(0,0,0,.25), rgba(0,0,0,.6)), "
            f"url('{escape(url, quote=True)}'); background-size: cover; background-position: center;"
        )
    gradient = design.get("gradient") or ["#2b2118", "#100c08"]
    angle = design.get("angle", 150)
    return f"background: linear-gradient({angle}deg, {gradient[0]}, {gradient[-1]});"


def build_html(
    book: Any,
    pages: list[Any],
    *,
    highlights: list[Any] | None = None,
    notes: list[Any] | None = None,
    page_indexes: dict[Any, int] | None = None,
) -> str:
    media_base = settings.public_api_url.rstrip("/")
    parts: list[str] = [
        "<!doctype html><html><head><meta charset='utf-8'>",
        f"<title>{escape(book.title)}</title>",
        f"<style>{PRINT_CSS}</style></head><body>",
    ]

    parts.append(
        f"<section class='cover' style=\"{_cover_style(book.front_cover)}\">"
        f"<h1>{escape(book.title)}</h1>"
        + (f"<p class='subtitle'>{escape(book.subtitle)}</p>" if book.subtitle else "")
        + f"<p class='author'>{escape(book.author.display_name)}</p></section>"
    )

    for page in pages:
        parts.append(f"<section class='page'>{doc_to_html(page.content, media_base)}</section>")

    if highlights or notes:
        parts.append("<section class='appendix'><h2>Your marks</h2>")
        indexes = page_indexes or {}

        for highlight in highlights or []:
            quote = (highlight.anchor or {}).get("quote", "")
            page_number = indexes.get(highlight.page_id)
            where = f"Page {page_number + 1}" if page_number is not None else "This book"
            parts.append(
                f"<div class='mark'><div class='where'>{escape(where)}</div>"
                f"<div class='quote'>{escape(str(quote))}</div></div>"
            )

        for note in notes or []:
            quote = (note.anchor or {}).get("quote", "")
            page_number = indexes.get(note.page_id)
            where = f"Page {page_number + 1}" if page_number is not None else "This book"
            body = doc_to_html(note.body, media_base)
            parts.append(
                f"<div class='mark'><div class='where'>{escape(where)}</div>"
                + (f"<div class='quote'>{escape(str(quote))}</div>" if quote else "")
                + f"<div class='note'>{body}</div></div>"
            )
        parts.append("</section>")

    # Back cover last, so a printed copy closes the way it opens.
    if book.back_cover:
        text = book.back_cover.get("text") or book.description or ""
        parts.append(
            f"<section class='cover' style=\"{_cover_style(book.back_cover)}\">"
            f"<p class='subtitle'>{escape(str(text))}</p>"
            f"<p class='author'>{escape(book.author.display_name)}</p></section>"
        )

    parts.append("</body></html>")
    return "".join(parts)


def render_pdf(html: str) -> bytes:
    from weasyprint import HTML

    return HTML(string=html, base_url=settings.public_api_url).write_pdf()
