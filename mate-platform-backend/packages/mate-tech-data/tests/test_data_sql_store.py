"""Tests for mate_tech_data.repositories.sql_store — SQL persistence (P3-W2).

Uses SQLite in-memory + Base.metadata.create_all to verify the SQL
store's CRUD + tenant isolation. Dynamic functions (schema discovery,
connection probe) stay in in_memory and are not exercised here.
"""
from __future__ import annotations

import pytest

from mate_tech_db.base import Base, create_all, init_engine, reset_engine
from mate_tech_data.repositories import in_memory as mem
from mate_tech_data.repositories import sql_models as models  # noqa: F401
from mate_tech_data.repositories import sql_store as sql


@pytest.fixture(autouse=True)
def _fresh_db() -> None:
    """Reset the engine and create all tables before each test."""
    reset_engine()
    init_engine("sqlite:///:memory:")
    create_all()
    yield
    reset_engine()


_TENANT_A = "tenant-acme"
_TENANT_B = "tenant-bigo"


# ---------------------------------------------------------------------------
# CDC task round-trip
# ---------------------------------------------------------------------------
def test_put_and_get_cdc_task() -> None:
    task = mem.CdcTask(
        id="cdc-1", tenant_id=_TENANT_A, name="Orders Sync",
        source_id="src-1", target_table="ods_orders",
        status="running", config={"mode": "incremental"},
        created_at="2026-08-01T00:00:00Z",
        updated_at="2026-08-01T00:00:00Z",
    )
    sql.put_cdc_task(_TENANT_A, task)

    fetched = sql.get_cdc_task(_TENANT_A, "cdc-1")
    assert fetched is not None
    assert fetched.id == "cdc-1"
    assert fetched.name == "Orders Sync"
    assert fetched.source_id == "src-1"
    assert fetched.target_table == "ods_orders"
    assert fetched.status == "running"
    assert fetched.config == {"mode": "incremental"}
    assert fetched.created_at == "2026-08-01T00:00:00Z"


def test_put_cdc_task_upsert() -> None:
    task = mem.CdcTask(
        id="cdc-2", tenant_id=_TENANT_A, name="Users Sync",
        source_id="src-2", target_table="ods_users",
    )
    sql.put_cdc_task(_TENANT_A, task)
    # Update
    task.status = "paused"
    task.config = {"mode": "bulk"}
    sql.put_cdc_task(_TENANT_A, task)

    fetched = sql.get_cdc_task(_TENANT_A, "cdc-2")
    assert fetched is not None
    assert fetched.status == "paused"
    assert fetched.config == {"mode": "bulk"}


def test_list_cdc_tasks_filters_by_tenant() -> None:
    sql.put_cdc_task(_TENANT_A, mem.CdcTask(
        id="cdc-a1", tenant_id=_TENANT_A, name="A1",
        source_id="src-1", target_table="t1",
    ))
    sql.put_cdc_task(_TENANT_B, mem.CdcTask(
        id="cdc-b1", tenant_id=_TENANT_B, name="B1",
        source_id="src-1", target_table="t1",
    ))

    a_tasks = sql.list_cdc_tasks(_TENANT_A)
    assert [t.id for t in a_tasks] == ["cdc-a1"]

    b_tasks = sql.list_cdc_tasks(_TENANT_B)
    assert [t.id for t in b_tasks] == ["cdc-b1"]


def test_list_cdc_tasks_filters_by_status() -> None:
    sql.put_cdc_task(_TENANT_A, mem.CdcTask(
        id="cdc-running", tenant_id=_TENANT_A, name="R",
        source_id="src-1", target_table="t1", status="running",
    ))
    sql.put_cdc_task(_TENANT_A, mem.CdcTask(
        id="cdc-paused", tenant_id=_TENANT_A, name="P",
        source_id="src-1", target_table="t1", status="paused",
    ))

    running = sql.list_cdc_tasks(_TENANT_A, status="running")
    assert [t.id for t in running] == ["cdc-running"]


def test_delete_cdc_task() -> None:
    sql.put_cdc_task(_TENANT_A, mem.CdcTask(
        id="cdc-del", tenant_id=_TENANT_A, name="Del",
        source_id="src-1", target_table="t1",
    ))
    assert sql.delete_cdc_task(_TENANT_A, "cdc-del") is True
    assert sql.get_cdc_task(_TENANT_A, "cdc-del") is None
    # Idempotent
    assert sql.delete_cdc_task(_TENANT_A, "cdc-del") is False


def test_delete_cdc_task_rejects_cross_tenant() -> None:
    sql.put_cdc_task(_TENANT_A, mem.CdcTask(
        id="cdc-x", tenant_id=_TENANT_A, name="X",
        source_id="src-1", target_table="t1",
    ))
    # Tenant B cannot delete tenant A's task
    assert sql.delete_cdc_task(_TENANT_B, "cdc-x") is False
    assert sql.get_cdc_task(_TENANT_A, "cdc-x") is not None


def test_set_cdc_task_status() -> None:
    sql.put_cdc_task(_TENANT_A, mem.CdcTask(
        id="cdc-st", tenant_id=_TENANT_A, name="ST",
        source_id="src-1", target_table="t1", status="running",
    ))
    updated = sql.set_cdc_task_status(_TENANT_A, "cdc-st", "stopped")
    assert updated is not None
    assert updated.status == "stopped"
    # Cross-tenant patch returns None
    assert sql.set_cdc_task_status(_TENANT_B, "cdc-st", "running") is None


def test_get_cdc_task_anonymous_tenant_returns_none() -> None:
    assert sql.get_cdc_task("", "cdc-1") is None


# ---------------------------------------------------------------------------
# Data source round-trip
# ---------------------------------------------------------------------------
def test_put_and_get_source() -> None:
    src = mem.DataSource(
        id="src-1", tenant_id=_TENANT_A, name="MySQL Orders",
        type="mysql", connection_config={"host": "db.example.com", "port": 3306},
        status="connected",
    )
    sql.put_source(_TENANT_A, src)

    fetched = sql.get_source(_TENANT_A, "src-1")
    assert fetched is not None
    assert fetched.name == "MySQL Orders"
    assert fetched.type == "mysql"
    assert fetched.connection_config == {"host": "db.example.com", "port": 3306}
    assert fetched.status == "connected"


def test_list_sources_filters_by_type() -> None:
    sql.put_source(_TENANT_A, mem.DataSource(
        id="src-mysql", tenant_id=_TENANT_A, name="MySQL",
        type="mysql",
    ))
    sql.put_source(_TENANT_A, mem.DataSource(
        id="src-kafka", tenant_id=_TENANT_A, name="Kafka",
        type="kafka",
    ))

    mysql_only = sql.list_sources(_TENANT_A, type_filter="mysql")
    assert [s.id for s in mysql_only] == ["src-mysql"]


def test_delete_source() -> None:
    sql.put_source(_TENANT_A, mem.DataSource(
        id="src-del", tenant_id=_TENANT_A, name="Del",
        type="mysql",
    ))
    assert sql.delete_source(_TENANT_A, "src-del") is True
    assert sql.get_source(_TENANT_A, "src-del") is None


def test_delete_source_rejects_cross_tenant() -> None:
    sql.put_source(_TENANT_A, mem.DataSource(
        id="src-x", tenant_id=_TENANT_A, name="X",
        type="mysql",
    ))
    assert sql.delete_source(_TENANT_B, "src-x") is False


# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------
def test_seed_from_inmemory() -> None:
    counts = sql.seed_from_inmemory(_TENANT_A)
    assert counts["cdc_tasks"] >= 3
    assert counts["sources"] >= 3
    # The seeded data is queryable via the SQL store
    assert len(sql.list_cdc_tasks(_TENANT_A)) >= 3
    assert len(sql.list_sources(_TENANT_A)) >= 3
