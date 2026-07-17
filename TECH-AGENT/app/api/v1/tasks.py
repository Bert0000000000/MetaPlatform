"""Agent task management endpoints (P2-AGT-14/15)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from app.common.api_response import build_page, success
from app.common.context import RequestContext, request_context_dep
from app.common.errors import InvalidParamError
from app.deps import get_task_service
from app.tasks.schemas import TaskStatus, stats_to_dict, task_to_dict
from app.tasks.service import TaskService

router = APIRouter(tags=["tasks"])


def _parse_status(value: Optional[str]) -> Optional[TaskStatus]:
    if value is None:
        return None
    try:
        return TaskStatus(value.upper())
    except ValueError as exc:
        raise InvalidParamError(
            f"不支持的任务状态: {value}",
            data={"allowed": [s.value for s in TaskStatus]},
        ) from exc


@router.post("/tasks", summary="创建 Agent 任务")
async def create_task(
    body: dict,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: TaskService = Depends(get_task_service),
) -> dict:
    from app.tasks.schemas import CreateTaskRequest

    req = CreateTaskRequest(**body)
    task = await service.create(ctx.tenant_id, req)
    return success(task_to_dict(task), trace_id=ctx.trace_id)


@router.get("/tasks", summary="任务列表(分页)")
async def list_tasks(
    request: Request,
    agentId: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    ctx: RequestContext = Depends(request_context_dep),
    service: TaskService = Depends(get_task_service),
) -> dict:
    task_status = _parse_status(status)
    items, total = await service.list(
        ctx.tenant_id,
        agent_id=agentId,
        status=task_status,
        page=page,
        page_size=pageSize,
    )
    paged = build_page(
        [task_to_dict(i) for i in items],
        total=total,
        page=page,
        page_size=pageSize,
    )
    return success(paged, trace_id=ctx.trace_id)


@router.get("/tasks/statistics", summary="任务统计")
async def get_task_statistics(
    request: Request,
    agentId: str = Query(...),
    ctx: RequestContext = Depends(request_context_dep),
    service: TaskService = Depends(get_task_service),
) -> dict:
    stats = await service.get_statistics(ctx.tenant_id, agentId)
    return success(stats_to_dict(stats), trace_id=ctx.trace_id)


@router.get("/tasks/{task_id}", summary="任务详情")
async def get_task(
    task_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: TaskService = Depends(get_task_service),
) -> dict:
    task = await service.get(ctx.tenant_id, task_id)
    return success(task_to_dict(task), trace_id=ctx.trace_id)


@router.get("/tasks/{task_id}/result", summary="获取任务结果")
async def get_task_result(
    task_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: TaskService = Depends(get_task_service),
) -> dict:
    result = await service.get_task_result(ctx.tenant_id, task_id)
    return success({"output": result}, trace_id=ctx.trace_id)


@router.patch("/tasks/{task_id}/status", summary="更新任务状态")
async def update_task_status(
    task_id: str,
    body: dict,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: TaskService = Depends(get_task_service),
) -> dict:
    from app.tasks.schemas import UpdateTaskStatusRequest

    req = UpdateTaskStatusRequest(**body)
    task = await service.update_status(ctx.tenant_id, task_id, req)
    return success(task_to_dict(task), trace_id=ctx.trace_id)


@router.post("/tasks/{task_id}/assign", summary="分配任务")
async def assign_task(
    task_id: str,
    body: dict,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: TaskService = Depends(get_task_service),
) -> dict:
    from app.tasks.schemas import AssignTaskRequest

    req = AssignTaskRequest(**body)
    task = await service.assign(ctx.tenant_id, task_id, req.assignedTo)
    return success(task_to_dict(task), trace_id=ctx.trace_id)
