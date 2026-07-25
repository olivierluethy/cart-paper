from __future__ import annotations

import uuid

from app.schemas.common import ORMModel


class AssetOut(ORMModel):
    id: uuid.UUID
    url: str
    filename: str
    mime: str
    size: int
    width: int | None = None
    height: int | None = None
