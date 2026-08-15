"""Integration tests for mate_tech_dw SQL persistence (DW_STORE=sql).

Complements test_dw_sql_store.py (read + put_* round-trips) by covering
the in_memory-compatible write surface the API layer depends on:

  - employee CRUD (create / partial update / delete, extended capability
    fields incl. system_prompt / tools / action_rids / temperature)
  - document append / delete
  - learning feedback append + update (promote 字段回填)
  - conversation + message sequence (atomic next_employee_message_sequence)
  - the repositories selection layer routing on DW_STORE=sql

Uses SQLite in-memory + Base.metadata.create_all, same as the sibling
suite. The default test run keeps DW_STORE unset (memory mode), so this
file exercises sql_store directly and reloads the repositories package
under DW_STORE=sql for the routing check.
"""
from __future__ import annotations

import importlib

import pytest
from mate_tech_dw import repositories as repos
from mate_tech_dw.repositories import in_memory as mem
from mate_tech_dw.repositories import sql_models as models  # noqa: F401
from mate_tech_dw.repositories import sql_store as sql

from mate_tech_db.base import create_all, init_engine, reset_engine


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
ACME_E1 = "dw-emp-acme-1"


# ---------------------------------------------------------------------------
# Employee CRUD (extended capability fields round-trip)
# ---------------------------------------------------------------------------
def test_create_employee_persists_capability_fields() -> None:
    emp = mem.DwEmployee(
        id="dw-emp-crud-1", tenant_id=_TENANT_A, name="定制员工",
        code="EMP-X-0001", role="CUSTOM", status="active",
        model_id="model-doubao", kb_ids=("dw-kb-1", "dw-kb-2"),
        system_prompt="你是定制数字员工", tools=("kb-search", "sql-exec"),
        action_rids=("ont.acme.actionType.ping.v1",),
        temperature=0.3, max_tokens=2048, top_p=0.8,
        retrieval_method="vector", top_k=8, rerank=False,
    )
    created = sql.create_employee(_TENANT_A, emp)
    assert created.id == "dw-emp-crud-1"

    fetched = sql.get_employee(_TENANT_A, "dw-emp-crud-1")
    assert fetched is not None
    assert fetched.name == "定制员工"
    assert fetched.role == "CUSTOM"
    assert fetched.kb_ids == ("dw-kb-1", "dw-kb-2")
    assert fetched.system_prompt == "你是定制数字员工"
    assert fetched.tools == ("kb-search", "sql-exec")
    assert fetched.action_rids == ("ont.acme.actionType.ping.v1",)
    assert fetched.temperature == pytest.approx(0.3)
    assert fetched.max_tokens == 2048
    assert fetched.top_p == pytest.approx(0.8)
    assert fetched.retrieval_method == "vector"
    assert fetched.top_k == 8
    assert fetched.rerank is False
    assert fetched in sql.list_employees(_TENANT_A)


def test_create_employee_requires_tenant() -> None:
    emp = mem.DwEmployee(
        id="dw-emp-crud-2", tenant_id="", name="x", code="EMP-X-0002",
        role="CUSTOM", status="active", model_id="model-openai",
    )
    with pytest.raises(ValueError):
        sql.create_employee("", emp)


def test_update_employee_partial_patch() -> None:
    emp = mem.DwEmployee(
        id="dw-emp-crud-3", tenant_id=_TENANT_A, name="Before",
        code="EMP-X-0003", role="workflow", status="active",
        model_id="model-openai", kb_ids=("dw-kb-1",),
        system_prompt="old prompt", temperature=0.7,
    )
    sql.create_employee(_TENANT_A, emp)

    updated = sql.update_employee(
        _TENANT_A, "dw-emp-crud-3",
        name="After", status="idle", system_prompt="new prompt",
        tools=("mail-send",), temperature=0.1, rerank=False,
    )
    assert updated is not None
    assert updated.name == "After"
    assert updated.status == "idle"
    assert updated.system_prompt == "new prompt"
    assert updated.tools == ("mail-send",)
    assert updated.temperature == pytest.approx(0.1)
    assert updated.rerank is False
    # Untouched fields keep their stored values (partial patch semantics).
    assert updated.role == "workflow"
    assert updated.code == "EMP-X-0003"
    assert updated.kb_ids == ("dw-kb-1",)
    assert updated.model_id == "model-openai"

    # Persisted — a fresh read sees the same state.
    refetched = sql.get_employee(_TENANT_A, "dw-emp-crud-3")
    assert refetched is not None
    assert refetched.name == "After"
    assert refetched.system_prompt == "new prompt"


def test_update_employee_missing_returns_none() -> None:
    assert sql.update_employee(_TENANT_A, "dw-emp-nope", name="x") is None
    assert sql.update_employee("", "dw-emp-crud-3", name="x") is None
    # Cross-tenant update is invisible (tenant-scoped lookup).
    sql.create_employee(_TENANT_A, mem.DwEmployee(
        id="dw-emp-crud-4", tenant_id=_TENANT_A, name="A", code="EMP-X-0004",
        role="app", status="active", model_id="model-openai",
    ))
    assert sql.update_employee(_TENANT_B, "dw-emp-crud-4", name="stolen") is None


def test_delete_employee() -> None:
    sql.create_employee(_TENANT_A, mem.DwEmployee(
        id="dw-emp-crud-5", tenant_id=_TENANT_A, name="Doomed",
        code="EMP-X-0005", role="obs", status="active", model_id="model-qwen",
    ))
    assert sql.delete_employee(_TENANT_A, "dw-emp-crud-5") is True
    assert sql.get_employee(_TENANT_A, "dw-emp-crud-5") is None
    assert sql.delete_employee(_TENANT_A, "dw-emp-crud-5") is False
    # Cross-tenant delete cannot remove another tenant's row.
    sql.create_employee(_TENANT_A, mem.DwEmployee(
        id="dw-emp-crud-6", tenant_id=_TENANT_A, name="Keep",
        code="EMP-X-0006", role="obs", status="active", model_id="model-qwen",
    ))
    assert sql.delete_employee(_TENANT_B, "dw-emp-crud-6") is False
    assert sql.get_employee(_TENANT_A, "dw-emp-crud-6") is not None


# ---------------------------------------------------------------------------
# Document append / delete
# ---------------------------------------------------------------------------
def test_append_and_delete_document() -> None:
    doc = mem.DwDocument(
        id="dw-doc-crud-1", tenant_id=_TENANT_A, name="上传手册.pdf",
        kind="pdf", size_bytes=2048, uploaded_by=ACME_E1,
        uploaded_at="2026-08-16T09:00:00Z", kb_id="dw-kb-1",
        document_id="rag-doc-1", chunk_count=3,
    )
    appended = sql.append_document(_TENANT_A, doc)
    assert appended.id == "dw-doc-crud-1"
    listed = sql.list_documents(_TENANT_A)
    assert [d.id for d in listed] == ["dw-doc-crud-1"]
    assert listed[0].document_id == "rag-doc-1"
    assert listed[0].chunk_count == 3

    assert sql.delete_document(_TENANT_A, "dw-doc-crud-1") is True
    assert sql.list_documents(_TENANT_A) == []
    assert sql.delete_document(_TENANT_A, "dw-doc-crud-1") is False

    # Cross-tenant delete cannot touch another tenant's document.
    sql.append_document(_TENANT_A, mem.DwDocument(
        id="dw-doc-crud-2", tenant_id=_TENANT_A, name="keep.md",
        kind="md", size_bytes=10, uploaded_by=ACME_E1,
        uploaded_at="2026-08-16T09:05:00Z", kb_id="dw-kb-1",
    ))
    assert sql.delete_document(_TENANT_B, "dw-doc-crud-2") is False
    assert [d.id for d in sql.list_documents(_TENANT_A)] == ["dw-doc-crud-2"]


def test_append_document_requires_tenant() -> None:
    with pytest.raises(ValueError):
        sql.append_document("", mem.DwDocument(
            id="dw-doc-x", tenant_id="", name="x", kind="md",
            size_bytes=1, uploaded_by="u", uploaded_at="t", kb_id="k",
        ))


# ---------------------------------------------------------------------------
# Learning feedback: append + update (promote 字段回填)
# ---------------------------------------------------------------------------
def test_learning_feedback_promote_writeback() -> None:
    fb = mem.DwLearningFeedback(
        id="dw-learn-fb-crud-1", tenant_id=_TENANT_A, employee_id=ACME_E1,
        scenario="cs-refund", rating=5, comment="处理准确",
        feedback_at="2026-08-16T10:00:00Z",
    )
    sql.append_learning_feedback(_TENANT_A, fb)
    fetched = sql.get_learning_feedback(_TENANT_A, "dw-learn-fb-crud-1")
    assert fetched is not None
    assert fetched.promoted_document_id == ""
    assert fetched.promoted_at == ""

    # P2.10 promote write-back: promoted_document_id + promoted_at persist.
    updated = sql.update_learning_feedback(
        _TENANT_A, "dw-learn-fb-crud-1",
        promoted_document_id="dw-fb-tenant-acme-dw-learn-fb-crud-1",
        promoted_at="2026-08-16T10:05:00Z",
    )
    assert updated is not None
    assert updated.promoted_document_id == "dw-fb-tenant-acme-dw-learn-fb-crud-1"
    assert updated.promoted_at == "2026-08-16T10:05:00Z"
    # Rating / comment untouched.
    assert updated.rating == 5
    assert updated.comment == "处理准确"

    # Persisted — a fresh read sees the promoted fields.
    refetched = sql.get_learning_feedback(_TENANT_A, "dw-learn-fb-crud-1")
    assert refetched is not None
    assert refetched.promoted_document_id.startswith("dw-fb-")
    assert refetched.promoted_at == "2026-08-16T10:05:00Z"


def test_update_learning_feedback_missing_returns_none() -> None:
    assert sql.update_learning_feedback(_TENANT_A, "nope", promoted_at="t") is None
    assert sql.update_learning_feedback("", "x", promoted_at="t") is None
    # Unknown kwargs are ignored, missing row returns None.
    assert sql.update_learning_feedback(_TENANT_B, "nope", bogus="v") is None


def test_append_learning_feedback_requires_tenant() -> None:
    with pytest.raises(ValueError):
        sql.append_learning_feedback("", mem.DwLearningFeedback(
            id="dw-learn-fb-x", tenant_id="", employee_id="e",
            scenario="s", rating=3, comment="", feedback_at="t",
        ))


# ---------------------------------------------------------------------------
# Conversation / message sequence
# ---------------------------------------------------------------------------
def _conv(conv_id: str) -> mem.DwEmployeeConversation:
    return mem.DwEmployeeConversation(
        id=conv_id, tenant_id=_TENANT_A, user_id="u-1",
        employee_id=ACME_E1, title="会话",
        created_at="2026-08-16T11:00:00Z", updated_at="2026-08-16T11:00:00Z",
    )


def _msg(msg_id: str, conv_id: str, sequence: int, created_at: str) -> mem.DwEmployeeMessage:
    return mem.DwEmployeeMessage(
        id=msg_id, tenant_id=_TENANT_A, conversation_id=conv_id,
        role="user", content="你好", status="completed",
        model="model-doubao", sequence=sequence, created_at=created_at,
    )


def test_conversation_message_sequence_flow() -> None:
    sql.put_employee_conversation(_TENANT_A, _conv("dwe-conv-1"))

    # Empty conversation → next sequence is 1; unknown conversation → 1 too.
    assert sql.next_employee_message_sequence(_TENANT_A, "dwe-conv-1") == 1
    assert sql.next_employee_message_sequence(_TENANT_A, "dwe-conv-unknown") == 1

    seq1 = sql.next_employee_message_sequence(_TENANT_A, "dwe-conv-1")
    sql.put_employee_message(_TENANT_A, _msg("dwe-msg-1", "dwe-conv-1", seq1, "2026-08-16T11:01:00Z"))
    seq2 = sql.next_employee_message_sequence(_TENANT_A, "dwe-conv-1")
    sql.put_employee_message(_TENANT_A, _msg("dwe-msg-2", "dwe-conv-1", seq2, "2026-08-16T11:02:00Z"))
    assert (seq1, seq2) == (1, 2)

    # Strictly increasing, ordered by sequence.
    msgs = sql.list_employee_messages(_TENANT_A, "dwe-conv-1")
    assert [m.id for m in msgs] == ["dwe-msg-1", "dwe-msg-2"]
    assert [m.sequence for m in msgs] == [1, 2]
    assert sql.next_employee_message_sequence(_TENANT_A, "dwe-conv-1") == 3

    # put_employee_message touches the conversation updated_at (in_memory parity).
    conv = sql.get_employee_conversation(_TENANT_A, "dwe-conv-1")
    assert conv is not None
    assert conv.updated_at == "2026-08-16T11:02:00Z"

    # Sequence is per-conversation: a second conversation restarts at 1.
    sql.put_employee_conversation(_TENANT_A, _conv("dwe-conv-2"))
    assert sql.next_employee_message_sequence(_TENANT_A, "dwe-conv-2") == 1

    # Tenant isolation on messages.
    assert sql.list_employee_messages(_TENANT_B, "dwe-conv-1") == []


# ---------------------------------------------------------------------------
# Task / evaluation / collaboration append + update
# ---------------------------------------------------------------------------
def test_append_employee_task_and_update() -> None:
    task = mem.DwEmployeeTask(
        id="dw-task-crud-1", tenant_id=_TENANT_A, employee_id=ACME_E1,
        title="巡检任务", status="pending", started_at="2026-08-16T12:00:00Z",
    )
    sql.append_employee_task(_TENANT_A, task)

    # None kwargs keep the stored values (pending -> running transition).
    running = sql.update_employee_task(_TENANT_A, "dw-task-crud-1", status="running")
    assert running is not None
    assert running.status == "running"
    assert running.finished_at is None
    assert running.duration_ms == 0

    # running -> success sets finished_at + duration.
    done = sql.update_employee_task(
        _TENANT_A, "dw-task-crud-1", status="success",
        finished_at="2026-08-16T12:05:00Z", duration_ms=300_000,
    )
    assert done is not None
    assert done.status == "success"
    assert done.finished_at == "2026-08-16T12:05:00Z"
    assert done.duration_ms == 300_000
    assert [t.id for t in sql.list_employee_tasks(_TENANT_A)] == ["dw-task-crud-1"]

    assert sql.update_employee_task(_TENANT_A, "nope", status="running") is None
    assert sql.update_employee_task(_TENANT_B, "dw-task-crud-1", status="failed") is None
    with pytest.raises(ValueError):
        sql.append_employee_task("", task)


def test_append_evaluation_persists() -> None:
    ev = mem.DwEvaluation(
        id="dw-eval-crud-1", tenant_id=_TENANT_A, employee_id=ACME_E1,
        qa_set_id="qa-cs-1", score=92.5, passed=True,
        evaluated_at="2026-08-16T13:00:00Z",
    )
    sql.append_evaluation(_TENANT_A, ev)
    assert [e.id for e in sql.list_evaluations(_TENANT_A)] == ["dw-eval-crud-1"]
    assert sql.list_evaluations(_TENANT_B) == []
    with pytest.raises(ValueError):
        sql.append_evaluation("", ev)


def test_append_collaboration_persists() -> None:
    collab = mem.DwCollaboration(
        id="dw-collab-crud-1", tenant_id=_TENANT_A, employee_id=ACME_E1,
        peer_employee_id="dw-emp-acme-2", session_id="sess-crud-1",
        started_at="2026-08-16T14:00:00Z", duration_ms=60_000,
    )
    sql.append_collaboration(_TENANT_A, collab)
    assert [c.id for c in sql.list_collaborations(_TENANT_A)] == ["dw-collab-crud-1"]
    assert sql.list_collaborations(_TENANT_B) == []
    with pytest.raises(ValueError):
        sql.append_collaboration("", collab)


# ---------------------------------------------------------------------------
# Selection layer: DW_STORE=sql routes the repositories package to sql_store
# ---------------------------------------------------------------------------
def test_dw_store_sql_routes_repositories_to_sql_store(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DW_STORE", "sql")
    try:
        reloaded = importlib.reload(repos)
        # Function identity: the exported surface must come from sql_store.
        assert reloaded.create_employee is sql.create_employee
        assert reloaded.update_employee is sql.update_employee
        assert reloaded.delete_employee is sql.delete_employee
        assert reloaded.append_document is sql.append_document
        assert reloaded.delete_document is sql.delete_document
        assert reloaded.update_learning_feedback is sql.update_learning_feedback
        assert reloaded.next_employee_message_sequence is (
            sql.next_employee_message_sequence
        )
        assert callable(reloaded.seed_from_inmemory)

        # End-to-end through the selection layer (sqlite engine from fixture).
        emp = mem.DwEmployee(
            id="dw-emp-route-1", tenant_id=_TENANT_A, name="路由验证",
            code="EMP-X-0007", role="CUSTOM", status="active",
            model_id="model-openai",
        )
        assert reloaded.create_employee(_TENANT_A, emp).id == "dw-emp-route-1"
        assert reloaded.get_employee(_TENANT_A, "dw-emp-route-1") is not None
        assert reloaded.delete_employee(_TENANT_A, "dw-emp-route-1") is True
    finally:
        monkeypatch.delenv("DW_STORE", raising=False)
        importlib.reload(repos)
        assert repos.create_employee is mem.create_employee  # memory mode restored
