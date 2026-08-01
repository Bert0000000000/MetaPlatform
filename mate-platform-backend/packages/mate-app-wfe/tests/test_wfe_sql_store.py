"""Tests for mate_app_wfe.repositories.sql_store — SQL persistence (P3-W3).

Uses SQLite in-memory + Base.metadata.create_all to verify the SQL
store's CRUD + tenant isolation. The structural ``validate_bpmn`` check
stays in in_memory and is not exercised here.
"""
from __future__ import annotations

import pytest

from mate_tech_db.base import Base, create_all, init_engine, reset_engine
from mate_app_wfe.repositories import in_memory as mem
from mate_app_wfe.repositories import sql_models as models  # noqa: F401
from mate_app_wfe.repositories import sql_store as sql


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
# FlowDefinition round-trip
# ---------------------------------------------------------------------------
def test_put_and_get_flow() -> None:
    flow = mem.FlowDefinition(
        id="flow-1", tenant_id=_TENANT_A, name="Approval Flow",
        bpmn_xml="<bpmn:definitions/>", version="2.0", status="active",
    )
    sql.put_flow(_TENANT_A, flow)

    fetched = sql.get_flow(_TENANT_A, "flow-1")
    assert fetched is not None
    assert fetched.id == "flow-1"
    assert fetched.name == "Approval Flow"
    assert fetched.bpmn_xml == "<bpmn:definitions/>"
    assert fetched.version == "2.0"
    assert fetched.status == "active"


def test_put_flow_upsert() -> None:
    flow = mem.FlowDefinition(
        id="flow-2", tenant_id=_TENANT_A, name="Old Name",
        bpmn_xml="", version="1.0", status="draft",
    )
    sql.put_flow(_TENANT_A, flow)
    # Update in place
    flow = mem.FlowDefinition(
        id="flow-2", tenant_id=_TENANT_A, name="New Name",
        bpmn_xml="<bpmn:definitions/>", version="1.1", status="active",
    )
    sql.put_flow(_TENANT_A, flow)

    fetched = sql.get_flow(_TENANT_A, "flow-2")
    assert fetched is not None
    assert fetched.name == "New Name"
    assert fetched.bpmn_xml == "<bpmn:definitions/>"
    assert fetched.version == "1.1"
    assert fetched.status == "active"


# ---------------------------------------------------------------------------
# FlowValidation round-trip (tuple field)
# ---------------------------------------------------------------------------
def test_put_and_get_validation() -> None:
    val = mem.FlowValidation(
        id="val-1", tenant_id=_TENANT_A, flow_id="flow-1",
        valid=False,
        issues=("missing <definitions>", "missing <process>"),
        validated_at="2026-08-01T00:00:00Z",
    )
    sql.put_validation(_TENANT_A, val)

    fetched = sql.get_validation(_TENANT_A, "val-1")
    assert fetched is not None
    assert fetched.flow_id == "flow-1"
    assert fetched.valid is False
    assert fetched.issues == ("missing <definitions>", "missing <process>")
    assert fetched.validated_at == "2026-08-01T00:00:00Z"


# ---------------------------------------------------------------------------
# FlowTestRun round-trip (dict field + int field)
# ---------------------------------------------------------------------------
def test_put_and_get_test_run() -> None:
    run = mem.FlowTestRun(
        id="run-1", tenant_id=_TENANT_A, flow_id="flow-1",
        status="success", started_at="2026-08-01T00:00:00Z",
        finished_at="2026-08-01T00:00:05Z", duration_ms=5000,
        output={"steps": 3, "passed": 3},
    )
    sql.put_test_run(_TENANT_A, run)

    fetched = sql.get_test_run(_TENANT_A, "run-1")
    assert fetched is not None
    assert fetched.flow_id == "flow-1"
    assert fetched.status == "success"
    assert fetched.started_at == "2026-08-01T00:00:00Z"
    assert fetched.finished_at == "2026-08-01T00:00:05Z"
    assert fetched.duration_ms == 5000
    assert fetched.output == {"steps": 3, "passed": 3}


# ---------------------------------------------------------------------------
# Tenant isolation
# ---------------------------------------------------------------------------
def test_tenant_isolation() -> None:
    sql.put_flow(_TENANT_A, mem.FlowDefinition(
        id="flow-a", tenant_id=_TENANT_A, name="A Flow", bpmn_xml="",
    ))
    sql.put_flow(_TENANT_B, mem.FlowDefinition(
        id="flow-b", tenant_id=_TENANT_B, name="B Flow", bpmn_xml="",
    ))

    a_flows = sql.list_flows(_TENANT_A)
    assert [f.id for f in a_flows] == ["flow-a"]

    b_flows = sql.list_flows(_TENANT_B)
    assert [f.id for f in b_flows] == ["flow-b"]

    # Cross-tenant get returns None
    assert sql.get_flow(_TENANT_B, "flow-a") is None
    assert sql.get_flow(_TENANT_A, "flow-b") is None


def test_anonymous_tenant_returns_empty() -> None:
    assert sql.list_flows("") == []
    assert sql.list_validations("") == []
    assert sql.list_test_runs("") == []
    assert sql.get_flow("", "flow-1") is None
    assert sql.get_validation("", "val-1") is None
    assert sql.get_test_run("", "run-1") is None


# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------
def test_seed_from_inmemory() -> None:
    counts = sql.seed_from_inmemory(_TENANT_A)
    assert counts["flows"] >= 5
    assert counts["validations"] >= 5
    assert counts["test_runs"] >= 0
    # The seeded data is queryable via the SQL store
    assert len(sql.list_flows(_TENANT_A)) >= 5
    assert len(sql.list_validations(_TENANT_A)) >= 5
    # Seeded data is tenant-scoped
    assert sql.list_flows(_TENANT_B) == []
