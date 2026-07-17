"""Agent Registry endpoints (P3-A2A-04)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from app.agent_registry.schemas import registration_to_dict
from app.agent_registry.service import AgentRegistryService
from app.audit.schemas import AuditAction
from app.audit.service import AuditService
from app.common.api_response import build_page, success
from app.common.context import RequestContext, request_context_dep
from app.common.errors import InvalidParamError
from app.deps import get_audit_service, get_registry_service

router = APIRouter(tags=["registry"])

_ERR_ACTIONS = {
    "register": AuditAction.AGENT_REGISTERED,
    "deregister": AuditAction.AGENT_DEREGISTERED,
}


@router.post("/registry/register", summary="注册 Agent")
async def register_agent(
    body: dict,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: AgentRegistryService = Depends(get_registry_service),
    audit: AuditService = Depends(get_audit_service),
) -> dict:
    from app.agent_registry.schemas import RegisterAgentRequest

    req = RegisterAgentRequest(**body)
    reg = await service.register(ctx.tenant_id, req)
    await audit.record_audit(
        ctx.tenant_id,
        AuditAction.AGENT_REGISTERED,
        actor_id=ctx.user_id or "",
        target_id=reg.agent_id,
        details={"registrationId": reg.id},
        trace_id=ctx.trace_id,
    )
    return success(registration_to_dict(reg), trace_id=ctx.trace_id)


@router.delete("/registry/{agent_id}", summary="注销 Agent")
async def deregister_agent(
    agent_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: AgentRegistryService = Depends(get_registry_service),
    audit: AuditService = Depends(get_audit_service),
) -> dict:
    ok = await service.deregister(ctx.tenant_id, agent_id)
    await audit.record_audit(
        ctx.tenant_id,
        AuditAction.AGENT_DEREGISTERED,
        actor_id=ctx.user_id or "",
        target_id=agent_id,
        trace_id=ctx.trace_id,
    )
    return success({"deregistered": ok, "agentId": agent_id}, trace_id=ctx.trace_id)


@router.post("/registry/{agent_id}/heartbeat", summary="Agent 心跳")
async def heartbeat(
    agent_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: AgentRegistryService = Depends(get_registry_service),
) -> dict:
    reg = await service.heartbeat(ctx.tenant_id, agent_id)
    return success(registration_to_dict(reg), trace_id=ctx.trace_id)


@router.get("/registry/{agent_id}/health", summary="Agent 健康状态")
async def health_check(
    agent_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: AgentRegistryService = Depends(get_registry_service),
) -> dict:
    reg = await service.health_check(ctx.tenant_id, agent_id)
    return success(registration_to_dict(reg), trace_id=ctx.trace_id)


@router.get("/registry", summary="已注册 Agent 列表(分页)")
async def list_registry(
    request: Request,
    status: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    ctx: RequestContext = Depends(request_context_dep),
    service: AgentRegistryService = Depends(get_registry_service),
) -> dict:
    from app.agent_registry.schemas import HealthStatus

    health_status = None
    if status is not None:
        try:
            health_status = HealthStatus(status.upper())
        except ValueError as exc:
            raise InvalidParamError(
                f"不支持的健康状态: {status}",
                data={"allowed": [s.value for s in HealthStatus]},
            ) from exc

    items, total = await service.list(
        ctx.tenant_id,
        status=health_status,
        page=page,
        page_size=pageSize,
    )
    paged = build_page(
        [registration_to_dict(r) for r in items],
        total=total,
        page=page,
        page_size=pageSize,
    )
    return success(paged, trace_id=ctx.trace_id)
