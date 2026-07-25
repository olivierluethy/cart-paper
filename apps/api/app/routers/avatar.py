from __future__ import annotations

import mimetypes

from fastapi import APIRouter, File, Form, UploadFile
from pydantic import BaseModel

from app.core.deps import CurrentUser, DbSession
from app.schemas.user import UserMe
from app.services.avatars import check_upload, fetch_remote_image, store_avatar
from app.services.storage import storage

router = APIRouter(prefix="/me/avatar", tags=["profile"])


class AvatarUrlIn(BaseModel):
    url: str


class AvatarPreviewOut(BaseModel):
    url: str
    mime: str
    width: int
    height: int
    size: int


class AvatarCropIn(BaseModel):
    url: str
    x: float = 0
    y: float = 0
    size: float = 0


@router.post("/preview", response_model=AvatarPreviewOut)
async def preview(payload: AvatarUrlIn, user: CurrentUser) -> AvatarPreviewOut:
    """Validate a pasted link on the server.

    Doing this here rather than in an <img> means CORS, mixed content and hotlink
    blocking can never make a perfectly good link look broken to the user — and
    a bad one gets a specific error instead of a silent blank box.
    """
    image = fetch_remote_image(payload.url)
    return AvatarPreviewOut(
        url=payload.url,
        mime=image.mime,
        width=image.width,
        height=image.height,
        size=len(image.data),
    )


@router.post("/url", response_model=UserMe)
async def set_from_url(payload: AvatarCropIn, db: DbSession, user: CurrentUser) -> UserMe:
    image = fetch_remote_image(payload.url)
    size = payload.size or float(min(image.width, image.height))
    user.avatar_url = store_avatar(image.data, x=payload.x, y=payload.y, size=size)
    await db.flush()
    return user


@router.post("", response_model=UserMe)
async def set_from_upload(
    db: DbSession,
    user: CurrentUser,
    file: UploadFile = File(...),
    x: float = Form(0),
    y: float = Form(0),
    size: float = Form(0),
) -> UserMe:
    mime = file.content_type or mimetypes.guess_type(file.filename or "")[0] or ""
    data = await file.read()
    image = check_upload(data, mime)
    user.avatar_url = store_avatar(data, x=x, y=y, size=size or float(min(image.width, image.height)))
    await db.flush()
    return user


@router.delete("", response_model=UserMe)
async def remove(db: DbSession, user: CurrentUser) -> UserMe:
    """Back to the initials fallback, which is a perfectly good avatar."""
    previous = user.avatar_url
    user.avatar_url = None
    await db.flush()
    if previous and previous.startswith("/media/"):
        storage.delete(previous.removeprefix("/media/"))
    return user
