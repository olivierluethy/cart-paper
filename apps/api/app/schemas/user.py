from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import ORMModel


class UserPublic(ORMModel):
    id: uuid.UUID
    handle: str
    display_name: str
    avatar_url: str | None = None
    bio: str | None = None
    stats_visible: bool
    created_at: datetime


class UserMe(UserPublic):
    email: EmailStr
    reading_settings: dict[str, Any]


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=120)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    bio: str | None = Field(default=None, max_length=2000)
    avatar_url: str | None = None
    stats_visible: bool | None = None


class ReadingSettingsIn(BaseModel):
    font_size: int | None = Field(default=None, ge=12, le=28)
    line_height: float | None = Field(default=None, ge=1.2, le=2.4)
    width: int | None = Field(default=None, ge=24, le=54)
    typeface: str | None = Field(default=None, pattern="^(serif|sans)$")
    hide_statistics: bool | None = None


class PasswordResetIn(BaseModel):
    email: EmailStr
