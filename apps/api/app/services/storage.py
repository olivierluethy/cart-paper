"""File storage behind a narrow interface.

v1 writes to a local volume mounted at ``UPLOAD_DIR`` and serves it from the API
at ``/media/...``. Everything else in the codebase goes through ``storage``, so
dropping in S3 later means implementing one class.
"""

from __future__ import annotations

import io
import secrets
from datetime import UTC, datetime
from pathlib import Path
from typing import Protocol

from fastapi import HTTPException, status

from app.core.config import settings

IMAGE_MIMES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/avif": ".avif",
    "image/svg+xml": ".svg",
}

DOCUMENT_MIMES = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}

# Raster images are capped so a 6000px phone photo does not become a book page.
MAX_IMAGE_EDGE = 2400


class StorageBackend(Protocol):
    def save(self, data: bytes, *, suffix: str, prefix: str = "") -> str: ...

    def url(self, key: str) -> str: ...

    def path(self, key: str) -> Path: ...

    def delete(self, key: str) -> None: ...

    def read(self, key: str) -> bytes: ...


class LocalStorage:
    def __init__(self, root: Path) -> None:
        self.root = root

    def save(self, data: bytes, *, suffix: str, prefix: str = "") -> str:
        stamp = datetime.now(UTC).strftime("%Y/%m")
        name = f"{secrets.token_hex(10)}{suffix}"
        key = "/".join(part for part in (prefix, stamp, name) if part)
        target = self._resolve(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        return key

    def url(self, key: str) -> str:
        return f"/media/{key}"

    def path(self, key: str) -> Path:
        return self._resolve(key)

    def read(self, key: str) -> bytes:
        return self._resolve(key).read_bytes()

    def delete(self, key: str) -> None:
        target = self._resolve(key)
        if target.exists():
            target.unlink()

    def _resolve(self, key: str) -> Path:
        """Refuse anything that escapes the upload root."""
        candidate = (self.root / key.lstrip("/")).resolve()
        root = self.root.resolve()
        if not candidate.is_relative_to(root):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid storage key.")
        return candidate


storage: StorageBackend = LocalStorage(settings.upload_dir)


def check_size(data: bytes) -> None:
    limit = settings.max_upload_mb * 1024 * 1024
    if len(data) > limit:
        raise HTTPException(413, f"That file is larger than {settings.max_upload_mb} MB.")


def normalise_image(data: bytes, mime: str) -> tuple[bytes, str, int | None, int | None]:
    """Downscale oversized rasters and drop metadata. SVG passes through as-is."""
    if mime == "image/svg+xml":
        return data, mime, None, None

    try:
        from PIL import Image  # imported lazily: the API boots without touching Pillow
    except ImportError:  # pragma: no cover - Pillow is a hard dependency in the image
        return data, mime, None, None

    try:
        with Image.open(io.BytesIO(data)) as image:
            image.load()
            width, height = image.size
            if mime == "image/gif" and getattr(image, "is_animated", False):
                # Re-encoding would flatten the animation; keep the original.
                return data, mime, width, height

            longest = max(width, height)
            if longest <= MAX_IMAGE_EDGE and mime in {"image/jpeg", "image/png", "image/webp"}:
                # Already reasonable — re-save anyway so EXIF (including GPS) is gone.
                pass

            if longest > MAX_IMAGE_EDGE:
                scale = MAX_IMAGE_EDGE / longest
                image = image.resize((round(width * scale), round(height * scale)), Image.LANCZOS)
                width, height = image.size

            buffer = io.BytesIO()
            if image.mode in {"RGBA", "LA", "P"}:
                image = image.convert("RGBA")
                image.save(buffer, format="PNG", optimize=True)
                return buffer.getvalue(), "image/png", width, height

            image.convert("RGB").save(buffer, format="JPEG", quality=86, optimize=True, progressive=True)
            return buffer.getvalue(), "image/jpeg", width, height
    except Exception:  # noqa: BLE001 — a decode failure should not lose the upload
        return data, mime, None, None
