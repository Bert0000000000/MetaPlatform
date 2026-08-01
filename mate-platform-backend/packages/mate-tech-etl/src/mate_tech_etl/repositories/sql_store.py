"""SQL-backed repository for the ETL task control plane (P3-W2 TD-5).

Provides read + write for ``EtlTask``. The ``config`` dict is
JSON-serialised to TEXT.
"""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from mate_tech_db.base import get_session

from . import sql_models as models
from .in_memory import EtlTask


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


def _orm_to_etl_task(row: models.EtlTaskORM) -> EtlTask:
    return EtlTask(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        source_table=row.source_table,
        target_table=row.target_table,
        status=row.status or "idle",
        config=_json_loads(row.config),
        created_at=row.created_at or "",
        updated_at=row.updated_at or "",
        last_run_at=row.last_run_at or "",
    )


# ---------------------------------------------------------------------------
# Read API
# ---------------------------------------------------------------------------
def list_etl_tasks(
    tenant_id: str, status: str | None = None,
) -> list[EtlTask]:
    if not tenant_id:
        return []
    s = _session()
    stmt = select(models.EtlTaskORM).where(
        models.EtlTaskORM.tenant_id == tenant_id
    )
    if status:
        stmt = stmt.where(models.EtlTaskORM.status == status)
    rows = s.execute(stmt.order_by(models.EtlTaskORM.id)).scalars().all()
    return [_orm_to_etl_task(r) for r in rows]


def get_etl_task(tenant_id: str, task_id: str) -> EtlTask | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.EtlTaskORM).where(
            models.EtlTaskORM.tenant_id == tenant_id,
            models.EtlTaskORM.id == task_id,
        )
    ).scalar_one_or_none()
    return _orm_to_etl_task(row) if row else None


# ---------------------------------------------------------------------------
# Write API
# ---------------------------------------------------------------------------
def put_etl_task(tenant_id: str, task: EtlTask) -> EtlTask:
    if not tenant_id:
        return task
    s = _session()
    config_str = _json_dumps(task.config)
    existing = s.get(models.EtlTaskORM, task.id)
    if existing:
        existing.name = task.name
        existing.source_table = task.source_table
        existing.target_table = task.target_table
        existing.status = task.status
        existing.config = config_str
        existing.updated_at = task.updated_at
        existing.last_run_at = task.last_run_at
    else:
        s.add(models.EtlTaskORM(
            id=task.id, tenant_id=tenant_id, name=task.name,
            source_table=task.source_table, target_table=task.target_table,
            status=task.status, config=config_str,
            created_at=task.created_at, updated_at=task.updated_at,
            last_run_at=task.last_run_at,
        ))
    s.commit()
    return task


def delete_etl_task(tenant_id: str, task_id: str) -> bool:
    if not tenant_id:
        return False
    s = _session()
    row = s.execute(
        select(models.EtlTaskORM).where(
            models.EtlTaskORM.tenant_id == tenant_id,
            models.EtlTaskORM.id == task_id,
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    s.delete(row)
    s.commit()
    return True


def set_etl_task_status(
    tenant_id: str, task_id: str, status: str,
    *,
    last_run_at: str | None = None,
) -> EtlTask | None:
    """Set the status (and optionally last_run_at) of an ETL task.

    Returns None if the task is missing.
    """
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.EtlTaskORM).where(
            models.EtlTaskORM.tenant_id == tenant_id,
            models.EtlTaskORM.id == task_id,
        )
    ).scalar_one_or_none()
    if row is None:
        return None
    row.status = status
    if last_run_at is not None:
        row.last_run_at = last_run_at
    s.commit()
    return _orm_to_etl_task(row)


# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------
def seed_from_inmemory(tenant_id: str) -> dict[str, int]:
    """Seed the SQL store from in_memory seed data."""
    from . import in_memory as mem  # noqa: PLC0415

    counts: dict[str, int] = {}
    counts["etl_tasks"] = len(
        [put_etl_task(tenant_id, t) for t in mem.list_etl_tasks(tenant_id)]
    )
    return counts
