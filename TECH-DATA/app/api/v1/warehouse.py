"""Warehouse endpoints (P3-DATA-04)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.deps import get_warehouse_service
from app.warehouse.schemas import (
    CreateMaterializedViewRequest,
    WarehouseLayer,
)
from app.warehouse.service import WarehouseService

router = APIRouter(tags=["warehouse"])


def _parse_layer(value: Optional[str]) -> Optional[WarehouseLayer]:
    if value is None:
        return None
    try:
        return WarehouseLayer(value.lower())
    except ValueError:
        return None


@router.post("/warehouse/query", summary="执行数仓查询")
async def execute_query(
    body: dict,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: WarehouseService = Depends(get_warehouse_service),
) -> dict:
    from app.warehouse.schemas import QueryRequest
    req = QueryRequest.model_validate(body)
    result = await service.execute_query(ctx.tenant_id, req)
    return success(result.model_dump(), trace_id=ctx.trace_id)


@router.get("/warehouse/layers", summary="数仓分层信息")
async def list_layers(
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: WarehouseService = Depends(get_warehouse_service),
) -> dict:
    items = [l.model_dump() for l in await service.list_layers()]
    return success({"items": items}, trace_id=ctx.trace_id)


@router.get("/warehouse/tables", summary="数仓表列表")
async def list_tables(
    request: Request,
    layer: Optional[str] = Query(default=None),
    ctx: RequestContext = Depends(request_context_dep),
    service: WarehouseService = Depends(get_warehouse_service),
) -> dict:
    items = [
        t.model_dump()
        for t in await service.list_tables(_parse_layer(layer))
    ]
    return success({"items": items}, trace_id=ctx.trace_id)


@router.post("/warehouse/materialized-views", summary="创建物化视图")
async def create_view(
    body: CreateMaterializedViewRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: WarehouseService = Depends(get_warehouse_service),
) -> dict:
    mv = await service.create_materialized_view(ctx.tenant_id, body)
    return success(mv.model_dump(), trace_id=ctx.trace_id)


@router.get("/warehouse/materialized-views", summary="物化视图列表")
async def list_views(
    request: Request,
    layer: Optional[str] = Query(default=None),
    ctx: RequestContext = Depends(request_context_dep),
    service: WarehouseService = Depends(get_warehouse_service),
) -> dict:
    items = [
        m.model_dump()
        for m in await service.list_materialized_views(ctx.tenant_id, _parse_layer(layer))
    ]
    return success({"items": items}, trace_id=ctx.trace_id)


@router.post(
    "/warehouse/materialized-views/{mv_id}/refresh",
    summary="刷新物化视图",
)
async def refresh_view(
    mv_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: WarehouseService = Depends(get_warehouse_service),
) -> dict:
    mv = await service.refresh_materialized_view(ctx.tenant_id, mv_id)
    return success(mv.model_dump(), trace_id=ctx.trace_id)


@router.get("/warehouse/query-history", summary="查询历史记录")
async def list_query_history(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    ctx: RequestContext = Depends(request_context_dep),
    service: WarehouseService = Depends(get_warehouse_service),
) -> dict:
    result = await service.list_query_history(
        ctx.tenant_id, page=page, page_size=page_size
    )
    return success(result, trace_id=ctx.trace_id)