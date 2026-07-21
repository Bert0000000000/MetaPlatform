"""Task Delegation endpoints (P3-A2A-05/07/08/09/10/15)."""

from __future__ import annotations

import asyncio
import json
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse

from app.audit.schemas import AuditAction
from app.audit.service import AuditService
from app.clients.agent_service_client import AgentServiceClient
from app.clients.wfe_client import WFEClient
from app.common.api_response import build_page, success
from app.common.context import RequestContext, request_context_dep
from app.common.errors import InvalidParamError
from app.delegation.schemas import (
    CreateDelegationRequest,
    DelegateTaskRequest,
    DelegationCallbackRequest,
    TaskStatus,
    UpdateTimeoutRequest,
    task_to_dict,
)
from app.delegation.service import DelegationService
from app.deps import (
    get_agent_service_client,
    get_audit_service,
    get_delegation_service,
    get_wfe_client,
)

router = APIRouter(tags=["tasks"])


def _parse_status(value: Optional[str]) -> Optional[TaskStatus]:
    if value is None:
        return None
    try:
        return TaskStatus(value.upper())
    except ValueError as exc:
        raise InvalidParamError(
            f"不支持的 Task 状态: {value}",
            data={"allowed": [s.value for s in TaskStatus]},
        ) from exc


@router.post("/tasks", summary="委派任务到外部 Agent")
async def delegate_task(
    body: DelegateTaskRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DelegationService = Depends(get_delegation_service),
    audit: AuditService = Depends(get_audit_service),
) -> dict:
    task = await service.delegate_task(ctx.tenant_id, body, trace_id=ctx.trace_id)
    await audit.record_audit(
        ctx.tenant_id,
        AuditAction.TASK_DELEGATED,
        actor_id=task.source_agent_id,
        target_id=task.target_agent_id,
        details={"taskId": task.id, "taskType": task.task_type},
        trace_id=ctx.trace_id,
    )
    # 若 mock/同步调用直接完成，补充 TASK_COMPLETED 审计，保证审计统计一致
    if task.status == TaskStatus.COMPLETED:
        await audit.record_audit(
            ctx.tenant_id,
            AuditAction.TASK_COMPLETED,
            actor_id=task.source_agent_id,
            target_id=task.target_agent_id,
            details={"taskId": task.id, "taskType": task.task_type},
            trace_id=ctx.trace_id,
        )
    return success(task_to_dict(task), trace_id=ctx.trace_id)


@router.get("/tasks", summary="任务列表(分页)")
async def list_tasks(
    request: Request,
    status: Optional[str] = Query(default=None),
    sourceAgentId: Optional[str] = Query(default=None),
    targetAgentId: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    ctx: RequestContext = Depends(request_context_dep),
    service: DelegationService = Depends(get_delegation_service),
) -> dict:
    task_status = _parse_status(status)
    items, total = await service.list_tasks(
        ctx.tenant_id,
        status=task_status,
        source_agent_id=sourceAgentId,
        target_agent_id=targetAgentId,
        page=page,
        page_size=pageSize,
    )
    paged = build_page(
        [task_to_dict(t) for t in items],
        total=total,
        page=page,
        page_size=pageSize,
    )
    return success(paged, trace_id=ctx.trace_id)


@router.get("/tasks/{task_id}", summary="任务详情")
async def get_task(
    task_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DelegationService = Depends(get_delegation_service),
) -> dict:
    task = await service.get_task(ctx.tenant_id, task_id)
    return success(task_to_dict(task), trace_id=ctx.trace_id)


@router.get("/tasks/{task_id}/status", summary="任务状态")
async def get_task_status(
    task_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DelegationService = Depends(get_delegation_service),
) -> dict:
    status = await service.get_task_status(ctx.tenant_id, task_id)
    status_value = status.value if isinstance(status, TaskStatus) else status
    return success({"taskId": task_id, "status": status_value}, trace_id=ctx.trace_id)


@router.get("/tasks/{task_id}/result", summary="任务结果")
async def get_task_result(
    task_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DelegationService = Depends(get_delegation_service),
) -> dict:
    result = await service.get_task_result(ctx.tenant_id, task_id)
    return success({"taskId": task_id, "result": result}, trace_id=ctx.trace_id)


@router.post("/tasks/{task_id}/cancel", summary="取消任务")
async def cancel_task(
    task_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DelegationService = Depends(get_delegation_service),
    audit: AuditService = Depends(get_audit_service),
) -> dict:
    task = await service.cancel_task(ctx.tenant_id, task_id, trace_id=ctx.trace_id)
    await audit.record_audit(
        ctx.tenant_id,
        AuditAction.TASK_CANCELLED,
        actor_id=task.source_agent_id,
        target_id=task_id,
        trace_id=ctx.trace_id,
    )
    return success(task_to_dict(task), trace_id=ctx.trace_id)


@router.get("/tasks/{task_id}/stream", summary="SSE 任务进度流")
async def stream_task(
    task_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DelegationService = Depends(get_delegation_service),
) -> StreamingResponse:
    """SSE stream of task progress events: started, progress, completed, failed."""

    async def event_generator():
        task = await service.get_task(ctx.tenant_id, task_id)

        # started event
        yield f"event: started\ndata: {json.dumps({'taskId': task_id, 'status': task.status.value})}\n\n"
        await asyncio.sleep(0)

        # progress events based on status history
        for entry in task.status_history:
            yield f"event: progress\ndata: {json.dumps({'taskId': task_id, 'status': entry.status.value, 'detail': entry.detail, 'timestamp': entry.timestamp.isoformat()})}\n\n"
            await asyncio.sleep(0)

        # terminal event
        if task.status == TaskStatus.COMPLETED:
            yield f"event: completed\ndata: {json.dumps({'taskId': task_id, 'result': task.result})}\n\n"
        elif task.status == TaskStatus.FAILED:
            yield f"event: failed\ndata: {json.dumps({'taskId': task_id, 'error': task.error})}\n\n"
        elif task.status == TaskStatus.CANCELLED:
            yield f"event: failed\ndata: {json.dumps({'taskId': task_id, 'error': 'Task cancelled'})}\n\n"
        else:
            yield f"event: progress\ndata: {json.dumps({'taskId': task_id, 'status': task.status.value, 'detail': 'Task still in progress'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/tasks/{task_id}/route-to-agent", summary="路由到 TECH-AGENT 执行")
async def route_to_agent(
    task_id: str,
    body: dict,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DelegationService = Depends(get_delegation_service),
    agent_client: AgentServiceClient = Depends(get_agent_service_client),
    audit: AuditService = Depends(get_audit_service),
) -> dict:
    task = await service.get_task(ctx.tenant_id, task_id)
    agent_id = body.get("agentId", task.target_agent_id)
    input_text = body.get("input", str(task.payload))

    result = await agent_client.execute_agent(
        agent_id,
        input_text,
        trace_id=ctx.trace_id,
        tenant_id=ctx.tenant_id,
    )

    updated = await service.update_task_status(
        ctx.tenant_id,
        task_id,
        TaskStatus.COMPLETED,
        result=result,
        trace_id=ctx.trace_id,
    )

    await audit.record_audit(
        ctx.tenant_id,
        AuditAction.ROUTED_TO_AGENT,
        actor_id=task.source_agent_id,
        target_id=agent_id,
        details={"taskId": task_id, "executionId": result.get("executionId")},
        trace_id=ctx.trace_id,
    )

    return success(task_to_dict(updated), trace_id=ctx.trace_id)


@router.post("/tasks/{task_id}/route-to-workflow", summary="路由到 TECH-WFE 执行")
async def route_to_workflow(
    task_id: str,
    body: dict,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DelegationService = Depends(get_delegation_service),
    wfe_client: WFEClient = Depends(get_wfe_client),
    audit: AuditService = Depends(get_audit_service),
) -> dict:
    task = await service.get_task(ctx.tenant_id, task_id)
    workflow_id = body.get("workflowId", task.target_agent_id)
    input_data = body.get("input", task.payload)

    result = await wfe_client.start_workflow(
        workflow_id,
        input_data,
        trace_id=ctx.trace_id,
        tenant_id=ctx.tenant_id,
    )

    updated = await service.update_task_status(
        ctx.tenant_id,
        task_id,
        TaskStatus.IN_PROGRESS,
        result=result,
        trace_id=ctx.trace_id,
    )

    await audit.record_audit(
        ctx.tenant_id,
        AuditAction.ROUTED_TO_WORKFLOW,
        actor_id=task.source_agent_id,
        target_id=workflow_id,
        details={"taskId": task_id, "instanceId": result.get("instanceId")},
        trace_id=ctx.trace_id,
    )

    return success(task_to_dict(updated), trace_id=ctx.trace_id)


# -- P3-A2A-15: Advanced task management --


@router.get("/tasks/{task_id}/status-history", summary="任务状态历史")
async def get_status_history(
    task_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DelegationService = Depends(get_delegation_service),
) -> dict:
    history = await service.get_status_history(ctx.tenant_id, task_id)
    return success(
        [
            {
                "status": e.status.value if isinstance(e.status, TaskStatus) else e.status,
                "timestamp": e.timestamp,
                "detail": e.detail,
            }
            for e in history
        ],
        trace_id=ctx.trace_id,
    )


@router.get("/tasks/{task_id}/artifacts", summary="任务产出物")
async def get_artifacts(
    task_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DelegationService = Depends(get_delegation_service),
) -> dict:
    artifacts = await service.get_artifacts(ctx.tenant_id, task_id)
    return success(
        [{"name": a.name, "type": a.type, "content": a.content} for a in artifacts],
        trace_id=ctx.trace_id,
    )


@router.put("/tasks/{task_id}/timeout", summary="更新任务超时")
async def update_timeout(
    task_id: str,
    body: UpdateTimeoutRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DelegationService = Depends(get_delegation_service),
) -> dict:
    task = await service.update_timeout(ctx.tenant_id, task_id, body)
    return success(task_to_dict(task), trace_id=ctx.trace_id)


# =========================================================== V14-06 /delegations


@router.post("/delegations", summary="创建 A2A 委托")
async def create_delegation(
    body: CreateDelegationRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DelegationService = Depends(get_delegation_service),
    audit: AuditService = Depends(get_audit_service),
) -> dict:
    task = await service.create_delegation(ctx.tenant_id, body, trace_id=ctx.trace_id)
    await audit.record_audit(
        ctx.tenant_id,
        AuditAction.TASK_DELEGATED,
        actor_id=task.source_agent_id,
        target_id=task.target_agent_id,
        details={"taskId": task.id, "taskType": task.task_type, "kind": "delegation"},
        trace_id=ctx.trace_id,
    )
    return success(task_to_dict(task), trace_id=ctx.trace_id)


@router.get("/delegations", summary="委托列表(分页)")
async def list_delegations(
    request: Request,
    status: Optional[str] = Query(default=None),
    sourceAgentId: Optional[str] = Query(default=None),
    targetAgentId: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    ctx: RequestContext = Depends(request_context_dep),
    service: DelegationService = Depends(get_delegation_service),
) -> dict:
    task_status = _parse_status(status)
    items, total = await service.list_tasks(
        ctx.tenant_id,
        status=task_status,
        source_agent_id=sourceAgentId,
        target_agent_id=targetAgentId,
        page=page,
        page_size=pageSize,
    )
    paged = build_page(
        [task_to_dict(t) for t in items],
        total=total,
        page=page,
        page_size=pageSize,
    )
    return success(paged, trace_id=ctx.trace_id)


@router.get("/delegations/{delegation_id}/stream", summary="SSE 委托状态流")
async def stream_delegation(
    delegation_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DelegationService = Depends(get_delegation_service),
) -> StreamingResponse:
    """SSE stream of delegation progress. Polls until terminal or timeout."""

    terminal = {TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELED, TaskStatus.CANCELLED}

    async def event_generator():
        task = await service.get_task(ctx.tenant_id, delegation_id)
        yield f"event: init\ndata: {json.dumps({'taskId': delegation_id, 'status': task.status.value})}\n\n"
        await asyncio.sleep(0)

        sent = 0
        for entry in task.status_history:
            yield f"event: progress\ndata: {json.dumps({'taskId': delegation_id, 'status': entry.status.value, 'detail': entry.detail, 'timestamp': entry.timestamp.isoformat()})}\n\n"
            await asyncio.sleep(0)
            sent += 1

        if task.status in terminal:
            if task.status == TaskStatus.COMPLETED:
                yield f"event: completed\ndata: {json.dumps({'taskId': delegation_id, 'result': task.result})}\n\n"
            elif task.status == TaskStatus.FAILED:
                yield f"event: failed\ndata: {json.dumps({'taskId': delegation_id, 'error': task.error})}\n\n"
            else:
                yield f"event: canceled\ndata: {json.dumps({'taskId': delegation_id})}\n\n"
            return

        # 非终态时持续轮询，最多 30 秒
        for _ in range(30):
            await asyncio.sleep(1)
            task = await service.get_task(ctx.tenant_id, delegation_id)
            if len(task.status_history) > sent:
                for entry in task.status_history[sent:]:
                    yield f"event: progress\ndata: {json.dumps({'taskId': delegation_id, 'status': entry.status.value, 'detail': entry.detail, 'timestamp': entry.timestamp.isoformat()})}\n\n"
                    await asyncio.sleep(0)
                sent = len(task.status_history)

            if task.status in terminal:
                if task.status == TaskStatus.COMPLETED:
                    yield f"event: completed\ndata: {json.dumps({'taskId': delegation_id, 'result': task.result})}\n\n"
                elif task.status == TaskStatus.FAILED:
                    yield f"event: failed\ndata: {json.dumps({'taskId': delegation_id, 'error': task.error})}\n\n"
                else:
                    yield f"event: canceled\ndata: {json.dumps({'taskId': delegation_id})}\n\n"
                return

        yield f"event: timeout\ndata: {json.dumps({'taskId': delegation_id, 'status': task.status.value})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/delegations/{delegation_id}", summary="委托详情")
async def get_delegation(
    delegation_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DelegationService = Depends(get_delegation_service),
) -> dict:
    task = await service.get_task(ctx.tenant_id, delegation_id)
    return success(task_to_dict(task), trace_id=ctx.trace_id)


@router.post("/delegations/{delegation_id}/cancel", summary="取消委托")
async def cancel_delegation(
    delegation_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DelegationService = Depends(get_delegation_service),
    audit: AuditService = Depends(get_audit_service),
) -> dict:
    task = await service.cancel_delegation(ctx.tenant_id, delegation_id, trace_id=ctx.trace_id)
    await audit.record_audit(
        ctx.tenant_id,
        AuditAction.TASK_CANCELLED,
        actor_id=task.source_agent_id,
        target_id=delegation_id,
        trace_id=ctx.trace_id,
    )
    return success(task_to_dict(task), trace_id=ctx.trace_id)


@router.post("/delegations/{delegation_id}/callback", summary="外部 Agent 结果回调(mock)")
async def delegation_callback(
    delegation_id: str,
    body: DelegationCallbackRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DelegationService = Depends(get_delegation_service),
    audit: AuditService = Depends(get_audit_service),
) -> dict:
    task = await service.apply_callback(ctx.tenant_id, delegation_id, body, trace_id=ctx.trace_id)
    if task.status == TaskStatus.COMPLETED:
        await audit.record_audit(
            ctx.tenant_id,
            AuditAction.TASK_COMPLETED,
            actor_id=task.source_agent_id,
            target_id=task.target_agent_id,
            details={"taskId": task.id, "taskType": task.task_type, "kind": "delegation-callback"},
            trace_id=ctx.trace_id,
        )
    return success(task_to_dict(task), trace_id=ctx.trace_id)
