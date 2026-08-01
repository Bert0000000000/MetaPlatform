"""Tests for mate_tech_metrics.repositories.sql_store — SQL persistence (P3-W2)."""
from __future__ import annotations

import pytest

from mate_tech_db.base import create_all, init_engine, reset_engine
from mate_tech_metrics.repositories import in_memory as mem
from mate_tech_metrics.repositories import sql_models as models  # noqa: F401
from mate_tech_metrics.repositories import sql_store as sql


@pytest.fixture(autouse=True)
def _fresh_db() -> None:
    reset_engine()
    init_engine("sqlite:///:memory:")
    create_all()
    yield
    reset_engine()


_TENANT_A = "tenant-acme"
_TENANT_B = "tenant-bigo"


def test_put_and_get_metric() -> None:
    m = mem.Metric(
        id="mtc-1", tenant_id=_TENANT_A, name="Daily Revenue",
        expression="SUM(orders.amount)", status="active",
        description="Revenue", config={"unit": "currency"},
    )
    sql.put_metric(_TENANT_A, m)

    fetched = sql.get_metric(_TENANT_A, "mtc-1")
    assert fetched is not None
    assert fetched.name == "Daily Revenue"
    assert fetched.expression == "SUM(orders.amount)"
    assert fetched.config == {"unit": "currency"}


def test_put_metric_upsert() -> None:
    m = mem.Metric(
        id="mtc-2", tenant_id=_TENANT_A, name="Active Users",
        expression="COUNT(DISTINCT users.id)",
    )
    sql.put_metric(_TENANT_A, m)
    m.status = "retired"
    m.description = "Deprecated"
    sql.put_metric(_TENANT_A, m)

    fetched = sql.get_metric(_TENANT_A, "mtc-2")
    assert fetched is not None
    assert fetched.status == "retired"
    assert fetched.description == "Deprecated"


def test_list_metrics_tenant_isolation() -> None:
    sql.put_metric(_TENANT_A, mem.Metric(
        id="mtc-a", tenant_id=_TENANT_A, name="A",
        expression="1",
    ))
    sql.put_metric(_TENANT_B, mem.Metric(
        id="mtc-b", tenant_id=_TENANT_B, name="B",
        expression="1",
    ))
    assert [m.id for m in sql.list_metrics(_TENANT_A)] == ["mtc-a"]
    assert [m.id for m in sql.list_metrics(_TENANT_B)] == ["mtc-b"]


def test_list_metrics_status_filter() -> None:
    sql.put_metric(_TENANT_A, mem.Metric(
        id="mtc-active", tenant_id=_TENANT_A, name="A",
        expression="1", status="active",
    ))
    sql.put_metric(_TENANT_A, mem.Metric(
        id="mtc-draft", tenant_id=_TENANT_A, name="D",
        expression="1", status="draft",
    ))
    active = sql.list_metrics(_TENANT_A, status="active")
    assert [m.id for m in active] == ["mtc-active"]


def test_delete_metric() -> None:
    sql.put_metric(_TENANT_A, mem.Metric(
        id="mtc-del", tenant_id=_TENANT_A, name="Del",
        expression="1",
    ))
    assert sql.delete_metric(_TENANT_A, "mtc-del") is True
    assert sql.get_metric(_TENANT_A, "mtc-del") is None
    assert sql.delete_metric(_TENANT_A, "mtc-del") is False


def test_delete_metric_rejects_cross_tenant() -> None:
    sql.put_metric(_TENANT_A, mem.Metric(
        id="mtc-x", tenant_id=_TENANT_A, name="X",
        expression="1",
    ))
    assert sql.delete_metric(_TENANT_B, "mtc-x") is False


def test_seed_from_inmemory() -> None:
    counts = sql.seed_from_inmemory(_TENANT_A)
    assert counts["metrics"] >= 3
    assert len(sql.list_metrics(_TENANT_A)) >= 3
