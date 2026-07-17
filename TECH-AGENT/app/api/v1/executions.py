"""Agent execution endpoints (P2-AGT-04/05)."""

from __future__ import annotations

import json
from typing import AsyncIterator

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.deps import get_execution_service
from app.execution.schemas import ExecuteRequest
from app.execution.service import ExecutionService

router = APIRouter(tags=["executions"])


@router.post("/agents/{agent_id}/execute", summary="同步执行 Agent")
async def execute_agent(
    agent_id: str,
    request: Request,
    body: ExecuteRequest,
    ctx: RequestContext = Depends(request_context_dep),
    service: ExecutionService = Depends(get_execution_service),
) -> dict:
    result = await service.execute(
        ctx.tenant_id,
        agent_id,
        body,
        trace_id=ctx.trace_id,
    )
    return success(
        result.model_dump(mode="json", by_alias=True),
        trace_id=ctx.trace_id,
    )


async def _sse_stream(
    service: ExecutionService,
    tenant_id: str,
    agent_id: str,
    request: ExecuteRequest,
    trace_id: str | None,
) -> AsyncIterator[str]:
    async for event in service.stream(
        tenant_id,
        agent_id,
        request,
        trace_id=trace_id,
    ):
        yield f"event: {event['event']}\ndata: {json.dumps(event['data'], ensure_ascii=False)}\n\n"


@router.post("/agents/{agent_id}/execute/stream", summary="SSE 流式执行 Agent")
async def stream_agent(
    agent_id: str,
    request: Request,
    body: ExecuteRequest,
    ctx: RequestContext = Depends(request_context_dep),
    service: ExecutionService = Depends(get_execution_service),
) -> StreamingResponse:
    return StreamingResponse(
        _sse_stream(service, ctx.tenant_id, agent_id, body, ctx.trace_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
