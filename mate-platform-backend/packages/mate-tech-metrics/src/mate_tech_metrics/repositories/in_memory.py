"""In-memory repository for the data metrics control plane (P2-W7).

Data shape:
    _METRICS / _LINEAGES / _VALUES:
        outer key = tenant_id (string)
        inner key = metric_id (string)
        value    = entity (Metric dataclass / lineage dict / values list)

The store is intentionally tenant-scoped: callers MUST pass the
tenant binding (`ctx.tenant_id`) and the lookup rejects entities
that don't belong to that tenant. This is the layer at which the
ADR-0014 cross-tenant rule is enforced.

``Metric`` is mutable (not frozen) so that update / compute
operations can mutate fields in place.
"""
from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Any


# ---------------------------------------------------------------------------
# Dataclass
# ---------------------------------------------------------------------------
@dataclass
class Metric:
    """Mutable: update / compute patch status / fields in place."""

    id: str
    tenant_id: str
    name: str
    expression: str
    status: str = "draft"  # draft | active | retired
    description: str = ""
    config: dict[str, Any] = field(default_factory=dict)
    created_at: str = ""
    updated_at: str = ""
    last_computed_at: str = ""


# ---------------------------------------------------------------------------
# Seed builder
# ---------------------------------------------------------------------------
def _seed_metrics(tenant_id: str) -> dict[str, Metric]:
    catalog: list[tuple[str, str, str, str]] = [
        ("mtc-revenue-daily", "Daily Revenue", "SUM(orders.amount)", "active"),
        ("mtc-active-users", "Active Users", "COUNT(DISTINCT users.id)", "active"),
        ("mtc-conversion-rate", "Conversion Rate", "COUNT(orders) / COUNT(visits)", "draft"),
    ]
    now = _now()
    return {
        mid: Metric(
            id=mid,
            tenant_id=tenant_id,
            name=name,
            expression=expr,
            status=status,
            description=f"{name} metric",
            config={"unit": "count"},
            created_at=now,
            updated_at=now,
            last_computed_at="",
        )
        for mid, name, expr, status in catalog
    }


def _seed_lineages(tenant_id: str) -> dict[str, dict[str, Any]]:
    return {
        "mtc-revenue-daily": {
            "metric_id": "mtc-revenue-daily",
            "sources": [
                {"type": "table", "name": "ods_orders"},
                {"type": "table", "name": "ods_order_items"},
            ],
            "downstream": [
                {"type": "dashboard", "name": "Revenue Dashboard"},
            ],
        },
        "mtc-active-users": {
            "metric_id": "mtc-active-users",
            "sources": [
                {"type": "table", "name": "ods_users"},
            ],
            "downstream": [
                {"type": "dashboard", "name": "User Growth Dashboard"},
            ],
        },
        "mtc-conversion-rate": {
            "metric_id": "mtc-conversion-rate",
            "sources": [
                {"type": "table", "name": "ods_orders"},
                {"type": "table", "name": "ods_visits"},
            ],
            "downstream": [],
        },
    }


def _seed_values(tenant_id: str) -> dict[str, list[dict[str, Any]]]:
    now = _now()
    return {
        "mtc-revenue-daily": [
            {"date": "2026-07-28", "value": 12500.0},
            {"date": "2026-07-29", "value": 13200.0},
            {"date": "2026-07-30", "value": 14800.0},
        ],
        "mtc-active-users": [
            {"date": "2026-07-28", "value": 3421},
            {"date": "2026-07-29", "value": 3580},
            {"date": "2026-07-30", "value": 3701},
        ],
        "mtc-conversion-rate": [
            {"date": "2026-07-28", "value": 0.0342},
            {"date": "2026-07-29", "value": 0.0361},
            {"date": "2026-07-30", "value": 0.0388},
        ],
    }


# ---------------------------------------------------------------------------
# Tenant-scoped stores
# ---------------------------------------------------------------------------
_METRICS: dict[str, dict[str, Metric]] = {}
_LINEAGES: dict[str, dict[str, dict[str, Any]]] = {}
_VALUES: dict[str, dict[str, list[dict[str, Any]]]] = {}


def _ensure_tenant(tenant_id: str) -> None:
    """Idempotently seed the store for a given tenant."""
    if not tenant_id:
        return  # anonymous lookups return empty, see list_*() functions
    if tenant_id not in _METRICS:
        _METRICS[tenant_id] = _seed_metrics(tenant_id)
    if tenant_id not in _LINEAGES:
        _LINEAGES[tenant_id] = _seed_lineages(tenant_id)
    if tenant_id not in _VALUES:
        _VALUES[tenant_id] = _seed_values(tenant_id)


def _now() -> str:
    """UTC timestamp string (ISO-8601, seconds precision)."""
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


# ---------------------------------------------------------------------------
# Public read API
# ---------------------------------------------------------------------------
def list_metrics(
    tenant_id: str, status: str | None = None,
) -> list[Metric]:
    """Return the metrics for a tenant, optionally filtered by status."""
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    metrics = list(_METRICS[tenant_id].values())
    if status:
        metrics = [m for m in metrics if m.status == status]
    return sorted(metrics, key=lambda m: m.id)


def get_metric(tenant_id: str, metric_id: str) -> Metric | None:
    """Return a single metric by id, or None if not found."""
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _METRICS[tenant_id].get(metric_id)


def get_metric_lineage(
    tenant_id: str, metric_id: str,
) -> dict[str, Any] | None:
    """Return the lineage for a metric, or None if not found."""
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _LINEAGES[tenant_id].get(metric_id)


def get_metric_values(
    tenant_id: str, metric_id: str,
) -> list[dict[str, Any]] | None:
    """Return the values for a metric, or None if not found."""
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _VALUES[tenant_id].get(metric_id)


# ---------------------------------------------------------------------------
# Public write API
# ---------------------------------------------------------------------------
def create_metric(
    tenant_id: str,
    name: str,
    expression: str,
    description: str = "",
    config: dict[str, Any] | None = None,
) -> Metric:
    """Create a new metric and store it."""
    _ensure_tenant(tenant_id)
    metric_id = f"mtc-{uuid.uuid4().hex[:8]}"
    now = _now()
    metric = Metric(
        id=metric_id,
        tenant_id=tenant_id,
        name=name,
        expression=expression,
        status="draft",
        description=description,
        config=dict(config or {}),
        created_at=now,
        updated_at=now,
        last_computed_at="",
    )
    _METRICS[tenant_id][metric_id] = metric
    return metric


def update_metric(
    tenant_id: str,
    metric_id: str,
    *,
    name: str | None = None,
    expression: str | None = None,
    description: str | None = None,
    status: str | None = None,
    config: dict[str, Any] | None = None,
) -> Metric | None:
    """Patch mutable fields of an existing metric. Returns None if missing."""
    _ensure_tenant(tenant_id)
    metric = _METRICS[tenant_id].get(metric_id)
    if metric is None:
        return None
    if name is not None:
        metric.name = name
    if expression is not None:
        metric.expression = expression
    if description is not None:
        metric.description = description
    if status is not None:
        metric.status = status
    if config is not None:
        metric.config = dict(config)
    metric.updated_at = _now()
    return metric


def delete_metric(tenant_id: str, metric_id: str) -> bool:
    """Delete a metric. Returns True if removed, False if not found."""
    _ensure_tenant(tenant_id)
    _LINEAGES[tenant_id].pop(metric_id, None)
    _VALUES[tenant_id].pop(metric_id, None)
    return _METRICS[tenant_id].pop(metric_id, None) is not None


def compute_metric(
    tenant_id: str, metric_id: str,
) -> Metric | None:
    """Trigger a manual compute for a metric. Returns None if missing."""
    _ensure_tenant(tenant_id)
    metric = _METRICS[tenant_id].get(metric_id)
    if metric is None:
        return None
    metric.last_computed_at = _now()
    metric.updated_at = _now()
    # Append a fresh computed value (simulated).
    values = _VALUES[tenant_id].setdefault(metric_id, [])
    values.append({"date": metric.last_computed_at[:10], "value": 0.0})
    return metric


# ---------------------------------------------------------------------------
# Serialization helper
# ---------------------------------------------------------------------------
def metric_to_dict(metric: Metric) -> dict[str, Any]:
    """Serialize a Metric to a JSON-friendly dict."""
    return {
        "id": metric.id,
        "tenant_id": metric.tenant_id,
        "name": metric.name,
        "expression": metric.expression,
        "status": metric.status,
        "description": metric.description,
        "config": dict(metric.config),
        "created_at": metric.created_at,
        "updated_at": metric.updated_at,
        "last_computed_at": metric.last_computed_at,
    }


# ---------------------------------------------------------------------------
# Test helpers — DO NOT call from production code paths
# ---------------------------------------------------------------------------
def reset_store() -> None:
    """Drop all seeded data. Used by tests to keep cases isolated."""
    _METRICS.clear()
    _LINEAGES.clear()
    _VALUES.clear()
