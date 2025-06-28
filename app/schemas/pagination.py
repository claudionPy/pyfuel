# pagination.py
# Generic Pydantic model for paginated list responses.

from pydantic import BaseModel
from typing import Generic, TypeVar, List

T = TypeVar("T")

class Paginated(BaseModel, Generic[T]):
    """
    Wraps a paginated result set.
    
    Attributes:
      - total: total number of matching items across all pages
      - page: current page number (1-based)
      - limit: maximum items per page
      - items: list of items of type T
    """
    total: int
    page: int
    limit: int
    items: List[T]

