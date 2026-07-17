"""Agent Card generation endpoints (P2-AGT-21)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.card.schemas import card_to_dict
from app.card.service import AgentCardService
from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.deps import get_card_service

router = APIRouter(tags=["card"])


@router.get("/agents/{agent_id}/card", summary="生成 Agent Card (A2A)")
async def generate_agent_card(
    agent_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: AgentCardService = Depends(get_card_service),
) -> dict:
    card = await service.generate_card(ctx.tenant_id, agent_id)
    return success(card_to_dict(card), trace_id=ctx.trace_id)
