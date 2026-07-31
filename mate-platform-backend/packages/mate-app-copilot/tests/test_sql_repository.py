"""Tests for the SQL-backed copilot repository (v3.2 POC).

Uses SQLite in-memory to verify the ORM models, CRUD operations,
and seed_from_inmemory bootstrap work correctly.
"""
from __future__ import annotations

# Import models so their tables register on Base.metadata before create_all
import mate_app_copilot.repositories.sql_models  # noqa: F401
import pytest
from mate_app_copilot.repositories.in_memory import Conversation, Plan
from mate_app_copilot.repositories.sql_store import (
    list_conversations,
    list_plans,
    put_conversation,
    put_plan,
    seed_from_inmemory,
)
from sqlalchemy import inspect

from mate_tech_db.base import Base, _state, create_all, get_session, init_engine


@pytest.fixture()
def sql_backend():
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
        "copilot_conversations",
        "copilot_queries",
        "copilot_plans",
        "copilot_intents",
        "copilot_actions",
    }
    assert expected.issubset(tables), f"missing tables: {expected - tables}"


def test_put_and_list_conversation(sql_backend: None) -> None:
    """Insert a conversation via SQL store and read it back."""
    conv = Conversation(
        id="conv-test-1",
        tenant_id="tenant-acme",
        title="Test Chat",
        summary="A test conversation",
        message_count=3,
        created_at="2026-07-31",
    )
    put_conversation("tenant-acme", conv)

    results = list_conversations("tenant-acme")
    assert len(results) == 1
    assert results[0].id == "conv-test-1"
    assert results[0].title == "Test Chat"
    assert results[0].message_count == 3


def test_tenant_isolation(sql_backend: None) -> None:
    """Verify tenant A cannot see tenant B's data."""
    put_conversation("tenant-acme", Conversation(
        id="c-acme", tenant_id="tenant-acme", title="Acme Chat",
    ))
    put_conversation("tenant-globex", Conversation(
        id="c-globex", tenant_id="tenant-globex", title="Globex Chat",
    ))

    acme = list_conversations("tenant-acme")
    globex = list_conversations("tenant-globex")
    assert len(acme) == 1 and acme[0].id == "c-acme"
    assert len(globex) == 1 and globex[0].id == "c-globex"


def test_seed_from_inmemory(sql_backend: None) -> None:
    """Bootstrap SQL store from in-memory seed data."""
    counts = seed_from_inmemory("tenant-acme")
    assert counts["conversations"] >= 10  # in_memory seeds >= 10
    assert len(list_conversations("tenant-acme")) >= 10


def test_put_plan_round_trip(sql_backend: None) -> None:
    """Verify Plan with tuple steps survives a write-read cycle."""
    plan = Plan(
        id="plan-rt",
        tenant_id="tenant-acme",
        name="Test Plan",
        goal="Do the thing",
        steps=("Step 1", "Step 2", "Step 3"),
    )
    put_plan("tenant-acme", plan)

    results = list_plans("tenant-acme")
    assert len(results) == 1
    assert results[0].steps == ("Step 1", "Step 2", "Step 3")
