"""Audit statistics endpoints (P3-A2A-14)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from app.audit.schemas import AuditAction
from app.audit.service import AuditService
from app.common.api_response import build_page, success
from app.common.context import RequestContext, request_context_dep
from app.common.errors import InvalidParamError
from app.deps import get_audit_service
from app.audit.schemas import audit_to_dict

router = APIRouter(tags=["audit"])


def _parse_action(value: Optional[str]) -> Optional[AuditAction]:
    if value is None:
        return None
    try:
        return AuditAction(value.upper())
    except ValueError as exc:
        raise InvalidParamError(
            f"不支持的审计动作: {value}",
            data={"allowed": [a.value for a in AuditAction]},
        ) from exc


@router.get("/audit/records", summary="审计记录列表(分页)")
async def list_audit(
    request: Request,
    action: Optional[str] = Query(default=None),
    actorId: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    ctx: RequestContext = Depends(request_context_dep),
    service: AuditService = Depends(get_audit_service),
) -> dict:
    audit_action = _parse_action(action)
    items, total = await service.list_audit(
        ctx.tenant_id,
        action=audit_action,
        actor_id=actorId,
        page=page,
        page_size=pageSize,
    )
    paged = build_page(
        [audit_to_dict(r) for r in items],
        total=total,
        page=page,
        page_size=pageSize,
    )
    return success(paged, trace_id=ctx.trace_id)


@router.get("/audit/collaboration-stats", summary="协作统计")
async def collaboration_stats(
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: AuditService = Depends(get_audit_service),
) -> dict:
    stats = await service.get_collaboration_stats(ctx.tenant_id)
    return success(stats, trace_id=ctx.trace_id)


@router.get("/audit/delegation-stats", summary="委派统计")
async def delegation_stats(
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: AuditService = Depends(get_audit_service),
) -> dict:
    stats = await service.get_delegation_stats(ctx.tenant_id)
    return success(stats, trace_id=ctx.trace_id)


@router.get("/audit/error-stats", summary="错误统计")
async def error_stats(
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: AuditService = Depends(get_audit_service),
) -> dict:
    stats = await service.get_error_stats(ctx.tenant_id)
    return success(stats, trace_id=ctx.trace_id)


@router.get("/audit/agent-stats", summary="Agent 统计")
async def agent_stats(
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: AuditService = Depends(get_audit_service),
) -> dict:
    stats = await service.get_agent_stats(ctx.tenant_id)
    return success(stats, trace_id=ctx.trace_id)


@router.get("/audit/export", summary="导出审计报告")
async def export_report(
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: AuditService = Depends(get_audit_service),
) -> dict:
    report = await service.export_report(ctx.tenant_id)
    return success(report, trace_id=ctx.trace_id)
