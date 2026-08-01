"""In-memory repository for the ETL task control plane (P2-W7).

Data shape:
    _ETL_TASKS:
        outer key = tenant_id (string)
        inner key = entity_id (string)
        value    = EtlTask dataclass

The store is intentionally tenant-scoped: callers MUST pass the
tenant binding (`ctx.tenant_id`) and the lookup rejects entities
that don't belong to that tenant. This is the layer at which the
ADR-0014 cross-tenant rule is enforced.

Seed data:
    >= 3 ETL tasks per tenant. Tests rely on these minima; bumping
    them is allowed but tests assert `>= N` rather than equality.

``EtlTask`` is mutable (not frozen) so that update / status-patch
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
class EtlTask:
    """Mutable: update / run / stop patch status / fields in place."""

    id: str
    tenant_id: str
    name: str
    source_table: str
    target_table: str
    status: str = "idle"  # idle | running | stopped | failed | succeeded
    config: dict[str, Any] = field(default_factory=dict)
    created_at: str = ""
    updated_at: str = ""
    last_run_at: str = ""


# ---------------------------------------------------------------------------
# Seed builder
# ---------------------------------------------------------------------------
def _seed_etl_tasks(tenant_id: str) -> dict[str, EtlTask]:
    catalog: list[tuple[str, str, str, str]] = [
        ("etl-orders-dim", "Orders Dim Load", "ods_orders", "dwd_orders"),
        ("etl-users-dim", "Users Dim Load", "ods_users", "dwd_users"),
        ("etl-events-fact", "Events Fact Load", "ods_events", "dwd_events"),
    ]
    now = _now()
    return {
        tid: EtlTask(
            id=tid,
            tenant_id=tenant_id,
            name=name,
            source_table=src,
            target_table=tgt,
            status="idle",
            config={"mode": "full_refresh"},
            created_at=now,
            updated_at=now,
            last_run_at="",
        )
        for tid, name, src, tgt in catalog
    }


# ---------------------------------------------------------------------------
# Tenant-scoped store
# ---------------------------------------------------------------------------
_ETL_TASKS: dict[str, dict[str, EtlTask]] = {}


def _ensure_tenant(tenant_id: str) -> None:
    """Idempotently seed the store for a given tenant."""
    if not tenant_id:
        return  # anonymous lookups return empty, see list_*() functions
    if tenant_id not in _ETL_TASKS:
        _ETL_TASKS[tenant_id] = _seed_etl_tasks(tenant_id)


def _now() -> str:
    """UTC timestamp string (ISO-8601, seconds precision)."""
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


# ---------------------------------------------------------------------------
# Public read API
# ---------------------------------------------------------------------------
def list_etl_tasks(
    tenant_id: str, status: str | None = None,
) -> list[EtlTask]:
    """Return the ETL tasks for a tenant, optionally filtered by status."""
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    tasks = list(_ETL_TASKS[tenant_id].values())
    if status:
        tasks = [t for t in tasks if t.status == status]
    return sorted(tasks, key=lambda t: t.id)


def get_etl_task(tenant_id: str, task_id: str) -> EtlTask | None:
    """Return a single ETL task by id, or None if not found."""
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _ETL_TASKS[tenant_id].get(task_id)


# ---------------------------------------------------------------------------
# Public write API
# ---------------------------------------------------------------------------
def create_etl_task(
    tenant_id: str,
    name: str,
    source_table: str,
    target_table: str,
    config: dict[str, Any] | None = None,
) -> EtlTask:
    """Create a new ETL task and store it."""
    _ensure_tenant(tenant_id)
    task_id = f"etl-{uuid.uuid4().hex[:8]}"
    now = _now()
    task = EtlTask(
        id=task_id,
        tenant_id=tenant_id,
        name=name,
        source_table=source_table,
        target_table=target_table,
        status="idle",
        config=dict(config or {}),
        created_at=now,
        updated_at=now,
        last_run_at="",
    )
    _ETL_TASKS[tenant_id][task_id] = task
    return task


def update_etl_task(
    tenant_id: str,
    task_id: str,
    *,
    name: str | None = None,
    source_table: str | None = None,
    target_table: str | None = None,
    config: dict[str, Any] | None = None,
) -> EtlTask | None:
    """Patch mutable fields of an existing ETL task. Returns None if missing."""
    _ensure_tenant(tenant_id)
    task = _ETL_TASKS[tenant_id].get(task_id)
    if task is None:
        return None
    if name is not None:
        task.name = name
    if source_table is not None:
        task.source_table = source_table
    if target_table is not None:
        task.target_table = target_table
    if config is not None:
        task.config = dict(config)
    task.updated_at = _now()
    return task


def delete_etl_task(tenant_id: str, task_id: str) -> bool:
    """Delete an ETL task. Returns True if removed, False if not found."""
    _ensure_tenant(tenant_id)
    return _ETL_TASKS[tenant_id].pop(task_id, None) is not None


def run_etl_task(tenant_id: str, task_id: str) -> EtlTask | None:
    """Start an ETL task run. Returns None if the task is missing."""
    _ensure_tenant(tenant_id)
    task = _ETL_TASKS[tenant_id].get(task_id)
    if task is None:
        return None
    task.status = "running"
    task.last_run_at = _now()
    task.updated_at = _now()
    return task


def stop_etl_task(tenant_id: str, task_id: str) -> EtlTask | None:
    """Stop a running ETL task. Returns None if the task is missing."""
    _ensure_tenant(tenant_id)
    task = _ETL_TASKS[tenant_id].get(task_id)
    if task is None:
        return None
    task.status = "stopped"
    task.updated_at = _now()
    return task


def set_etl_task_status(
    tenant_id: str, task_id: str, status: str,
) -> EtlTask | None:
    """Set the status of an ETL task. Returns None if missing."""
    _ensure_tenant(tenant_id)
    task = _ETL_TASKS[tenant_id].get(task_id)
    if task is None:
        return None
    task.status = status
    task.updated_at = _now()
    return task


# ---------------------------------------------------------------------------
# Serialization helper
# ---------------------------------------------------------------------------
def task_to_dict(task: EtlTask) -> dict[str, Any]:
    """Serialize an EtlTask to a JSON-friendly dict."""
    return {
        "id": task.id,
        "tenant_id": task.tenant_id,
        "name": task.name,
        "source_table": task.source_table,
        "target_table": task.target_table,
        "status": task.status,
        "config": dict(task.config),
        "created_at": task.created_at,
        "updated_at": task.updated_at,
        "last_run_at": task.last_run_at,
    }


# ---------------------------------------------------------------------------
# Test helpers — DO NOT call from production code paths
# ---------------------------------------------------------------------------
def reset_store() -> None:
    """Drop all seeded data. Used by tests to keep cases isolated."""
    _ETL_TASKS.clear()
