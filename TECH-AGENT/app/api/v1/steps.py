"""Execution steps & thinking chain endpoints (P2-AGT-20)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.deps import get_step_service
from app.steps.schemas import (
    evaluation_to_dict,
    step_to_dict,
    tool_call_to_dict,
)
from app.steps.service import StepService

router = APIRouter(tags=["steps"])


@router.get("/executions/{execution_id}/steps", summary="执行步骤列表")
async def get_steps(
    execution_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: StepService = Depends(get_step_service),
) -> dict:
    steps = await service.get_steps(ctx.tenant_id, execution_id)
    return success(
        [step_to_dict(s) for s in steps],
        trace_id=ctx.trace_id,
    )


@router.get("/executions/{execution_id}/thinking-chain", summary="思维链")
async def get_thinking_chain(
    execution_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: StepService = Depends(get_step_service),
) -> dict:
    chain = await service.get_thinking_chain(ctx.tenant_id, execution_id)
    return success(
        {
            "executionId": chain.execution_id,
            "steps": [step_to_dict(s) for s in chain.steps],
            "totalSteps": chain.total_steps,
        },
        trace_id=ctx.trace_id,
    )


@router.get("/executions/{execution_id}/tool-calls", summary="工具调用记录")
async def get_tool_calls(
    execution_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: StepService = Depends(get_step_service),
) -> dict:
    calls = await service.get_tool_calls(ctx.tenant_id, execution_id)
    return success(
        [tool_call_to_dict(c) for c in calls],
        trace_id=ctx.trace_id,
    )


@router.post("/executions/{execution_id}/evaluations", summary="提交评估")
async def submit_evaluation(
    execution_id: str,
    body: dict,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: StepService = Depends(get_step_service),
) -> dict:
    from app.steps.schemas import SubmitEvaluationRequest

    req = SubmitEvaluationRequest(**body)
    evaluation = await service.submit_evaluation(
        ctx.tenant_id, execution_id, req
    )
    return success(evaluation_to_dict(evaluation), trace_id=ctx.trace_id)


@router.get("/executions/{execution_id}/evaluations", summary="评估列表")
async def get_evaluations(
    execution_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: StepService = Depends(get_step_service),
) -> dict:
    evaluations = await service.get_evaluations(ctx.tenant_id, execution_id)
    return success(
        [evaluation_to_dict(e) for e in evaluations],
        trace_id=ctx.trace_id,
    )
