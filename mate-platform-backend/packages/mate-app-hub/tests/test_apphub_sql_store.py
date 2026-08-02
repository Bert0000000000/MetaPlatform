"""Tests for mate_app_hub.repositories.sql_store — SQL persistence (P3-W3 TD-5).

Uses SQLite in-memory + Base.metadata.create_all to verify the SQL
store's CRUD + tenant isolation for the 5 apphub entities.
"""
from __future__ import annotations

import pytest
from mate_app_hub.repositories import in_memory as mem
from mate_app_hub.repositories import (
    sql_models as models,  # noqa: F401  # pyright: ignore[reportUnusedImport]
)
from mate_app_hub.repositories import sql_store as sql

from mate_tech_db.base import (  # pyright: ignore[reportUnusedImport]
    create_all,
    init_engine,
    reset_engine,
)


@pytest.fixture(autouse=True)
def _fresh_db() -> None:  # pyright: ignore[reportUnusedFunction]
    """Reset the engine and create all tables before each test."""
    reset_engine()
    init_engine("sqlite:///:memory:")
    create_all()
    yield
    reset_engine()


_TENANT_A = "tenant-acme"
_TENANT_B = "tenant-bigo"


# ---------------------------------------------------------------------------
# App round-trip
# ---------------------------------------------------------------------------
def test_put_and_get_app() -> None:
    app = mem.ApphubApp(
        id="app-x1", tenant_id=_TENANT_A, name="Custom App",
        code="x1", category="platform", description="a custom app",
        version="2.0.0", owner="team-x", tags=("platform", "custom"),
    )
    sql.put_app(_TENANT_A, app)

    fetched = sql.get_app(_TENANT_A, "app-x1")
    assert fetched is not None
    assert fetched.id == "app-x1"
    assert fetched.name == "Custom App"
    assert fetched.code == "x1"
    assert fetched.category == "platform"
    assert fetched.description == "a custom app"
    assert fetched.version == "2.0.0"
    assert fetched.owner == "team-x"
    assert fetched.tags == ("platform", "custom")


def test_put_app_upsert() -> None:
    app = mem.ApphubApp(
        id="app-x2", tenant_id=_TENANT_A, name="App V1",
        code="x2", category="knowledge", description="v1",
    )
    sql.put_app(_TENANT_A, app)
    # Update
    app = mem.ApphubApp(
        id="app-x2", tenant_id=_TENANT_A, name="App V2",
        code="x2", category="data", description="v2",
        version="3.0.0", owner="team-y", tags=("data", "v2"),
    )
    sql.put_app(_TENANT_A, app)

    fetched = sql.get_app(_TENANT_A, "app-x2")
    assert fetched is not None
    assert fetched.name == "App V2"
    assert fetched.category == "data"
    assert fetched.description == "v2"
    assert fetched.version == "3.0.0"
    assert fetched.owner == "team-y"
    assert fetched.tags == ("data", "v2")


# ---------------------------------------------------------------------------
# Group round-trip
# ---------------------------------------------------------------------------
def test_put_and_get_group() -> None:
    group = mem.ApphubGroup(
        id="grp-x1", tenant_id=_TENANT_A, name="Custom Group",
        code="x1", icon="star", sort_order=50,
    )
    sql.put_group(_TENANT_A, group)

    fetched = sql.get_group(_TENANT_A, "grp-x1")
    assert fetched is not None
    assert fetched.id == "grp-x1"
    assert fetched.name == "Custom Group"
    assert fetched.code == "x1"
    assert fetched.icon == "star"
    assert fetched.sort_order == 50


# ---------------------------------------------------------------------------
# Module round-trip
# ---------------------------------------------------------------------------
def test_put_and_get_module() -> None:
    module = mem.ApphubModule(
        id="mod-x1", tenant_id=_TENANT_A, name="Custom Module",
        code="x1", app_code="kb", description="a custom module",
        entry_path="/kb/custom",
    )
    sql.put_module(_TENANT_A, module)

    fetched = sql.get_module(_TENANT_A, "mod-x1")
    assert fetched is not None
    assert fetched.id == "mod-x1"
    assert fetched.name == "Custom Module"
    assert fetched.code == "x1"
    assert fetched.app_code == "kb"
    assert fetched.description == "a custom module"
    assert fetched.entry_path == "/kb/custom"


# ---------------------------------------------------------------------------
# Page round-trip
# ---------------------------------------------------------------------------
def test_put_and_get_page() -> None:
    page = mem.ApphubPage(
        id="page-x1", tenant_id=_TENANT_A, name="Custom Page",
        code="x1", module_code="kb", layout="split", schema_version=2,
    )
    sql.put_page(_TENANT_A, page)

    fetched = sql.get_page(_TENANT_A, "page-x1")
    assert fetched is not None
    assert fetched.id == "page-x1"
    assert fetched.name == "Custom Page"
    assert fetched.code == "x1"
    assert fetched.module_code == "kb"
    assert fetched.layout == "split"
    assert fetched.schema_version == 2


# ---------------------------------------------------------------------------
# Template round-trip (dict field)
# ---------------------------------------------------------------------------
def test_put_and_get_template() -> None:
    template = mem.ApphubTemplate(
        id="tpl-x1", tenant_id=_TENANT_A, name="Custom Template",
        code="x1", template_type="workflow", description="a custom template",
        content={"nodes": [{"type": "start"}, {"type": "end"}],
                 "edges": [{"from": "start", "to": "end"}]},
    )
    sql.put_template(_TENANT_A, template)

    fetched = sql.get_template(_TENANT_A, "tpl-x1")
    assert fetched is not None
    assert fetched.id == "tpl-x1"
    assert fetched.name == "Custom Template"
    assert fetched.code == "x1"
    assert fetched.template_type == "workflow"
    assert fetched.description == "a custom template"
    assert fetched.content == {
        "nodes": [{"type": "start"}, {"type": "end"}],
        "edges": [{"from": "start", "to": "end"}],
    }


def test_put_template_upsert() -> None:
    template = mem.ApphubTemplate(
        id="tpl-x2", tenant_id=_TENANT_A, name="V1",
        code="x2", template_type="form", description="v1",
        content={"fields": []},
    )
    sql.put_template(_TENANT_A, template)
    # Update
    template = mem.ApphubTemplate(
        id="tpl-x2", tenant_id=_TENANT_A, name="V2",
        code="x2", template_type="form", description="v2",
        content={"fields": [{"name": "q1"}]},
    )
    sql.put_template(_TENANT_A, template)

    fetched = sql.get_template(_TENANT_A, "tpl-x2")
    assert fetched is not None
    assert fetched.name == "V2"
    assert fetched.description == "v2"
    assert fetched.content == {"fields": [{"name": "q1"}]}


# ---------------------------------------------------------------------------
# Tenant isolation
# ---------------------------------------------------------------------------
def test_list_apps_tenant_isolation() -> None:
    sql.put_app(_TENANT_A, mem.ApphubApp(
        id="app-a1", tenant_id=_TENANT_A, name="A1",
        code="a1", category="platform", description="",
    ))
    sql.put_app(_TENANT_B, mem.ApphubApp(
        id="app-b1", tenant_id=_TENANT_B, name="B1",
        code="b1", category="platform", description="",
    ))

    a_apps = sql.list_apps(_TENANT_A)
    assert [a.id for a in a_apps] == ["app-a1"]

    b_apps = sql.list_apps(_TENANT_B)
    assert [a.id for a in b_apps] == ["app-b1"]

    # Cross-tenant get returns None
    assert sql.get_app(_TENANT_B, "app-a1") is None
    assert sql.get_app(_TENANT_A, "app-b1") is None


def test_list_groups_tenant_isolation() -> None:
    sql.put_group(_TENANT_A, mem.ApphubGroup(
        id="grp-a1", tenant_id=_TENANT_A, name="A1",
        code="a1", icon="book", sort_order=10,
    ))
    sql.put_group(_TENANT_B, mem.ApphubGroup(
        id="grp-b1", tenant_id=_TENANT_B, name="B1",
        code="b1", icon="server", sort_order=20,
    ))

    a_groups = sql.list_groups(_TENANT_A)
    assert [g.id for g in a_groups] == ["grp-a1"]

    b_groups = sql.list_groups(_TENANT_B)
    assert [g.id for g in b_groups] == ["grp-b1"]


# ---------------------------------------------------------------------------
# Anonymous tenant guard
# ---------------------------------------------------------------------------
def test_anonymous_tenant_returns_empty() -> None:
    assert sql.list_apps("") == []
    assert sql.list_groups("") == []
    assert sql.list_modules("") == []
    assert sql.list_pages("") == []
    assert sql.list_templates("") == []
    assert sql.get_app("", "app-x1") is None
    assert sql.get_group("", "grp-x1") is None


# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------
def test_seed_from_inmemory() -> None:
    counts = sql.seed_from_inmemory(_TENANT_A)
    assert counts["apps"] >= 15
    assert counts["groups"] >= 3
    assert counts["modules"] >= 8
    assert counts["pages"] >= 12
    assert counts["templates"] >= 6

    # The seeded data is queryable via the SQL store
    assert len(sql.list_apps(_TENANT_A)) >= 15
    assert len(sql.list_groups(_TENANT_A)) >= 3
    assert len(sql.list_modules(_TENANT_A)) >= 8
    assert len(sql.list_pages(_TENANT_A)) >= 12
    assert len(sql.list_templates(_TENANT_A)) >= 6

    # Seeded data is tenant-scoped (tenant B sees nothing)
    assert sql.list_apps(_TENANT_B) == []
    assert sql.list_templates(_TENANT_B) == []


def test_seed_from_inmemory_is_idempotent() -> None:
    """Re-seeding the same tenant updates rows but does not duplicate."""
    sql.seed_from_inmemory(_TENANT_A)
    first_count = len(sql.list_apps(_TENANT_A))
    sql.seed_from_inmemory(_TENANT_A)
    second_count = len(sql.list_apps(_TENANT_A))
    assert first_count == second_count
    assert first_count >= 15
