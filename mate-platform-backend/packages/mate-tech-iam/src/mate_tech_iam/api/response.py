"""Common API response helpers to keep response envelopes consistent."""
from __future__ import annotations

from typing import Any


def ok(data: Any = None, message: str = "success") -> dict[str, Any]:
    """Return the standard success envelope."""
    return {"code": 0, "message": message, "data": data}


def page(items: list[Any], total: int, page: int, page_size: int) -> dict[str, Any]:
    """Standard paginated envelope."""
    total_pages = (total + page_size - 1) // page_size if page_size else 1
    return {
        "code": 0,
        "message": "success",
        "data": {
            "items": items,
            "total": total,
            "page": page,
            "pageSize": page_size,
            "totalPages": total_pages,
        },
    }
