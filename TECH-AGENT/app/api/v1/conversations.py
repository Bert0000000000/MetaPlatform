"""Conversation management endpoints (P2-AGT-16/17)."""

from __future__ import annotations

import json
from typing import AsyncIterator, Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse

from app.common.api_response import build_page, success
from app.common.context import RequestContext, request_context_dep
from app.conversations.schemas import (
    conversation_to_dict,
    message_to_dict,
)
from app.conversations.service import ConversationService
from app.deps import get_conversation_service

router = APIRouter(tags=["conversations"])


@router.post("/conversations", summary="创建会话")
async def create_conversation(
    body: dict,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: ConversationService = Depends(get_conversation_service),
) -> dict:
    from app.conversations.schemas import CreateConversationRequest

    req = CreateConversationRequest(**body)
    conv = await service.create_conversation(
        ctx.tenant_id, req.agentId, req.title
    )
    return success(conversation_to_dict(conv), trace_id=ctx.trace_id)


@router.get("/conversations", summary="会话列表(分页)")
async def list_conversations(
    request: Request,
    agentId: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    ctx: RequestContext = Depends(request_context_dep),
    service: ConversationService = Depends(get_conversation_service),
) -> dict:
    items, total = await service.list_conversations(
        ctx.tenant_id,
        agent_id=agentId,
        page=page,
        page_size=pageSize,
    )
    paged = build_page(
        [conversation_to_dict(i) for i in items],
        total=total,
        page=page,
        page_size=pageSize,
    )
    return success(paged, trace_id=ctx.trace_id)


@router.get("/conversations/{conversation_id}", summary="会话详情")
async def get_conversation(
    conversation_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: ConversationService = Depends(get_conversation_service),
) -> dict:
    conv = await service.get_conversation(ctx.tenant_id, conversation_id)
    return success(conversation_to_dict(conv), trace_id=ctx.trace_id)


@router.post("/conversations/{conversation_id}/messages", summary="发送消息(同步)")
async def send_message(
    conversation_id: str,
    body: dict,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: ConversationService = Depends(get_conversation_service),
) -> dict:
    from app.conversations.schemas import SendMessageRequest

    req = SendMessageRequest(**body)
    msg = await service.send_message(
        ctx.tenant_id, conversation_id, req, trace_id=ctx.trace_id
    )
    return success(message_to_dict(msg), trace_id=ctx.trace_id)


@router.post("/conversations/{conversation_id}/messages/stream", summary="发送消息(流式)")
async def stream_message(
    conversation_id: str,
    body: dict,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: ConversationService = Depends(get_conversation_service),
) -> StreamingResponse:
    from app.conversations.schemas import SendMessageRequest

    req = SendMessageRequest(**body)

    async def _sse() -> AsyncIterator[str]:
        async for event in service.stream_message(
            ctx.tenant_id, conversation_id, req, trace_id=ctx.trace_id
        ):
            yield f"event: {event['event']}\ndata: {json.dumps(event['data'], ensure_ascii=False)}\n\n"

    return StreamingResponse(
        _sse(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/conversations/{conversation_id}/messages", summary="会话消息历史")
async def get_history(
    conversation_id: str,
    request: Request,
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=50, ge=1, le=200),
    ctx: RequestContext = Depends(request_context_dep),
    service: ConversationService = Depends(get_conversation_service),
) -> dict:
    items, total = await service.get_history(
        ctx.tenant_id, conversation_id, page=page, page_size=pageSize
    )
    paged = build_page(
        [message_to_dict(i) for i in items],
        total=total,
        page=page,
        page_size=pageSize,
    )
    return success(paged, trace_id=ctx.trace_id)


@router.post("/conversations/{conversation_id}/end", summary="结束会话")
async def end_conversation(
    conversation_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: ConversationService = Depends(get_conversation_service),
) -> dict:
    conv = await service.end_conversation(ctx.tenant_id, conversation_id)
    return success(conversation_to_dict(conv), trace_id=ctx.trace_id)
