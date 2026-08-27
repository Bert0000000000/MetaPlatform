"""Tests for mate_tech_mcp.repositories.sql_store — SQL persistence (P3-W4).

Uses SQLite in-memory + Base.metadata.create_all to verify the SQL
store's CRUD + tenant isolation + JSON/text serialisation
(input_schema dict, arguments tuple).
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

_MONOREPO = Path(__file__).resolve().parents[3]
_DB_SRC = str(_MONOREPO / "packages" / "mate-tech-db" / "src")
if _DB_SRC not in sys.path:
    sys.path.insert(0, _DB_SRC)

from mate_tech_db.base import create_all, init_engine, reset_engine  # noqa: E402

from mate_tech_mcp.repositories import in_memory as mem  # noqa: E402
from mate_tech_mcp.repositories import sql_models as models  # noqa: E402, F401
from mate_tech_mcp.repositories import sql_store as sql  # noqa: E402


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
# McpTool round-trip (input_schema JSON dict)
# ---------------------------------------------------------------------------
def test_put_and_get_tool() -> None:
    tool = mem.McpTool(
        id="tool-1", tenant_id=_TENANT_A, name="kb_search",
        description="Search the knowledge base",
        input_schema={"type": "object", "properties": {"query": {"type": "string"}}},
        enabled=True,
        created_at="2026-08-01T00:00:00Z",
        updated_at="2026-08-01T00:00:00Z",
    )
    sql.put_tool(_TENANT_A, tool)

    fetched = sql.get_tool(_TENANT_A, "tool-1")
    assert fetched is not None
    assert fetched.name == "kb_search"
    assert fetched.description == "Search the knowledge base"
    assert fetched.input_schema == {"type": "object", "properties": {"query": {"type": "string"}}}
    assert fetched.enabled is True


def test_put_tool_upsert() -> None:
    tool = mem.McpTool(
        id="tool-2", tenant_id=_TENANT_A, name="old_tool",
        input_schema={"type": "object"},
    )
    sql.put_tool(_TENANT_A, tool)
    tool = mem.McpTool(
        id="tool-2", tenant_id=_TENANT_A, name="new_tool",
        input_schema={"type": "object", "properties": {"q": {"type": "string"}}},
        enabled=False,
    )
    sql.put_tool(_TENANT_A, tool)

    fetched = sql.get_tool(_TENANT_A, "tool-2")
    assert fetched is not None
    assert fetched.name == "new_tool"
    assert fetched.enabled is False
    assert fetched.input_schema == {"type": "object", "properties": {"q": {"type": "string"}}}


def test_delete_tool() -> None:
    sql.put_tool(_TENANT_A, mem.McpTool(id="tool-del", tenant_id=_TENANT_A, name="del"))
    assert sql.delete_tool(_TENANT_A, "tool-del") is True
    assert sql.get_tool(_TENANT_A, "tool-del") is None
    assert sql.delete_tool(_TENANT_A, "tool-del") is False


def test_delete_tool_rejects_cross_tenant() -> None:
    sql.put_tool(_TENANT_A, mem.McpTool(id="tool-x", tenant_id=_TENANT_A, name="x"))
    assert sql.delete_tool(_TENANT_B, "tool-x") is False
    assert sql.get_tool(_TENANT_A, "tool-x") is not None


# ---------------------------------------------------------------------------
# McpResource round-trip
# ---------------------------------------------------------------------------
def test_put_and_get_resource() -> None:
    res = mem.McpResource(
        id="res-1", tenant_id=_TENANT_A, uri="ont://default",
        name="Ontology", description="The default ontology",
        mime_type="application/json",
        created_at="2026-08-01T00:00:00Z",
    )
    sql.put_resource(_TENANT_A, res)

    fetched = sql.get_resource(_TENANT_A, "res-1")
    assert fetched is not None
    assert fetched.uri == "ont://default"
    assert fetched.name == "Ontology"
    assert fetched.description == "The default ontology"
    assert fetched.mime_type == "application/json"


def test_delete_resource() -> None:
    sql.put_resource(_TENANT_A, mem.McpResource(id="res-del", tenant_id=_TENANT_A, uri="x://y"))
    assert sql.delete_resource(_TENANT_A, "res-del") is True
    assert sql.get_resource(_TENANT_A, "res-del") is None


def test_delete_resource_rejects_cross_tenant() -> None:
    sql.put_resource(_TENANT_A, mem.McpResource(id="res-x", tenant_id=_TENANT_A, uri="x://y"))
    assert sql.delete_resource(_TENANT_B, "res-x") is False


# ---------------------------------------------------------------------------
# McpPrompt round-trip (arguments tuple as newline-separated TEXT)
# ---------------------------------------------------------------------------
def test_put_and_get_prompt() -> None:
    prompt = mem.McpPrompt(
        id="prompt-1", tenant_id=_TENANT_A, name="sales_assistant",
        description="Sales assistant prompt",
        template="You are a sales assistant.",
        arguments=("product", "region"),
        created_at="2026-08-01T00:00:00Z",
        updated_at="2026-08-01T00:00:00Z",
    )
    sql.put_prompt(_TENANT_A, prompt)

    fetched = sql.get_prompt(_TENANT_A, "prompt-1")
    assert fetched is not None
    assert fetched.name == "sales_assistant"
    assert fetched.description == "Sales assistant prompt"
    assert fetched.template == "You are a sales assistant."
    assert fetched.arguments == ("product", "region")


def test_put_prompt_upsert() -> None:
    prompt = mem.McpPrompt(
        id="prompt-2", tenant_id=_TENANT_A, name="old",
        template="Old template", arguments=("a",),
    )
    sql.put_prompt(_TENANT_A, prompt)
    prompt = mem.McpPrompt(
        id="prompt-2", tenant_id=_TENANT_A, name="new",
        template="New template", arguments=("a", "b", "c"),
    )
    sql.put_prompt(_TENANT_A, prompt)

    fetched = sql.get_prompt(_TENANT_A, "prompt-2")
    assert fetched is not None
    assert fetched.name == "new"
    assert fetched.template == "New template"
    assert fetched.arguments == ("a", "b", "c")


def test_delete_prompt() -> None:
    sql.put_prompt(_TENANT_A, mem.McpPrompt(id="prompt-del", tenant_id=_TENANT_A, name="del"))
    assert sql.delete_prompt(_TENANT_A, "prompt-del") is True
    assert sql.get_prompt(_TENANT_A, "prompt-del") is None


def test_delete_prompt_rejects_cross_tenant() -> None:
    sql.put_prompt(_TENANT_A, mem.McpPrompt(id="prompt-x", tenant_id=_TENANT_A, name="x"))
    assert sql.delete_prompt(_TENANT_B, "prompt-x") is False


# ---------------------------------------------------------------------------
# Tenant isolation
# ---------------------------------------------------------------------------
def test_tenant_isolation() -> None:
    sql.put_tool(_TENANT_A, mem.McpTool(id="tool-a", tenant_id=_TENANT_A, name="a"))
    sql.put_tool(_TENANT_B, mem.McpTool(id="tool-b", tenant_id=_TENANT_B, name="b"))

    a_tools = sql.list_tools(_TENANT_A)
    assert [t.id for t in a_tools] == ["tool-a"]

    b_tools = sql.list_tools(_TENANT_B)
    assert [t.id for t in b_tools] == ["tool-b"]

    assert sql.get_tool(_TENANT_B, "tool-a") is None
    assert sql.get_tool(_TENANT_A, "tool-b") is None


def test_anonymous_tenant_returns_empty() -> None:
    assert sql.list_tools("") == []
    assert sql.list_resources("") == []
    assert sql.list_prompts("") == []
    assert sql.get_tool("", "tool-1") is None
    assert sql.get_resource("", "res-1") is None
    assert sql.get_prompt("", "prompt-1") is None


# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------
def test_seed_from_inmemory() -> None:
    counts = sql.seed_from_inmemory(_TENANT_A)
    assert counts["tools"] >= 3
    assert counts["resources"] >= 2
    assert counts["prompts"] >= 2
    assert len(sql.list_tools(_TENANT_A)) >= 3
    assert len(sql.list_resources(_TENANT_A)) >= 2
    assert len(sql.list_prompts(_TENANT_A)) >= 2
    assert sql.list_tools(_TENANT_B) == []
