"""SQL-backed repository for the data platform control plane (P3-W2 TD-5).

Provides read + write for ``CdcTask`` and ``DataSource``. Dict fields
(``config`` / ``connection_config``) are JSON-serialised to TEXT.

Schema discovery (``get_source_schema``) and connection probing
(``test_source_connection``) stay in ``in_memory`` because they are
dynamic and not part of the persistence contract.
"""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from mate_tech_db.base import get_session

from . import sql_models as models
from .in_memory import CdcTask, DataSource


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


def _orm_to_cdc_task(row: models.CdcTaskORM) -> CdcTask:
    return CdcTask(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        source_id=row.source_id,
        target_table=row.target_table,
        status=row.status or "running",
        config=_json_loads(row.config),
        created_at=row.created_at or "",
        updated_at=row.updated_at or "",
    )


def _orm_to_source(row: models.DataSourceORM) -> DataSource:
    return DataSource(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        type=row.type,
        connection_config=_json_loads(row.connection_config),
        status=row.status or "connected",
        created_at=row.created_at or "",
        updated_at=row.updated_at or "",
    )


# ---------------------------------------------------------------------------
# Read API — CDC tasks
# ---------------------------------------------------------------------------
def list_cdc_tasks(
    tenant_id: str, status: str | None = None,
) -> list[CdcTask]:
    if not tenant_id:
        return []
    s = _session()
    stmt = select(models.CdcTaskORM).where(
        models.CdcTaskORM.tenant_id == tenant_id
    )
    if status:
        stmt = stmt.where(models.CdcTaskORM.status == status)
    rows = s.execute(stmt.order_by(models.CdcTaskORM.id)).scalars().all()
    return [_orm_to_cdc_task(r) for r in rows]


def get_cdc_task(tenant_id: str, task_id: str) -> CdcTask | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.CdcTaskORM).where(
            models.CdcTaskORM.tenant_id == tenant_id,
            models.CdcTaskORM.id == task_id,
        )
    ).scalar_one_or_none()
    return _orm_to_cdc_task(row) if row else None


# ---------------------------------------------------------------------------
# Read API — data sources
# ---------------------------------------------------------------------------
def list_sources(
    tenant_id: str, type_filter: str | None = None,
) -> list[DataSource]:
    if not tenant_id:
        return []
    s = _session()
    stmt = select(models.DataSourceORM).where(
        models.DataSourceORM.tenant_id == tenant_id
    )
    if type_filter:
        stmt = stmt.where(models.DataSourceORM.type == type_filter)
    rows = s.execute(stmt.order_by(models.DataSourceORM.id)).scalars().all()
    return [_orm_to_source(r) for r in rows]


def get_source(tenant_id: str, source_id: str) -> DataSource | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.DataSourceORM).where(
            models.DataSourceORM.tenant_id == tenant_id,
            models.DataSourceORM.id == source_id,
        )
    ).scalar_one_or_none()
    return _orm_to_source(row) if row else None


# ---------------------------------------------------------------------------
# Write API — CDC tasks
# ---------------------------------------------------------------------------
def put_cdc_task(tenant_id: str, task: CdcTask) -> CdcTask:
    if not tenant_id:
        return task
    s = _session()
    config_str = _json_dumps(task.config)
    existing = s.get(models.CdcTaskORM, task.id)
    if existing:
        existing.name = task.name
        existing.source_id = task.source_id
        existing.target_table = task.target_table
        existing.status = task.status
        existing.config = config_str
        existing.updated_at = task.updated_at
    else:
        s.add(models.CdcTaskORM(
            id=task.id, tenant_id=tenant_id, name=task.name,
            source_id=task.source_id, target_table=task.target_table,
            status=task.status, config=config_str,
            created_at=task.created_at, updated_at=task.updated_at,
        ))
    s.commit()
    return task


def delete_cdc_task(tenant_id: str, task_id: str) -> bool:
    if not tenant_id:
        return False
    s = _session()
    row = s.execute(
        select(models.CdcTaskORM).where(
            models.CdcTaskORM.tenant_id == tenant_id,
            models.CdcTaskORM.id == task_id,
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    s.delete(row)
    s.commit()
    return True


def set_cdc_task_status(
    tenant_id: str, task_id: str, status: str,
) -> CdcTask | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.CdcTaskORM).where(
            models.CdcTaskORM.tenant_id == tenant_id,
            models.CdcTaskORM.id == task_id,
        )
    ).scalar_one_or_none()
    if row is None:
        return None
    row.status = status
    s.commit()
    return _orm_to_cdc_task(row)


# ---------------------------------------------------------------------------
# Write API — data sources
# ---------------------------------------------------------------------------
def put_source(tenant_id: str, source: DataSource) -> DataSource:
    if not tenant_id:
        return source
    s = _session()
    config_str = _json_dumps(source.connection_config)
    existing = s.get(models.DataSourceORM, source.id)
    if existing:
        existing.name = source.name
        existing.type = source.type
        existing.connection_config = config_str
        existing.status = source.status
        existing.updated_at = source.updated_at
    else:
        s.add(models.DataSourceORM(
            id=source.id, tenant_id=tenant_id, name=source.name,
            type=source.type, connection_config=config_str,
            status=source.status, created_at=source.created_at,
            updated_at=source.updated_at,
        ))
    s.commit()
    return source


def delete_source(tenant_id: str, source_id: str) -> bool:
    if not tenant_id:
        return False
    s = _session()
    row = s.execute(
        select(models.DataSourceORM).where(
            models.DataSourceORM.tenant_id == tenant_id,
            models.DataSourceORM.id == source_id,
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    s.delete(row)
    s.commit()
    return True


# ---------------------------------------------------------------------------
# Bootstrap — seed SQL store from in_memory seed data (one-time)
# ---------------------------------------------------------------------------
def seed_from_inmemory(tenant_id: str) -> dict[str, int]:
    """Seed the SQL store from in_memory seed data.

    Returns counts of rows inserted per table.
    """
    from . import in_memory as mem  # noqa: PLC0415

    counts: dict[str, int] = {}
    counts["cdc_tasks"] = len(
        [put_cdc_task(tenant_id, t) for t in mem.list_cdc_tasks(tenant_id)]
    )
    counts["sources"] = len(
        [put_source(tenant_id, s) for s in mem.list_sources(tenant_id)]
    )
    return counts
