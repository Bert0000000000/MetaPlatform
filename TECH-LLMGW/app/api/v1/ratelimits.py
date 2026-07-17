"""Rate limit configuration endpoints (P1-LLMGW-07/08)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.deps import get_rate_limit_service
from app.ratelimits.schemas import RateLimitCreateRequest, RateLimitUpdateRequest
from app.ratelimits.service import RateLimitService

router = APIRouter(tags=["rate-limits"])


@router.post("/rate-limits", summary="创建限流规则")
async def create_rate_limit(
    request: Request,
    body: RateLimitCreateRequest,
    ctx: RequestContext = Depends(request_context_dep),
    service: RateLimitService = Depends(get_rate_limit_service),
) -> dict:
    record = service.create(
        ctx.tenant_id,
        body,
        created_by=ctx.user_id or "system",
    )
    return success(service.to_detail(record), trace_id=ctx.trace_id)


@router.get("/rate-limits", summary="限流规则列表")
async def list_rate_limits(
    request: Request,
    scope: Optional[str] = Query(default=None),
    type: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    ctx: RequestContext = Depends(request_context_dep),
    service: RateLimitService = Depends(get_rate_limit_service),
) -> dict:
    result = service.list(
        ctx.tenant_id,
        scope=scope,
        type_=type,
        page=page,
        page_size=pageSize,
    )
    return success(result, trace_id=ctx.trace_id)


@router.get("/rate-limits/stats/summary", summary="限流全局统计")
async def get_rate_limit_summary(
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: RateLimitService = Depends(get_rate_limit_service),
) -> dict:
    result = service.stats(ctx.tenant_id, rate_limit_id=None)
    return success(result, trace_id=ctx.trace_id)


@router.get("/rate-limits/{rate_limit_id}", summary="限流规则详情")
async def get_rate_limit(
    rate_limit_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: RateLimitService = Depends(get_rate_limit_service),
) -> dict:
    record = service.detail(ctx.tenant_id, rate_limit_id)
    return success(service.to_detail(record), trace_id=ctx.trace_id)


@router.put("/rate-limits/{rate_limit_id}", summary="更新限流规则")
async def update_rate_limit(
    rate_limit_id: str,
    request: Request,
    body: RateLimitUpdateRequest,
    ctx: RequestContext = Depends(request_context_dep),
    service: RateLimitService = Depends(get_rate_limit_service),
) -> dict:
    record = service.update(
        ctx.tenant_id,
        rate_limit_id,
        body,
        updated_by=ctx.user_id or "system",
    )
    return success(service.to_detail(record), trace_id=ctx.trace_id)


@router.delete("/rate-limits/{rate_limit_id}", summary="删除限流规则")
async def delete_rate_limit(
    rate_limit_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: RateLimitService = Depends(get_rate_limit_service),
) -> dict:
    result = service.delete(ctx.tenant_id, rate_limit_id)
    return success(result, trace_id=ctx.trace_id)


@router.post("/rate-limits/{rate_limit_id}/reset", summary="重置限流计数")
async def reset_rate_limit(
    rate_limit_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: RateLimitService = Depends(get_rate_limit_service),
) -> dict:
    result = service.reset(ctx.tenant_id, rate_limit_id)
    return success(result, trace_id=ctx.trace_id)


@router.get("/rate-limits/{rate_limit_id}/stats", summary="限流规则统计")
async def get_rate_limit_stats(
    rate_limit_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: RateLimitService = Depends(get_rate_limit_service),
) -> dict:
    result = service.stats(ctx.tenant_id, rate_limit_id=rate_limit_id)
    return success(result, trace_id=ctx.trace_id)
