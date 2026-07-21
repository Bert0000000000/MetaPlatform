"""Unified API response envelope for TECH-ONT discovery endpoints."""

from __future__ import annotations

from typing import Any, Iterable, Optional


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
    """Build an error response payload."""
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
    """Build a page payload."""
    items_list = list(items)
    total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0
    return {
        "items": items_list,
        "total": total,
        "page": page,
        "pageSize": page_size,
        "totalPages": total_pages,
    }
