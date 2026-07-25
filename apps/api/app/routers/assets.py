from __future__ import annotations

import mimetypes

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select

from app.core.deps import CurrentUser, DbSession
from app.models import BookAsset
from app.schemas.common import Ok
from app.schemas.media import AssetOut
from app.services import books as book_svc
from app.services.storage import IMAGE_MIMES, check_size, normalise_image, storage

router = APIRouter(tags=["assets"])


@router.post("/books/{ref}/assets", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
async def upload_asset(
    ref: str, db: DbSession, user: CurrentUser, file: UploadFile = File(...)
) -> AssetOut:
    book = await book_svc.load_book(db, ref)
    book_svc.require_owner(book, user)

    mime = file.content_type or mimetypes.guess_type(file.filename or "")[0] or ""
    if mime not in IMAGE_MIMES:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            "Images only here — JPEG, PNG, WebP, GIF, AVIF or SVG.",
        )

    data = await file.read()
    check_size(data)
    data, mime, width, height = normalise_image(data, mime)

    key = storage.save(data, suffix=IMAGE_MIMES[mime], prefix="assets")
    asset = BookAsset(
        book_id=book.id,
        uploader_id=user.id,
        filename=file.filename or "image",
        mime=mime,
        size=len(data),
        storage_key=key,
        width=width,
        height=height,
    )
    db.add(asset)
    await db.flush()
    return AssetOut(
        id=asset.id,
        url=storage.url(key),
        filename=asset.filename,
        mime=asset.mime,
        size=asset.size,
        width=asset.width,
        height=asset.height,
    )


@router.get("/books/{ref}/assets", response_model=list[AssetOut])
async def list_assets(ref: str, db: DbSession, user: CurrentUser) -> list[AssetOut]:
    book = await book_svc.load_book(db, ref)
    book_svc.require_owner(book, user)
    rows = await db.scalars(
        select(BookAsset).where(BookAsset.book_id == book.id).order_by(BookAsset.created_at.desc())
    )
    return [
        AssetOut(
            id=asset.id,
            url=storage.url(asset.storage_key),
            filename=asset.filename,
            mime=asset.mime,
            size=asset.size,
            width=asset.width,
            height=asset.height,
        )
        for asset in rows
    ]


@router.delete("/assets/{asset_id}", response_model=Ok)
async def delete_asset(asset_id: str, db: DbSession, user: CurrentUser) -> Ok:
    asset = await db.scalar(select(BookAsset).where(BookAsset.id == asset_id))
    if asset is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such asset.")
    if asset.uploader_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "That upload is not yours.")
    storage.delete(asset.storage_key)
    await db.delete(asset)
    return Ok()


@router.get("/media/{key:path}", include_in_schema=False)
async def media(key: str) -> FileResponse:
    """Uploads are public once their book is — the key itself is unguessable."""
    path = storage.path(key)
    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found.")
    return FileResponse(
        path,
        media_type=mimetypes.guess_type(path.name)[0] or "application/octet-stream",
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
