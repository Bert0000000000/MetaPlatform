"""Agent definition CRUD endpoints."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from app.agents.schemas import (
    AgentStatus,
    CreateAgentRequest,
    UpdateAgentRequest,
    to_dict,
)
from app.agents.service import AgentService
from app.common.api_response import build_page, success
from app.common.context import RequestContext, request_context_dep
from app.common.errors import InvalidParamError
from app.deps import get_agent_service

router = APIRouter(tags=["agents"])


def _parse_status(value: Optional[str]) -> Optional[AgentStatus]:
    if value is None:
        return None
    try:
        return AgentStatus(value.upper())
    except ValueError as exc:
        raise InvalidParamError(
            f"不支持的 Agent 状态: {value}",
            data={"allowed": [s.value for s in AgentStatus]},
        ) from exc


@router.post("/agents", summary="创建 Agent")
async def create_agent(
    body: CreateAgentRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: AgentService = Depends(get_agent_service),
) -> dict:
    agent = await service.create(ctx.tenant_id, body, created_by=ctx.user_id)
    return success(to_dict(agent), trace_id=ctx.trace_id)


@router.get("/agents", summary="Agent 列表(分页)")
async def list_agents(
    request: Request,
    status: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    ctx: RequestContext = Depends(request_context_dep),
    service: AgentService = Depends(get_agent_service),
) -> dict:
    agent_status = _parse_status(status)
    items, total = await service.list(
        ctx.tenant_id,
        status=agent_status,
        page=page,
        page_size=pageSize,
    )
    paged = build_page(
        [to_dict(i) for i in items],
        total=total,
        page=page,
        page_size=pageSize,
    )
    return success(paged, trace_id=ctx.trace_id)


@router.get("/agents/{agent_id}", summary="Agent 详情")
async def get_agent(
    agent_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: AgentService = Depends(get_agent_service),
) -> dict:
    agent = await service.get(ctx.tenant_id, agent_id)
    return success(to_dict(agent), trace_id=ctx.trace_id)


@router.put("/agents/{agent_id}", summary="更新 Agent")
async def update_agent(
    agent_id: str,
    body: UpdateAgentRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: AgentService = Depends(get_agent_service),
) -> dict:
    agent = await service.update(ctx.tenant_id, agent_id, body)
    return success(to_dict(agent), trace_id=ctx.trace_id)


@router.delete("/agents/{agent_id}", summary="删除 Agent")
async def delete_agent(
    agent_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: AgentService = Depends(get_agent_service),
) -> dict:
    ok = await service.delete(ctx.tenant_id, agent_id)
    return success({"deleted": ok, "agentId": agent_id}, trace_id=ctx.trace_id)
