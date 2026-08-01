"""FastAPI router exposing the DAG scheduling control plane (FR-DATA-SCHEDULER-001..008).

Every handler enforces ADR-0014 step 2 (`require_tenant(ctx)`)
before touching the repository. The repository itself does not
double-check the tenant — the guard is the source of truth.

8 endpoints under `/api/v1/scheduler/*`:

  GET    /api/v1/scheduler/tasks             — list (paginated)
  POST   /api/v1/scheduler/tasks             — create
  GET    /api/v1/scheduler/tasks/{id}        — detail
  PUT    /api/v1/scheduler/tasks/{id}        — update
  DELETE /api/v1/scheduler/tasks/{id}        — delete
  POST   /api/v1/scheduler/tasks/{id}/pause  — pause
  POST   /api/v1/scheduler/tasks/{id}/trigger — manual trigger
  GET    /api/v1/scheduler/dag               — DAG graph

Write handlers emit `scheduler.<aggregate>.<verb>` outbox events via
`app.state.outbox_writer` (ADR-0014 step 3).
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from mate_platform.messaging.events import Event
from mate_platform.messaging.outbox import InMemoryOutboxWriter
from mate_platform.tenancy.context import TenantId
from mate_platform.tenancy.guards import require_tenant

from ..repositories import (
    create_scheduler_task,
    delete_scheduler_task,
    get_dag,
    get_scheduler_task,
    list_scheduler_tasks,
    pause_scheduler_task,
    task_to_dict,
    trigger_scheduler_task,
    update_scheduler_task,
)

router = APIRouter(prefix="/api/v1/scheduler", tags=["scheduler"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _tid(request: Request) -> str:
    """Return the verified tenant_id for the current request."""
    ctx = request.state.ctx
    return str(require_tenant(ctx))


def _emit(
    request: Request,
    event_type: str,
    aggregate_id: str,
    payload: dict[str, Any],
    tenant_id: str,
) -> None:
    """Append an outbox event if a writer is configured (no-op otherwise)."""
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


def _paginate(items: list[Any], page: int, size: int) -> dict[str, Any]:
    """Apply cursor-free pagination to a list of serialized dicts."""
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


# ---------------------------------------------------------------------------
# Body schemas
# ---------------------------------------------------------------------------
class SchedulerTaskCreate(BaseModel):
    """Body for POST /tasks."""

    name: str
    cron_expression: str
    config: dict[str, Any] | None = None


class SchedulerTaskUpdate(BaseModel):
    """Body for PUT /tasks/{id}. All fields optional (patch semantics)."""

    name: str | None = None
    cron_expression: str | None = None
    config: dict[str, Any] | None = None


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@router.get("/health")
async def health() -> dict[str, str]:
    """Anonymous liveness probe (no bearer token required)."""
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# 1. GET /tasks — list (paginated)
# ---------------------------------------------------------------------------
@router.get("/tasks")
async def list_scheduler_tasks_endpoint(
    request: Request,
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    """List scheduler tasks (FR-DATA-DATAGETSCHEDULERTASKS). Paginated, optional status filter."""
    tid = _tid(request)
    tasks = list_scheduler_tasks(tid, status=status)
    items = [task_to_dict(t) for t in tasks]
    return _paginate(items, page, size)


# ---------------------------------------------------------------------------
# 2. POST /tasks — create
# ---------------------------------------------------------------------------
@router.post("/tasks")
async def create_scheduler_task_endpoint(
    request: Request, body: SchedulerTaskCreate,
) -> dict[str, Any]:
    """Create a scheduler task (FR-DATA-DATAPOSTSCHEDULERTASKS)."""
    tid = _tid(request)
    task = create_scheduler_task(
        tid,
        name=body.name,
        cron_expression=body.cron_expression,
        config=body.config,
    )
    _emit(
        request,
        "scheduler.task.created",
        task.id,
        {"task_id": task.id, "name": task.name, "cron_expression": task.cron_expression},
        tid,
    )
    return task_to_dict(task)


# ---------------------------------------------------------------------------
# 3. GET /tasks/{id} — detail
# ---------------------------------------------------------------------------
@router.get("/tasks/{task_id}")
async def get_scheduler_task_endpoint(
    request: Request, task_id: str,
) -> dict[str, Any]:
    """Get a scheduler task by id (FR-DATA-DATAGETSCHEDULERTASKSID)."""
    tid = _tid(request)
    task = get_scheduler_task(tid, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="scheduler task not found")
    return task_to_dict(task)


# ---------------------------------------------------------------------------
# 4. PUT /tasks/{id} — update
# ---------------------------------------------------------------------------
@router.put("/tasks/{task_id}")
async def update_scheduler_task_endpoint(
    request: Request, task_id: str, body: SchedulerTaskUpdate,
) -> dict[str, Any]:
    """Update a scheduler task (FR-DATA-DATAPUTSCHEDULERTASKSID)."""
    tid = _tid(request)
    task = update_scheduler_task(
        tid,
        task_id,
        name=body.name,
        cron_expression=body.cron_expression,
        config=body.config,
    )
    if task is None:
        raise HTTPException(status_code=404, detail="scheduler task not found")
    _emit(
        request,
        "scheduler.task.updated",
        task.id,
        {"task_id": task.id, "name": task.name},
        tid,
    )
    return task_to_dict(task)


# ---------------------------------------------------------------------------
# 5. DELETE /tasks/{id} — delete
# ---------------------------------------------------------------------------
@router.delete("/tasks/{task_id}")
async def delete_scheduler_task_endpoint(
    request: Request, task_id: str,
) -> dict[str, Any]:
    """Delete a scheduler task (FR-DATA-DATADELETESCHEDULERTASKSID)."""
    tid = _tid(request)
    if not delete_scheduler_task(tid, task_id):
        raise HTTPException(status_code=404, detail="scheduler task not found")
    _emit(
        request,
        "scheduler.task.deleted",
        task_id,
        {"task_id": task_id},
        tid,
    )
    return {"id": task_id, "deleted": True}


# ---------------------------------------------------------------------------
# 6. POST /tasks/{id}/pause — pause
# ---------------------------------------------------------------------------
@router.post("/tasks/{task_id}/pause")
async def pause_scheduler_task_endpoint(
    request: Request, task_id: str,
) -> dict[str, Any]:
    """Pause a scheduler task (FR-DATA-DATAPOSTSCHEDULERTASKSIDPAUSE)."""
    tid = _tid(request)
    task = pause_scheduler_task(tid, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="scheduler task not found")
    _emit(
        request,
        "scheduler.task.paused",
        task.id,
        {"task_id": task.id, "status": task.status},
        tid,
    )
    return task_to_dict(task)


# ---------------------------------------------------------------------------
# 7. POST /tasks/{id}/trigger — manual trigger
# ---------------------------------------------------------------------------
@router.post("/tasks/{task_id}/trigger")
async def trigger_scheduler_task_endpoint(
    request: Request, task_id: str,
) -> dict[str, Any]:
    """Trigger a scheduler task (FR-DATA-DATAPOSTSCHEDULERTASKSIDTRIGGER)."""
    tid = _tid(request)
    task = trigger_scheduler_task(tid, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="scheduler task not found")
    _emit(
        request,
        "scheduler.task.triggered",
        task.id,
        {"task_id": task.id, "status": task.status, "last_run_at": task.last_run_at},
        tid,
    )
    return task_to_dict(task)


# ---------------------------------------------------------------------------
# 8. GET /dag — DAG graph
# ---------------------------------------------------------------------------
@router.get("/dag")
async def get_dag_endpoint(request: Request) -> list[dict[str, Any]]:
    """Get the DAG graph (FR-DATA-DATAGETSCHEDULERDAG)."""
    tid = _tid(request)
    dag_nodes = get_dag(tid)
    return [
        {
            "task_id": node.task_id,
            "name": node.name,
            "upstream": list(node.upstream),
            "downstream": list(node.downstream),
        }
        for node in dag_nodes
    ]
