"""Public .well-known Agent Card endpoints (P3-A2A-03)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.agent_card.schemas import card_to_public_dict
from app.agent_card.service import AgentCardService
from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.common.errors import CardNotFoundError
from app.deps import get_card_service

router = APIRouter(tags=["public"])


@router.get("/.well-known/agent.json", summary="所有已发布 Agent Cards (公共)")
async def get_all_public_cards(
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: AgentCardService = Depends(get_card_service),
) -> dict:
    cards = await service.list_published_cards()
    return success(
        [card_to_public_dict(c) for c in cards],
        trace_id=ctx.trace_id,
    )


@router.get("/.well-known/agents/{agent_id}/agent.json", summary="特定 Agent Card (公共)")
async def get_public_card(
    agent_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: AgentCardService = Depends(get_card_service),
) -> dict:
    cards = await service.list_published_cards()
    for card in cards:
        if card.id == agent_id or card.name == agent_id:
            return success(card_to_public_dict(card), trace_id=ctx.trace_id)
    raise CardNotFoundError(
        f"Agent Card 不存在: agentId={agent_id}",
        data={"agentId": agent_id},
    )
