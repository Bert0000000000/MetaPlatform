"""Evaluation endpoints for APP-DW (V11-04 APP-DW 效果评估后端化).

All routes are mounted under ``/evaluations`` to avoid collision with the
agent-runtime ``/conversations`` endpoints. The APP-DW frontend talks to:

- POST   /evaluations/conversations                       save a conversation record
- GET    /evaluations/conversations                       list conversations (by employeeId)
- GET    /evaluations/conversations/{id}                  get a conversation record
- POST   /evaluations/conversations/{id}/score            manual scoring
- POST   /evaluations/conversations/{id}/auto-score       LLM auto-scoring
- POST   /evaluations/conversations/batch-auto-score      batch auto-scoring
- POST   /evaluations/suggestions/generate                generate optimization suggestions
- GET    /evaluations/suggestions                         list suggestions
- POST   /evaluations/reports/generate                    generate an aggregated report
- GET    /evaluations/reports                             list reports
- GET    /evaluations/reports/quality-trend               quality trend curve
- GET    /evaluations/reports/{id}                        report detail
- GET    /evaluations/rubrics                             list scoring rubrics
- POST   /evaluations/rubrics                             save a scoring rubric
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Body, Depends, Query, Request

from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.deps import get_evaluation_service
from app.evaluation.schemas import (
    AggregateReportRequest,
    AutoScoreRequest,
    BatchAutoScoreRequest,
    ConversationRecord,
    GenerateReportRequest,
    GenerateSuggestionsRequest,
    ManualScoreRequest,
    ScoringRubric,
    conversation_record_to_dict,
    report_detail_to_dict,
    report_to_dict,
    rubric_to_dict,
    score_result_to_dict,
    suggestion_to_dict,
)
from app.evaluation.service import EvaluationService

router = APIRouter(prefix="/evaluations", tags=["evaluation"])


# --------------------------------------------------------------- conversations


@router.post("/conversations", summary="保存对话记录(评估用)")
async def save_conversation(
    body: dict,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: EvaluationService = Depends(get_evaluation_service),
) -> dict:
    record = ConversationRecord(**body)
    saved = await service.save_conversation(ctx.tenant_id, record)
    return success(conversation_record_to_dict(saved), trace_id=ctx.trace_id)


@router.get("/conversations", summary="对话记录列表(评估用)")
async def list_conversations(
    request: Request,
    employeeId: Optional[str] = Query(default=None),
    ctx: RequestContext = Depends(request_context_dep),
    service: EvaluationService = Depends(get_evaluation_service),
) -> dict:
    records = await service.list_conversations(ctx.tenant_id, employee_id=employeeId)
    return success(
        [conversation_record_to_dict(r) for r in records], trace_id=ctx.trace_id
    )


@router.get("/conversations/{conversation_id}", summary="对话记录详情(评估用)")
async def get_conversation(
    conversation_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: EvaluationService = Depends(get_evaluation_service),
) -> dict:
    record = await service.get_conversation(ctx.tenant_id, conversation_id)
    return success(conversation_record_to_dict(record), trace_id=ctx.trace_id)


@router.post("/conversations/{conversation_id}/score", summary="人工评分")
async def manual_score(
    conversation_id: str,
    body: dict,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: EvaluationService = Depends(get_evaluation_service),
) -> dict:
    req = ManualScoreRequest(**body)
    result = await service.manual_score(ctx.tenant_id, conversation_id, req)
    return success(score_result_to_dict(result), trace_id=ctx.trace_id)


@router.post("/conversations/{conversation_id}/auto-score", summary="自动评分")
async def auto_score(
    conversation_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: EvaluationService = Depends(get_evaluation_service),
    body: Optional[dict] = Body(default=None),
) -> dict:
    rubric_id = None
    if body:
        req = AutoScoreRequest(**body)
        rubric_id = req.rubricId
    result = await service.auto_score(ctx.tenant_id, conversation_id, rubric_id)
    return success(score_result_to_dict(result), trace_id=ctx.trace_id)


@router.post("/conversations/batch-auto-score", summary="批量自动评分")
async def batch_auto_score(
    body: dict,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: EvaluationService = Depends(get_evaluation_service),
) -> dict:
    req = BatchAutoScoreRequest(**body)
    resp = await service.batch_auto_score(ctx.tenant_id, req)
    return success(
        {
            "total": resp.total,
            "scored": resp.scored,
            "results": [score_result_to_dict(r) for r in resp.results],
        },
        trace_id=ctx.trace_id,
    )


# --------------------------------------------------------------- suggestions


@router.post("/suggestions/generate", summary="生成优化建议")
async def generate_suggestions(
    body: dict,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: EvaluationService = Depends(get_evaluation_service),
) -> dict:
    req = GenerateSuggestionsRequest(**body)
    resp = await service.generate_suggestions(ctx.tenant_id, req)
    return success(
        {
            "suggestions": [suggestion_to_dict(s) for s in resp.suggestions],
            "generatedAt": resp.generatedAt,
            "basedOnReportId": resp.basedOnReportId,
        },
        trace_id=ctx.trace_id,
    )


@router.get("/suggestions", summary="优化建议列表")
async def list_suggestions(
    request: Request,
    employeeId: str = Query(...),
    period: Optional[str] = Query(default=None),
    ctx: RequestContext = Depends(request_context_dep),
    service: EvaluationService = Depends(get_evaluation_service),
) -> dict:
    items = await service.list_suggestions(
        ctx.tenant_id, employeeId, period=period
    )
    return success(
        [suggestion_to_dict(s) for s in items], trace_id=ctx.trace_id
    )


# --------------------------------------------------------------- reports


@router.post("/reports/generate", summary="生成评估报告")
async def generate_report(
    body: dict,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: EvaluationService = Depends(get_evaluation_service),
) -> dict:
    req = GenerateReportRequest(**body)
    report = await service.generate_report(ctx.tenant_id, req)
    return success(report_detail_to_dict(report), trace_id=ctx.trace_id)


@router.get("/reports", summary="评估报告列表")
async def list_reports(
    request: Request,
    employeeId: Optional[str] = Query(default=None),
    ctx: RequestContext = Depends(request_context_dep),
    service: EvaluationService = Depends(get_evaluation_service),
) -> dict:
    reports = await service.list_reports(ctx.tenant_id, employee_id=employeeId)
    return success(
        [report_to_dict(r) for r in reports], trace_id=ctx.trace_id
    )


@router.get("/reports/quality-trend", summary="质量趋势")
async def get_quality_trend(
    request: Request,
    employeeId: str = Query(...),
    ctx: RequestContext = Depends(request_context_dep),
    service: EvaluationService = Depends(get_evaluation_service),
) -> dict:
    points = await service.get_quality_trend(ctx.tenant_id, employeeId)
    return success(
        [{"date": p.date, "score": p.score} for p in points],
        trace_id=ctx.trace_id,
    )


@router.get("/reports/{report_id}", summary="评估报告详情")
async def get_report_detail(
    report_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: EvaluationService = Depends(get_evaluation_service),
) -> dict:
    report = await service.get_report_detail(ctx.tenant_id, report_id)
    return success(report_detail_to_dict(report), trace_id=ctx.trace_id)


@router.post("/aggregate-report", summary="多员工协作报告聚合(V11-06)")
async def aggregate_report(
    body: dict,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: EvaluationService = Depends(get_evaluation_service),
) -> dict:
    req = AggregateReportRequest(**body)
    resp = await service.aggregate_report(ctx.tenant_id, req)
    return success(
        {
            "collaborationId": resp.collaborationId,
            "employeeIds": list(resp.employeeIds),
            "totalEmployees": resp.totalEmployees,
            "totalConversations": resp.totalConversations,
            "avgQualityScore": resp.avgQualityScore,
            "successRate": resp.successRate,
            "dimensions": [d.model_dump(mode="json") for d in resp.dimensions],
            "highlights": list(resp.highlights),
            "issues": list(resp.issues),
            "report": resp.report,
            "generatedAt": resp.generatedAt,
        },
        trace_id=ctx.trace_id,
    )


# --------------------------------------------------------------- rubrics


@router.get("/rubrics", summary="评分规则列表")
async def list_rubrics(
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: EvaluationService = Depends(get_evaluation_service),
) -> dict:
    rubrics = await service.list_rubrics(ctx.tenant_id)
    return success(
        [rubric_to_dict(r) for r in rubrics], trace_id=ctx.trace_id
    )


@router.post("/rubrics", summary="保存评分规则")
async def save_rubric(
    body: dict,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: EvaluationService = Depends(get_evaluation_service),
) -> dict:
    rubric = ScoringRubric(**body)
    saved = await service.save_rubric(ctx.tenant_id, rubric)
    return success(rubric_to_dict(saved), trace_id=ctx.trace_id)
