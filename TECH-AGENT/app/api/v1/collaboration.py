"""Digital worker team collaboration endpoints (V15-04).

Exposes CRUD + execute + report endpoints under
``/api/v1/agent/collaboration/tasks``.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query, Request, Depends

from app.common.api_response import build_page, success
from app.common.context import RequestContext, request_context_dep
from app.common.errors import InvalidParamError
from app.deps import get_collaboration_service
from app.collaboration.schemas import (
    CreateCollaborationRequest,
    collaboration_to_dict,
    report_to_dict,
)
from app.collaboration.service import CollaborationService

router = APIRouter(prefix="/collaboration", tags=["collaboration"])


@router.post("/tasks", summary="创建协作任务并自动分工")
async def create_collaboration(
    body: CreateCollaborationRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: CollaborationService = Depends(get_collaboration_service),
) -> dict:
    task = await service.create(
        ctx.tenant_id,
        body,
        created_by=ctx.user_id,
    )
    return success(collaboration_to_dict(task), trace_id=ctx.trace_id)


@router.get("/tasks", summary="协作任务列表(分页)")
async def list_collaborations(
    request: Request,
    status: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    ctx: RequestContext = Depends(request_context_dep),
    service: CollaborationService = Depends(get_collaboration_service),
) -> dict:
    items, total = await service.list(
        ctx.tenant_id,
        status=status,
        page=page,
        page_size=pageSize,
    )
    paged = build_page(
        [collaboration_to_dict(t) for t in items],
        total=total,
        page=page,
        page_size=pageSize,
    )
    return success(paged, trace_id=ctx.trace_id)


@router.get("/tasks/{task_id}", summary="查询协作任务详情")
async def get_collaboration(
    task_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: CollaborationService = Depends(get_collaboration_service),
) -> dict:
    task = await service.get(ctx.tenant_id, task_id)
    return success(collaboration_to_dict(task), trace_id=ctx.trace_id)


@router.post("/tasks/{task_id}/execute", summary="执行协作任务")
async def execute_collaboration(
    task_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: CollaborationService = Depends(get_collaboration_service),
) -> dict:
    task = await service.execute(ctx.tenant_id, task_id)
    return success(collaboration_to_dict(task), trace_id=ctx.trace_id)


@router.get("/tasks/{task_id}/report", summary="生成/获取协作报告")
async def get_collaboration_report(
    task_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: CollaborationService = Depends(get_collaboration_service),
) -> dict:
    # Verify the task exists first to surface a 400 instead of a computed report
    # for an unknown id.
    await service.get(ctx.tenant_id, task_id)
    report = await service.get_report(ctx.tenant_id, task_id)
    return success(report_to_dict(report), trace_id=ctx.trace_id)
