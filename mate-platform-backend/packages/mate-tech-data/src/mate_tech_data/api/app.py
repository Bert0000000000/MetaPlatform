"""FastAPI router exposing the data platform control plane (FR-DATA-001..015).

Every handler enforces ADR-0014 step 2 (`require_tenant(ctx)`)
before touching the repository. The repository itself does not
double-check the tenant — the guard is the source of truth.

15 endpoints under `/api/v1/data/*`:

  CDC tasks (8):
    GET    /api/v1/data/cdc-tasks                — list (paginated)
    POST   /api/v1/data/cdc-tasks                — create
    GET    /api/v1/data/cdc-tasks/{id}           — detail
    PUT    /api/v1/data/cdc-tasks/{id}           — update
    DELETE /api/v1/data/cdc-tasks/{id}           — delete
    POST   /api/v1/data/cdc-tasks/{id}/pause     — pause
    POST   /api/v1/data/cdc-tasks/{id}/resume    — resume
    GET    /api/v1/data/cdc-tasks/{id}/status    — status

  Data sources (7):
    GET    /api/v1/data/sources                  — list (paginated)
    POST   /api/v1/data/sources                  — create
    GET    /api/v1/data/sources/{id}             — detail
    PUT    /api/v1/data/sources/{id}             — update
    DELETE /api/v1/data/sources/{id}             — delete
    GET    /api/v1/data/sources/{id}/schema      — discover schema
    POST   /api/v1/data/sources/{id}/test        — test connection

Write handlers emit `data.<aggregate>.<verb>` outbox events via
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
    create_cdc_task,
    create_source,
    delete_cdc_task,
    delete_source,
    get_cdc_task,
    get_source,
    get_source_schema,
    list_cdc_tasks,
    list_sources,
    set_cdc_task_status,
    source_to_dict,
    task_to_dict,
    test_source_connection,
    update_cdc_task,
    update_source,
)

router = APIRouter(prefix="/api/v1/data", tags=["data"])


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
class CdcTaskCreate(BaseModel):
    """Body for POST /cdc-tasks."""

    name: str
    source_id: str
    target_table: str
    config: dict[str, Any] | None = None


class CdcTaskUpdate(BaseModel):
    """Body for PUT /cdc-tasks/{id}. All fields optional (patch semantics)."""

    name: str | None = None
    source_id: str | None = None
    target_table: str | None = None
    config: dict[str, Any] | None = None


class SourceCreate(BaseModel):
    """Body for POST /sources."""

    name: str
    type: str
    connection_config: dict[str, Any] | None = None


class SourceUpdate(BaseModel):
    """Body for PUT /sources/{id}. All fields optional (patch semantics)."""

    name: str | None = None
    type: str | None = None
    connection_config: dict[str, Any] | None = None


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@router.get("/health")
async def health() -> dict[str, str]:
    """Anonymous liveness probe (no bearer token required)."""
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# CDC tasks (8 endpoints)
# ---------------------------------------------------------------------------
@router.get("/cdc-tasks")
async def list_cdc_tasks_endpoint(
    request: Request,
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    """List CDC tasks (FR-DATA-DATAGETDATACDCTASKS). Paginated, optional status filter."""
    tid = _tid(request)
    tasks = list_cdc_tasks(tid, status=status)
    items = [task_to_dict(t) for t in tasks]
    return _paginate(items, page, size)


@router.post("/cdc-tasks")
async def create_cdc_task_endpoint(
    request: Request, body: CdcTaskCreate,
) -> dict[str, Any]:
    """Create a CDC task (FR-DATA-DATAPOSTDATACDCTASKS)."""
    tid = _tid(request)
    task = create_cdc_task(
        tid,
        name=body.name,
        source_id=body.source_id,
        target_table=body.target_table,
        config=body.config,
    )
    _emit(
        request,
        "data.cdc_task.created",
        task.id,
        {"task_id": task.id, "name": task.name, "source_id": task.source_id},
        tid,
    )
    return task_to_dict(task)


@router.get("/cdc-tasks/{task_id}")
async def get_cdc_task_endpoint(
    request: Request, task_id: str,
) -> dict[str, Any]:
    """Get a CDC task by id (FR-DATA-DATAGETDATACDCTASKSID)."""
    tid = _tid(request)
    task = get_cdc_task(tid, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="cdc task not found")
    return task_to_dict(task)


@router.put("/cdc-tasks/{task_id}")
async def update_cdc_task_endpoint(
    request: Request, task_id: str, body: CdcTaskUpdate,
) -> dict[str, Any]:
    """Update a CDC task (FR-DATA-DATAPUTDATACDCTASKSID)."""
    tid = _tid(request)
    task = update_cdc_task(
        tid,
        task_id,
        name=body.name,
        source_id=body.source_id,
        target_table=body.target_table,
        config=body.config,
    )
    if task is None:
        raise HTTPException(status_code=404, detail="cdc task not found")
    _emit(
        request,
        "data.cdc_task.updated",
        task.id,
        {"task_id": task.id, "name": task.name, "status": task.status},
        tid,
    )
    return task_to_dict(task)


@router.delete("/cdc-tasks/{task_id}")
async def delete_cdc_task_endpoint(
    request: Request, task_id: str,
) -> dict[str, Any]:
    """Delete a CDC task (FR-DATA-DATADELETEDATACDCTASKSID)."""
    tid = _tid(request)
    removed = delete_cdc_task(tid, task_id)
    if not removed:
        raise HTTPException(status_code=404, detail="cdc task not found")
    _emit(
        request,
        "data.cdc_task.deleted",
        task_id,
        {"task_id": task_id},
        tid,
    )
    return {"deleted": True, "id": task_id}


@router.post("/cdc-tasks/{task_id}/pause")
async def pause_cdc_task_endpoint(
    request: Request, task_id: str,
) -> dict[str, Any]:
    """Pause a CDC task (FR-DATA-DATAPOSTDATACDCTASKSIDPAUSE)."""
    tid = _tid(request)
    task = set_cdc_task_status(tid, task_id, "paused")
    if task is None:
        raise HTTPException(status_code=404, detail="cdc task not found")
    _emit(
        request,
        "data.cdc_task.paused",
        task.id,
        {"task_id": task.id, "status": task.status},
        tid,
    )
    return {"id": task.id, "status": task.status}


@router.post("/cdc-tasks/{task_id}/resume")
async def resume_cdc_task_endpoint(
    request: Request, task_id: str,
) -> dict[str, Any]:
    """Resume a CDC task (FR-DATA-DATAPOSTDATACDCTASKSIDRESUME)."""
    tid = _tid(request)
    task = set_cdc_task_status(tid, task_id, "running")
    if task is None:
        raise HTTPException(status_code=404, detail="cdc task not found")
    _emit(
        request,
        "data.cdc_task.resumed",
        task.id,
        {"task_id": task.id, "status": task.status},
        tid,
    )
    return {"id": task.id, "status": task.status}


@router.get("/cdc-tasks/{task_id}/status")
async def cdc_task_status_endpoint(
    request: Request, task_id: str,
) -> dict[str, Any]:
    """Get CDC task status (FR-DATA-DATAGETDATACDCTASKSIDSTATUS)."""
    tid = _tid(request)
    task = get_cdc_task(tid, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="cdc task not found")
    return {"id": task.id, "status": task.status}


# ---------------------------------------------------------------------------
# Data sources (7 endpoints)
# ---------------------------------------------------------------------------
@router.get("/sources")
async def list_sources_endpoint(
    request: Request,
    type: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    """List data sources (FR-DATA-DATAGETDATASOURCES). Paginated, optional type filter."""
    tid = _tid(request)
    sources = list_sources(tid, type_filter=type)
    items = [source_to_dict(s) for s in sources]
    return _paginate(items, page, size)


@router.post("/sources")
async def create_source_endpoint(
    request: Request, body: SourceCreate,
) -> dict[str, Any]:
    """Create a data source (FR-DATA-DATAPOSTDATASOURCES)."""
    tid = _tid(request)
    source = create_source(
        tid,
        name=body.name,
        type=body.type,
        connection_config=body.connection_config,
    )
    _emit(
        request,
        "data.source.created",
        source.id,
        {"source_id": source.id, "name": source.name, "type": source.type},
        tid,
    )
    return source_to_dict(source)


@router.get("/sources/{source_id}")
async def get_source_endpoint(
    request: Request, source_id: str,
) -> dict[str, Any]:
    """Get a data source by id (FR-DATA-DATAGETDATASOURCESID)."""
    tid = _tid(request)
    source = get_source(tid, source_id)
    if source is None:
        raise HTTPException(status_code=404, detail="data source not found")
    return source_to_dict(source)


@router.put("/sources/{source_id}")
async def update_source_endpoint(
    request: Request, source_id: str, body: SourceUpdate,
) -> dict[str, Any]:
    """Update a data source (FR-DATA-DATAPUTDATASOURCESID)."""
    tid = _tid(request)
    source = update_source(
        tid,
        source_id,
        name=body.name,
        type=body.type,
        connection_config=body.connection_config,
    )
    if source is None:
        raise HTTPException(status_code=404, detail="data source not found")
    _emit(
        request,
        "data.source.updated",
        source.id,
        {"source_id": source.id, "name": source.name, "type": source.type},
        tid,
    )
    return source_to_dict(source)


@router.delete("/sources/{source_id}")
async def delete_source_endpoint(
    request: Request, source_id: str,
) -> dict[str, Any]:
    """Delete a data source (FR-DATA-DATADELETEDATASOURCESID)."""
    tid = _tid(request)
    removed = delete_source(tid, source_id)
    if not removed:
        raise HTTPException(status_code=404, detail="data source not found")
    _emit(
        request,
        "data.source.deleted",
        source_id,
        {"source_id": source_id},
        tid,
    )
    return {"deleted": True, "id": source_id}


@router.get("/sources/{source_id}/schema")
async def source_schema_endpoint(
    request: Request, source_id: str,
) -> dict[str, Any]:
    """Discover schema for a data source (FR-DATA-DATAGETDATASOURCESIDSCHEMA)."""
    tid = _tid(request)
    schema = get_source_schema(tid, source_id)
    if schema is None:
        raise HTTPException(status_code=404, detail="data source not found")
    return schema


@router.post("/sources/{source_id}/test")
async def test_source_endpoint(
    request: Request, source_id: str,
) -> dict[str, Any]:
    """Test a data source connection (FR-DATA-DATAPOSTDATASOURCESIDTEST)."""
    tid = _tid(request)
    result = test_source_connection(tid, source_id)
    if result is None:
        raise HTTPException(status_code=404, detail="data source not found")
    _emit(
        request,
        "data.source.tested",
        source_id,
        {"source_id": source_id, "ok": result["ok"]},
        tid,
    )
    return result
