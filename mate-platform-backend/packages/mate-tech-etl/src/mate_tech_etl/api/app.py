"""FastAPI router exposing the ETL task control plane (FR-DATA-ETL-001..008).

Every handler enforces ADR-0014 step 2 (`require_tenant(ctx)`)
before touching the repository. The repository itself does not
double-check the tenant — the guard is the source of truth.

8 endpoints under `/api/v1/etl/*`:

  GET    /api/v1/etl/tasks              — list (paginated)
  POST   /api/v1/etl/tasks              — create
  GET    /api/v1/etl/tasks/{id}         — detail
  PUT    /api/v1/etl/tasks/{id}         — update
  DELETE /api/v1/etl/tasks/{id}         — delete
  POST   /api/v1/etl/tasks/{id}/run     — run
  GET    /api/v1/etl/tasks/{id}/status  — status
  POST   /api/v1/etl/tasks/{id}/stop    — stop

Write handlers emit `etl.<aggregate>.<verb>` outbox events via
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
    create_etl_task,
    delete_etl_task,
    get_etl_task,
    list_etl_tasks,
    run_etl_task,
    stop_etl_task,
    task_to_dict,
    update_etl_task,
)

router = APIRouter(prefix="/api/v1/etl", tags=["etl"])


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
class EtlTaskCreate(BaseModel):
    """Body for POST /tasks."""

    name: str
    source_table: str
    target_table: str
    config: dict[str, Any] | None = None


class EtlTaskUpdate(BaseModel):
    """Body for PUT /tasks/{id}. All fields optional (patch semantics)."""

    name: str | None = None
    source_table: str | None = None
    target_table: str | None = None
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
async def list_etl_tasks_endpoint(
    request: Request,
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    """List ETL tasks (FR-DATA-DATAGETETLTASKS). Paginated, optional status filter."""
    tid = _tid(request)
    tasks = list_etl_tasks(tid, status=status)
    items = [task_to_dict(t) for t in tasks]
    return _paginate(items, page, size)


# ---------------------------------------------------------------------------
# 2. POST /tasks — create
# ---------------------------------------------------------------------------
@router.post("/tasks")
async def create_etl_task_endpoint(
    request: Request, body: EtlTaskCreate,
) -> dict[str, Any]:
    """Create an ETL task (FR-DATA-DATAPOSTETLTASKS)."""
    tid = _tid(request)
    task = create_etl_task(
        tid,
        name=body.name,
        source_table=body.source_table,
        target_table=body.target_table,
        config=body.config,
    )
    _emit(
        request,
        "etl.task.created",
        task.id,
        {"task_id": task.id, "name": task.name, "target_table": task.target_table},
        tid,
    )
    return task_to_dict(task)


# ---------------------------------------------------------------------------
# 3. GET /tasks/{id} — detail
# ---------------------------------------------------------------------------
@router.get("/tasks/{task_id}")
async def get_etl_task_endpoint(
    request: Request, task_id: str,
) -> dict[str, Any]:
    """Get an ETL task by id (FR-DATA-DATAGETETLTASKSID)."""
    tid = _tid(request)
    task = get_etl_task(tid, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="etl task not found")
    return task_to_dict(task)


# ---------------------------------------------------------------------------
# 4. PUT /tasks/{id} — update
# ---------------------------------------------------------------------------
@router.put("/tasks/{task_id}")
async def update_etl_task_endpoint(
    request: Request, task_id: str, body: EtlTaskUpdate,
) -> dict[str, Any]:
    """Update an ETL task (FR-DATA-DATAPUTETLTASKSID)."""
    tid = _tid(request)
    task = update_etl_task(
        tid,
        task_id,
        name=body.name,
        source_table=body.source_table,
        target_table=body.target_table,
        config=body.config,
    )
    if task is None:
        raise HTTPException(status_code=404, detail="etl task not found")
    _emit(
        request,
        "etl.task.updated",
        task.id,
        {"task_id": task.id, "name": task.name},
        tid,
    )
    return task_to_dict(task)


# ---------------------------------------------------------------------------
# 5. DELETE /tasks/{id} — delete
# ---------------------------------------------------------------------------
@router.delete("/tasks/{task_id}")
async def delete_etl_task_endpoint(
    request: Request, task_id: str,
) -> dict[str, Any]:
    """Delete an ETL task (FR-DATA-DATADELETEETLTASKSID)."""
    tid = _tid(request)
    if not delete_etl_task(tid, task_id):
        raise HTTPException(status_code=404, detail="etl task not found")
    _emit(
        request,
        "etl.task.deleted",
        task_id,
        {"task_id": task_id},
        tid,
    )
    return {"id": task_id, "deleted": True}


# ---------------------------------------------------------------------------
# 6. POST /tasks/{id}/run — run
# ---------------------------------------------------------------------------
@router.post("/tasks/{task_id}/run")
async def run_etl_task_endpoint(
    request: Request, task_id: str,
) -> dict[str, Any]:
    """Run an ETL task (FR-DATA-DATAPOSTETLTASKSIDRUN)."""
    tid = _tid(request)
    task = run_etl_task(tid, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="etl task not found")
    _emit(
        request,
        "etl.task.run",
        task.id,
        {"task_id": task.id, "status": task.status},
        tid,
    )
    return task_to_dict(task)


# ---------------------------------------------------------------------------
# 7. GET /tasks/{id}/status — status
# ---------------------------------------------------------------------------
@router.get("/tasks/{task_id}/status")
async def get_etl_task_status_endpoint(
    request: Request, task_id: str,
) -> dict[str, Any]:
    """Get the status of an ETL task (FR-DATA-DATAGETETLTASKSIDSTATUS)."""
    tid = _tid(request)
    task = get_etl_task(tid, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="etl task not found")
    return {
        "task_id": task.id,
        "status": task.status,
        "last_run_at": task.last_run_at,
        "updated_at": task.updated_at,
    }


# ---------------------------------------------------------------------------
# 8. POST /tasks/{id}/stop — stop
# ---------------------------------------------------------------------------
@router.post("/tasks/{task_id}/stop")
async def stop_etl_task_endpoint(
    request: Request, task_id: str,
) -> dict[str, Any]:
    """Stop an ETL task (FR-DATA-DATAPOSTETLTASKSIDSTOP)."""
    tid = _tid(request)
    task = stop_etl_task(tid, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="etl task not found")
    _emit(
        request,
        "etl.task.stopped",
        task.id,
        {"task_id": task.id, "status": task.status},
        tid,
    )
    return task_to_dict(task)
