"""Digital worker self-learning endpoints (V15-03)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from app.common.api_response import build_page, success
from app.common.context import RequestContext, request_context_dep
from app.common.errors import InvalidParamError
from app.deps import get_learning_service
from app.learning.schemas import (
    FeedbackCreateRequest,
    KnowledgeExtractRequest,
    feedback_to_dict,
    knowledge_to_dict,
    stats_to_dict,
)
from app.learning.service import LearningService

router = APIRouter(tags=["learning"])


def _ensure_feedback_exists(
    service: LearningService,
    feedback_id: str,
) -> None:
    if service.get_feedback(feedback_id) is None:
        raise InvalidParamError(
            f"反馈记录不存在: feedbackId={feedback_id}",
            data={"feedbackId": feedback_id},
        )


@router.post("/learning/feedback", summary="记录任务执行反馈")
async def record_feedback(
    body: FeedbackCreateRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: LearningService = Depends(get_learning_service),
) -> dict:
    record = await service.record_feedback(body)
    return success(feedback_to_dict(record), trace_id=ctx.trace_id)


@router.get("/learning/feedback", summary="查询反馈记录")
async def list_feedback(
    request: Request,
    employeeId: Optional[str] = Query(default=None),
    taskId: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    ctx: RequestContext = Depends(request_context_dep),
    service: LearningService = Depends(get_learning_service),
) -> dict:
    records = service.list_feedback(employee_id=employeeId, task_id=taskId)
    paged = build_page(
        [feedback_to_dict(r) for r in records],
        total=len(records),
        page=page,
        page_size=pageSize,
    )
    return success(paged, trace_id=ctx.trace_id)


@router.put("/learning/feedback/{feedback_id}/tags", summary="更新反馈标签")
async def update_feedback_tags(
    feedback_id: str,
    body: dict,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: LearningService = Depends(get_learning_service),
) -> dict:
    tags = body.get("tags", []) or []
    updated = service.update_feedback_tags(feedback_id, tags)
    if updated is None:
        raise InvalidParamError(
            f"反馈记录不存在: feedbackId={feedback_id}",
            data={"feedbackId": feedback_id},
        )
    return success(feedback_to_dict(updated), trace_id=ctx.trace_id)


@router.post("/learning/extract", summary="从反馈中自动提炼知识")
async def extract_knowledge(
    body: KnowledgeExtractRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: LearningService = Depends(get_learning_service),
) -> dict:
    records = service.list_feedback(employee_id=body.employee_id)
    if body.feedback_ids:
        records = [r for r in records if r.id in body.feedback_ids]
    knowledge = await service.extract_knowledge(records)
    return success(
        {"knowledge": [knowledge_to_dict(k) for k in knowledge]},
        trace_id=ctx.trace_id,
    )


@router.get(
    "/learning/employees/{employee_id}/knowledge",
    summary="查询员工学到的知识片段",
)
async def list_knowledge(
    employee_id: str,
    request: Request,
    syncedOnly: bool = Query(default=False),
    ctx: RequestContext = Depends(request_context_dep),
    service: LearningService = Depends(get_learning_service),
) -> dict:
    knowledge = service.list_knowledge(employee_id, synced_only=syncedOnly)
    return success(
        {"items": [knowledge_to_dict(k) for k in knowledge]},
        trace_id=ctx.trace_id,
    )


@router.post(
    "/learning/employees/{employee_id}/sync-to-kb",
    summary="将员工知识片段同步到知识库",
)
async def sync_to_knowledge_base(
    employee_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: LearningService = Depends(get_learning_service),
) -> dict:
    result = await service.sync_to_knowledge_base(employee_id)
    return success(
        {
            "employeeId": result.employee_id,
            "syncedCount": result.synced_count,
            "documentIds": result.document_ids,
        },
        trace_id=ctx.trace_id,
    )


@router.get(
    "/learning/employees/{employee_id}/stats",
    summary="查询员工学习统计",
)
async def get_learning_stats(
    employee_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: LearningService = Depends(get_learning_service),
) -> dict:
    stats = service.get_stats(employee_id)
    return success(stats_to_dict(stats), trace_id=ctx.trace_id)
