"""Checkpoint endpoints (P2-AGT-07)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.checkpoint.schemas import SaveCheckpointRequest, checkpoint_to_dict
from app.checkpoint.service import CheckpointService
from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.deps import get_checkpoint_service

router = APIRouter(tags=["checkpoints"])


@router.post("/executions/{execution_id}/checkpoint", summary="保存执行检查点")
async def save_checkpoint(
    execution_id: str,
    body: SaveCheckpointRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: CheckpointService = Depends(get_checkpoint_service),
) -> dict:
    checkpoint = await service.save_checkpoint(
        ctx.tenant_id, execution_id, body.agentId, body.state
    )
    return success(checkpoint_to_dict(checkpoint), trace_id=ctx.trace_id)


@router.get("/executions/{execution_id}/checkpoint", summary="加载执行检查点")
async def load_checkpoint(
    execution_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: CheckpointService = Depends(get_checkpoint_service),
) -> dict:
    checkpoint = await service.load_checkpoint(ctx.tenant_id, execution_id)
    if checkpoint is None:
        return success(None, trace_id=ctx.trace_id)
    return success(checkpoint_to_dict(checkpoint), trace_id=ctx.trace_id)


@router.post("/executions/{execution_id}/resume", summary="从检查点恢复执行")
async def resume_from_checkpoint(
    execution_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: CheckpointService = Depends(get_checkpoint_service),
) -> dict:
    checkpoint = await service.load_checkpoint(ctx.tenant_id, execution_id)
    if checkpoint is None:
        return success(
            {"resumed": False, "reason": "no checkpoint found"},
            trace_id=ctx.trace_id,
        )
    return success(
        {"resumed": True, "checkpoint": checkpoint_to_dict(checkpoint)},
        trace_id=ctx.trace_id,
    )
