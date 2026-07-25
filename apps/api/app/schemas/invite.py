from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import ORMModel


class InviteCreate(BaseModel):
    label: str | None = Field(default=None, max_length=120)
    invited_email: EmailStr | None = None
    expires_in_days: int | None = Field(default=None, ge=1, le=365)


class InviteOut(ORMModel):
    id: uuid.UUID
    token: str
    url: str
    label: str | None
    invited_email: str | None
    accepted_count: int
    expires_at: datetime | None
    revoked_at: datetime | None
    created_at: datetime
