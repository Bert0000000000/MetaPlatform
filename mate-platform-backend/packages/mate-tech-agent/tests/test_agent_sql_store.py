"""Tests for mate_tech_agent.repositories.sql_store — SQL persistence (P3-W4).

Uses SQLite in-memory + Base.metadata.create_all to verify the SQL
store's CRUD + tenant isolation + JSON serialisation (config, tool_calls).
"""
from __future__ import annotations

import pytest

from mate_tech_db.base import Base, create_all, init_engine, reset_engine
from mate_tech_agent.repositories import in_memory as mem
from mate_tech_agent.repositories import sql_models as models  # noqa: F401
from mate_tech_agent.repositories import sql_store as sql


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
# Agent round-trip
# ---------------------------------------------------------------------------
def test_put_and_get_agent() -> None:
    agent = mem.Agent(
        id="agent-1", tenant_id=_TENANT_A, name="Sales Bot",
        scenario="S1", model_id="gpt-4o", status="active",
        config={"temperature": 0.7, "top_p": 0.9},
        created_at="2026-08-01T00:00:00Z",
        updated_at="2026-08-01T00:00:00Z",
    )
    sql.put_agent(_TENANT_A, agent)

    fetched = sql.get_agent(_TENANT_A, "agent-1")
    assert fetched is not None
    assert fetched.id == "agent-1"
    assert fetched.name == "Sales Bot"
    assert fetched.scenario == "S1"
    assert fetched.model_id == "gpt-4o"
    assert fetched.status == "active"
    assert fetched.config == {"temperature": 0.7, "top_p": 0.9}
    assert fetched.created_at == "2026-08-01T00:00:00Z"


def test_put_agent_upsert() -> None:
    agent = mem.Agent(
        id="agent-2", tenant_id=_TENANT_A, name="Old",
        scenario="S2", model_id="claude-3-5-sonnet-20241022",
    )
    sql.put_agent(_TENANT_A, agent)
    # Update
    agent = mem.Agent(
        id="agent-2", tenant_id=_TENANT_A, name="New",
        scenario="S3", model_id="gpt-4o", status="draft",
        config={"max_tokens": 4096},
    )
    sql.put_agent(_TENANT_A, agent)

    fetched = sql.get_agent(_TENANT_A, "agent-2")
    assert fetched is not None
    assert fetched.name == "New"
    assert fetched.scenario == "S3"
    assert fetched.status == "draft"
    assert fetched.config == {"max_tokens": 4096}


def test_delete_agent() -> None:
    sql.put_agent(_TENANT_A, mem.Agent(
        id="agent-del", tenant_id=_TENANT_A, name="Del",
    ))
    assert sql.delete_agent(_TENANT_A, "agent-del") is True
    assert sql.get_agent(_TENANT_A, "agent-del") is None
    assert sql.delete_agent(_TENANT_A, "agent-del") is False


def test_delete_agent_rejects_cross_tenant() -> None:
    sql.put_agent(_TENANT_A, mem.Agent(
        id="agent-x", tenant_id=_TENANT_A, name="X",
    ))
    assert sql.delete_agent(_TENANT_B, "agent-x") is False
    assert sql.get_agent(_TENANT_A, "agent-x") is not None


# ---------------------------------------------------------------------------
# AgentSession round-trip
# ---------------------------------------------------------------------------
def test_put_and_get_session() -> None:
    ses = mem.AgentSession(
        id="ses-1", tenant_id=_TENANT_A, agent_id="agent-1",
        thread_id="thread-1", scenario="S1", status="active",
        created_at="2026-08-01T00:00:00Z",
        updated_at="2026-08-01T00:00:00Z",
    )
    sql.put_session(_TENANT_A, ses)

    fetched = sql.get_session(_TENANT_A, "ses-1")
    assert fetched is not None
    assert fetched.agent_id == "agent-1"
    assert fetched.thread_id == "thread-1"
    assert fetched.scenario == "S1"
    assert fetched.status == "active"


def test_delete_session() -> None:
    sql.put_session(_TENANT_A, mem.AgentSession(
        id="ses-del", tenant_id=_TENANT_A, agent_id="agent-1",
    ))
    assert sql.delete_session(_TENANT_A, "ses-del") is True
    assert sql.get_session(_TENANT_A, "ses-del") is None


def test_delete_session_rejects_cross_tenant() -> None:
    sql.put_session(_TENANT_A, mem.AgentSession(
        id="ses-x", tenant_id=_TENANT_A,
    ))
    assert sql.delete_session(_TENANT_B, "ses-x") is False


# ---------------------------------------------------------------------------
# AgentMessage round-trip (tool_calls JSON list)
# ---------------------------------------------------------------------------
def test_put_and_get_message() -> None:
    msg = mem.AgentMessage(
        id="msg-1", tenant_id=_TENANT_A, thread_id="thread-1",
        role="assistant", content="Here are the results.",
        tool_calls=[{"name": "search", "args": {"q": "sales"}}],
        created_at="2026-08-01T00:00:00Z",
    )
    sql.put_message(_TENANT_A, msg)

    fetched = sql.get_message(_TENANT_A, "msg-1")
    assert fetched is not None
    assert fetched.thread_id == "thread-1"
    assert fetched.role == "assistant"
    assert fetched.content == "Here are the results."
    assert fetched.tool_calls == [{"name": "search", "args": {"q": "sales"}}]


def test_put_message_upsert() -> None:
    msg = mem.AgentMessage(
        id="msg-2", tenant_id=_TENANT_A, thread_id="thread-1",
        role="user", content="Hello",
    )
    sql.put_message(_TENANT_A, msg)
    msg = mem.AgentMessage(
        id="msg-2", tenant_id=_TENANT_A, thread_id="thread-1",
        role="assistant", content="Hi there",
        tool_calls=[{"name": "tool1"}],
    )
    sql.put_message(_TENANT_A, msg)

    fetched = sql.get_message(_TENANT_A, "msg-2")
    assert fetched is not None
    assert fetched.role == "assistant"
    assert fetched.content == "Hi there"
    assert fetched.tool_calls == [{"name": "tool1"}]


def test_delete_message() -> None:
    sql.put_message(_TENANT_A, mem.AgentMessage(
        id="msg-del", tenant_id=_TENANT_A, thread_id="t1",
    ))
    assert sql.delete_message(_TENANT_A, "msg-del") is True
    assert sql.get_message(_TENANT_A, "msg-del") is None


def test_delete_message_rejects_cross_tenant() -> None:
    sql.put_message(_TENANT_A, mem.AgentMessage(
        id="msg-x", tenant_id=_TENANT_A, thread_id="t1",
    ))
    assert sql.delete_message(_TENANT_B, "msg-x") is False


# ---------------------------------------------------------------------------
# Tenant isolation
# ---------------------------------------------------------------------------
def test_tenant_isolation() -> None:
    sql.put_agent(_TENANT_A, mem.Agent(id="agent-a", tenant_id=_TENANT_A))
    sql.put_agent(_TENANT_B, mem.Agent(id="agent-b", tenant_id=_TENANT_B))

    a_agents = sql.list_agents(_TENANT_A)
    assert [a.id for a in a_agents] == ["agent-a"]

    b_agents = sql.list_agents(_TENANT_B)
    assert [a.id for a in b_agents] == ["agent-b"]

    assert sql.get_agent(_TENANT_B, "agent-a") is None
    assert sql.get_agent(_TENANT_A, "agent-b") is None


def test_anonymous_tenant_returns_empty() -> None:
    assert sql.list_agents("") == []
    assert sql.list_sessions("") == []
    assert sql.list_messages("") == []
    assert sql.get_agent("", "agent-1") is None
    assert sql.get_session("", "ses-1") is None
    assert sql.get_message("", "msg-1") is None


# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------
def test_seed_from_inmemory() -> None:
    counts = sql.seed_from_inmemory(_TENANT_A)
    assert counts["agents"] >= 3
    assert counts["sessions"] >= 2
    assert counts["messages"] >= 3
    assert len(sql.list_agents(_TENANT_A)) >= 3
    assert len(sql.list_sessions(_TENANT_A)) >= 2
    assert len(sql.list_messages(_TENANT_A)) >= 3
    assert sql.list_agents(_TENANT_B) == []
