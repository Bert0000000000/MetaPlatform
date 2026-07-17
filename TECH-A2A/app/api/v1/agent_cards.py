"""Agent Card CRUD endpoints (P3-A2A-02)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from app.agent_card.schemas import (
    CardStatus,
    PublishAgentCardRequest,
    UpdateAgentCardRequest,
    card_to_dict,
)
from app.agent_card.service import AgentCardService
from app.common.api_response import build_page, success
from app.common.context import RequestContext, request_context_dep
from app.common.errors import InvalidParamError
from app.deps import get_card_service

router = APIRouter(tags=["agent-cards"])


def _parse_status(value: Optional[str]) -> Optional[CardStatus]:
    if value is None:
        return None
    try:
        return CardStatus(value.upper())
    except ValueError as exc:
        raise InvalidParamError(
            f"不支持的 Card 状态: {value}",
            data={"allowed": [s.value for s in CardStatus]},
        ) from exc


@router.post("/agent-cards", summary="发布 Agent Card")
async def publish_card(
    body: PublishAgentCardRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: AgentCardService = Depends(get_card_service),
) -> dict:
    card = await service.publish(ctx.tenant_id, body)
    return success(card_to_dict(card), trace_id=ctx.trace_id)


@router.get("/agent-cards", summary="Agent Card 列表(分页)")
async def list_cards(
    request: Request,
    status: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    ctx: RequestContext = Depends(request_context_dep),
    service: AgentCardService = Depends(get_card_service),
) -> dict:
    card_status = _parse_status(status)
    items, total = await service.list(
        ctx.tenant_id,
        status=card_status,
        page=page,
        page_size=pageSize,
    )
    paged = build_page(
        [card_to_dict(c) for c in items],
        total=total,
        page=page,
        page_size=pageSize,
    )
    return success(paged, trace_id=ctx.trace_id)


@router.get("/agent-cards/search", summary="搜索 Agent Card")
async def search_cards(
    request: Request,
    name: Optional[str] = Query(default=None),
    capability: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    ctx: RequestContext = Depends(request_context_dep),
    service: AgentCardService = Depends(get_card_service),
) -> dict:
    card_status = _parse_status(status)
    items = await service.search(
        ctx.tenant_id,
        name=name,
        capability=capability,
        status=card_status,
    )
    return success(
        [card_to_dict(c) for c in items],
        trace_id=ctx.trace_id,
    )


@router.get("/agent-cards/{card_id}", summary="Agent Card 详情")
async def get_card(
    card_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: AgentCardService = Depends(get_card_service),
) -> dict:
    card = await service.get(ctx.tenant_id, card_id)
    return success(card_to_dict(card), trace_id=ctx.trace_id)


@router.put("/agent-cards/{card_id}", summary="更新 Agent Card")
async def update_card(
    card_id: str,
    body: UpdateAgentCardRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: AgentCardService = Depends(get_card_service),
) -> dict:
    card = await service.update(ctx.tenant_id, card_id, body)
    return success(card_to_dict(card), trace_id=ctx.trace_id)


@router.delete("/agent-cards/{card_id}", summary="删除 Agent Card")
async def delete_card(
    card_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: AgentCardService = Depends(get_card_service),
) -> dict:
    ok = await service.delete(ctx.tenant_id, card_id)
    return success({"deleted": ok, "cardId": card_id}, trace_id=ctx.trace_id)
