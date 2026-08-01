"""SQL-backed repository for the data metrics control plane (P3-W2 TD-5).

Provides read + write for ``Metric``. The ``config`` dict is
JSON-serialised to TEXT.

Lineage (``get_metric_lineage``) and computed values
(``get_metric_values`` / ``compute_metric``) stay in in_memory
because they are dynamic and not part of the persistence contract.
"""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from mate_tech_db.base import get_session

from . import sql_models as models
from .in_memory import Metric


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _session() -> Session:
    return get_session()


def _json_dumps(value: dict[str, Any] | None) -> str:
    return json.dumps(value or {}, ensure_ascii=False, sort_keys=True)


def _json_loads(text: str) -> dict[str, Any]:
    if not text:
        return {}
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return {}


def _orm_to_metric(row: models.MetricORM) -> Metric:
    return Metric(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        expression=row.expression,
        status=row.status or "draft",
        description=row.description or "",
        config=_json_loads(row.config),
        created_at=row.created_at or "",
        updated_at=row.updated_at or "",
        last_computed_at=row.last_computed_at or "",
    )


# ---------------------------------------------------------------------------
# Read API
# ---------------------------------------------------------------------------
def list_metrics(
    tenant_id: str, status: str | None = None,
) -> list[Metric]:
    if not tenant_id:
        return []
    s = _session()
    stmt = select(models.MetricORM).where(
        models.MetricORM.tenant_id == tenant_id
    )
    if status:
        stmt = stmt.where(models.MetricORM.status == status)
    rows = s.execute(stmt.order_by(models.MetricORM.id)).scalars().all()
    return [_orm_to_metric(r) for r in rows]


def get_metric(tenant_id: str, metric_id: str) -> Metric | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.MetricORM).where(
            models.MetricORM.tenant_id == tenant_id,
            models.MetricORM.id == metric_id,
        )
    ).scalar_one_or_none()
    return _orm_to_metric(row) if row else None


# ---------------------------------------------------------------------------
# Write API
# ---------------------------------------------------------------------------
def put_metric(tenant_id: str, metric: Metric) -> Metric:
    if not tenant_id:
        return metric
    s = _session()
    config_str = _json_dumps(metric.config)
    existing = s.get(models.MetricORM, metric.id)
    if existing:
        existing.name = metric.name
        existing.expression = metric.expression
        existing.status = metric.status
        existing.description = metric.description
        existing.config = config_str
        existing.updated_at = metric.updated_at
        existing.last_computed_at = metric.last_computed_at
    else:
        s.add(models.MetricORM(
            id=metric.id, tenant_id=tenant_id, name=metric.name,
            expression=metric.expression, status=metric.status,
            description=metric.description, config=config_str,
            created_at=metric.created_at, updated_at=metric.updated_at,
            last_computed_at=metric.last_computed_at,
        ))
    s.commit()
    return metric


def delete_metric(tenant_id: str, metric_id: str) -> bool:
    if not tenant_id:
        return False
    s = _session()
    row = s.execute(
        select(models.MetricORM).where(
            models.MetricORM.tenant_id == tenant_id,
            models.MetricORM.id == metric_id,
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    s.delete(row)
    s.commit()
    return True


# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------
def seed_from_inmemory(tenant_id: str) -> dict[str, int]:
    """Seed the SQL store from in_memory seed data."""
    from . import in_memory as mem  # noqa: PLC0415

    counts: dict[str, int] = {}
    counts["metrics"] = len(
        [put_metric(tenant_id, m) for m in mem.list_metrics(tenant_id)]
    )
    return counts
