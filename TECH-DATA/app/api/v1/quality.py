"""Quality endpoints (P3-DATA-06, V11-01)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.deps import get_quality_service
from app.quality.schemas import (
    CreateQualityRuleRequest,
    IssueSeverity,
    QualityDimension,
    QualityIssueStatus,
    RunQualityCheckRequest,
    Severity,
    UpdateIssueStatusRequest,
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


def _parse_dimension(value: Optional[str]) -> Optional[QualityDimension]:
    if value is None:
        return None
    try:
        return QualityDimension(value.lower())
    except ValueError:
        return None


def _parse_issue_severity(value: Optional[str]) -> Optional[IssueSeverity]:
    if value is None:
        return None
    try:
        return IssueSeverity(value.lower())
    except ValueError:
        return None


def _parse_issue_status(value: Optional[str]) -> Optional[QualityIssueStatus]:
    if value is None:
        return None
    try:
        return QualityIssueStatus(value.lower())
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
    dimension: Optional[str] = Query(default=None),
    ctx: RequestContext = Depends(request_context_dep),
    service: QualityService = Depends(get_quality_service),
) -> dict:
    rules = await service.list_rules(
        ctx.tenant_id,
        table=table,
        severity=_parse_severity(severity),
        dimension=_parse_dimension(dimension),
    )
    items = [r.model_dump() for r in rules]
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


# ----------------------------------------------------------- V11-01: overview / issues / run


@router.get("/quality/overview", summary="数据质量概览")
async def get_overview(
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: QualityService = Depends(get_quality_service),
) -> dict:
    data = await service.get_overview(ctx.tenant_id)
    return success(data.model_dump(mode="json"), trace_id=ctx.trace_id)


@router.get("/quality/issues", summary="质量问题列表")
async def list_issues(
    request: Request,
    status: Optional[str] = Query(default=None),
    dimension: Optional[str] = Query(default=None),
    severity: Optional[str] = Query(default=None),
    conceptId: Optional[str] = Query(default=None),
    ctx: RequestContext = Depends(request_context_dep),
    service: QualityService = Depends(get_quality_service),
) -> dict:
    items = await service.list_issues(
        ctx.tenant_id,
        status=_parse_issue_status(status),
        dimension=_parse_dimension(dimension),
        severity=_parse_issue_severity(severity),
        concept_id=conceptId,
    )
    payload = [i.model_dump(mode="json") for i in items]
    return success({"items": payload}, trace_id=ctx.trace_id)


@router.post("/quality/issues/{issue_id}/status", summary="更新问题状态")
async def update_issue_status(
    issue_id: str,
    body: UpdateIssueStatusRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: QualityService = Depends(get_quality_service),
) -> dict:
    issue = await service.update_issue_status(
        ctx.tenant_id, issue_id, body
    )
    return success(issue.model_dump(mode="json"), trace_id=ctx.trace_id)


@router.post("/quality/run", summary="触发质量检测任务")
async def run_check(
    body: RunQualityCheckRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: QualityService = Depends(get_quality_service),
) -> dict:
    job = await service.run_check_job(ctx.tenant_id, body)
    # 前端期望 { jobId, startedAt } 结构
    payload = {
        "jobId": job.jobId,
        "startedAt": job.startedAt,
        "status": job.status,
        "totalRules": job.totalRules,
        "failedCount": job.failedCount,
        "issuesGenerated": job.issuesGenerated,
        "finishedAt": job.finishedAt,
    }
    return success(payload, trace_id=ctx.trace_id)


# ----------------------------------------------------------- checks（保留兼容）


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
