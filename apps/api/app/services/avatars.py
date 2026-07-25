"""Avatar ingestion: fetch, crop, re-host.

Two rules:

* **Never hotlink.** A remote avatar is downloaded, cropped and stored locally.
  Rendering someone else's URL would let that host break every avatar on the
  page whenever it feels like it, and would leak each viewer's IP to it.
* **Never let a URL reach the private network.** Fetching a user-supplied
  address from the server is a classic SSRF, so the host is resolved first and
  anything loopback, link-local, private or otherwise reserved is refused —
  including on redirects.
"""

from __future__ import annotations

import io
import ipaddress
import socket
from dataclasses import dataclass
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException, status

from app.services.storage import storage

MAX_BYTES = 8 * 1024 * 1024
AVATAR_PX = 512
TIMEOUT = httpx.Timeout(8.0, connect=4.0)
ALLOWED = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"}


@dataclass
class RemoteImage:
    data: bytes
    mime: str
    width: int
    height: int


def _reject(message: str) -> HTTPException:
    return HTTPException(status.HTTP_400_BAD_REQUEST, message)


def _assert_public(host: str) -> None:
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror as exc:
        raise _reject("That address does not resolve.") from exc

    for info in infos:
        address = ipaddress.ip_address(info[4][0])
        if (
            address.is_private
            or address.is_loopback
            or address.is_link_local
            or address.is_reserved
            or address.is_multicast
            or address.is_unspecified
        ):
            raise _reject("That address points inside a private network.")


def fetch_remote_image(url: str) -> RemoteImage:
    parsed = urlparse(url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise _reject("Only http and https image links can be used.")
    _assert_public(parsed.hostname)

    try:
        with httpx.Client(timeout=TIMEOUT, follow_redirects=False) as client:
            response = client.get(url, headers={"User-Agent": "CART Paper avatar fetcher"})
            # Follow redirects by hand so every hop is re-checked.
            hops = 0
            while response.is_redirect and hops < 3:
                target = response.headers.get("location", "")
                nxt = urlparse(httpx.URL(response.url).join(target).__str__())
                if nxt.scheme not in {"http", "https"} or not nxt.hostname:
                    raise _reject("That link redirects somewhere unusable.")
                _assert_public(nxt.hostname)
                response = client.get(str(nxt), headers={"User-Agent": "CART Paper avatar fetcher"})
                hops += 1
    except httpx.HTTPError as exc:
        raise _reject("That link could not be reached.") from exc

    if response.status_code >= 400:
        raise _reject(f"That link returned {response.status_code}.")

    mime = (response.headers.get("content-type") or "").split(";")[0].strip().lower()
    if mime not in ALLOWED:
        raise _reject("That link is not an image (JPEG, PNG, WebP, GIF or AVIF).")

    data = response.content
    if len(data) > MAX_BYTES:
        raise _reject("That image is larger than 8 MB.")

    width, height = _dimensions(data)
    return RemoteImage(data=data, mime=mime, width=width, height=height)


def _dimensions(data: bytes) -> tuple[int, int]:
    from PIL import Image

    try:
        with Image.open(io.BytesIO(data)) as image:
            return image.size
    except Exception as exc:  # noqa: BLE001
        raise _reject("That file could not be read as an image.") from exc


def check_upload(data: bytes, mime: str) -> RemoteImage:
    if mime not in ALLOWED:
        raise _reject("Avatars must be a JPEG, PNG, WebP, GIF or AVIF image.")
    if len(data) > MAX_BYTES:
        raise _reject("That image is larger than 8 MB.")
    width, height = _dimensions(data)
    return RemoteImage(data=data, mime=mime, width=width, height=height)


def store_avatar(data: bytes, *, x: float, y: float, size: float) -> str:
    """Crop the requested square, normalise to 512×512 WebP, store it."""
    from PIL import Image

    with Image.open(io.BytesIO(data)) as image:
        image = image.convert("RGB") if image.mode not in {"RGB", "RGBA"} else image
        width, height = image.size

        side = max(16.0, min(size, float(min(width, height))))
        left = max(0, min(int(round(x)), width - int(side)))
        top = max(0, min(int(round(y)), height - int(side)))
        box = (left, top, left + int(side), top + int(side))

        cropped = image.crop(box).resize((AVATAR_PX, AVATAR_PX), Image.LANCZOS)
        buffer = io.BytesIO()
        cropped.convert("RGB").save(buffer, format="WEBP", quality=88, method=4)
        payload = buffer.getvalue()

    key = storage.save(payload, suffix=".webp", prefix="avatars")
    return storage.url(key)
