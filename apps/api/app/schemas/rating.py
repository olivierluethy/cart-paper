from __future__ import annotations

from pydantic import BaseModel, Field


class RatingIn(BaseModel):
    value: int = Field(ge=1, le=5)


class RatingSummary(BaseModel):
    average: float
    count: int
    distribution: dict[str, int]
    my_rating: int | None = None
