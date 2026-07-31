"""Tests for the SQL-backed copilot repository (v3.2 POC).

Uses SQLite in-memory to verify the ORM models, CRUD operations,
and seed_from_inmemory bootstrap work correctly.
"""
from __future__ import annotations

# Import models so their tables register on Base.metadata before create_all
import mate_app_copilot.repositories.sql_models  # noqa: F401
import pytest
from mate_app_copilot.repositories.in_memory import (
    AssetRecord,
    Conversation,
    Datasource,
    KnowledgeBase,
    Plan,
    Template,
)
from mate_app_copilot.repositories.sql_store import (
    get_asset,
    list_assets,
    list_conversations,
    list_datasources,
    list_knowledge_bases,
    list_plans,
    list_templates,
    put_asset,
    put_conversation,
    put_datasource,
    put_knowledge_base,
    put_plan,
    put_template,
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
    """Verify all 10 ORM model tables exist after create_all."""
    s = get_session()
    insp = inspect(s.bind)
    tables = set(insp.get_table_names())
    expected = {
        "copilot_conversations",
        "copilot_queries",
        "copilot_plans",
        "copilot_intents",
        "copilot_actions",
        "copilot_datasources",
        "copilot_knowledge_bases",
        "copilot_models",
        "copilot_templates",
        "copilot_assets",
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


def test_put_and_list_datasource(sql_backend: None) -> None:
    """Insert a datasource and read it back."""
    ds = Datasource(
        id="ds-test-1",
        tenant_id="tenant-acme",
        name="Test DB",
        type="postgresql",
        description="A test datasource",
        status="active",
    )
    put_datasource("tenant-acme", ds)

    results = list_datasources("tenant-acme")
    assert len(results) == 1
    assert results[0].id == "ds-test-1"
    assert results[0].name == "Test DB"
    assert results[0].type == "postgresql"
    assert results[0].status == "active"


def test_put_and_list_knowledge_base(sql_backend: None) -> None:
    """Insert a knowledge base and read it back."""
    kb = KnowledgeBase(
        id="kb-test-1",
        tenant_id="tenant-acme",
        name="Test KB",
        description="A test knowledge base",
        doc_count=42,
    )
    put_knowledge_base("tenant-acme", kb)

    results = list_knowledge_bases("tenant-acme")
    assert len(results) == 1
    assert results[0].id == "kb-test-1"
    assert results[0].name == "Test KB"
    assert results[0].doc_count == 42


def test_put_and_list_template(sql_backend: None) -> None:
    """Insert a template and read it back."""
    tpl = Template(
        id="tpl-test-1",
        tenant_id="tenant-acme",
        name="Test Template",
        category="report",
        description="A test template",
    )
    put_template("tenant-acme", tpl)

    results = list_templates("tenant-acme")
    assert len(results) == 1
    assert results[0].id == "tpl-test-1"
    assert results[0].name == "Test Template"
    assert results[0].category == "report"


def test_put_and_list_asset(sql_backend: None) -> None:
    """Insert an asset, read it back via list and via get_asset."""
    asset = AssetRecord(
        id="asset-test-1",
        tenant_id="tenant-acme",
        filename="report.pdf",
        content_type="application/pdf",
        embedding_dim=768,
    )
    put_asset("tenant-acme", asset)

    # list_assets
    results = list_assets("tenant-acme")
    assert len(results) == 1
    assert results[0].id == "asset-test-1"
    assert results[0].filename == "report.pdf"
    assert results[0].embedding_dim == 768

    # get_asset (single fetch)
    fetched = get_asset("tenant-acme", "asset-test-1")
    assert fetched is not None
    assert fetched.content_type == "application/pdf"

    # cross-tenant get returns None
    assert get_asset("tenant-globex", "asset-test-1") is None
    assert get_asset("tenant-acme", "nonexistent") is None


def test_full_seed_from_inmemory(sql_backend: None) -> None:
    """Bootstrap SQL store from in-memory seed data for all 10 tables."""
    counts = seed_from_inmemory("tenant-acme")

    # All 10 tables should have seed entries
    assert counts["conversations"] >= 10
    assert counts["queries"] >= 20
    assert counts["plans"] >= 5
    assert counts["intents"] >= 5
    assert counts["actions"] >= 10
    assert counts["datasources"] >= 3
    assert counts["knowledge_bases"] >= 5
    assert counts["models"] >= 3
    assert counts["templates"] >= 5
    # assets seed is empty in in_memory (no _seed_assets), so >= 0
    assert counts["assets"] >= 0

    # Verify data is actually queryable via list_*
    assert len(list_datasources("tenant-acme")) >= 3
    assert len(list_knowledge_bases("tenant-acme")) >= 5
    assert len(list_templates("tenant-acme")) >= 5
    assert len(list_conversations("tenant-acme")) >= 10
