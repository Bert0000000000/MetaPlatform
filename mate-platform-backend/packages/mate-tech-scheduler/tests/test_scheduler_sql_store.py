"""Tests for mate_tech_scheduler.repositories.sql_store — SQL persistence (P3-W2)."""
from __future__ import annotations

import pytest

from mate_tech_db.base import create_all, init_engine, reset_engine
from mate_tech_scheduler.repositories import in_memory as mem
from mate_tech_scheduler.repositories import sql_models as models  # noqa: F401
from mate_tech_scheduler.repositories import sql_store as sql


@pytest.fixture(autouse=True)
def _fresh_db() -> None:
    reset_engine()
    init_engine("sqlite:///:memory:")
    create_all()
    yield
    reset_engine()


_TENANT_A = "tenant-acme"
_TENANT_B = "tenant-bigo"


def test_put_and_get_scheduler_task() -> None:
    t = mem.SchedulerTask(
        id="sch-1", tenant_id=_TENANT_A, name="ETL Daily",
        cron_expression="0 2 * * *", status="active",
        config={"timezone": "Asia/Shanghai"},
    )
    sql.put_scheduler_task(_TENANT_A, t)

    fetched = sql.get_scheduler_task(_TENANT_A, "sch-1")
    assert fetched is not None
    assert fetched.name == "ETL Daily"
    assert fetched.cron_expression == "0 2 * * *"
    assert fetched.config == {"timezone": "Asia/Shanghai"}


def test_put_scheduler_task_upsert() -> None:
    t = mem.SchedulerTask(
        id="sch-2", tenant_id=_TENANT_A, name="Metrics",
        cron_expression="0 * * * *",
    )
    sql.put_scheduler_task(_TENANT_A, t)
    t.status = "paused"
    t.last_run_at = "2026-08-01T00:00:00Z"
    sql.put_scheduler_task(_TENANT_A, t)

    fetched = sql.get_scheduler_task(_TENANT_A, "sch-2")
    assert fetched is not None
    assert fetched.status == "paused"
    assert fetched.last_run_at == "2026-08-01T00:00:00Z"


def test_list_scheduler_tasks_tenant_isolation() -> None:
    sql.put_scheduler_task(_TENANT_A, mem.SchedulerTask(
        id="sch-a", tenant_id=_TENANT_A, name="A",
        cron_expression="0 0 * * *",
    ))
    sql.put_scheduler_task(_TENANT_B, mem.SchedulerTask(
        id="sch-b", tenant_id=_TENANT_B, name="B",
        cron_expression="0 0 * * *",
    ))
    assert [t.id for t in sql.list_scheduler_tasks(_TENANT_A)] == ["sch-a"]
    assert [t.id for t in sql.list_scheduler_tasks(_TENANT_B)] == ["sch-b"]


def test_list_scheduler_tasks_status_filter() -> None:
    sql.put_scheduler_task(_TENANT_A, mem.SchedulerTask(
        id="sch-active", tenant_id=_TENANT_A, name="A",
        cron_expression="0 0 * * *", status="active",
    ))
    sql.put_scheduler_task(_TENANT_A, mem.SchedulerTask(
        id="sch-paused", tenant_id=_TENANT_A, name="P",
        cron_expression="0 0 * * *", status="paused",
    ))
    active = sql.list_scheduler_tasks(_TENANT_A, status="active")
    assert [t.id for t in active] == ["sch-active"]


def test_delete_scheduler_task() -> None:
    sql.put_scheduler_task(_TENANT_A, mem.SchedulerTask(
        id="sch-del", tenant_id=_TENANT_A, name="Del",
        cron_expression="0 0 * * *",
    ))
    assert sql.delete_scheduler_task(_TENANT_A, "sch-del") is True
    assert sql.get_scheduler_task(_TENANT_A, "sch-del") is None
    assert sql.delete_scheduler_task(_TENANT_A, "sch-del") is False


def test_delete_scheduler_task_rejects_cross_tenant() -> None:
    sql.put_scheduler_task(_TENANT_A, mem.SchedulerTask(
        id="sch-x", tenant_id=_TENANT_A, name="X",
        cron_expression="0 0 * * *",
    ))
    assert sql.delete_scheduler_task(_TENANT_B, "sch-x") is False


def test_set_scheduler_task_status() -> None:
    sql.put_scheduler_task(_TENANT_A, mem.SchedulerTask(
        id="sch-st", tenant_id=_TENANT_A, name="ST",
        cron_expression="0 0 * * *", status="active",
    ))
    updated = sql.set_scheduler_task_status(
        _TENANT_A, "sch-st", "running", last_run_at="2026-08-01T00:00:00Z",
    )
    assert updated is not None
    assert updated.status == "running"
    assert updated.last_run_at == "2026-08-01T00:00:00Z"
    # Cross-tenant patch returns None
    assert sql.set_scheduler_task_status(_TENANT_B, "sch-st", "active") is None


def test_seed_from_inmemory() -> None:
    counts = sql.seed_from_inmemory(_TENANT_A)
    assert counts["scheduler_tasks"] >= 3
    assert len(sql.list_scheduler_tasks(_TENANT_A)) >= 3
