"""Tests for mate_tech_llmgw.repositories.sql_store — SQL persistence (P3-W4).

Uses SQLite in-memory + Base.metadata.create_all to verify the SQL
store's CRUD + tenant isolation + JSON serialisation (config dict).
"""
from __future__ import annotations

import pytest

from mate_tech_db.base import Base, create_all, init_engine, reset_engine
from mate_tech_llmgw.repositories import in_memory as mem
from mate_tech_llmgw.repositories import sql_models as models  # noqa: F401
from mate_tech_llmgw.repositories import sql_store as sql


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
# LlmProvider round-trip (config JSON dict)
# ---------------------------------------------------------------------------
def test_put_and_get_provider() -> None:
    prov = mem.LlmProvider(
        id="prov-1", tenant_id=_TENANT_A, name="OpenAI",
        provider_type="openai", base_url="https://api.openai.com/v1",
        enabled=True, config={"timeout": 30, "max_retries": 3},
        created_at="2026-08-01T00:00:00Z",
        updated_at="2026-08-01T00:00:00Z",
    )
    sql.put_provider(_TENANT_A, prov)

    fetched = sql.get_provider(_TENANT_A, "prov-1")
    assert fetched is not None
    assert fetched.name == "OpenAI"
    assert fetched.provider_type == "openai"
    assert fetched.base_url == "https://api.openai.com/v1"
    assert fetched.enabled is True
    assert fetched.config == {"timeout": 30, "max_retries": 3}


def test_put_provider_upsert() -> None:
    prov = mem.LlmProvider(
        id="prov-2", tenant_id=_TENANT_A, name="Old",
        provider_type="anthropic", config={"timeout": 10},
    )
    sql.put_provider(_TENANT_A, prov)
    prov = mem.LlmProvider(
        id="prov-2", tenant_id=_TENANT_A, name="New",
        provider_type="anthropic", base_url="https://api.anthropic.com",
        enabled=False, config={"timeout": 60, "max_retries": 5},
    )
    sql.put_provider(_TENANT_A, prov)

    fetched = sql.get_provider(_TENANT_A, "prov-2")
    assert fetched is not None
    assert fetched.name == "New"
    assert fetched.base_url == "https://api.anthropic.com"
    assert fetched.enabled is False
    assert fetched.config == {"timeout": 60, "max_retries": 5}


def test_delete_provider() -> None:
    sql.put_provider(_TENANT_A, mem.LlmProvider(id="prov-del", tenant_id=_TENANT_A, name="del"))
    assert sql.delete_provider(_TENANT_A, "prov-del") is True
    assert sql.get_provider(_TENANT_A, "prov-del") is None
    assert sql.delete_provider(_TENANT_A, "prov-del") is False


def test_delete_provider_rejects_cross_tenant() -> None:
    sql.put_provider(_TENANT_A, mem.LlmProvider(id="prov-x", tenant_id=_TENANT_A, name="x"))
    assert sql.delete_provider(_TENANT_B, "prov-x") is False
    assert sql.get_provider(_TENANT_A, "prov-x") is not None


# ---------------------------------------------------------------------------
# LlmModel round-trip (config JSON dict)
# ---------------------------------------------------------------------------
def test_put_and_get_model() -> None:
    model = mem.LlmModel(
        id="model-1", tenant_id=_TENANT_A, model_id="gpt-4o",
        display_name="GPT-4o", provider="openai", modality="text",
        max_tokens=4096, enabled=True,
        config={"temperature": 0.7, "top_p": 0.9},
        created_at="2026-08-01T00:00:00Z",
        updated_at="2026-08-01T00:00:00Z",
    )
    sql.put_model(_TENANT_A, model)

    fetched = sql.get_model(_TENANT_A, "model-1")
    assert fetched is not None
    assert fetched.model_id == "gpt-4o"
    assert fetched.display_name == "GPT-4o"
    assert fetched.provider == "openai"
    assert fetched.modality == "text"
    assert fetched.max_tokens == 4096
    assert fetched.enabled is True
    assert fetched.config == {"temperature": 0.7, "top_p": 0.9}


def test_put_model_upsert() -> None:
    model = mem.LlmModel(
        id="model-2", tenant_id=_TENANT_A, model_id="qwen-max",
        display_name="Old", provider="qwen",
    )
    sql.put_model(_TENANT_A, model)
    model = mem.LlmModel(
        id="model-2", tenant_id=_TENANT_A, model_id="qwen-max",
        display_name="New", provider="qwen", max_tokens=8192,
        enabled=False, config={"temperature": 0.5},
    )
    sql.put_model(_TENANT_A, model)

    fetched = sql.get_model(_TENANT_A, "model-2")
    assert fetched is not None
    assert fetched.display_name == "New"
    assert fetched.max_tokens == 8192
    assert fetched.enabled is False
    assert fetched.config == {"temperature": 0.5}


def test_delete_model() -> None:
    sql.put_model(_TENANT_A, mem.LlmModel(id="model-del", tenant_id=_TENANT_A, model_id="x"))
    assert sql.delete_model(_TENANT_A, "model-del") is True
    assert sql.get_model(_TENANT_A, "model-del") is None


def test_delete_model_rejects_cross_tenant() -> None:
    sql.put_model(_TENANT_A, mem.LlmModel(id="model-x", tenant_id=_TENANT_A, model_id="x"))
    assert sql.delete_model(_TENANT_B, "model-x") is False


# ---------------------------------------------------------------------------
# LlmRouteRule round-trip
# ---------------------------------------------------------------------------
def test_put_and_get_route_rule() -> None:
    rule = mem.LlmRouteRule(
        id="route-1", tenant_id=_TENANT_A, model_pattern="gpt-*",
        provider="openai", priority=10, enabled=True,
        created_at="2026-08-01T00:00:00Z",
        updated_at="2026-08-01T00:00:00Z",
    )
    sql.put_route_rule(_TENANT_A, rule)

    fetched = sql.get_route_rule(_TENANT_A, "route-1")
    assert fetched is not None
    assert fetched.model_pattern == "gpt-*"
    assert fetched.provider == "openai"
    assert fetched.priority == 10
    assert fetched.enabled is True


def test_put_route_rule_upsert() -> None:
    rule = mem.LlmRouteRule(
        id="route-2", tenant_id=_TENANT_A, model_pattern="claude-*",
        provider="anthropic", priority=5,
    )
    sql.put_route_rule(_TENANT_A, rule)
    rule = mem.LlmRouteRule(
        id="route-2", tenant_id=_TENANT_A, model_pattern="claude-*",
        provider="anthropic", priority=20, enabled=False,
    )
    sql.put_route_rule(_TENANT_A, rule)

    fetched = sql.get_route_rule(_TENANT_A, "route-2")
    assert fetched is not None
    assert fetched.priority == 20
    assert fetched.enabled is False


def test_delete_route_rule() -> None:
    sql.put_route_rule(_TENANT_A, mem.LlmRouteRule(id="route-del", tenant_id=_TENANT_A, provider="x"))
    assert sql.delete_route_rule(_TENANT_A, "route-del") is True
    assert sql.get_route_rule(_TENANT_A, "route-del") is None


def test_delete_route_rule_rejects_cross_tenant() -> None:
    sql.put_route_rule(_TENANT_A, mem.LlmRouteRule(id="route-x", tenant_id=_TENANT_A, provider="x"))
    assert sql.delete_route_rule(_TENANT_B, "route-x") is False


# ---------------------------------------------------------------------------
# Tenant isolation
# ---------------------------------------------------------------------------
def test_tenant_isolation() -> None:
    sql.put_provider(_TENANT_A, mem.LlmProvider(id="prov-a", tenant_id=_TENANT_A, name="a"))
    sql.put_provider(_TENANT_B, mem.LlmProvider(id="prov-b", tenant_id=_TENANT_B, name="b"))

    a_provs = sql.list_providers(_TENANT_A)
    assert [p.id for p in a_provs] == ["prov-a"]

    b_provs = sql.list_providers(_TENANT_B)
    assert [p.id for p in b_provs] == ["prov-b"]

    assert sql.get_provider(_TENANT_B, "prov-a") is None
    assert sql.get_provider(_TENANT_A, "prov-b") is None


def test_anonymous_tenant_returns_empty() -> None:
    assert sql.list_providers("") == []
    assert sql.list_models("") == []
    assert sql.list_route_rules("") == []
    assert sql.get_provider("", "prov-1") is None
    assert sql.get_model("", "model-1") is None
    assert sql.get_route_rule("", "route-1") is None


# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------
def test_seed_from_inmemory() -> None:
    counts = sql.seed_from_inmemory(_TENANT_A)
    assert counts["providers"] >= 4
    assert counts["models"] >= 4
    assert counts["route_rules"] >= 4
    assert len(sql.list_providers(_TENANT_A)) >= 4
    assert len(sql.list_models(_TENANT_A)) >= 4
    assert len(sql.list_route_rules(_TENANT_A)) >= 4
    assert sql.list_providers(_TENANT_B) == []
