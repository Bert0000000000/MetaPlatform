"""Unified API response envelope used by all TECH-LLMGW endpoints."""

from __future__ import annotations

from typing import Any, Generic, Iterable, List, Optional, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """Standard response envelope."""

    code: int = 0
    message: str = "success"
    data: Optional[T] = None
    traceId: Optional[str] = Field(default=None, alias="traceId")

    model_config = {"populate_by_name": True}


class PageResponse(BaseModel, Generic[T]):
    """Paged payload used by all list endpoints."""

    items: List[T]
    total: int
    page: int
    pageSize: int
    totalPages: int


def success(data: Any = None, trace_id: Optional[str] = None) -> dict[str, Any]:
    """Build a successful response payload."""

    return {
        "code": 0,
        "message": "success",
        "data": data,
        "traceId": trace_id,
    }


def fail(
    code: int,
    message: str,
    *,
    data: Any = None,
    trace_id: Optional[str] = None,
    http_status: int = 400,
) -> dict[str, Any]:
    """Build an error response payload. Note: HTTP status is applied by the
    global exception handler; this helper only shapes the body."""

    return {
        "code": code,
        "message": message,
        "data": data,
        "traceId": trace_id,
        "_httpStatus": http_status,
    }


def build_page(
    items: Iterable[Any],
    *,
    total: int,
    page: int,
    page_size: int,
) -> dict[str, Any]:
    """Build a PageResponse dict from raw items."""

    items_list = list(items)
    total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0
    return {
        "items": items_list,
        "total": total,
        "page": page,
        "pageSize": page_size,
        "totalPages": total_pages,
    }