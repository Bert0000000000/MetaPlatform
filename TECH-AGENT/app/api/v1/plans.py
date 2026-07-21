"""Autonomous task planning endpoints (V15-02)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from app.common.api_response import build_page, success
from app.common.context import RequestContext, request_context_dep
from app.deps import get_plan_service
from app.plans.schemas import plan_to_dict
from app.plans.service import PlanService

router = APIRouter(tags=["plans"])


@router.post("/plans", summary="根据用户输入生成任务计划")
async def create_plan(
    body: dict,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: PlanService = Depends(get_plan_service),
) -> dict:
    from app.plans.schemas import CreatePlanRequest

    req = CreatePlanRequest(**body)
    plan = await service.create(ctx.tenant_id, req)
    return success(plan_to_dict(plan), trace_id=ctx.trace_id)


@router.get("/plans", summary="任务计划列表(分页)")
async def list_plans(
    request: Request,
    agentId: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    ctx: RequestContext = Depends(request_context_dep),
    service: PlanService = Depends(get_plan_service),
) -> dict:
    items, total = await service.list(
        ctx.tenant_id,
        agent_id=agentId,
        page=page,
        page_size=pageSize,
    )
    paged = build_page(
        [plan_to_dict(p) for p in items],
        total=total,
        page=page,
        page_size=pageSize,
    )
    return success(paged, trace_id=ctx.trace_id)


@router.get("/plans/{plan_id}", summary="查询任务计划状态")
async def get_plan(
    plan_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: PlanService = Depends(get_plan_service),
) -> dict:
    plan = await service.get(ctx.tenant_id, plan_id)
    return success(plan_to_dict(plan), trace_id=ctx.trace_id)


@router.post(
    "/plans/{plan_id}/steps/{step_id}/approve",
    summary="批准计划步骤",
)
async def approve_step(
    plan_id: str,
    step_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: PlanService = Depends(get_plan_service),
) -> dict:
    plan = await service.approve_step(ctx.tenant_id, plan_id, step_id)
    return success(plan_to_dict(plan), trace_id=ctx.trace_id)


@router.post(
    "/plans/{plan_id}/steps/{step_id}/skip",
    summary="跳过计划步骤",
)
async def skip_step(
    plan_id: str,
    step_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: PlanService = Depends(get_plan_service),
) -> dict:
    plan = await service.skip_step(ctx.tenant_id, plan_id, step_id)
    return success(plan_to_dict(plan), trace_id=ctx.trace_id)


@router.post("/plans/{plan_id}/execute", summary="执行任务计划")
async def execute_plan(
    plan_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: PlanService = Depends(get_plan_service),
) -> dict:
    plan = await service.execute(ctx.tenant_id, plan_id)
    return success(plan_to_dict(plan), trace_id=ctx.trace_id)
