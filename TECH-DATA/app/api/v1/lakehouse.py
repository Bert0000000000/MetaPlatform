"""Lakehouse endpoints (P3-DATA-03)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request

from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.deps import get_lakehouse_service
from app.lakehouse.schemas import (
    CreateIngestTaskRequest,
    CreateLakeTableRequest,
    UpdateLakeTableRequest,
)
from app.lakehouse.service import LakehouseService

router = APIRouter(tags=["lakehouse"])


# ----------------------------------------------------------- tables


@router.post("/lakehouse/tables", summary="创建湖表")
async def create_table(
    body: CreateLakeTableRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: LakehouseService = Depends(get_lakehouse_service),
) -> dict:
    t = await service.create_table(ctx.tenant_id, body)
    return success(t.model_dump(), trace_id=ctx.trace_id)


@router.get("/lakehouse/tables", summary="湖表列表")
async def list_tables(
    request: Request,
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    ctx: RequestContext = Depends(request_context_dep),
    service: LakehouseService = Depends(get_lakehouse_service),
) -> dict:
    data = await service.list_tables(
        ctx.tenant_id, page=page, page_size=pageSize
    )
    return success(data, trace_id=ctx.trace_id)


@router.get("/lakehouse/tables/{table_id}", summary="湖表详情")
async def get_table(
    table_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: LakehouseService = Depends(get_lakehouse_service),
) -> dict:
    t = await service.get_table(ctx.tenant_id, table_id)
    return success(t.model_dump(), trace_id=ctx.trace_id)


@router.put("/lakehouse/tables/{table_id}", summary="更新湖表")
async def update_table(
    table_id: str,
    body: UpdateLakeTableRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: LakehouseService = Depends(get_lakehouse_service),
) -> dict:
    t = await service.update_table(ctx.tenant_id, table_id, body)
    return success(t.model_dump(), trace_id=ctx.trace_id)


@router.delete("/lakehouse/tables/{table_id}", summary="删除湖表")
async def delete_table(
    table_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: LakehouseService = Depends(get_lakehouse_service),
) -> dict:
    result = await service.delete_table(ctx.tenant_id, table_id)
    return success(result, trace_id=ctx.trace_id)


# ----------------------------------------------------------- ingest


@router.post("/lakehouse/tables/{table_id}/ingest", summary="创建摄入任务")
async def create_ingest(
    table_id: str,
    body: CreateIngestTaskRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: LakehouseService = Depends(get_lakehouse_service),
) -> dict:
    task = await service.create_ingest_task(ctx.tenant_id, table_id, body)
    return success(task.model_dump(), trace_id=ctx.trace_id)


@router.get("/lakehouse/tables/{table_id}/ingest", summary="摄入任务列表")
async def list_ingest(
    table_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: LakehouseService = Depends(get_lakehouse_service),
) -> dict:
    items = [
        i.model_dump()
        for i in await service.list_ingest_tasks(ctx.tenant_id, table_id)
    ]
    return success({"items": items}, trace_id=ctx.trace_id)


@router.post("/lakehouse/tables/{table_id}/ingest/{task_id}/run", summary="运行摄入任务")
async def run_ingest(
    table_id: str,
    task_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: LakehouseService = Depends(get_lakehouse_service),
) -> dict:
    task = await service.run_ingest_task(ctx.tenant_id, table_id, task_id)
    return success(task.model_dump(), trace_id=ctx.trace_id)