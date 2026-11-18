from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class UserRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    full_name: str


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    size: int
