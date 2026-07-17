"""Audit log endpoints (P3-LLMGW-02)."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from app.audit.schemas import AuditLogStatus, ExportFormat
from app.audit.service import AuditLogService
from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.deps import get_audit_service

router = APIRouter(tags=["audit"])


def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    if value is None or value == "":
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _parse_status(value: Optional[str]) -> Optional[AuditLogStatus]:
    if value is None:
        return None
    try:
        return AuditLogStatus(value.upper())
    except ValueError:
        return None


def _parse_format(value: Optional[str]) -> ExportFormat:
    if value is None:
        return ExportFormat.CSV
    try:
        return ExportFormat(value.lower())
    except ValueError:
        return ExportFormat.CSV


@router.get("/audit-logs", summary="审计日志查询")
async def query_audit_logs(
    request: Request,
    userId: Optional[str] = Query(default=None),
    modelId: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    startTime: Optional[str] = Query(default=None),
    endTime: Optional[str] = Query(default=None),
    keyword: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=200),
    ctx: RequestContext = Depends(request_context_dep),
    service: AuditLogService = Depends(get_audit_service),
) -> dict:
    data = service.query(
        ctx.tenant_id,
        user_id=userId,
        model_id=modelId,
        status=_parse_status(status),
        start_time=_parse_dt(startTime),
        end_time=_parse_dt(endTime),
        keyword=keyword,
        page=page,
        page_size=pageSize,
    )
    return success(data, trace_id=ctx.trace_id)


@router.get("/audit-logs/errors", summary="审计错误日志")
async def query_error_logs(
    request: Request,
    startTime: Optional[str] = Query(default=None),
    endTime: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=200),
    ctx: RequestContext = Depends(request_context_dep),
    service: AuditLogService = Depends(get_audit_service),
) -> dict:
    data = service.get_errors(
        ctx.tenant_id,
        start_time=_parse_dt(startTime),
        end_time=_parse_dt(endTime),
        page=page,
        page_size=pageSize,
    )
    return success(data, trace_id=ctx.trace_id)


@router.get("/audit-logs/latency", summary="延迟统计")
async def query_latency(
    request: Request,
    startTime: Optional[str] = Query(default=None),
    endTime: Optional[str] = Query(default=None),
    ctx: RequestContext = Depends(request_context_dep),
    service: AuditLogService = Depends(get_audit_service),
) -> dict:
    stats = service.get_latency_stats(
        ctx.tenant_id,
        start_time=_parse_dt(startTime),
        end_time=_parse_dt(endTime),
    )
    return success(stats.model_dump(), trace_id=ctx.trace_id)


@router.get("/audit-logs/latency-by-model", summary="按模型延迟统计")
async def query_latency_by_model(
    request: Request,
    startTime: Optional[str] = Query(default=None),
    endTime: Optional[str] = Query(default=None),
    ctx: RequestContext = Depends(request_context_dep),
    service: AuditLogService = Depends(get_audit_service),
) -> dict:
    items = [
        m.model_dump()
        for m in service.get_latency_by_model(
            ctx.tenant_id,
            start_time=_parse_dt(startTime),
            end_time=_parse_dt(endTime),
        )
    ]
    return success({"items": items}, trace_id=ctx.trace_id)


@router.get("/audit-logs/export", summary="审计日志导出")
async def export_audit_logs(
    request: Request,
    format: Optional[str] = Query(default="csv"),
    startTime: Optional[str] = Query(default=None),
    endTime: Optional[str] = Query(default=None),
    ctx: RequestContext = Depends(request_context_dep),
    service: AuditLogService = Depends(get_audit_service),
) -> dict:
    payload = service.export(
        ctx.tenant_id,
        format=_parse_format(format),
        start_time=_parse_dt(startTime),
        end_time=_parse_dt(endTime),
    )
    return success(payload, trace_id=ctx.trace_id)


@router.get("/audit-logs/{log_id}", summary="审计日志详情")
async def get_audit_log_detail(
    log_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: AuditLogService = Depends(get_audit_service),
) -> dict:
    try:
        data = service.get_detail(ctx.tenant_id, log_id)
    except LookupError:
        from app.common.errors import InvalidParamError
        raise InvalidParamError(
            f"审计日志不存在: logId={log_id}", data={"logId": log_id}
        )
    return success(data, trace_id=ctx.trace_id)