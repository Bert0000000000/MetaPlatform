"""Quota configuration endpoints (P1-LLMGW-04)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.quotas.schemas import QuotaCreateRequest, QuotaUpdateRequest
from app.quotas.service import QuotaService
from app.deps import get_quota_service

router = APIRouter(tags=["quotas"])


@router.post("/quotas", summary="创建配额配置")
async def create_quota(
    request: Request,
    body: QuotaCreateRequest,
    ctx: RequestContext = Depends(request_context_dep),
    service: QuotaService = Depends(get_quota_service),
) -> dict:
    record = service.create(
        ctx.tenant_id,
        body,
        created_by=ctx.user_id or "system",
    )
    return success(service.to_detail(record), trace_id=ctx.trace_id)


@router.get("/quotas", summary="配额配置列表")
async def list_quotas(
    request: Request,
    scope: Optional[str] = Query(default=None),
    type: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    ctx: RequestContext = Depends(request_context_dep),
    service: QuotaService = Depends(get_quota_service),
) -> dict:
    result = service.list(
        ctx.tenant_id,
        scope=scope,
        type_=type,
        page=page,
        page_size=pageSize,
    )
    return success(result, trace_id=ctx.trace_id)


@router.get("/quotas/{quota_id}", summary="配额配置详情")
async def get_quota(
    quota_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: QuotaService = Depends(get_quota_service),
) -> dict:
    record = service.detail(ctx.tenant_id, quota_id)
    return success(service.to_detail(record), trace_id=ctx.trace_id)


@router.put("/quotas/{quota_id}", summary="更新配额配置")
async def update_quota(
    quota_id: str,
    request: Request,
    body: QuotaUpdateRequest,
    ctx: RequestContext = Depends(request_context_dep),
    service: QuotaService = Depends(get_quota_service),
) -> dict:
    record = service.update(
        ctx.tenant_id,
        quota_id,
        body,
        updated_by=ctx.user_id or "system",
    )
    return success(service.to_detail(record), trace_id=ctx.trace_id)


@router.delete("/quotas/{quota_id}", summary="删除配额配置")
async def delete_quota(
    quota_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: QuotaService = Depends(get_quota_service),
) -> dict:
    result = service.delete(ctx.tenant_id, quota_id)
    return success(result, trace_id=ctx.trace_id)
