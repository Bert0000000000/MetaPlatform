"""Cost report endpoints (P3-LLMGW-01)."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.cost.schemas import ExportFormat, TimeInterval
from app.cost.service import CostReportService
from app.deps import get_cost_service

router = APIRouter(tags=["cost"])


def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    if value is None or value == "":
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _parse_interval(value: Optional[str]) -> TimeInterval:
    if value is None:
        return TimeInterval.DAY
    try:
        return TimeInterval(value.lower())
    except ValueError:
        return TimeInterval.DAY


def _parse_format(value: Optional[str]) -> ExportFormat:
    if value is None:
        return ExportFormat.CSV
    try:
        return ExportFormat(value.lower())
    except ValueError:
        return ExportFormat.CSV


@router.get("/cost/summary", summary="成本汇总")
async def cost_summary(
    request: Request,
    startTime: Optional[str] = Query(default=None),
    endTime: Optional[str] = Query(default=None),
    ctx: RequestContext = Depends(request_context_dep),
    service: CostReportService = Depends(get_cost_service),
) -> dict:
    summary = service.get_summary(
        ctx.tenant_id, _parse_dt(startTime), _parse_dt(endTime)
    )
    return success(summary.model_dump(), trace_id=ctx.trace_id)


@router.get("/cost/by-user", summary="按用户成本")
async def cost_by_user(
    request: Request,
    startTime: Optional[str] = Query(default=None),
    endTime: Optional[str] = Query(default=None),
    ctx: RequestContext = Depends(request_context_dep),
    service: CostReportService = Depends(get_cost_service),
) -> dict:
    items = [
        b.model_dump()
        for b in service.get_by_user(ctx.tenant_id, _parse_dt(startTime), _parse_dt(endTime))
    ]
    return success({"items": items}, trace_id=ctx.trace_id)


@router.get("/cost/by-application", summary="按应用成本")
async def cost_by_application(
    request: Request,
    startTime: Optional[str] = Query(default=None),
    endTime: Optional[str] = Query(default=None),
    ctx: RequestContext = Depends(request_context_dep),
    service: CostReportService = Depends(get_cost_service),
) -> dict:
    items = [
        b.model_dump()
        for b in service.get_by_application(ctx.tenant_id, _parse_dt(startTime), _parse_dt(endTime))
    ]
    return success({"items": items}, trace_id=ctx.trace_id)


@router.get("/cost/by-model", summary="按模型成本")
async def cost_by_model(
    request: Request,
    startTime: Optional[str] = Query(default=None),
    endTime: Optional[str] = Query(default=None),
    ctx: RequestContext = Depends(request_context_dep),
    service: CostReportService = Depends(get_cost_service),
) -> dict:
    items = [
        b.model_dump()
        for b in service.get_by_model(ctx.tenant_id, _parse_dt(startTime), _parse_dt(endTime))
    ]
    return success({"items": items}, trace_id=ctx.trace_id)


@router.get("/cost/by-provider", summary="按供应方成本")
async def cost_by_provider(
    request: Request,
    startTime: Optional[str] = Query(default=None),
    endTime: Optional[str] = Query(default=None),
    ctx: RequestContext = Depends(request_context_dep),
    service: CostReportService = Depends(get_cost_service),
) -> dict:
    items = [
        b.model_dump()
        for b in service.get_by_provider(ctx.tenant_id, _parse_dt(startTime), _parse_dt(endTime))
    ]
    return success({"items": items}, trace_id=ctx.trace_id)


@router.get("/cost/time-series", summary="成本时间序列")
async def cost_time_series(
    request: Request,
    interval: Optional[str] = Query(default="day"),
    startTime: Optional[str] = Query(default=None),
    endTime: Optional[str] = Query(default=None),
    ctx: RequestContext = Depends(request_context_dep),
    service: CostReportService = Depends(get_cost_service),
) -> dict:
    ts = service.get_time_series(
        ctx.tenant_id,
        _parse_dt(startTime),
        _parse_dt(endTime),
        _parse_interval(interval),
    )
    return success(ts.model_dump(), trace_id=ctx.trace_id)


@router.get("/cost/export", summary="成本导出")
async def cost_export(
    request: Request,
    format: Optional[str] = Query(default="csv"),
    dimension: Optional[str] = Query(default="model"),
    startTime: Optional[str] = Query(default=None),
    endTime: Optional[str] = Query(default=None),
    ctx: RequestContext = Depends(request_context_dep),
    service: CostReportService = Depends(get_cost_service),
) -> dict:
    payload = service.export_report(
        ctx.tenant_id,
        format=_parse_format(format),
        dimension=dimension or "model",
        start_time=_parse_dt(startTime),
        end_time=_parse_dt(endTime),
    )
    return success(payload, trace_id=ctx.trace_id)