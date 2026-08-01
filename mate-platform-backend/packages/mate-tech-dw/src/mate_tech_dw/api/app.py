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
    DwEmployeeTask,
    DwEvaluation,
    DwLearningFeedback,
    append_collaboration,
    append_document,
    append_employee_task,
    append_evaluation,
    append_learning_feedback,
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
    """Apply pagination to a list of items."""
    total = len(items)
    pages = (total + size - 1) // size if size > 0 else 0
    start = (page - 1) * size
    end = start + size
    return {
        "items": items[start:end],
        "total": total,
        "page": page,
        "size": size,
        "pages": pages,
    }


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
    tenant_id = _tenant_id(request)
    items = _serialize(list_employees(tenant_id))
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
    tenant_id = _tenant_id(request)
    items = _serialize(list_employee_tasks(tenant_id))
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
    tenant_id = _tenant_id(request)
    items = _serialize(list_evaluations(tenant_id))
    return _paginate(items, page, size)


# ---------------------------------------------------------------------------
# 9. GET /extract
# ---------------------------------------------------------------------------
@router.get("/extract")
async def dw_get_extract(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
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
    """
    tid = _tenant_id(request)
    emp = get_employee(tid, employee_id)
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
    return asdict(task)


@router.patch("/employees/{employee_id}/tasks/{task_id}/status")
async def transition_task_status(
    request: Request, employee_id: str, task_id: str, body: TaskStatusRequest,
) -> dict:
    """Transition a task's lifecycle status.

    State machine: pending -> running -> success | failed.
    A failed task can be retried (failed -> running).
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
    """
    tid = _tenant_id(request)
    emp = get_employee(tid, employee_id)
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
