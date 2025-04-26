from pydantic import BaseModel
from typing import Generic, TypeVar, List

T = TypeVar("T")

class Paginated(BaseModel, Generic[T]):
    total: int
    page: int
    limit: int
    items: List[T]  