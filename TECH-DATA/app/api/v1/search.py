"""Global search endpoint (P3-DASH-07)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.deps import get_search_service
from app.search.schemas import SearchCategory
from app.search.service import SearchService

router = APIRouter(tags=["search"])


def _parse_categories(values: Optional[list[str]]) -> Optional[list[SearchCategory]]:
    if not values:
        return None
    categories: list[SearchCategory] = []
    for v in values:
        try:
            categories.append(SearchCategory(v.lower()))
        except ValueError:
            continue
    return categories if categories else None


@router.get("/search/global", summary="全局搜索")
async def global_search(
    request: Request,
    keyword: str = Query(min_length=1, max_length=128),
    categories: Optional[list[str]] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    ctx: RequestContext = Depends(request_context_dep),
    service: SearchService = Depends(get_search_service),
) -> dict:
    cats = _parse_categories(categories)
    items = await service.search(
        ctx.tenant_id,
        keyword=keyword,
        categories=cats,
        limit=limit,
    )
    return success(
        {"items": [i.model_dump() for i in items]},
        trace_id=ctx.trace_id,
    )
