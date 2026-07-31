"""Tests for the SQL-backed A2A repository.

Uses SQLite in-memory to verify the ORM models, CRUD operations,
tenant isolation, and seed_from_inmemory bootstrap work correctly.
"""
from __future__ import annotations

# Import models so their tables register on Base.metadata before create_all
from collections.abc import Iterator

import mate_app_a2a.repositories.sql_models  # noqa: F401
import pytest
from mate_app_a2a.repositories.in_memory import (
    Agent,
    AgentCapability,
    DelegationTask,
    ExternalAgent,
)
from mate_app_a2a.repositories.sql_store import (
    create_delegation,
    get_agent,
    get_delegation,
    list_agents,
    list_capabilities,
    list_delegations,
    list_external_agents,
    put_agent,
    put_capability,
    put_delegation,
    put_external_agent,
    register_external_agent,
    seed_from_inmemory,
    update_delegation_result,
)
from sqlalchemy import inspect

from mate_tech_db.base import Base, _state, create_all, get_session, init_engine


@pytest.fixture()
def sql_backend() -> Iterator[None]:
    """Initialize a fresh SQLite in-memory DB for each test."""
    init_engine("sqlite:///:memory:")
    create_all()
    yield
    # SQLAlchemy 2.0: drop via engine, not metadata.bind
    if _state.engine is not None:
        Base.metadata.drop_all(_state.engine)


def test_orm_models_create_tables(sql_backend: None) -> None:
    """Verify all 5 ORM model tables exist after create_all."""
    s = get_session()
    insp = inspect(s.bind)
    tables = set(insp.get_table_names())
    expected = {
        "a2a_agents",
        "a2a_agent_capabilities",
        "a2a_delegations",
        "a2a_external_agents",
        "a2a_task_results",
    }
    assert expected.issubset(tables), f"missing tables: {expected - tables}"


def test_put_and_list_agent(sql_backend: None) -> None:
    """Insert an agent via SQL store and read it back."""
    agent = Agent(
        id="agent-sql-1",
        tenant_id="tenant-acme",
        name="SQL Bot",
        description="persisted via orm",
        endpoint="a2a://agent-sql-1",
    )
    put_agent("tenant-acme", agent)

    results = list_agents("tenant-acme")
    assert len(results) == 1
    assert results[0].id == "agent-sql-1"
    assert results[0].name == "SQL Bot"
    assert results[0].description == "persisted via orm"
    assert results[0].endpoint == "a2a://agent-sql-1"
    assert results[0].status == "active"


def test_delegation_round_trip(sql_backend: None) -> None:
    """Verify DelegationTask with dict context survives a write-read cycle."""
    task = DelegationTask(
        id="task-rt",
        tenant_id="tenant-acme",
        target_agent_id="agent-recon",
        message="Reconcile Q3 ledger",
        context={"priority": "high", "batch_id": 42},
    )
    put_delegation("tenant-acme", task)

    fetched = get_delegation("tenant-acme", "task-rt")
    assert fetched is not None
    assert fetched.id == "task-rt"
    assert fetched.target_agent_id == "agent-recon"
    assert fetched.message == "Reconcile Q3 ledger"
    assert fetched.context == {"priority": "high", "batch_id": 42}
    assert fetched.status == "pending"
    assert fetched.result == {}


def test_delegation_update_result(sql_backend: None) -> None:
    """update_delegation_result patches status / result in place."""
    task = DelegationTask(
        id="task-upd",
        tenant_id="tenant-acme",
        target_agent_id="agent-recon",
        message="do thing",
        context={},
    )
    put_delegation("tenant-acme", task)

    updated = update_delegation_result(
        "tenant-acme", "task-upd", {"rows": 10}, "completed"
    )
    assert updated is not None
    assert updated.status == "completed"
    assert updated.result == {"rows": 10}

    refetch = get_delegation("tenant-acme", "task-upd")
    assert refetch is not None
    assert refetch.status == "completed"
    assert refetch.result == {"rows": 10}


def test_capability_dict_schema_round_trip(sql_backend: None) -> None:
    """AgentCapability input_schema / output_schema dicts round-trip."""
    cap = AgentCapability(
        id="cap-dict",
        tenant_id="tenant-acme",
        agent_id="agent-copilot",
        name="search",
        description="semantic search",
        input_schema={"type": "object", "properties": {"q": {"type": "string"}}},
        output_schema={"type": "array"},
    )
    put_capability("tenant-acme", cap)

    caps = list_capabilities("tenant-acme")
    assert len(caps) == 1
    assert caps[0].input_schema == {"type": "object", "properties": {"q": {"type": "string"}}}
    assert caps[0].output_schema == {"type": "array"}


def test_list_capabilities_filtered_by_agent(sql_backend: None) -> None:
    """list_capabilities agent_id filter works on the SQL backend."""
    put_capability("tenant-acme", AgentCapability(
        id="cap-a1", tenant_id="tenant-acme", agent_id="agent-1",
        name="c1", description="d1",
    ))
    put_capability("tenant-acme", AgentCapability(
        id="cap-a2", tenant_id="tenant-acme", agent_id="agent-2",
        name="c2", description="d2",
    ))

    all_caps = list_capabilities("tenant-acme")
    assert len(all_caps) == 2
    filtered = list_capabilities("tenant-acme", agent_id="agent-1")
    assert len(filtered) == 1
    assert filtered[0].id == "cap-a1"


def test_external_agent_capabilities_tuple_round_trip(sql_backend: None) -> None:
    """ExternalAgent capabilities tuple survives a write-read cycle."""
    agent = ExternalAgent(
        id="ext-rt",
        tenant_id="tenant-acme",
        name="Federated Bot",
        endpoint="https://example.com/a2a",
        capabilities=("code-interpreter", "retrieval", "function-call"),
    )
    put_external_agent("tenant-acme", agent)

    results = list_external_agents("tenant-acme")
    assert len(results) == 1
    assert results[0].capabilities == ("code-interpreter", "retrieval", "function-call")
    assert results[0].status == "registered"


def test_register_external_agent_creates_row(sql_backend: None) -> None:
    """register_external_agent creates a new row with generated id."""
    agent = register_external_agent(
        "tenant-acme",
        "New Bot",
        "https://example.com/new",
        ["chat", "reasoning"],
    )
    assert agent.id.startswith("ext-")
    assert agent.capabilities == ("chat", "reasoning")

    results = list_external_agents("tenant-acme")
    assert len(results) == 1
    assert results[0].name == "New Bot"


def test_create_delegation_generates_id(sql_backend: None) -> None:
    """create_delegation returns a task with a generated id, persisted."""
    task = create_delegation(
        "tenant-acme", "agent-recon", "do work", {"k": "v"}
    )
    assert task.id.startswith("task-")
    assert task.status == "pending"

    fetched = get_delegation("tenant-acme", task.id)
    assert fetched is not None
    assert fetched.message == "do work"
    assert fetched.context == {"k": "v"}


def test_tenant_isolation(sql_backend: None) -> None:
    """Verify tenant A cannot see tenant B's data."""
    put_agent("tenant-acme", Agent(
        id="a-acme", tenant_id="tenant-acme", name="Acme Agent",
        description="d",
    ))
    put_agent("tenant-globex", Agent(
        id="a-globex", tenant_id="tenant-globex", name="Globex Agent",
        description="d",
    ))

    acme = list_agents("tenant-acme")
    globex = list_agents("tenant-globex")
    assert len(acme) == 1 and acme[0].id == "a-acme"
    assert len(globex) == 1 and globex[0].id == "a-globex"

    # get_agent rejects cross-tenant lookups
    assert get_agent("tenant-acme", "a-globex") is None
    assert get_delegation("tenant-acme", "a-globex") is None


def test_seed_from_inmemory(sql_backend: None) -> None:
    """Bootstrap SQL store from in-memory seed data."""
    counts = seed_from_inmemory("tenant-acme")
    assert counts["agents"] >= 5  # in_memory seeds >= 5
    assert counts["capabilities"] >= 8  # in_memory seeds >= 8
    assert counts["external_agents"] >= 3  # in_memory seeds >= 3
    assert counts["delegations"] >= 5  # in_memory seeds >= 5

    assert len(list_agents("tenant-acme")) >= 5
    assert len(list_capabilities("tenant-acme")) >= 8
    assert len(list_external_agents("tenant-acme")) >= 3
    assert len(list_delegations("tenant-acme")) >= 5


def test_seed_is_idempotent(sql_backend: None) -> None:
    """Re-seeding the same tenant upserts, not duplicates."""
    seed_from_inmemory("tenant-acme")
    first = len(list_agents("tenant-acme"))
    seed_from_inmemory("tenant-acme")
    second = len(list_agents("tenant-acme"))
    assert first == second
