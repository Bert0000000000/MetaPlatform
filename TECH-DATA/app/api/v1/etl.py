"""ETL task management endpoints (P3-DATA-01)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from app.common.api_response import build_page, success
from app.common.context import RequestContext, request_context_dep
from app.deps import get_etl_service
from app.etl.schemas import (
    CreateEtlTaskRequest,
    EtlTaskType,
    UpdateEtlTaskRequest,
)
from app.etl.service import EtlTaskService

router = APIRouter(tags=["etl"])


def _parse_type(value: Optional[str]) -> Optional[EtlTaskType]:
    if value is None:
        return None
    try:
        return EtlTaskType(value.upper())
    except ValueError:
        return None


@router.post("/etl-tasks", summary="创建 ETL 任务")
async def create_task(
    body: CreateEtlTaskRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: EtlTaskService = Depends(get_etl_service),
) -> dict:
    task = await service.create(ctx.tenant_id, body)
    return success(task.model_dump(), trace_id=ctx.trace_id)


@router.get("/etl-tasks", summary="ETL 任务列表")
async def list_tasks(
    request: Request,
    type: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    ctx: RequestContext = Depends(request_context_dep),
    service: EtlTaskService = Depends(get_etl_service),
) -> dict:
    data = await service.list(
        ctx.tenant_id, type=_parse_type(type), page=page, page_size=pageSize
    )
    return success(data, trace_id=ctx.trace_id)


@router.get("/etl-tasks/{task_id}", summary="ETL 任务详情")
async def get_task(
    task_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: EtlTaskService = Depends(get_etl_service),
) -> dict:
    task = await service.get(ctx.tenant_id, task_id)
    return success(task.model_dump(), trace_id=ctx.trace_id)


@router.put("/etl-tasks/{task_id}", summary="更新 ETL 任务")
async def update_task(
    task_id: str,
    body: UpdateEtlTaskRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: EtlTaskService = Depends(get_etl_service),
) -> dict:
    task = await service.update(ctx.tenant_id, task_id, body)
    return success(task.model_dump(), trace_id=ctx.trace_id)


@router.delete("/etl-tasks/{task_id}", summary="删除 ETL 任务")
async def delete_task(
    task_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: EtlTaskService = Depends(get_etl_service),
) -> dict:
    result = await service.delete(ctx.tenant_id, task_id)
    return success(result, trace_id=ctx.trace_id)


@router.post("/etl-tasks/{task_id}/trigger", summary="手动触发 ETL 任务")
async def trigger_task(
    task_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: EtlTaskService = Depends(get_etl_service),
) -> dict:
    run = await service.trigger(ctx.tenant_id, task_id)
    return success(run.model_dump(), trace_id=ctx.trace_id)


@router.get("/etl-tasks/{task_id}/runs", summary="ETL 任务运行记录")
async def list_runs(
    task_id: str,
    request: Request,
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    ctx: RequestContext = Depends(request_context_dep),
    service: EtlTaskService = Depends(get_etl_service),
) -> dict:
    data = await service.list_runs(
        ctx.tenant_id, task_id, page=page, page_size=pageSize
    )
    return success(data, trace_id=ctx.trace_id)