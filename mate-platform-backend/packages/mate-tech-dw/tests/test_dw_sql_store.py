"""Tests for mate_tech_dw.repositories.sql_store — SQL persistence (P3-W3 TD-5).

Uses SQLite in-memory + Base.metadata.create_all to verify the SQL
store's CRUD + tenant isolation for all 14 dw entities.
"""
from __future__ import annotations

# Tenant-scoped employee id constants (matches seed _emp_id)
ACME_E1 = "dw-emp-acme-1"
ACME_E2 = "dw-emp-acme-2"
ACME_E3 = "dw-emp-acme-3"
ACME_E4 = "dw-emp-acme-4"
ACME_E5 = "dw-emp-acme-5"
ACME_E6 = "dw-emp-acme-6"
ACME_E7 = "dw-emp-acme-7"
GLOBEX_E1 = "dw-emp-globex-1"
GLOBEX_E2 = "dw-emp-globex-2"

import pytest

from mate_tech_db.base import Base, create_all, init_engine, reset_engine
from mate_tech_dw.repositories import in_memory as mem
from mate_tech_dw.repositories import sql_models as models  # noqa: F401
from mate_tech_dw.repositories import sql_store as sql


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
# Auth login round-trip
# ---------------------------------------------------------------------------
def test_put_and_get_auth_login() -> None:
    entity = mem.DwAuthLogin(
        id="dw-auth-x", tenant_id=_TENANT_A, employee_id=ACME_E1,
        login_at="2026-08-01T09:00:00Z", ip="10.0.0.1", status="success",
    )
    sql.put_auth_login(_TENANT_A, entity)

    fetched = sql.get_auth_login(_TENANT_A, "dw-auth-x")
    assert fetched is not None
    assert fetched.id == "dw-auth-x"
    assert fetched.employee_id == ACME_E1
    assert fetched.login_at == "2026-08-01T09:00:00Z"
    assert fetched.ip == "10.0.0.1"
    assert fetched.status == "success"


# ---------------------------------------------------------------------------
# Collaboration round-trip
# ---------------------------------------------------------------------------
def test_put_and_get_collaboration() -> None:
    entity = mem.DwCollaboration(
        id="dw-collab-x", tenant_id=_TENANT_A, employee_id=ACME_E1,
        peer_employee_id=ACME_E2, session_id="sess-x",
        started_at="2026-08-01T10:00:00Z", duration_ms=180_000,
    )
    sql.put_collaboration(_TENANT_A, entity)

    fetched = sql.get_collaboration(_TENANT_A, "dw-collab-x")
    assert fetched is not None
    assert fetched.peer_employee_id == ACME_E2
    assert fetched.session_id == "sess-x"
    assert fetched.duration_ms == 180_000


# ---------------------------------------------------------------------------
# Commit round-trip
# ---------------------------------------------------------------------------
def test_put_and_get_commit() -> None:
    entity = mem.DwCommit(
        id="dw-commit-x", tenant_id=_TENANT_A, employee_id=ACME_E1,
        scope="kb", target_id="kb-doc-1", summary="test summary",
        committed_at="2026-08-01T11:00:00Z",
    )
    sql.put_commit(_TENANT_A, entity)

    fetched = sql.get_commit(_TENANT_A, "dw-commit-x")
    assert fetched is not None
    assert fetched.scope == "kb"
    assert fetched.target_id == "kb-doc-1"
    assert fetched.summary == "test summary"


# ---------------------------------------------------------------------------
# Document round-trip
# ---------------------------------------------------------------------------
def test_put_and_get_document() -> None:
    entity = mem.DwDocument(
        id="dw-doc-x", tenant_id=_TENANT_A, name="report.pdf",
        kind="pdf", size_bytes=1_024, uploaded_by=ACME_E1,
        uploaded_at="2026-08-01T12:00:00Z", kb_id="dw-kb-1",
    )
    sql.put_document(_TENANT_A, entity)

    fetched = sql.get_document(_TENANT_A, "dw-doc-x")
    assert fetched is not None
    assert fetched.name == "report.pdf"
    assert fetched.kind == "pdf"
    assert fetched.size_bytes == 1_024
    assert fetched.kb_id == "dw-kb-1"


# ---------------------------------------------------------------------------
# Employee round-trip (includes tuple field kb_ids)
# ---------------------------------------------------------------------------
def test_put_and_get_employee_with_kb_ids() -> None:
    entity = mem.DwEmployee(
        id="dw-emp-x", tenant_id=_TENANT_A, name="Test Agent",
        code="EMP-T-001", role="ontology", status="active",
        model_id="model-openai", kb_ids=("dw-kb-1", "dw-kb-2", "dw-kb-3"),
    )
    sql.put_employee(_TENANT_A, entity)

    fetched = sql.get_employee(_TENANT_A, "dw-emp-x")
    assert fetched is not None
    assert fetched.name == "Test Agent"
    assert fetched.code == "EMP-T-001"
    assert fetched.role == "ontology"
    assert fetched.model_id == "model-openai"
    assert fetched.kb_ids == ("dw-kb-1", "dw-kb-2", "dw-kb-3")


def test_put_employee_empty_kb_ids() -> None:
    entity = mem.DwEmployee(
        id="dw-emp-y", tenant_id=_TENANT_A, name="No KB",
        code="EMP-T-002", role="workflow", status="idle",
        model_id="model-doubao",
    )
    sql.put_employee(_TENANT_A, entity)

    fetched = sql.get_employee(_TENANT_A, "dw-emp-y")
    assert fetched is not None
    assert fetched.kb_ids == ()


# ---------------------------------------------------------------------------
# Employee task round-trip (includes nullable finished_at)
# ---------------------------------------------------------------------------
def test_put_and_get_employee_task_with_finished_at() -> None:
    entity = mem.DwEmployeeTask(
        id="dw-task-x", tenant_id=_TENANT_A, employee_id=ACME_E1,
        title="Completed task", status="success",
        started_at="2026-08-01T13:00:00Z",
        finished_at="2026-08-01T13:05:00Z", duration_ms=300_000,
    )
    sql.put_employee_task(_TENANT_A, entity)

    fetched = sql.get_employee_task(_TENANT_A, "dw-task-x")
    assert fetched is not None
    assert fetched.title == "Completed task"
    assert fetched.status == "success"
    assert fetched.finished_at == "2026-08-01T13:05:00Z"
    assert fetched.duration_ms == 300_000


def test_put_employee_task_null_finished_at() -> None:
    entity = mem.DwEmployeeTask(
        id="dw-task-y", tenant_id=_TENANT_A, employee_id=ACME_E1,
        title="Running task", status="running",
        started_at="2026-08-01T14:00:00Z",
    )
    sql.put_employee_task(_TENANT_A, entity)

    fetched = sql.get_employee_task(_TENANT_A, "dw-task-y")
    assert fetched is not None
    assert fetched.finished_at is None
    assert fetched.duration_ms == 0


# ---------------------------------------------------------------------------
# Evaluation round-trip (includes float + bool)
# ---------------------------------------------------------------------------
def test_put_and_get_evaluation() -> None:
    entity = mem.DwEvaluation(
        id="dw-eval-x", tenant_id=_TENANT_A, employee_id=ACME_E1,
        qa_set_id="qa-1", score=92.5, passed=True,
        evaluated_at="2026-08-01T15:00:00Z",
    )
    sql.put_evaluation(_TENANT_A, entity)

    fetched = sql.get_evaluation(_TENANT_A, "dw-eval-x")
    assert fetched is not None
    assert fetched.qa_set_id == "qa-1"
    assert fetched.score == 92.5
    assert fetched.passed is True


def test_put_evaluation_failed() -> None:
    entity = mem.DwEvaluation(
        id="dw-eval-y", tenant_id=_TENANT_A, employee_id=ACME_E2,
        qa_set_id="qa-2", score=55.0, passed=False,
        evaluated_at="2026-08-01T15:30:00Z",
    )
    sql.put_evaluation(_TENANT_A, entity)

    fetched = sql.get_evaluation(_TENANT_A, "dw-eval-y")
    assert fetched is not None
    assert fetched.score == 55.0
    assert fetched.passed is False


# ---------------------------------------------------------------------------
# Extract round-trip
# ---------------------------------------------------------------------------
def test_put_and_get_extract() -> None:
    entity = mem.DwExtract(
        id="dw-extract-x", tenant_id=_TENANT_A, employee_id=ACME_E1,
        source="kb", source_id="dw-kb-1", extracted_facts=42,
        extracted_at="2026-08-01T16:00:00Z",
    )
    sql.put_extract(_TENANT_A, entity)

    fetched = sql.get_extract(_TENANT_A, "dw-extract-x")
    assert fetched is not None
    assert fetched.source == "kb"
    assert fetched.source_id == "dw-kb-1"
    assert fetched.extracted_facts == 42


# ---------------------------------------------------------------------------
# Knowledge base round-trip
# ---------------------------------------------------------------------------
def test_put_and_get_knowledge_base() -> None:
    entity = mem.DwKnowledgeBase(
        id="dw-kb-x", tenant_id=_TENANT_A, name="Test KB",
        code="kb-test", docs=100, vectors=4096, owner=ACME_E1,
        updated_at="2026-08-01T09:00:00Z",
    )
    sql.put_knowledge_base(_TENANT_A, entity)

    fetched = sql.get_knowledge_base(_TENANT_A, "dw-kb-x")
    assert fetched is not None
    assert fetched.name == "Test KB"
    assert fetched.code == "kb-test"
    assert fetched.docs == 100
    assert fetched.vectors == 4096


# ---------------------------------------------------------------------------
# Learning extract round-trip
# ---------------------------------------------------------------------------
def test_put_and_get_learning_extract() -> None:
    entity = mem.DwLearningExtract(
        id="dw-learn-ext-x", tenant_id=_TENANT_A, employee_id=ACME_E1,
        scenario="cs-refund", extracted_at="2026-08-01T17:00:00Z", facts=7,
    )
    sql.put_learning_extract(_TENANT_A, entity)

    fetched = sql.get_learning_extract(_TENANT_A, "dw-learn-ext-x")
    assert fetched is not None
    assert fetched.scenario == "cs-refund"
    assert fetched.facts == 7


# ---------------------------------------------------------------------------
# Learning feedback round-trip
# ---------------------------------------------------------------------------
def test_put_and_get_learning_feedback() -> None:
    entity = mem.DwLearningFeedback(
        id="dw-learn-fb-x", tenant_id=_TENANT_A, employee_id=ACME_E1,
        scenario="cs-refund", rating=5, comment="great",
        feedback_at="2026-08-01T18:00:00Z",
    )
    sql.put_learning_feedback(_TENANT_A, entity)

    fetched = sql.get_learning_feedback(_TENANT_A, "dw-learn-fb-x")
    assert fetched is not None
    assert fetched.rating == 5
    assert fetched.comment == "great"


# ---------------------------------------------------------------------------
# Model round-trip (includes bool)
# ---------------------------------------------------------------------------
def test_put_and_get_model() -> None:
    entity = mem.DwModel(
        id="dw-model-x", tenant_id=_TENANT_A, provider="openai",
        model_id="gpt-4o", display_name="GPT-4o",
        modality="multimodal", enabled=True,
    )
    sql.put_model(_TENANT_A, entity)

    fetched = sql.get_model(_TENANT_A, "dw-model-x")
    assert fetched is not None
    assert fetched.provider == "openai"
    assert fetched.model_id == "gpt-4o"
    assert fetched.display_name == "GPT-4o"
    assert fetched.enabled is True


def test_put_model_disabled() -> None:
    entity = mem.DwModel(
        id="dw-model-y", tenant_id=_TENANT_A, provider="anthropic",
        model_id="claude-3", display_name="Claude 3",
        modality="text", enabled=False,
    )
    sql.put_model(_TENANT_A, entity)

    fetched = sql.get_model(_TENANT_A, "dw-model-y")
    assert fetched is not None
    assert fetched.enabled is False


# ---------------------------------------------------------------------------
# Tool round-trip (includes bool + int)
# ---------------------------------------------------------------------------
def test_put_and_get_tool() -> None:
    entity = mem.DwTool(
        id="dw-tool-x", tenant_id=_TENANT_A, name="Search",
        code="kb-search", kind="mcp", enabled=True, invocations=1280,
    )
    sql.put_tool(_TENANT_A, entity)

    fetched = sql.get_tool(_TENANT_A, "dw-tool-x")
    assert fetched is not None
    assert fetched.code == "kb-search"
    assert fetched.kind == "mcp"
    assert fetched.enabled is True
    assert fetched.invocations == 1280


# ---------------------------------------------------------------------------
# Trace round-trip
# ---------------------------------------------------------------------------
def test_put_and_get_trace() -> None:
    entity = mem.DwTrace(
        id="dw-trace-x", tenant_id=_TENANT_A, employee_id=ACME_E1,
        trace_id="trace-x", span_count=15, status="ok",
        duration_ms=1500, started_at="2026-08-01T10:00:00Z",
    )
    sql.put_trace(_TENANT_A, entity)

    fetched = sql.get_trace(_TENANT_A, "dw-trace-x")
    assert fetched is not None
    assert fetched.trace_id == "trace-x"
    assert fetched.span_count == 15
    assert fetched.status == "ok"
    assert fetched.duration_ms == 1500


# ---------------------------------------------------------------------------
# Upsert test
# ---------------------------------------------------------------------------
def test_put_employee_upsert() -> None:
    entity = mem.DwEmployee(
        id="dw-emp-up", tenant_id=_TENANT_A, name="Before",
        code="EMP-UP-001", role="ontology", status="active",
        model_id="model-openai", kb_ids=("dw-kb-1",),
    )
    sql.put_employee(_TENANT_A, entity)

    updated = mem.DwEmployee(
        id="dw-emp-up", tenant_id=_TENANT_A, name="After",
        code="EMP-UP-001", role="app", status="idle",
        model_id="model-anthropic", kb_ids=("dw-kb-2", "dw-kb-3"),
    )
    sql.put_employee(_TENANT_A, updated)

    fetched = sql.get_employee(_TENANT_A, "dw-emp-up")
    assert fetched is not None
    assert fetched.name == "After"
    assert fetched.role == "app"
    assert fetched.status == "idle"
    assert fetched.model_id == "model-anthropic"
    assert fetched.kb_ids == ("dw-kb-2", "dw-kb-3")


# ---------------------------------------------------------------------------
# Tenant isolation
# ---------------------------------------------------------------------------
def test_tenant_isolation_employees() -> None:
    sql.put_employee(_TENANT_A, mem.DwEmployee(
        id="dw-emp-a", tenant_id=_TENANT_A, name="A Employee",
        code="EMP-A-001", role="ontology", status="active",
        model_id="model-openai",
    ))
    sql.put_employee(_TENANT_B, mem.DwEmployee(
        id="dw-emp-b", tenant_id=_TENANT_B, name="B Employee",
        code="EMP-B-001", role="workflow", status="active",
        model_id="model-anthropic",
    ))

    a_emps = sql.list_employees(_TENANT_A)
    assert [e.id for e in a_emps] == ["dw-emp-a"]

    b_emps = sql.list_employees(_TENANT_B)
    assert [e.id for e in b_emps] == ["dw-emp-b"]

    # Cross-tenant get returns None
    assert sql.get_employee(_TENANT_A, "dw-emp-b") is None
    assert sql.get_employee(_TENANT_B, "dw-emp-a") is None


def test_tenant_isolation_traces_and_tools() -> None:
    sql.put_trace(_TENANT_A, mem.DwTrace(
        id="dw-trace-a", tenant_id=_TENANT_A, employee_id=ACME_E1,
        trace_id="trace-a", span_count=5, status="ok",
        duration_ms=500, started_at="2026-08-01T10:00:00Z",
    ))
    sql.put_trace(_TENANT_B, mem.DwTrace(
        id="dw-trace-b", tenant_id=_TENANT_B, employee_id=ACME_E2,
        trace_id="trace-b", span_count=10, status="error",
        duration_ms=1000, started_at="2026-08-01T11:00:00Z",
    ))
    sql.put_tool(_TENANT_A, mem.DwTool(
        id="dw-tool-a", tenant_id=_TENANT_A, name="A Tool",
        code="tool-a", kind="function",
    ))
    sql.put_tool(_TENANT_B, mem.DwTool(
        id="dw-tool-b", tenant_id=_TENANT_B, name="B Tool",
        code="tool-b", kind="mcp",
    ))

    assert [t.id for t in sql.list_traces(_TENANT_A)] == ["dw-trace-a"]
    assert [t.id for t in sql.list_traces(_TENANT_B)] == ["dw-trace-b"]
    assert [t.id for t in sql.list_tools(_TENANT_A)] == ["dw-tool-a"]
    assert [t.id for t in sql.list_tools(_TENANT_B)] == ["dw-tool-b"]


# ---------------------------------------------------------------------------
# Anonymous tenant guard
# ---------------------------------------------------------------------------
def test_anonymous_tenant_returns_empty() -> None:
    assert sql.list_employees("") == []
    assert sql.list_traces("") == []
    assert sql.get_employee("", "any") is None
    assert sql.get_trace("", "any") is None


# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------
def test_seed_from_inmemory() -> None:
    counts = sql.seed_from_inmemory(_TENANT_A)
    assert counts["auth_logins"] >= 3
    assert counts["collaborations"] >= 4
    assert counts["commits"] >= 5
    assert counts["documents"] >= 8
    assert counts["employees"] >= 6
    assert counts["employee_tasks"] >= 12
    assert counts["evaluations"] >= 4
    assert counts["extracts"] >= 5
    assert counts["knowledge_bases"] >= 5
    assert counts["learning_extracts"] >= 6
    assert counts["learning_feedback"] >= 6
    assert counts["models"] >= 5
    assert counts["tools"] >= 8
    assert counts["traces"] >= 10

    # The seeded data is queryable via the SQL store
    assert len(sql.list_employees(_TENANT_A)) >= 6
    assert len(sql.list_traces(_TENANT_A)) >= 10

    # Tenant B sees nothing (seed only populated A)
    assert sql.list_employees(_TENANT_B) == []
    assert sql.list_traces(_TENANT_B) == []

    # Verify tuple field round-trip through seed
    emps = sql.list_employees(_TENANT_A)
    emp4 = [e for e in emps if e.id == ACME_E4][0]
    assert emp4.kb_ids == ("dw-kb-1", "dw-kb-2")