"""In-memory repository for the DAG scheduling control plane (P2-W7).

Data shape:
    _TASKS:
        outer key = tenant_id (string)
        inner key = task_id (string)
        value    = SchedulerTask dataclass

    _DAG:
        outer key = tenant_id (string)
        value     = list of DagNode (the per-tenant DAG graph)

The store is intentionally tenant-scoped: callers MUST pass the
tenant binding (`ctx.tenant_id`) and the lookup rejects entities
that don't belong to that tenant. This is the layer at which the
ADR-0014 cross-tenant rule is enforced.

``SchedulerTask`` is mutable (not frozen) so that update / pause /
trigger operations can mutate fields in place.
"""
from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Any


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------
@dataclass
class SchedulerTask:
    """Mutable: update / pause / trigger patch status / fields in place."""

    id: str
    tenant_id: str
    name: str
    cron_expression: str
    status: str = "active"  # active | paused | running | failed | succeeded
    config: dict[str, Any] = field(default_factory=dict)
    created_at: str = ""
    updated_at: str = ""
    last_run_at: str = ""


@dataclass
class DagNode:
    """Immutable node in the per-tenant DAG graph."""

    task_id: str
    name: str
    upstream: list[str] = field(default_factory=list)
    downstream: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Seed builders
# ---------------------------------------------------------------------------
def _seed_scheduler_tasks(tenant_id: str) -> dict[str, SchedulerTask]:
    catalog: list[tuple[str, str, str]] = [
        ("sch-etl-orders", "ETL Orders Daily", "0 2 * * *"),
        ("sch-etl-users", "ETL Users Daily", "0 3 * * *"),
        ("sch-metrics-rollup", "Metrics Rollup Hourly", "0 * * * *"),
    ]
    now = _now()
    return {
        tid: SchedulerTask(
            id=tid,
            tenant_id=tenant_id,
            name=name,
            cron_expression=cron,
            status="active",
            config={"timezone": "Asia/Shanghai"},
            created_at=now,
            updated_at=now,
            last_run_at="",
        )
        for tid, name, cron in catalog
    }


def _seed_dag(tenant_id: str) -> list[DagNode]:
    return [
        DagNode(
            task_id="sch-etl-orders",
            name="ETL Orders Daily",
            upstream=[],
            downstream=["sch-metrics-rollup"],
        ),
        DagNode(
            task_id="sch-etl-users",
            name="ETL Users Daily",
            upstream=[],
            downstream=["sch-metrics-rollup"],
        ),
        DagNode(
            task_id="sch-metrics-rollup",
            name="Metrics Rollup Hourly",
            upstream=["sch-etl-orders", "sch-etl-users"],
            downstream=[],
        ),
    ]


# ---------------------------------------------------------------------------
# Tenant-scoped stores
# ---------------------------------------------------------------------------
_TASKS: dict[str, dict[str, SchedulerTask]] = {}
_DAG: dict[str, list[DagNode]] = {}


def _ensure_tenant(tenant_id: str) -> None:
    """Idempotently seed the store for a given tenant."""
    if not tenant_id:
        return  # anonymous lookups return empty, see list_*() functions
    if tenant_id not in _TASKS:
        _TASKS[tenant_id] = _seed_scheduler_tasks(tenant_id)
    if tenant_id not in _DAG:
        _DAG[tenant_id] = _seed_dag(tenant_id)


def _now() -> str:
    """UTC timestamp string (ISO-8601, seconds precision)."""
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


# ---------------------------------------------------------------------------
# Public read API
# ---------------------------------------------------------------------------
def list_scheduler_tasks(
    tenant_id: str, status: str | None = None,
) -> list[SchedulerTask]:
    """Return the scheduler tasks for a tenant, optionally filtered by status."""
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    tasks = list(_TASKS[tenant_id].values())
    if status:
        tasks = [t for t in tasks if t.status == status]
    return sorted(tasks, key=lambda t: t.id)


def get_scheduler_task(tenant_id: str, task_id: str) -> SchedulerTask | None:
    """Return a single scheduler task by id, or None if not found."""
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _TASKS[tenant_id].get(task_id)


def get_dag(tenant_id: str) -> list[DagNode]:
    """Return the per-tenant DAG graph (list of nodes)."""
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return list(_DAG[tenant_id])


# ---------------------------------------------------------------------------
# Public write API
# ---------------------------------------------------------------------------
def create_scheduler_task(
    tenant_id: str,
    name: str,
    cron_expression: str,
    config: dict[str, Any] | None = None,
) -> SchedulerTask:
    """Create a new scheduler task and store it."""
    _ensure_tenant(tenant_id)
    task_id = f"sch-{uuid.uuid4().hex[:8]}"
    now = _now()
    task = SchedulerTask(
        id=task_id,
        tenant_id=tenant_id,
        name=name,
        cron_expression=cron_expression,
        status="active",
        config=dict(config or {}),
        created_at=now,
        updated_at=now,
        last_run_at="",
    )
    _TASKS[tenant_id][task_id] = task
    return task


def update_scheduler_task(
    tenant_id: str,
    task_id: str,
    *,
    name: str | None = None,
    cron_expression: str | None = None,
    config: dict[str, Any] | None = None,
) -> SchedulerTask | None:
    """Patch mutable fields of an existing scheduler task. Returns None if missing."""
    _ensure_tenant(tenant_id)
    task = _TASKS[tenant_id].get(task_id)
    if task is None:
        return None
    if name is not None:
        task.name = name
    if cron_expression is not None:
        task.cron_expression = cron_expression
    if config is not None:
        task.config = dict(config)
    task.updated_at = _now()
    return task


def delete_scheduler_task(tenant_id: str, task_id: str) -> bool:
    """Delete a scheduler task. Returns True if removed, False if not found."""
    _ensure_tenant(tenant_id)
    return _TASKS[tenant_id].pop(task_id, None) is not None


def pause_scheduler_task(tenant_id: str, task_id: str) -> SchedulerTask | None:
    """Pause a scheduler task. Returns None if the task is missing."""
    _ensure_tenant(tenant_id)
    task = _TASKS[tenant_id].get(task_id)
    if task is None:
        return None
    task.status = "paused"
    task.updated_at = _now()
    return task


def trigger_scheduler_task(tenant_id: str, task_id: str) -> SchedulerTask | None:
    """Manually trigger a scheduler task. Returns None if the task is missing."""
    _ensure_tenant(tenant_id)
    task = _TASKS[tenant_id].get(task_id)
    if task is None:
        return None
    task.status = "running"
    task.last_run_at = _now()
    task.updated_at = _now()
    return task


# ---------------------------------------------------------------------------
# Serialization helper
# ---------------------------------------------------------------------------
def task_to_dict(task: SchedulerTask) -> dict[str, Any]:
    """Serialize a SchedulerTask to a JSON-friendly dict."""
    return {
        "id": task.id,
        "tenant_id": task.tenant_id,
        "name": task.name,
        "cron_expression": task.cron_expression,
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
    _TASKS.clear()
    _DAG.clear()
