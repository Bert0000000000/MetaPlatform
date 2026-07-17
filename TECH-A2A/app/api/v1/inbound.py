"""Inbound JSON-RPC endpoint (P3-A2A-06)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.audit.schemas import AuditAction
from app.audit.service import AuditService
from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.common.errors import InvalidRequestError
from app.delegation.schemas import TaskStatus
from app.deps import get_audit_service, get_inbound_service
from app.inbound.schemas import JsonRpcRequest, inbound_task_to_dict
from app.inbound.service import InboundService

router = APIRouter(tags=["inbound"])


@router.post("/jsonrpc", summary="A2A JSON-RPC 入口")
async def jsonrpc(
    body: dict,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    inbound: InboundService = Depends(get_inbound_service),
    audit: AuditService = Depends(get_audit_service),
) -> dict:
    """JSON-RPC 2.0 endpoint for receiving A2A tasks from external agents.

    Methods: tasks/send, tasks/get, tasks/cancel
    """

    try:
        req = JsonRpcRequest(**body)
    except Exception as exc:
        raise InvalidRequestError(f"无效的 JSON-RPC 请求: {exc}") from exc

    rpc_id = req.id

    if req.method == "tasks/send":
        params = req.params
        source_agent_id = params.get("sourceAgentId", params.get("source_agent_id", ""))
        target_agent_id = params.get("targetAgentId", params.get("target_agent_id", ""))
        task_type = params.get("taskType", params.get("task_type", "generic"))
        payload = params.get("payload", {})

        if not source_agent_id:
            raise InvalidRequestError("sourceAgentId is required")

        task = await inbound.receive_task(
            ctx.tenant_id,
            source_agent_id=source_agent_id,
            target_agent_id=target_agent_id,
            task_type=task_type,
            payload=payload,
            trace_id=ctx.trace_id,
            jsonrpc_id=rpc_id,
        )

        await audit.record_audit(
            ctx.tenant_id,
            AuditAction.TASK_RECEIVED,
            actor_id=source_agent_id,
            target_id=target_agent_id,
            details={"taskId": task.id, "taskType": task_type},
            trace_id=ctx.trace_id,
        )

        return _jsonrpc_result(rpc_id, inbound_task_to_dict(task))

    elif req.method == "tasks/get":
        params = req.params
        task_id = params.get("id", params.get("taskId", ""))
        if not task_id:
            raise InvalidRequestError("task id is required")
        task = await inbound.get_task(ctx.tenant_id, task_id)
        return _jsonrpc_result(rpc_id, inbound_task_to_dict(task))

    elif req.method == "tasks/cancel":
        params = req.params
        task_id = params.get("id", params.get("taskId", ""))
        if not task_id:
            raise InvalidRequestError("task id is required")
        task = await inbound.cancel_task(ctx.tenant_id, task_id, trace_id=ctx.trace_id)
        await audit.record_audit(
            ctx.tenant_id,
            AuditAction.TASK_CANCELLED,
            target_id=task_id,
            trace_id=ctx.trace_id,
        )
        return _jsonrpc_result(rpc_id, inbound_task_to_dict(task))

    else:
        raise InvalidRequestError(f"Unsupported JSON-RPC method: {req.method}")


@router.get("/inbound/tasks", summary="入站任务列表")
async def list_inbound_tasks(
    request: Request,
    status: str | None = None,
    ctx: RequestContext = Depends(request_context_dep),
    inbound: InboundService = Depends(get_inbound_service),
) -> dict:
    task_status = None
    if status is not None:
        task_status = TaskStatus(status.upper())
    tasks = await inbound.list_tasks(ctx.tenant_id, status=task_status)
    return success(
        [inbound_task_to_dict(t) for t in tasks],
        trace_id=ctx.trace_id,
    )


@router.get("/inbound/tasks/{task_id}", summary="入站任务详情")
async def get_inbound_task(
    task_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    inbound: InboundService = Depends(get_inbound_service),
) -> dict:
    task = await inbound.get_task(ctx.tenant_id, task_id)
    return success(inbound_task_to_dict(task), trace_id=ctx.trace_id)


def _jsonrpc_result(rpc_id: str | None, result: dict) -> dict:
    return {
        "jsonrpc": "2.0",
        "id": rpc_id,
        "result": result,
    }
