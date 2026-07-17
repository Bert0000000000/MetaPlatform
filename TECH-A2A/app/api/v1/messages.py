"""Agent Messaging endpoints (P3-A2A-13)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from app.audit.schemas import AuditAction
from app.audit.service import AuditService
from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.common.errors import InvalidParamError
from app.deps import get_audit_service, get_message_service
from app.messaging.schemas import MessageStatus, SendMessageRequest, message_to_dict
from app.messaging.service import MessagingService

router = APIRouter(tags=["messages"])


def _parse_status(value: Optional[str]) -> Optional[MessageStatus]:
    if value is None:
        return None
    try:
        return MessageStatus(value.upper())
    except ValueError as exc:
        raise InvalidParamError(
            f"不支持的消息状态: {value}",
            data={"allowed": [s.value for s in MessageStatus]},
        ) from exc


@router.post("/messages", summary="发送消息")
async def send_message(
    body: SendMessageRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: MessagingService = Depends(get_message_service),
    audit: AuditService = Depends(get_audit_service),
) -> dict:
    msg = await service.send(ctx.tenant_id, body)
    await audit.record_audit(
        ctx.tenant_id,
        AuditAction.MESSAGE_SENT,
        actor_id=body.fromAgentId,
        target_id=body.toAgentId,
        details={"messageId": msg.id},
        trace_id=ctx.trace_id,
    )
    return success(message_to_dict(msg), trace_id=ctx.trace_id)


@router.get("/messages/receive", summary="接收消息")
async def receive_messages(
    request: Request,
    agentId: str = Query(..., description="接收消息的 Agent ID"),
    limit: int = Query(default=10, ge=1, le=100),
    ctx: RequestContext = Depends(request_context_dep),
    service: MessagingService = Depends(get_message_service),
) -> dict:
    messages = await service.receive(ctx.tenant_id, agentId, limit=limit)
    return success(
        [message_to_dict(m) for m in messages],
        trace_id=ctx.trace_id,
    )


@router.post("/messages/{message_id}/ack", summary="确认消息")
async def acknowledge_message(
    message_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: MessagingService = Depends(get_message_service),
    audit: AuditService = Depends(get_audit_service),
) -> dict:
    msg = await service.acknowledge(ctx.tenant_id, message_id)
    await audit.record_audit(
        ctx.tenant_id,
        AuditAction.MESSAGE_ACKED,
        target_id=message_id,
        details={"fromAgentId": msg.from_agent_id},
        trace_id=ctx.trace_id,
    )
    return success(message_to_dict(msg), trace_id=ctx.trace_id)


@router.get("/messages/queue", summary="消息队列")
async def list_queue(
    request: Request,
    agentId: str = Query(..., description="查询队列的 Agent ID"),
    status: Optional[str] = Query(default=None),
    ctx: RequestContext = Depends(request_context_dep),
    service: MessagingService = Depends(get_message_service),
) -> dict:
    msg_status = _parse_status(status)
    messages = await service.list_queue(ctx.tenant_id, agentId, status=msg_status)
    return success(
        [message_to_dict(m) for m in messages],
        trace_id=ctx.trace_id,
    )


@router.delete("/messages/cleanup", summary="清理过期消息")
async def cleanup_expired(
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: MessagingService = Depends(get_message_service),
) -> dict:
    count = await service.cleanup_expired()
    return success({"cleanedUp": count}, trace_id=ctx.trace_id)


@router.get("/messages/{message_id}", summary="消息详情")
async def get_message(
    message_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: MessagingService = Depends(get_message_service),
) -> dict:
    msg = await service.get(ctx.tenant_id, message_id)
    return success(message_to_dict(msg), trace_id=ctx.trace_id)
