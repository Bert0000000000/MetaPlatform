"""Monitoring endpoints (P3-DATA-07)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.deps import get_monitoring_service
from app.monitoring.schemas import AlertSeverity, AlertStatus
from app.monitoring.service import MonitoringService

router = APIRouter(tags=["monitoring"])


def _parse_severity(value: Optional[str]) -> Optional[AlertSeverity]:
    if value is None:
        return None
    try:
        return AlertSeverity(value.upper())
    except ValueError:
        return None


def _parse_status(value: Optional[str]) -> Optional[AlertStatus]:
    if value is None:
        return None
    try:
        return AlertStatus(value.upper())
    except ValueError:
        return None


class CreateAlertRequest(BaseModel):
    title: str = Field(min_length=1, max_length=256)
    description: Optional[str] = None
    severity: AlertSeverity = AlertSeverity.MEDIUM
    source: str = Field(min_length=1, max_length=128)
    metadata: dict = Field(default_factory=dict)


@router.get("/monitoring/overview", summary="监控总览")
async def overview(
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: MonitoringService = Depends(get_monitoring_service),
) -> dict:
    data = await service.overview(ctx.tenant_id)
    return success(data.model_dump(), trace_id=ctx.trace_id)


@router.get("/monitoring/sla", summary="SLA 跟踪")
async def list_sla(
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: MonitoringService = Depends(get_monitoring_service),
) -> dict:
    items = [s.model_dump() for s in await service.list_sla(ctx.tenant_id)]
    return success({"items": items}, trace_id=ctx.trace_id)


# ----------------------------------------------------------- alerts


@router.post("/monitoring/alerts", summary="创建告警")
async def create_alert(
    body: CreateAlertRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: MonitoringService = Depends(get_monitoring_service),
) -> dict:
    alert = await service.create_alert(
        ctx.tenant_id,
        title=body.title,
        description=body.description,
        severity=body.severity,
        source=body.source,
        metadata=body.metadata,
    )
    return success(alert.model_dump(), trace_id=ctx.trace_id)


@router.get("/monitoring/alerts", summary="告警列表")
async def list_alerts(
    request: Request,
    severity: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    ctx: RequestContext = Depends(request_context_dep),
    service: MonitoringService = Depends(get_monitoring_service),
) -> dict:
    items = [
        a.model_dump()
        for a in await service.list_alerts(
            ctx.tenant_id,
            severity=_parse_severity(severity),
            status=_parse_status(status),
        )
    ]
    return success({"items": items}, trace_id=ctx.trace_id)


@router.post("/monitoring/alerts/{alert_id}/acknowledge", summary="确认告警")
async def acknowledge_alert(
    alert_id: str,
    request: Request,
    operator: Optional[str] = Query(default=None),
    ctx: RequestContext = Depends(request_context_dep),
    service: MonitoringService = Depends(get_monitoring_service),
) -> dict:
    alert = await service.acknowledge_alert(
        ctx.tenant_id, alert_id, operator=operator
    )
    return success(alert.model_dump(), trace_id=ctx.trace_id)


@router.post("/monitoring/alerts/{alert_id}/resolve", summary="解决告警")
async def resolve_alert(
    alert_id: str,
    request: Request,
    operator: Optional[str] = Query(default=None),
    ctx: RequestContext = Depends(request_context_dep),
    service: MonitoringService = Depends(get_monitoring_service),
) -> dict:
    alert = await service.resolve_alert(
        ctx.tenant_id, alert_id, operator=operator
    )
    return success(alert.model_dump(), trace_id=ctx.trace_id)


# ----------------------------------------------------------- logs


@router.get("/monitoring/logs", summary="告警日志查询")
async def list_logs(
    request: Request,
    alertId: Optional[str] = Query(default=None),
    ctx: RequestContext = Depends(request_context_dep),
    service: MonitoringService = Depends(get_monitoring_service),
) -> dict:
    items = [
        e.model_dump() for e in await service.list_logs(ctx.tenant_id, alertId)
    ]
    return success({"items": items}, trace_id=ctx.trace_id)