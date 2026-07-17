"""Quality endpoints (P3-DATA-06)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.deps import get_quality_service
from app.quality.schemas import (
    CreateQualityRuleRequest,
    Severity,
    UpdateQualityRuleRequest,
)
from app.quality.service import QualityService

router = APIRouter(tags=["quality"])


def _parse_severity(value: Optional[str]) -> Optional[Severity]:
    if value is None:
        return None
    try:
        return Severity(value.upper())
    except ValueError:
        return None


# ----------------------------------------------------------- rules


@router.post("/quality/rules", summary="创建质量规则")
async def create_rule(
    body: CreateQualityRuleRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: QualityService = Depends(get_quality_service),
) -> dict:
    rule = await service.create_rule(ctx.tenant_id, body)
    return success(rule.model_dump(), trace_id=ctx.trace_id)


@router.get("/quality/rules", summary="质量规则列表")
async def list_rules(
    request: Request,
    table: Optional[str] = Query(default=None),
    severity: Optional[str] = Query(default=None),
    ctx: RequestContext = Depends(request_context_dep),
    service: QualityService = Depends(get_quality_service),
) -> dict:
    items = [
        r.model_dump()
        for r in await service.list_rules(
            ctx.tenant_id, table=table, severity=_parse_severity(severity)
        )
    ]
    return success({"items": items}, trace_id=ctx.trace_id)


@router.get("/quality/rules/{rule_id}", summary="质量规则详情")
async def get_rule(
    rule_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: QualityService = Depends(get_quality_service),
) -> dict:
    rule = await service.get_rule(ctx.tenant_id, rule_id)
    return success(rule.model_dump(), trace_id=ctx.trace_id)


@router.put("/quality/rules/{rule_id}", summary="更新质量规则")
async def update_rule(
    rule_id: str,
    body: UpdateQualityRuleRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: QualityService = Depends(get_quality_service),
) -> dict:
    rule = await service.update_rule(ctx.tenant_id, rule_id, body)
    return success(rule.model_dump(), trace_id=ctx.trace_id)


@router.delete("/quality/rules/{rule_id}", summary="删除质量规则")
async def delete_rule(
    rule_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: QualityService = Depends(get_quality_service),
) -> dict:
    result = await service.delete_rule(ctx.tenant_id, rule_id)
    return success(result, trace_id=ctx.trace_id)


# ----------------------------------------------------------- checks


@router.post("/quality/checks/run", summary="执行质量检查")
async def run_checks(
    request: Request,
    table: Optional[str] = Query(default=None),
    ctx: RequestContext = Depends(request_context_dep),
    service: QualityService = Depends(get_quality_service),
) -> dict:
    results = [
        r.model_dump()
        for r in await service.execute_checks(ctx.tenant_id, table=table)
    ]
    return success({"items": results}, trace_id=ctx.trace_id)


@router.post("/quality/reports", summary="生成质量报告")
async def generate_report(
    request: Request,
    table: Optional[str] = Query(default=None),
    ctx: RequestContext = Depends(request_context_dep),
    service: QualityService = Depends(get_quality_service),
) -> dict:
    report = await service.generate_report(ctx.tenant_id, table=table)
    return success(report.model_dump(), trace_id=ctx.trace_id)


@router.get("/quality/dashboard", summary="质量看板")
async def dashboard(
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: QualityService = Depends(get_quality_service),
) -> dict:
    data = await service.dashboard(ctx.tenant_id)
    return success(data.model_dump(), trace_id=ctx.trace_id)