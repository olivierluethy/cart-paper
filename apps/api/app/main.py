from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.routers import (
    annotations,
    avatar,
    assets,
    auth,
    books,
    comments,
    export,
    favorites,
    imports,
    notifications,
    publishing,
    ratings,
    reading,
    users,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title="CART Paper API",
    version="0.1.0",
    description=(
        "Social reading and writing — books, passages, and the discussions anchored to them."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(auth.router)
app.include_router(books.router)
app.include_router(assets.router)
app.include_router(publishing.router)
app.include_router(favorites.router)
app.include_router(reading.router)
app.include_router(annotations.router)
app.include_router(comments.router)
app.include_router(ratings.router)
app.include_router(notifications.router)
app.include_router(users.router)
app.include_router(avatar.router)
app.include_router(imports.router)
app.include_router(export.router)


@app.get("/health", tags=["meta"])
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "cart-paper-api"}


@app.exception_handler(500)
async def internal_error(request: Request, exc: Exception) -> JSONResponse:
    logging.exception("unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse({"detail": "Something went wrong on our side."}, status_code=500)
