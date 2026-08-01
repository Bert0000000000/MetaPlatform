"""Tests for mate_tech_etl.repositories.sql_store — SQL persistence (P3-W2)."""
from __future__ import annotations

import pytest

from mate_tech_db.base import create_all, init_engine, reset_engine
from mate_tech_etl.repositories import in_memory as mem
from mate_tech_etl.repositories import sql_models as models  # noqa: F401
from mate_tech_etl.repositories import sql_store as sql


@pytest.fixture(autouse=True)
def _fresh_db() -> None:
    reset_engine()
    init_engine("sqlite:///:memory:")
    create_all()
    yield
    reset_engine()


_TENANT_A = "tenant-acme"
_TENANT_B = "tenant-bigo"


def test_put_and_get_etl_task() -> None:
    task = mem.EtlTask(
        id="etl-1", tenant_id=_TENANT_A, name="Orders Dim",
        source_table="ods_orders", target_table="dwd_orders",
        status="idle", config={"mode": "full_refresh"},
    )
    sql.put_etl_task(_TENANT_A, task)

    fetched = sql.get_etl_task(_TENANT_A, "etl-1")
    assert fetched is not None
    assert fetched.name == "Orders Dim"
    assert fetched.config == {"mode": "full_refresh"}
    assert fetched.status == "idle"


def test_put_etl_task_upsert() -> None:
    task = mem.EtlTask(
        id="etl-2", tenant_id=_TENANT_A, name="Users Dim",
        source_table="ods_users", target_table="dwd_users",
    )
    sql.put_etl_task(_TENANT_A, task)
    task.status = "running"
    task.last_run_at = "2026-08-01T00:00:00Z"
    sql.put_etl_task(_TENANT_A, task)

    fetched = sql.get_etl_task(_TENANT_A, "etl-2")
    assert fetched is not None
    assert fetched.status == "running"
    assert fetched.last_run_at == "2026-08-01T00:00:00Z"


def test_list_etl_tasks_tenant_isolation() -> None:
    sql.put_etl_task(_TENANT_A, mem.EtlTask(
        id="etl-a", tenant_id=_TENANT_A, name="A",
        source_table="s", target_table="t",
    ))
    sql.put_etl_task(_TENANT_B, mem.EtlTask(
        id="etl-b", tenant_id=_TENANT_B, name="B",
        source_table="s", target_table="t",
    ))
    assert [t.id for t in sql.list_etl_tasks(_TENANT_A)] == ["etl-a"]
    assert [t.id for t in sql.list_etl_tasks(_TENANT_B)] == ["etl-b"]


def test_list_etl_tasks_status_filter() -> None:
    sql.put_etl_task(_TENANT_A, mem.EtlTask(
        id="etl-idle", tenant_id=_TENANT_A, name="I",
        source_table="s", target_table="t", status="idle",
    ))
    sql.put_etl_task(_TENANT_A, mem.EtlTask(
        id="etl-running", tenant_id=_TENANT_A, name="R",
        source_table="s", target_table="t", status="running",
    ))
    running = sql.list_etl_tasks(_TENANT_A, status="running")
    assert [t.id for t in running] == ["etl-running"]


def test_delete_etl_task() -> None:
    sql.put_etl_task(_TENANT_A, mem.EtlTask(
        id="etl-del", tenant_id=_TENANT_A, name="Del",
        source_table="s", target_table="t",
    ))
    assert sql.delete_etl_task(_TENANT_A, "etl-del") is True
    assert sql.get_etl_task(_TENANT_A, "etl-del") is None
    assert sql.delete_etl_task(_TENANT_A, "etl-del") is False


def test_delete_etl_task_rejects_cross_tenant() -> None:
    sql.put_etl_task(_TENANT_A, mem.EtlTask(
        id="etl-x", tenant_id=_TENANT_A, name="X",
        source_table="s", target_table="t",
    ))
    assert sql.delete_etl_task(_TENANT_B, "etl-x") is False


def test_set_etl_task_status() -> None:
    sql.put_etl_task(_TENANT_A, mem.EtlTask(
        id="etl-st", tenant_id=_TENANT_A, name="ST",
        source_table="s", target_table="t", status="idle",
    ))
    updated = sql.set_etl_task_status(
        _TENANT_A, "etl-st", "running", last_run_at="2026-08-01T00:00:00Z",
    )
    assert updated is not None
    assert updated.status == "running"
    assert updated.last_run_at == "2026-08-01T00:00:00Z"
    # Cross-tenant patch returns None
    assert sql.set_etl_task_status(_TENANT_B, "etl-st", "idle") is None


def test_seed_from_inmemory() -> None:
    counts = sql.seed_from_inmemory(_TENANT_A)
    assert counts["etl_tasks"] >= 3
    assert len(sql.list_etl_tasks(_TENANT_A)) >= 3
