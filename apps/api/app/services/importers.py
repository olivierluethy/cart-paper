"""Best-effort conversion of uploaded documents into CART pages.

Two rules govern everything here:

  * the original file is kept, always, so a poor conversion is never a loss;
  * a conversion that cannot be trusted is reported as low confidence rather
    than dressed up — the reader falls back to the PDF viewer, where
    highlighting, notes and anchored comments still work.
"""

from __future__ import annotations

import io
import statistics
from dataclasses import dataclass, field
from typing import Any

from app.services.html_to_doc import html_to_doc, split_into_pages
from app.services.storage import IMAGE_MIMES, storage


@dataclass
class Conversion:
    pages: list[dict[str, Any]] = field(default_factory=list)
    pages_total: int = 0
    pages_clean: int = 0
    images: int = 0
    warnings: list[str] = field(default_factory=list)
    confidence: float = 1.0
    title: str | None = None

    def report(self) -> dict[str, Any]:
        return {
            "pages_total": self.pages_total,
            "pages_clean": self.pages_clean,
            "images": self.images,
            "warnings": self.warnings,
            "confidence": round(self.confidence, 2),
        }


# --------------------------------------------------------------------------- docx
def convert_docx(data: bytes) -> Conversion:
    import mammoth

    result = Conversion()
    images: list[str] = []

    def handle_image(image):  # noqa: ANN001 - mammoth's own type
        with image.open() as stream:
            payload = stream.read()
        suffix = IMAGE_MIMES.get(image.content_type or "", ".png")
        key = storage.save(payload, suffix=suffix, prefix="imports")
        images.append(key)
        return {"src": storage.url(key)}

    try:
        converted = mammoth.convert_to_html(
            io.BytesIO(data), convert_image=mammoth.images.img_element(handle_image)
        )
    except Exception as exc:  # noqa: BLE001
        result.warnings.append(f"Word conversion failed: {exc}")
        result.confidence = 0.0
        return result

    for message in converted.messages[:20]:
        result.warnings.append(str(message))

    doc = html_to_doc(converted.value)
    result.pages = split_into_pages(doc)
    result.pages_total = len(result.pages)
    result.pages_clean = sum(1 for page in result.pages if _has_text(page))
    result.images = len(images)
    result.title = _first_heading(doc)
    result.confidence = result.pages_clean / result.pages_total if result.pages_total else 0.0
    return result


# ---------------------------------------------------------------------------- pdf
def convert_pdf(data: bytes) -> Conversion:
    import pdfplumber

    result = Conversion()

    try:
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            result.pages_total = len(pdf.pages)
            for number, page in enumerate(pdf.pages, start=1):
                blocks, clean = _pdf_page_blocks(page)
                if clean:
                    result.pages_clean += 1
                else:
                    result.warnings.append(f"Page {number} had no extractable text.")
                result.pages.append({"type": "doc", "content": blocks or [{"type": "paragraph"}]})
    except Exception as exc:  # noqa: BLE001
        result.warnings.append(f"PDF conversion failed: {exc}")
        result.confidence = 0.0
        return result

    result.images = _extract_pdf_images(data, result)
    result.confidence = result.pages_clean / result.pages_total if result.pages_total else 0.0
    if result.pages:
        result.title = _first_heading({"content": result.pages[0]["content"]})
    return result


def _pdf_page_blocks(page: Any) -> tuple[list[dict[str, Any]], bool]:
    """Headings by relative font size, paragraphs by vertical gap."""
    try:
        lines = page.extract_text_lines(strip=True) or []
    except Exception:  # noqa: BLE001
        lines = []

    if not lines:
        return [], False

    sizes = [line.get("bottom", 0) - line.get("top", 0) for line in lines if line.get("text")]
    body_size = statistics.median(sizes) if sizes else 0

    blocks: list[dict[str, Any]] = []
    paragraph: list[str] = []
    previous_bottom: float | None = None

    def flush() -> None:
        if paragraph:
            text = " ".join(paragraph).strip()
            if text:
                blocks.append({"type": "paragraph", "content": [{"type": "text", "text": text}]})
            paragraph.clear()

    for line in lines:
        text = (line.get("text") or "").strip()
        if not text:
            continue
        height = line.get("bottom", 0) - line.get("top", 0)
        gap = (line.get("top", 0) - previous_bottom) if previous_bottom is not None else 0
        previous_bottom = line.get("bottom", 0)

        # Noticeably larger and short enough to be a title, not a sentence.
        if body_size and height > body_size * 1.28 and len(text) < 120:
            flush()
            level = 1 if height > body_size * 1.7 else 2
            blocks.append({"type": "heading", "attrs": {"level": level}, "content": [{"type": "text", "text": text}]})
            continue

        if gap > height * 1.6 and paragraph:
            flush()
        paragraph.append(text)

    flush()
    return blocks, bool(blocks)


def _extract_pdf_images(data: bytes, result: Conversion) -> int:
    """Images are stored as assets; placing them accurately is out of scope for v1."""
    try:
        from pypdf import PdfReader
    except ImportError:  # pragma: no cover
        return 0

    count = 0
    try:
        reader = PdfReader(io.BytesIO(data))
        for page_number, page in enumerate(reader.pages):
            if page_number >= len(result.pages):
                break
            for image in list(page.images)[:6]:
                key = storage.save(image.data, suffix=".png", prefix="imports")
                result.pages[page_number]["content"].append(
                    {
                        "type": "cartImage",
                        "attrs": {
                            "src": storage.url(key),
                            "alt": None,
                            "caption": None,
                            "align": "center",
                            "width": 100,
                            "wrap": False,
                        },
                    }
                )
                count += 1
    except Exception as exc:  # noqa: BLE001
        result.warnings.append(f"Some images could not be extracted: {exc}")
    return count


# ------------------------------------------------------------------------ helpers
def _has_text(page: dict[str, Any]) -> bool:
    def walk(node: dict[str, Any]) -> bool:
        if node.get("type") == "text" and (node.get("text") or "").strip():
            return True
        if node.get("type") == "cartImage":
            return True
        return any(walk(child) for child in node.get("content", []) or [])

    return walk(page)


def _first_heading(doc: dict[str, Any]) -> str | None:
    for block in doc.get("content", []):
        if block.get("type") == "heading":
            text = "".join(item.get("text", "") for item in block.get("content", []) or [])
            if text.strip():
                return text.strip()[:200]
    for block in doc.get("content", []):
        if block.get("type") == "paragraph":
            text = "".join(item.get("text", "") for item in block.get("content", []) or [])
            if text.strip():
                return text.strip()[:80]
    return None
