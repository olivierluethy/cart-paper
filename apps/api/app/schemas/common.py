from __future__ import annotations

from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int

    @property
    def has_more(self) -> bool:
        return self.offset + len(self.items) < self.total


class Anchor(BaseModel):
    """The locator shared by highlights, notes, anchored comments and progress.

    Positions are the fast path; ``quote`` + ``prefix``/``suffix`` are what let
    an annotation survive an edit to the page it lives on.
    """

    page_id: str | None = None
    from_: int | None = Field(default=None, alias="from")
    to: int | None = None
    quote: str = ""
    prefix: str = ""
    suffix: str = ""
    pdf: dict[str, Any] | None = None

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class Ok(BaseModel):
    ok: bool = True
