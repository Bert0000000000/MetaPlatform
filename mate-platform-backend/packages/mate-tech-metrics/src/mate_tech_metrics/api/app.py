"""FastAPI router exposing the data metrics control plane (FR-DATA-METRICS-001..008).

Every handler enforces ADR-0014 step 2 (`require_tenant(ctx)`)
before touching the repository. The repository itself does not
double-check the tenant — the guard is the source of truth.

8 endpoints under `/api/v1/metrics/*`:

  GET    /api/v1/metrics              — list (paginated)
  POST   /api/v1/metrics              — create
  GET    /api/v1/metrics/{id}         — detail
  PUT    /api/v1/metrics/{id}         — update
  DELETE /api/v1/metrics/{id}         — delete
  POST   /api/v1/metrics/{id}/compute — manual compute
  GET    /api/v1/metrics/{id}/lineage — metric lineage
  GET    /api/v1/metrics/{id}/values  — metric values

Write handlers emit `metrics.<aggregate>.<verb>` outbox events via
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
    compute_metric,
    create_metric,
    delete_metric,
    get_metric,
    get_metric_lineage,
    get_metric_values,
    list_metrics,
    metric_to_dict,
    update_metric,
)

router = APIRouter(prefix="/api/v1/metrics", tags=["metrics"])


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
class MetricCreate(BaseModel):
    """Body for POST /metrics."""

    name: str
    expression: str
    description: str = ""
    config: dict[str, Any] | None = None


class MetricUpdate(BaseModel):
    """Body for PUT /metrics/{id}. All fields optional (patch semantics)."""

    name: str | None = None
    expression: str | None = None
    description: str | None = None
    status: str | None = None
    config: dict[str, Any] | None = None


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@router.get("/health")
async def health() -> dict[str, str]:
    """Anonymous liveness probe (no bearer token required)."""
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# 1. GET / — list (paginated)
# ---------------------------------------------------------------------------
@router.get("")
async def list_metrics_endpoint(
    request: Request,
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    """List metrics (FR-DATA-DATAGETMETRICS). Paginated, optional status filter."""
    tid = _tid(request)
    metrics = list_metrics(tid, status=status)
    items = [metric_to_dict(m) for m in metrics]
    return _paginate(items, page, size)


# ---------------------------------------------------------------------------
# 2. POST / — create
# ---------------------------------------------------------------------------
@router.post("")
async def create_metric_endpoint(
    request: Request, body: MetricCreate,
) -> dict[str, Any]:
    """Create a metric (FR-DATA-DATAPOSTMETRICS)."""
    tid = _tid(request)
    metric = create_metric(
        tid,
        name=body.name,
        expression=body.expression,
        description=body.description,
        config=body.config,
    )
    _emit(
        request,
        "metrics.metric.created",
        metric.id,
        {"metric_id": metric.id, "name": metric.name},
        tid,
    )
    return metric_to_dict(metric)


# ---------------------------------------------------------------------------
# 3. GET /{id} — detail
# ---------------------------------------------------------------------------
@router.get("/{metric_id}")
async def get_metric_endpoint(
    request: Request, metric_id: str,
) -> dict[str, Any]:
    """Get a metric by id (FR-DATA-DATAGETMETRICSID)."""
    tid = _tid(request)
    metric = get_metric(tid, metric_id)
    if metric is None:
        raise HTTPException(status_code=404, detail="metric not found")
    return metric_to_dict(metric)


# ---------------------------------------------------------------------------
# 4. PUT /{id} — update
# ---------------------------------------------------------------------------
@router.put("/{metric_id}")
async def update_metric_endpoint(
    request: Request, metric_id: str, body: MetricUpdate,
) -> dict[str, Any]:
    """Update a metric (FR-DATA-DATAPUTMETRICSID)."""
    tid = _tid(request)
    metric = update_metric(
        tid,
        metric_id,
        name=body.name,
        expression=body.expression,
        description=body.description,
        status=body.status,
        config=body.config,
    )
    if metric is None:
        raise HTTPException(status_code=404, detail="metric not found")
    _emit(
        request,
        "metrics.metric.updated",
        metric.id,
        {"metric_id": metric.id, "name": metric.name},
        tid,
    )
    return metric_to_dict(metric)


# ---------------------------------------------------------------------------
# 5. DELETE /{id} — delete
# ---------------------------------------------------------------------------
@router.delete("/{metric_id}")
async def delete_metric_endpoint(
    request: Request, metric_id: str,
) -> dict[str, Any]:
    """Delete a metric (FR-DATA-DATADELETEMETRICSID)."""
    tid = _tid(request)
    if not delete_metric(tid, metric_id):
        raise HTTPException(status_code=404, detail="metric not found")
    _emit(
        request,
        "metrics.metric.deleted",
        metric_id,
        {"metric_id": metric_id},
        tid,
    )
    return {"id": metric_id, "deleted": True}


# ---------------------------------------------------------------------------
# 6. POST /{id}/compute — manual compute
# ---------------------------------------------------------------------------
@router.post("/{metric_id}/compute")
async def compute_metric_endpoint(
    request: Request, metric_id: str,
) -> dict[str, Any]:
    """Trigger a manual compute for a metric (FR-DATA-DATAPOSTMETRICSIDCOMPUTE)."""
    tid = _tid(request)
    metric = compute_metric(tid, metric_id)
    if metric is None:
        raise HTTPException(status_code=404, detail="metric not found")
    _emit(
        request,
        "metrics.metric.computed",
        metric.id,
        {"metric_id": metric.id, "last_computed_at": metric.last_computed_at},
        tid,
    )
    return metric_to_dict(metric)


# ---------------------------------------------------------------------------
# 7. GET /{id}/lineage — metric lineage
# ---------------------------------------------------------------------------
@router.get("/{metric_id}/lineage")
async def get_metric_lineage_endpoint(
    request: Request, metric_id: str,
) -> dict[str, Any]:
    """Get the lineage for a metric (FR-DATA-DATAGETMETRICSIDLINEAGE)."""
    tid = _tid(request)
    lineage = get_metric_lineage(tid, metric_id)
    if lineage is None:
        raise HTTPException(status_code=404, detail="metric lineage not found")
    return lineage


# ---------------------------------------------------------------------------
# 8. GET /{id}/values — metric values
# ---------------------------------------------------------------------------
@router.get("/{metric_id}/values")
async def get_metric_values_endpoint(
    request: Request, metric_id: str,
) -> dict[str, Any]:
    """Get the values for a metric (FR-DATA-DATAGETMETRICSIDVALUES)."""
    tid = _tid(request)
    values = get_metric_values(tid, metric_id)
    if values is None:
        raise HTTPException(status_code=404, detail="metric values not found")
    return {
        "metric_id": metric_id,
        "values": values,
        "count": len(values),
    }
