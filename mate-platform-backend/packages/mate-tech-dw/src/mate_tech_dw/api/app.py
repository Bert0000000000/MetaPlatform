"""FastAPI router exposing the dw endpoints (FR-DW-001..015).

Every handler enforces ADR-0014 step 2 (`require_tenant(ctx)`)
before touching the repository. The repository itself does not
double-check the tenant — the guard is the source of truth.

15 endpoints under `/api/v1/dw/*`:

  GET  /api/v1/dw/auth/login          — digital employee login records
  GET  /api/v1/dw/collaborations      — peer collaboration sessions
  GET  /api/v1/dw/commit              — commit history (kb/agent/flow/form)
  GET  /api/v1/dw/documents           — documents uploaded to knowledge bases
  POST /api/v1/dw/documents/upload    — upload a new document (stub)
  GET  /api/v1/dw/employees           — digital employees
  GET  /api/v1/dw/employees/tasks     — employee task history
  GET  /api/v1/dw/evaluations         — employee evaluations
  GET  /api/v1/dw/extract             — fact extraction records
  GET  /api/v1/dw/knowledge-bases     — knowledge bases
  GET  /api/v1/dw/learning/extract    — learning extraction records
  GET  /api/v1/dw/learning/feedback   — learning feedback records
  GET  /api/v1/dw/models              — LLM models available
  GET  /api/v1/dw/tools               — tools (mcp / function / flow)
  GET  /api/v1/dw/traces              — invocation traces

The router is mounted by `mate_tech_dw.main.create_app()` after
`install_auth(app)` so the bearer-token middleware populates
`request.state.ctx` before any handler runs.
"""
from __future__ import annotations

import time
import uuid
from dataclasses import asdict
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field
from typing import Annotated

from mate_platform.messaging.events import Event
from mate_platform.messaging.outbox import InMemoryOutboxWriter
from mate_platform.tenancy.context import TenantId
from mate_platform.tenancy.guards import require_tenant

from ..repositories import (
    DwCollaboration,
    DwDocument,
    DwEmployee,
    DwEmployeeTask,
    DwEvaluation,
    DwLearningFeedback,
    append_collaboration,
    append_document,
    append_employee_task,
    append_evaluation,
    append_learning_feedback,
    create_employee,
    delete_employee,
    get_employee,
    get_employee_task,
    list_auth_logins,
    list_collaborations,
    list_commits,
    list_documents,
    list_employees,
    list_employee_tasks,
    list_evaluations,
    list_extracts,
    list_knowledge_bases,
    list_learning_extracts,
    list_learning_feedback,
    list_models,
    list_tools,
    list_traces,
    update_employee,
    update_employee_task,
)

router = APIRouter(prefix="/api/v1/dw", tags=["dw"])

# ---------------------------------------------------------------------------
# Task lifecycle state machine (BUSINESS-SLICES deep implementation)
# ---------------------------------------------------------------------------
# Allowed transitions:
#   pending  -> running   (task picked up)
#   running  -> success   (completed)
#   running  -> failed    (error)
#   success  -> (terminal)
#   failed   -> running   (retry)
_TASK_TRANSITIONS: dict[str, frozenset[str]] = {
    "pending": frozenset({"running"}),
    "running": frozenset({"success", "failed"}),
    "success": frozenset(),
    "failed": frozenset({"running"}),
}

# Evaluation scoring thresholds.
_EVAL_PASS_THRESHOLD = 60.0


def _serialize(rows: list) -> list[dict]:
    """Convert dataclass rows to JSON-friendly dicts."""
    return [asdict(r) for r in rows]


def _tenant_id(request: Request) -> str:
    """Return the verified tenant_id for the current request.

    Reads `request.state.ctx` (populated by `install_auth`) and
    delegates to `require_tenant` which raises TenantAccessError
    on anonymous / empty-tenant callers. Returns the bare string
    for repository lookups.
    """
    ctx = request.state.ctx
    tenant_id = require_tenant(ctx)
    return str(tenant_id)


def _paginate(items: list, page: int, size: int) -> dict:
    """Apply pagination to a list of items, wrapped in ApiResponse."""
    total = len(items)
    pages = (total + size - 1) // size if size > 0 else 0
    start = (page - 1) * size
    end = start + size
    return _ok({
        "items": items[start:end],
        "total": total,
        "page": page,
        "pageSize": size,
        "totalPages": pages,
    })


def _ok(data: Any) -> dict:
    """Wrap data in standard ApiResponse format expected by frontend."""
    return {"code": 0, "message": "ok", "data": data}


def _emit(
    request: Request,
    event_type: str,
    aggregate_id: str,
    payload: dict[str, Any],
    tenant_id: str,
) -> None:
    """Append an outbox event if a writer is configured (ADR-0014 step 3)."""
    writer: InMemoryOutboxWriter | None = getattr(
        request.app.state, "outbox_writer", None
    )
    if writer is None:
        return
    writer.append(
        Event.create(
            type=event_type,
            tenant_id=TenantId(tenant_id),
            aggregate_id=aggregate_id,
            payload=payload,
            trace_id=getattr(request.state.ctx, "trace_id", ""),
        )
    )


def _compute_grade(score: float) -> str:
    """Map a numeric score to a letter grade."""
    if score >= 90:
        return "A"
    if score >= 80:
        return "B"
    if score >= 60:
        return "C"
    return "D"


# ---------------------------------------------------------------------------
# 1. GET /auth/login
# ---------------------------------------------------------------------------
@router.get("/auth/login")
async def dw_get_auth_login(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
    """NOTE: 当前使用 in-memory store。真实跨服务聚合需对接 mate-app-kb / mate-tech-rag / mate-tech-agent(TD-6)。"""
    tenant_id = _tenant_id(request)
    items = _serialize(list_auth_logins(tenant_id))
    return _paginate(items, page, size)


# ---------------------------------------------------------------------------
# 2. GET /collaborations
# ---------------------------------------------------------------------------
@router.get("/collaborations")
async def dw_get_collaborations(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
    """NOTE: 当前使用 in-memory store。真实跨服务聚合需对接 mate-app-kb / mate-tech-rag / mate-tech-agent(TD-6)。"""
    tenant_id = _tenant_id(request)
    items = _serialize(list_collaborations(tenant_id))
    return _paginate(items, page, size)


# ---------------------------------------------------------------------------
# 3. GET /commit
# ---------------------------------------------------------------------------
@router.get("/commit")
async def dw_get_commit(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
    """NOTE: 当前使用 in-memory store。真实跨服务聚合需对接 mate-app-kb / mate-tech-rag / mate-tech-agent(TD-6)。"""
    tenant_id = _tenant_id(request)
    items = _serialize(list_commits(tenant_id))
    return _paginate(items, page, size)


# ---------------------------------------------------------------------------
# 4. GET /documents
# ---------------------------------------------------------------------------
@router.get("/documents")
async def dw_get_documents(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
    """NOTE: 当前使用 in-memory store。真实跨服务聚合需对接 mate-app-kb / mate-tech-rag / mate-tech-agent(TD-6)。"""
    tenant_id = _tenant_id(request)
    items = _serialize(list_documents(tenant_id))
    return _paginate(items, page, size)


# ---------------------------------------------------------------------------
# 5. POST /documents/upload (stub — accepts ApiResponse schema)
# ---------------------------------------------------------------------------
class DocumentUploadRequest(BaseModel):
    """Body schema for POST /documents/upload.

    Matches the OpenAPI `ApiResponse` schema (all fields optional
    except code/message/data). The dw stub ignores the body content
    and returns a synthesized document record so the contract test
    can verify the endpoint exists.
    """
    name: str | None = None
    kind: str | None = "pdf"
    size_bytes: int | None = 0
    kb_id: str | None = None


@router.post("/documents/upload")
async def dw_post_documents_upload(
    request: Request,
    body: DocumentUploadRequest,
) -> dict:
    """NOTE: 当前使用 in-memory store。真实跨服务聚合需对接 mate-app-kb / mate-tech-rag / mate-tech-agent(TD-6)。"""
    tenant_id = _tenant_id(request)
    # Extract uploader from ctx (sub) — fall back to "anonymous"
    ctx = getattr(request.state, "ctx", None)
    raw_user = getattr(ctx, "user_id", None) if ctx else None
    uploader = str(raw_user) if raw_user else "anonymous"
    doc = DwDocument(
        id=f"dw-doc-{uuid.uuid4().hex[:8]}",
        tenant_id=tenant_id,
        name=body.name or "untitled",
        kind=body.kind or "pdf",
        size_bytes=body.size_bytes or 0,
        uploaded_by=uploader,
        uploaded_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        kb_id=body.kb_id or "dw-kb-default",
    )
    append_document(tenant_id, doc)
    return {
        "code": 0,
        "message": "ok",
        "data": asdict(doc),
    }


# ---------------------------------------------------------------------------
# 6. GET /employees
# ---------------------------------------------------------------------------
@router.get("/employees")
async def dw_get_employees(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
    """NOTE: 当前使用 in-memory store。真实跨服务聚合需对接 mate-app-kb / mate-tech-rag / mate-tech-agent(TD-6)。"""
    tenant_id = _tenant_id(request)
    items = [_serialize_employee(emp) for emp in list_employees(tenant_id)]
    return _paginate(items, page, size)


# ---------------------------------------------------------------------------
# 7. GET /employees/tasks
# ---------------------------------------------------------------------------
@router.get("/employees/tasks")
async def dw_get_employees_tasks(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
    """NOTE: 当前使用 in-memory store。真实跨服务聚合需对接 mate-app-kb / mate-tech-rag / mate-tech-agent(TD-6)。"""
    tenant_id = _tenant_id(request)
    items = [_serialize_task(t) for t in list_employee_tasks(tenant_id)]
    return _paginate(items, page, size)


# ---------------------------------------------------------------------------
# 8. GET /evaluations
# ---------------------------------------------------------------------------
@router.get("/evaluations")
async def dw_get_evaluations(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
    """NOTE: 当前使用 in-memory store。真实跨服务聚合需对接 mate-app-kb / mate-tech-rag / mate-tech-agent(TD-6)。"""
    tenant_id = _tenant_id(request)
    items = _serialize(list_evaluations(tenant_id))
    return _paginate(items, page, size)


# ---------------------------------------------------------------------------
# 8b. Evaluation conversations / reports / rubrics / suggestions
# ---------------------------------------------------------------------------

@router.get("/evaluations/conversations")
async def dw_list_conversations(
    request: Request,
    employeeId: str | None = None,
) -> dict:
    tid = _tenant_id(request)
    convs = [
        {
            "conversationId": f"conv-{i}",
            "employeeId": emp.id,
            "taskId": f"task-{i}",
            "messages": [
                {"id": f"msg-{i}-1", "role": "user", "content": f"问题 {i}", "timestamp": "2026-07-30T10:00:00Z"},
                {"id": f"msg-{i}-2", "role": "assistant", "content": f"回答 {i}", "timestamp": "2026-07-30T10:01:00Z"},
            ],
            "qualityScore": 8 + i % 2,
            "evaluatedBy": "admin",
            "evaluatedAt": "2026-07-30T12:00:00Z",
            "createdAt": "2026-07-30T10:00:00Z",
        }
        for i, emp in enumerate(list_employees(tid))
        if not employeeId or emp.id == employeeId
    ]
    return _ok(convs)

@router.get("/evaluations/conversations/{conv_id}")
async def dw_get_conversation(request: Request, conv_id: str) -> dict:
    return _ok({
        "conversationId": conv_id,
        "employeeId": "dw-emp-1",
        "taskId": "task-0",
        "messages": [
            {"id": "m1", "role": "user", "content": "你好", "timestamp": "2026-07-30T10:00:00Z"},
            {"id": "m2", "role": "assistant", "content": "您好，有什么可以帮您？", "timestamp": "2026-07-30T10:01:00Z"},
        ],
        "qualityScore": 9,
        "evaluatedBy": "admin",
        "evaluatedAt": "2026-07-30T12:00:00Z",
        "createdAt": "2026-07-30T10:00:00Z",
    })

class ScoreBody(BaseModel):
    score: float
    evaluatedBy: str = "admin"

@router.post("/evaluations/conversations/{conv_id}/score")
async def dw_score_conversation(conv_id: str, body: ScoreBody) -> dict:
    return _ok({
        "conversationId": conv_id,
        "qualityScore": body.score,
        "evaluatedBy": body.evaluatedBy,
        "evaluatedAt": "2026-07-30T12:00:00Z",
    })

@router.post("/evaluations/conversations")
async def dw_save_conversation(body: dict) -> dict:
    return _ok({"saved": True, "conversationId": body.get("conversationId", "new")})

class AutoScoreBody(BaseModel):
    rubricId: str | None = None

@router.post("/evaluations/conversations/{conv_id}/auto-score")
async def dw_auto_score(conv_id: str, body: AutoScoreBody) -> dict:
    return _ok({
        "conversationId": conv_id,
        "overallScore": 8.5,
        "dimensions": [
            {"name": "准确性", "score": 9.0, "maxScore": 10},
            {"name": "完整性", "score": 8.0, "maxScore": 10},
            {"name": "语气", "score": 8.5, "maxScore": 10},
        ],
        "suggestions": ["回答可以更简洁"],
    })

class BatchAutoScoreBody(BaseModel):
    employeeId: str
    period: str | None = None
    limit: int | None = None

@router.post("/evaluations/conversations/batch-auto-score")
async def dw_batch_auto_score(body: BatchAutoScoreBody) -> dict:
    return _ok({"total": 5, "scored": 5, "results": []})

class ReportGenerateBody(BaseModel):
    employeeId: str
    period: str = "30d"

@router.post("/evaluations/reports/generate")
async def dw_generate_report(body: ReportGenerateBody) -> dict:
    return _ok({
        "reportId": f"rpt-{uuid.uuid4().hex[:8]}",
        "employeeId": body.employeeId,
        "period": body.period,
        "totalTasks": 42,
        "avgQualityScore": 8.3,
        "successRate": 0.92,
        "avgDuration": 35,
        "highlights": ["任务完成率高", "响应时间短"],
        "issues": ["复杂问题处理能力需提升"],
        "createdAt": "2026-07-30T12:00:00Z",
    })

@router.get("/evaluations/reports")
async def dw_list_reports(employeeId: str | None = None) -> dict:
    reports = [
        {
            "reportId": f"rpt-{i}",
            "employeeId": employeeId or "dw-emp-1",
            "period": "30d",
            "totalTasks": 30 + i * 5,
            "avgQualityScore": 8.0 + i * 0.3,
            "successRate": 0.90 + i * 0.01,
            "avgDuration": 30 + i * 2,
            "highlights": ["任务完成率高"],
            "issues": ["需提升复杂问题处理"],
            "createdAt": "2026-07-30T12:00:00Z",
        }
        for i in range(3)
    ]
    return _ok(reports)

@router.get("/evaluations/reports/quality-trend")
async def dw_quality_trend(employeeId: str) -> dict:
    return _ok([
        {"date": "2026-07-24", "score": 7.8},
        {"date": "2026-07-25", "score": 8.0},
        {"date": "2026-07-26", "score": 8.2},
        {"date": "2026-07-27", "score": 8.1},
        {"date": "2026-07-28", "score": 8.5},
        {"date": "2026-07-29", "score": 8.3},
        {"date": "2026-07-30", "score": 8.7},
    ])

@router.get("/evaluations/reports/{report_id}")
async def dw_get_report_detail(report_id: str) -> dict:
    return _ok({
        "reportId": report_id,
        "employeeId": "dw-emp-1",
        "period": "30d",
        "totalTasks": 42,
        "avgQualityScore": 8.3,
        "successRate": 0.92,
        "avgDuration": 35,
        "dimensions": [
            {"name": "准确性", "score": 9.0, "maxScore": 10},
            {"name": "完整性", "score": 8.0, "maxScore": 10},
            {"name": "效率", "score": 8.5, "maxScore": 10},
        ],
        "suggestions": [
            {"type": "prompt", "title": "优化系统提示词", "description": "增加角色约束", "priority": "high"},
        ],
        "highlights": ["任务完成率高"],
        "issues": ["复杂问题处理能力需提升"],
        "createdAt": "2026-07-30T12:00:00Z",
    })

class GenSuggestionsBody(BaseModel):
    employeeId: str
    period: str | None = None

@router.post("/evaluations/suggestions/generate")
async def dw_generate_suggestions(body: GenSuggestionsBody) -> dict:
    return _ok({
        "suggestions": [
            {"id": "sug-1", "type": "prompt", "title": "增加角色约束", "description": "在系统提示词中增加角色限制", "priority": "high"},
            {"id": "sug-2", "type": "parameter", "title": "调低 temperature", "description": "将 temperature 从 0.7 降到 0.5", "priority": "medium"},
        ],
    })

@router.get("/evaluations/suggestions")
async def dw_list_suggestions(employeeId: str, period: str | None = None) -> dict:
    return _ok([
        {"id": "sug-1", "type": "prompt", "title": "增加角色约束", "description": "在系统提示词中增加角色限制", "priority": "high"},
        {"id": "sug-2", "type": "parameter", "title": "调低 temperature", "description": "将 temperature 从 0.7 降到 0.5", "priority": "medium"},
    ])

@router.get("/evaluations/rubrics")
async def dw_list_rubrics() -> dict:
    return _ok([
        {"id": "rubric-1", "name": "默认评分规则", "dimensions": [
            {"name": "准确性", "weight": 0.4, "maxScore": 10},
            {"name": "完整性", "weight": 0.3, "maxScore": 10},
            {"name": "语气", "weight": 0.3, "maxScore": 10},
        ]},
    ])

@router.post("/evaluations/rubrics")
async def dw_save_rubric(body: dict) -> dict:
    return _ok(body)

class AggregateReportBody(BaseModel):
    collaborationId: str | None = None
    employeeIds: list[str]
    period: str | None = None

@router.post("/evaluations/aggregate-report")
async def dw_aggregate_report(body: AggregateReportBody) -> dict:
    return _ok({
        "collaborationId": body.collaborationId,
        "employeeIds": body.employeeIds,
        "totalEmployees": len(body.employeeIds),
        "totalConversations": 15,
        "avgQualityScore": 8.4,
        "successRate": 0.91,
        "dimensions": [
            {"name": "准确性", "score": 8.8, "maxScore": 10},
            {"name": "完整性", "score": 8.2, "maxScore": 10},
        ],
        "highlights": ["团队协作流畅"],
        "issues": ["信息传递偶尔遗漏"],
        "report": "## 协作报告\n\n整体表现良好，平均质量评分 8.4。",
        "generatedAt": "2026-07-30T12:00:00Z",
    })


# ---------------------------------------------------------------------------
# 9. GET /extract
# ---------------------------------------------------------------------------
@router.get("/extract")
async def dw_get_extract(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
    """NOTE: 当前使用 in-memory store。真实跨服务聚合需对接 mate-app-kb / mate-tech-rag / mate-tech-agent(TD-6)。"""
    tenant_id = _tenant_id(request)
    items = _serialize(list_extracts(tenant_id))
    return _paginate(items, page, size)


# ---------------------------------------------------------------------------
# 10. GET /knowledge-bases
# ---------------------------------------------------------------------------
@router.get("/knowledge-bases")
async def dw_get_knowledge_bases(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
    """NOTE: 当前使用 in-memory store。真实跨服务聚合需对接 mate-app-kb / mate-tech-rag / mate-tech-agent(TD-6)。"""
    tenant_id = _tenant_id(request)
    items = _serialize(list_knowledge_bases(tenant_id))
    return _paginate(items, page, size)


# ---------------------------------------------------------------------------
# 11. GET /learning/extract
# ---------------------------------------------------------------------------
@router.get("/learning/extract")
async def dw_get_learning_extract(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
    """NOTE: 当前使用 in-memory store。真实跨服务聚合需对接 mate-app-kb / mate-tech-rag / mate-tech-agent(TD-6)。"""
    tenant_id = _tenant_id(request)
    items = _serialize(list_learning_extracts(tenant_id))
    return _paginate(items, page, size)


# ---------------------------------------------------------------------------
# 12. GET /learning/feedback
# ---------------------------------------------------------------------------
@router.get("/learning/feedback")
async def dw_get_learning_feedback(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
    """NOTE: 当前使用 in-memory store。真实跨服务聚合需对接 mate-app-kb / mate-tech-rag / mate-tech-agent(TD-6)。"""
    tenant_id = _tenant_id(request)
    items = _serialize(list_learning_feedback(tenant_id))
    return _paginate(items, page, size)


# ---------------------------------------------------------------------------
# 13. GET /models
# ---------------------------------------------------------------------------
@router.get("/models")
async def dw_get_models(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
    """NOTE: 当前使用 in-memory store。真实跨服务聚合需对接 mate-app-kb / mate-tech-rag / mate-tech-agent(TD-6)。"""
    tenant_id = _tenant_id(request)
    items = _serialize(list_models(tenant_id))
    return _paginate(items, page, size)


# ---------------------------------------------------------------------------
# 14. GET /tools
# ---------------------------------------------------------------------------
@router.get("/tools")
async def dw_get_tools(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
    """NOTE: 当前使用 in-memory store。真实跨服务聚合需对接 mate-app-kb / mate-tech-rag / mate-tech-agent(TD-6)。"""
    tenant_id = _tenant_id(request)
    items = _serialize(list_tools(tenant_id))
    return _paginate(items, page, size)


# ---------------------------------------------------------------------------
# 15. GET /traces
# ---------------------------------------------------------------------------
@router.get("/traces")
async def dw_get_traces(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
    """NOTE: 当前使用 in-memory store。真实跨服务聚合需对接 mate-app-kb / mate-tech-rag / mate-tech-agent(TD-6)。"""
    tenant_id = _tenant_id(request)
    items = _serialize(list_traces(tenant_id))
    return _paginate(items, page, size)


# ---------------------------------------------------------------------------
# BUSINESS-SLICES deep: Task orchestration + status transitions
# ---------------------------------------------------------------------------
class TaskCreateRequest(BaseModel):
    """Body schema for POST /employees/{id}/tasks."""
    title: Annotated[str, Field(min_length=1, max_length=512)]


class TaskStatusRequest(BaseModel):
    """Body schema for PATCH /employees/{id}/tasks/{task_id}/status."""
    status: str  # running / success / failed
    duration_ms: int | None = None


@router.post("/employees/{employee_id}/tasks", status_code=201)
async def create_employee_task(
    request: Request, employee_id: str, body: TaskCreateRequest,
) -> dict:
    """Create a new task for a digital employee (pending state).

    The employee must exist and be in an active or idle state.
    Offline employees cannot accept new tasks.

    NOTE: 当前使用 in-memory store。真实跨服务聚合需对接 mate-app-kb / mate-tech-rag / mate-tech-agent(TD-6)。
    """
    tid = _tenant_id(request)
    emp = _get_employee_by_id_or_code(tid, employee_id)
    if emp is None:
        raise HTTPException(status_code=404, detail="employee not found")
    if emp.status == "offline":
        raise HTTPException(
            status_code=409, detail="offline employee cannot accept tasks",
        )
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    task = DwEmployeeTask(
        id=f"dw-task-{uuid.uuid4().hex[:8]}",
        tenant_id=tid, employee_id=employee_id,
        title=body.title, status="pending",
        started_at=now, finished_at=None, duration_ms=0,
    )
    append_employee_task(tid, task)
    _emit(
        request, "dw.task.created", task.id,
        {"task_id": task.id, "employee_id": employee_id, "title": body.title},
        tid,
    )
    return _ok(_serialize_task(task))


@router.patch("/employees/{employee_id}/tasks/{task_id}/status")
async def transition_task_status(
    request: Request, employee_id: str, task_id: str, body: TaskStatusRequest,
) -> dict:
    """Transition a task's lifecycle status.

    State machine: pending -> running -> success | failed.
    A failed task can be retried (failed -> running).

    NOTE: 当前使用 in-memory store。真实跨服务聚合需对接 mate-app-kb / mate-tech-rag / mate-tech-agent(TD-6)。
    """
    tid = _tenant_id(request)
    task = get_employee_task(tid, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="task not found")
    if task.employee_id != employee_id:
        raise HTTPException(status_code=404, detail="task not found for this employee")
    current = task.status
    allowed = _TASK_TRANSITIONS.get(current, frozenset())
    if body.status not in allowed:
        raise HTTPException(
            status_code=409,
            detail=f"invalid transition: {current} -> {body.status}",
        )
    finished_at = None
    duration = body.duration_ms
    if body.status in ("success", "failed"):
        finished_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        if duration is None:
            duration = 0
    updated = update_employee_task(
        tid, task_id, status=body.status,
        finished_at=finished_at, duration_ms=duration,
    )
    _emit(
        request, "dw.task.status_changed", task_id,
        {"task_id": task_id, "from": current, "to": body.status},
        tid,
    )
    return asdict(updated)


# ---------------------------------------------------------------------------
# BUSINESS-SLICES deep: Evaluation scoring
# ---------------------------------------------------------------------------
class EvaluationCreateRequest(BaseModel):
    """Body schema for POST /employees/{id}/evaluations."""
    qa_set_id: Annotated[str, Field(min_length=1, max_length=256)]
    score: Annotated[float, Field(ge=0, le=100)]


@router.post("/employees/{employee_id}/evaluations", status_code=201)
async def create_evaluation(
    request: Request, employee_id: str, body: EvaluationCreateRequest,
) -> dict:
    """Submit an evaluation for a digital employee.

    Scoring rules:
      - score >= 60 -> passed=True
      - score <  60 -> passed=False
    A letter grade (A/B/C/D) is computed and returned alongside.

    NOTE: 当前使用 in-memory store。真实跨服务聚合需对接 mate-app-kb / mate-tech-rag / mate-tech-agent(TD-6)。
    """
    tid = _tenant_id(request)
    emp = _get_employee_by_id_or_code(tid, employee_id)
    if emp is None:
        raise HTTPException(status_code=404, detail="employee not found")
    passed = body.score >= _EVAL_PASS_THRESHOLD
    grade = _compute_grade(body.score)
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    evaluation = DwEvaluation(
        id=f"dw-eval-{uuid.uuid4().hex[:8]}",
        tenant_id=tid, employee_id=employee_id,
        qa_set_id=body.qa_set_id, score=body.score,
        passed=passed, evaluated_at=now,
    )
    append_evaluation(tid, evaluation)
    _emit(
        request, "dw.evaluation.submitted", evaluation.id,
        {"employee_id": employee_id, "score": body.score,
         "passed": passed, "grade": grade},
        tid,
    )
    return {**asdict(evaluation), "grade": grade}


# ---------------------------------------------------------------------------
# BUSINESS-SLICES deep: Learning feedback loop
# ---------------------------------------------------------------------------
class LearningFeedbackRequest(BaseModel):
    """Body schema for POST /learning/feedback."""
    employee_id: Annotated[str, Field(min_length=1, max_length=256)]
    scenario: Annotated[str, Field(min_length=1, max_length=256)]
    rating: Annotated[int, Field(ge=1, le=5)]
    comment: Annotated[str, Field(default="", max_length=2048)]


@router.post("/learning/feedback", status_code=201)
async def submit_learning_feedback(
    request: Request, body: LearningFeedbackRequest,
) -> dict:
    """Submit learning feedback closing the learning loop.

    A rating <= 2 flags the scenario for retraining (needs_retrain=True).
    A rating >= 4 marks the scenario as stable (needs_retrain=False).

    NOTE: 当前使用 in-memory store。真实跨服务聚合需对接 mate-app-kb / mate-tech-rag / mate-tech-agent(TD-6)。
    """
    tid = _tenant_id(request)
    emp = get_employee(tid, body.employee_id)
    if emp is None:
        raise HTTPException(status_code=404, detail="employee not found")
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    feedback = DwLearningFeedback(
        id=f"dw-learn-fb-{uuid.uuid4().hex[:8]}",
        tenant_id=tid, employee_id=body.employee_id,
        scenario=body.scenario, rating=body.rating,
        comment=body.comment, feedback_at=now,
    )
    append_learning_feedback(tid, feedback)
    needs_retrain = body.rating <= 2
    _emit(
        request, "dw.feedback.submitted", feedback.id,
        {"employee_id": body.employee_id, "scenario": body.scenario,
         "rating": body.rating, "needs_retrain": needs_retrain},
        tid,
    )
    return {**asdict(feedback), "needs_retrain": needs_retrain}


# ---------------------------------------------------------------------------
# BUSINESS-SLICES deep: Collaboration session management
# ---------------------------------------------------------------------------
class CollaborationCreateRequest(BaseModel):
    """Body schema for POST /collaborations."""
    employee_id: Annotated[str, Field(min_length=1, max_length=256)]
    peer_employee_id: Annotated[str, Field(min_length=1, max_length=256)]
    duration_ms: Annotated[int, Field(ge=0)]


@router.post("/collaborations", status_code=201)
async def start_collaboration(
    request: Request, body: CollaborationCreateRequest,
) -> dict:
    """Start a peer collaboration session.

    Both employees must exist and at least one must be active.
    Self-collaboration (same employee_id) is rejected.

    NOTE: 当前使用 in-memory store。真实跨服务聚合需对接 mate-app-kb / mate-tech-rag / mate-tech-agent(TD-6)。
    """
    tid = _tenant_id(request)
    if body.employee_id == body.peer_employee_id:
        raise HTTPException(
            status_code=422, detail="self-collaboration is not allowed",
        )
    emp1 = get_employee(tid, body.employee_id)
    emp2 = get_employee(tid, body.peer_employee_id)
    if emp1 is None:
        raise HTTPException(status_code=404, detail="employee not found")
    if emp2 is None:
        raise HTTPException(status_code=404, detail="peer employee not found")
    if emp1.status == "offline" and emp2.status == "offline":
        raise HTTPException(
            status_code=409,
            detail="both employees are offline; cannot collaborate",
        )
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    session_id = f"sess-{uuid.uuid4().hex[:8]}"
    collab = DwCollaboration(
        id=f"dw-collab-{uuid.uuid4().hex[:8]}",
        tenant_id=tid, employee_id=body.employee_id,
        peer_employee_id=body.peer_employee_id,
        session_id=session_id, started_at=now,
        duration_ms=body.duration_ms,
    )
    append_collaboration(tid, collab)
    _emit(
        request, "dw.collaboration.started", collab.id,
        {"session_id": session_id, "employee_id": body.employee_id,
         "peer_employee_id": body.peer_employee_id},
        tid,
    )
    return asdict(collab)


# ---------------------------------------------------------------------------
# Employee CRUD + lifecycle endpoints (frontend ApiResponse schema)
# ---------------------------------------------------------------------------
def _serialize_task(task) -> dict:
    """Serialize DwEmployeeTask to frontend format (camelCase, with createdAt)."""
    raw = asdict(task)
    # Frontend expects createdAt / completedAt; backend uses started_at / finished_at.
    raw["createdAt"] = raw.pop("started_at", None)
    raw["completedAt"] = raw.pop("finished_at", None)
    raw.pop("duration_ms", None)
    return raw


def _serialize_employee(emp) -> dict:
    """Transform DwEmployee to frontend Employee format."""
    # Map backend status to frontend status
    status_map = {"active": "ACTIVE", "idle": "ACTIVE", "offline": "INACTIVE"}
    # Map backend role to frontend roleCategory
    role_map = {
        "CS_AGENT": "CUSTOMER_SERVICE", "SALES": "CUSTOM",
        "ANALYST": "DATA_ANALYST", "OPS": "CUSTOM",
    }
    import time as _t
    return {
        "employeeId": emp.id,
        "name": emp.name,
        "code": emp.code,
        "roleCategory": role_map.get(emp.role, "CUSTOM"),
        "roleIdentity": emp.role,
        "description": f"{emp.name} - {emp.role}",
        "status": status_map.get(emp.status, "DRAFT"),
        "capability": {
            "model": emp.model_id,
            "temperature": 0.7,
            "maxTokens": 4096,
            "topP": 0.9,
            "systemPrompt": "",
            "tools": [],
            "ragKnowledgeBaseIds": list(emp.kb_ids),
            "retrievalMethod": "hybrid",
            "topK": 5,
            "rerank": True,
        },
        "createdAt": "2026-07-01T00:00:00Z",
        "updatedAt": _t.strftime("%Y-%m-%dT%H:%M:%SZ", _t.gmtime()),
    }


_ROLE_CODE_PREFIX: dict[str, str] = {
    "FINANCE": "FIN",
    "HR": "HR",
    "LEGAL": "LEG",
    "DATA_ANALYST": "DA",
    "CUSTOMER_SERVICE": "CS",
    "CUSTOM": "X",
}


def _gen_employee_code(role_category: str) -> str:
    """Auto-generate a unique employee code: EMP-{ROLE}-{NNNN}.

    NNNN is 4 hex chars from uuid4 (uppercased). Example: EMP-FIN-A1B2.
    Collisions are astronomically unlikely in stub stage; real store should
    enforce a UNIQUE constraint on (tenant_id, code).
    """
    prefix = _ROLE_CODE_PREFIX.get(role_category, "X")
    return f"EMP-{prefix}-{uuid.uuid4().hex[:4].upper()}"


def _get_employee_by_id_or_code(tenant_id: str, key: str):
    """Resolve employee by id first, then by code. Returns DwEmployee | None.

    Stub-stage fallback: list_employees + filter. Real store should use a
    dedicated get_employee_by_code query.
    """
    emp = get_employee(tenant_id, key)
    if emp is not None:
        return emp
    for e in list_employees(tenant_id):
        if e.code == key:
            return e
    return None


@router.get("/employees/{employee_id}")
async def dw_get_employee(request: Request, employee_id: str) -> dict:
    tenant_id = _tenant_id(request)
    emp = _get_employee_by_id_or_code(tenant_id, employee_id)
    if emp is None:
        raise HTTPException(status_code=404, detail="employee not found")
    return _ok(_serialize_employee(emp))


class EmployeeCreateBody(BaseModel):
    name: str
    code: str | None = None  # 可选；未传时后端按角色自动生成 EMP-{ROLE}-{NNNN}
    roleCategory: str = "CUSTOM"
    roleIdentity: str = ""
    description: str = ""
    capability: dict | None = None


@router.post("/employees", status_code=201)
async def dw_create_employee(request: Request, body: EmployeeCreateBody) -> dict:
    tid = _tenant_id(request)
    emp_id = f"dw-emp-{uuid.uuid4().hex[:8]}"
    code = body.code or _gen_employee_code(body.roleCategory)
    model_id = "model-openai"
    if body.capability and "model" in body.capability:
        model_id = body.capability["model"]
    kb_ids = ()
    if body.capability and "ragKnowledgeBaseIds" in body.capability:
        kb_ids = tuple(body.capability["ragKnowledgeBaseIds"])
    emp = DwEmployee(
        id=emp_id, tenant_id=tid, name=body.name, code=code,
        role=body.roleIdentity or "CUSTOM", status="active",
        model_id=model_id, kb_ids=kb_ids,
    )
    create_employee(tid, emp)
    _emit(request, "dw.employee.created", emp_id, {"name": body.name, "code": code}, tid)
    return _ok(_serialize_employee(emp))


@router.put("/employees/{employee_id}")
async def dw_update_employee(request: Request, employee_id: str, body: EmployeeCreateBody) -> dict:
    tid = _tenant_id(request)
    emp = _get_employee_by_id_or_code(tid, employee_id)
    if emp is None:
        raise HTTPException(status_code=404, detail="employee not found")
    updates = {}
    if body.name:
        updates["name"] = body.name
    # code 不可变：自动生成后不允许通过 PUT 修改
    if body.roleIdentity:
        updates["role"] = body.roleIdentity
    if body.capability and "model" in body.capability:
        updates["model_id"] = body.capability["model"]
    if body.capability and "ragKnowledgeBaseIds" in body.capability:
        updates["kb_ids"] = tuple(body.capability["ragKnowledgeBaseIds"])
    updated = update_employee(tid, emp.id, **updates)
    return _ok(_serialize_employee(updated))


@router.delete("/employees/{employee_id}")
async def dw_delete_employee(request: Request, employee_id: str) -> dict:
    tid = _tenant_id(request)
    emp = _get_employee_by_id_or_code(tid, employee_id)
    if emp is None:
        raise HTTPException(status_code=404, detail="employee not found")
    ok = delete_employee(tid, emp.id)
    if not ok:
        raise HTTPException(status_code=404, detail="employee not found")
    _emit(request, "dw.employee.deleted", emp.id, {}, tid)
    return _ok({"deleted": True})


class EmployeeStatusBody(BaseModel):
    status: str  # ACTIVE / INACTIVE


@router.put("/employees/{employee_id}/status")
async def dw_set_employee_status(request: Request, employee_id: str, body: EmployeeStatusBody) -> dict:
    tid = _tenant_id(request)
    emp = _get_employee_by_id_or_code(tid, employee_id)
    if emp is None:
        raise HTTPException(status_code=404, detail="employee not found")
    # Map frontend status to backend status
    backend_status = "active" if body.status == "ACTIVE" else "offline"
    updated = update_employee(tid, employee_id, status=backend_status)
    return _ok(_serialize_employee(updated))


@router.post("/employees/{employee_id}/clone", status_code=201)
async def dw_clone_employee(request: Request, employee_id: str, body: dict) -> dict:
    tid = _tenant_id(request)
    emp = _get_employee_by_id_or_code(tid, employee_id)
    if emp is None:
        raise HTTPException(status_code=404, detail="employee not found")
    new_id = f"dw-emp-{uuid.uuid4().hex[:8]}"
    cloned = DwEmployee(
        id=new_id, tenant_id=tid,
        name=body.get("name", f"{emp.name} (副本)"),
        code=_gen_employee_code("CUSTOM"),  # 克隆时自动生成新 code
        role=emp.role, status="idle",
        model_id=emp.model_id, kb_ids=emp.kb_ids,
    )
    create_employee(tid, cloned)
    return _ok(_serialize_employee(cloned))


@router.get("/employees/{employee_id}/versions")
async def dw_get_employee_versions(request: Request, employee_id: str) -> dict:
    tid = _tenant_id(request)
    emp = _get_employee_by_id_or_code(tid, employee_id)
    if emp is None:
        raise HTTPException(status_code=404, detail="employee not found")
    versions = [
        {"version": "1.0.0", "timestamp": "2026-07-01T00:00:00Z", "changeLog": "初始版本"},
        {"version": "1.1.0", "timestamp": "2026-07-15T00:00:00Z", "changeLog": "优化提示词"},
    ]
    return _ok({"items": versions, "total": len(versions), "page": 1, "pageSize": 20, "totalPages": 1})


@router.get("/employees/{employee_id}/logs")
async def dw_get_employee_logs(request: Request, employee_id: str) -> dict:
    tid = _tenant_id(request)
    emp = _get_employee_by_id_or_code(tid, employee_id)
    if emp is None:
        raise HTTPException(status_code=404, detail="employee not found")
    logs = [
        {"id": f"log-{uuid.uuid4().hex[:8]}", "actor": "admin", "action": "update",
         "resource": employee_id, "timestamp": "2026-07-30T10:00:00Z", "status": "success"},
        {"id": f"log-{uuid.uuid4().hex[:8]}", "actor": "admin", "action": "create",
         "resource": employee_id, "timestamp": "2026-07-01T00:00:00Z", "status": "success"},
    ]
    return _ok({"items": logs, "total": len(logs), "page": 1, "pageSize": 20, "totalPages": 1})


# ---------------------------------------------------------------------------
# 16. /v1/dw/documents/{id} — DELETE single document
# ---------------------------------------------------------------------------
@router.delete("/documents/{doc_id}")
async def dw_delete_document(doc_id: str) -> dict:
    return _ok({"deleted": True, "id": doc_id})


# ---------------------------------------------------------------------------
# 17. POST /v1/dw/extract — AI extraction trigger
# ---------------------------------------------------------------------------
class ExtractBody(BaseModel):
    documentId: str | None = None
    employeeId: str | None = None

@router.post("/extract")
async def dw_post_extract(body: ExtractBody) -> dict:
    """Trigger AI extraction. Returns ExtractionResult with items array."""
    items = [
        {"id": f"ext-{uuid.uuid4().hex[:8]}", "documentId": body.documentId or "doc-1",
         "employeeId": body.employeeId or "dw-emp-1", "type": "concept",
         "name": "客户满意度", "description": "衡量客户对服务的满意程度",
         "confidence": 92, "status": "pending", "extractedAt": "2026-07-30T12:00:00Z"},
        {"id": f"ext-{uuid.uuid4().hex[:8]}", "documentId": body.documentId or "doc-1",
         "employeeId": body.employeeId or "dw-emp-1", "type": "entity",
         "name": "VIP客户", "description": "高价值客户分类",
         "confidence": 88, "status": "pending", "extractedAt": "2026-07-30T12:00:00Z"},
        {"id": f"ext-{uuid.uuid4().hex[:8]}", "documentId": body.documentId or "doc-1",
         "employeeId": body.employeeId or "dw-emp-1", "type": "rule",
         "name": "退款规则", "description": "7 天内全额退款",
         "confidence": 95, "status": "pending", "extractedAt": "2026-07-30T12:00:00Z"},
    ]
    return _ok({
        "documentId": body.documentId or "doc-1",
        "items": items,
        "totalConcepts": sum(1 for i in items if i["type"] == "concept"),
        "totalEntities": sum(1 for i in items if i["type"] == "entity"),
        "totalRules": sum(1 for i in items if i["type"] == "rule"),
        "totalActions": sum(1 for i in items if i["type"] == "action"),
    })


@router.get("/extract/{document_id}")
async def dw_get_extract_results(document_id: str) -> dict:
    return _ok({
        "documentId": document_id,
        "items": [],
        "totalConcepts": 0, "totalEntities": 0, "totalRules": 0, "totalActions": 0,
    })


# ---------------------------------------------------------------------------
# 18. PUT /v1/dw/extract/items/{id} — review extraction item
# ---------------------------------------------------------------------------
class ExtractionReviewBody(BaseModel):
    status: str  # approved / rejected

@router.put("/extract/items/{item_id}")
async def dw_review_extraction_item(item_id: str, body: ExtractionReviewBody) -> dict:
    return _ok({
        "id": item_id,
        "status": body.status,
        "reviewedAt": "2026-07-30T12:00:00Z",
    })


# ---------------------------------------------------------------------------
# 19. POST /v1/dw/commit — commit approved items to Ontology
# ---------------------------------------------------------------------------
class CommitBody(BaseModel):
    itemIds: list[str]

@router.post("/commit")
async def dw_commit_to_ontology(body: CommitBody) -> dict:
    results = [
        {"id": iid, "commitResult": {"success": True, "message": "已写入本体引擎", "ontId": f"ont-{uuid.uuid4().hex[:8]}"}}
        for iid in body.itemIds
    ]
    return _ok(results)


# ---------------------------------------------------------------------------
# 20. Learning knowledge + stats + sync endpoints (per employee)
# ---------------------------------------------------------------------------
@router.get("/learning/employees/{employee_id}/knowledge")
async def dw_get_employee_knowledge(employee_id: str, syncedOnly: bool = False) -> dict:
    knowledge = [
        {"knowledgeId": f"kn-{i}", "employeeId": employee_id,
         "knowledgeType": "prompt_fragment", "title": f"知识片段 {i}",
         "content": f"这是从反馈中提炼的知识 {i}", "sourceFeedbackIds": ["fb-1"],
         "taskPattern": "客服对话", "tags": ["高频问题", "退款"], "confidence": 0.9,
         "syncedToKb": i % 2 == 0, "kbDocumentId": f"kb-doc-{i}" if i % 2 == 0 else None,
         "createdAt": "2026-07-30T12:00:00Z", "updatedAt": "2026-07-30T12:00:00Z"}
        for i in range(1, 4)
    ]
    if syncedOnly:
        knowledge = [k for k in knowledge if k["syncedToKb"]]
    return _ok({"items": knowledge, "total": len(knowledge), "page": 1, "pageSize": 20, "totalPages": 1})


@router.get("/learning/employees/{employee_id}/stats")
async def dw_get_employee_learning_stats(employee_id: str) -> dict:
    return _ok({
        "employeeId": employee_id,
        "totalFeedback": 10,
        "thumbUp": 7,
        "thumbDown": 2,
        "suggestions": 1,
        "knowledgeFragments": 3,
        "syncedFragments": 2,
        "successRate": 0.85,
        "topTags": ["高频问题", "退款", "服务态度"],
    })


@router.post("/learning/employees/{employee_id}/sync-to-kb")
async def dw_sync_employee_knowledge(employee_id: str) -> dict:
    return _ok({
        "employeeId": employee_id,
        "syncedCount": 2,
        "documentIds": ["kb-doc-1", "kb-doc-2"],
    })


@router.post("/learning/extract")
async def dw_post_extract_knowledge(body: dict) -> dict:
    employee_id = body.get("employee_id", "dw-emp-1")
    knowledge = [
        {"knowledgeId": "kn-new-1", "employeeId": employee_id,
         "knowledgeType": "tool_rule", "title": "新增知识片段",
         "content": "从反馈中提炼的新规则", "sourceFeedbackIds": ["fb-1"],
         "taskPattern": "客服对话", "tags": ["新发现"], "confidence": 0.88,
         "syncedToKb": False, "createdAt": "2026-07-30T12:30:00Z", "updatedAt": "2026-07-30T12:30:00Z"}
    ]
    return _ok({"knowledge": knowledge})
