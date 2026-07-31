"""Tests for the SQL-backed architecture-center repository.

Uses SQLite in-memory to verify the ORM models, CRUD operations,
tenant isolation, tuple round-tripping, and seed_from_inmemory
bootstrap work correctly.
"""
from __future__ import annotations

# Import models so their tables register on Base.metadata before create_all
import mate_app_arch.repositories.sql_models  # noqa: F401
import pytest
from mate_app_arch.repositories.in_memory import (
    Application,
    Capability,
    DataAsset,
    DataEntity,
    DataFlow,
)
from mate_app_arch.repositories.sql_store import (
    list_applications,
    list_capabilities,
    list_capability_tree,
    list_data_assets,
    list_data_entities,
    list_data_flows,
    put_application,
    put_capability,
    put_data_asset,
    put_data_entity,
    put_data_flow,
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
    if _state.engine is not None:
        Base.metadata.drop_all(_state.engine)


def test_orm_models_create_tables(sql_backend: None) -> None:
    """Verify arch_ tables exist after create_all."""
    s = get_session()
    insp = inspect(s.bind)
    tables = set(insp.get_table_names())
    expected = {
        "arch_applications",
        "arch_business_processes",
        "arch_capabilities",
        "arch_data_assets",
        "arch_data_entities",
        "arch_data_flows",
        "arch_data_standards",
        "arch_data_domains",
        "arch_deployments",
        "arch_infrastructures",
        "arch_principle_categories",
        "arch_principles",
        "arch_review_templates",
        "arch_review_tickets",
        "arch_tech_debts",
        "arch_impact_analysis",
        "arch_ontology_rules",
        "arch_ontology_changes",
        "arch_orgs",
        "arch_roles",
        "arch_tech_stacks",
        "arch_technology_components",
        "arch_technology_radar",
        "arch_technology_stacks",
        "arch_value_streams",
    }
    assert expected.issubset(tables), f"missing tables: {expected - tables}"


def test_put_and_list_application(sql_backend: None) -> None:
    """Insert an application via SQL store and read it back."""
    app = Application(
        id="app-test-1",
        tenant_id="tenant-acme",
        name="Test App",
        code="test-app",
        category="platform",
        owner="test-team",
        description="A test application",
    )
    put_application("tenant-acme", app)

    results = list_applications("tenant-acme")
    assert len(results) == 1
    assert results[0].id == "app-test-1"
    assert results[0].name == "Test App"
    assert results[0].code == "test-app"
    assert results[0].category == "platform"


def test_update_application(sql_backend: None) -> None:
    """Verify put_application updates an existing row."""
    app = Application(
        id="app-upd",
        tenant_id="tenant-acme",
        name="Original",
        code="upd",
        category="data",
        owner="team-a",
    )
    put_application("tenant-acme", app)

    updated = Application(
        id="app-upd",
        tenant_id="tenant-acme",
        name="Renamed",
        code="upd",
        category="platform",
        owner="team-b",
        status="deprecated",
        description="Updated description",
    )
    put_application("tenant-acme", updated)

    results = list_applications("tenant-acme")
    assert len(results) == 1
    assert results[0].name == "Renamed"
    assert results[0].category == "platform"
    assert results[0].status == "deprecated"
    assert results[0].description == "Updated description"


def test_put_and_list_capability(sql_backend: None) -> None:
    """Insert capabilities and verify flat list + tree structure."""
    root = Capability(
        id="cap-root",
        tenant_id="tenant-acme",
        name="Root Cap",
        code="cap-root",
        level=1,
    )
    child = Capability(
        id="cap-child",
        tenant_id="tenant-acme",
        name="Child Cap",
        code="cap-child",
        parent_id="cap-root",
        level=2,
    )
    put_capability("tenant-acme", root)
    put_capability("tenant-acme", child)

    flat = list_capabilities("tenant-acme")
    assert len(flat) == 2
    assert {c.code for c in flat} == {"cap-root", "cap-child"}

    tree = list_capability_tree("tenant-acme")
    assert len(tree) == 1
    assert tree[0]["code"] == "cap-root"
    assert len(tree[0]["children"]) == 1
    assert tree[0]["children"][0]["code"] == "cap-child"


def test_data_entity_tuple_round_trip(sql_backend: None) -> None:
    """Verify DataEntity with tuple fields survives a write-read cycle."""
    entity = DataEntity(
        id="de-rt",
        tenant_id="tenant-acme",
        name="test_entity",
        code="de-rt",
        data_asset_id="da-test",
        fields=("uid", "event", "ts"),
    )
    put_data_entity("tenant-acme", entity)

    results = list_data_entities("tenant-acme")
    assert len(results) == 1
    assert results[0].fields == ("uid", "event", "ts")


def test_data_flow_round_trip(sql_backend: None) -> None:
    """Verify DataFlow round-trips through SQL."""
    flow = DataFlow(
        id="df-rt",
        tenant_id="tenant-acme",
        name="Test Flow",
        code="df-rt",
        source_entity_id="de-src",
        target_entity_id="de-tgt",
        pipeline_spec="spec-yaml",
    )
    put_data_flow("tenant-acme", flow)

    results = list_data_flows("tenant-acme")
    assert len(results) == 1
    assert results[0].source_entity_id == "de-src"
    assert results[0].target_entity_id == "de-tgt"
    assert results[0].pipeline_spec == "spec-yaml"


def test_data_asset_round_trip(sql_backend: None) -> None:
    """Verify DataAsset round-trips through SQL."""
    asset = DataAsset(
        id="da-rt",
        tenant_id="tenant-acme",
        name="Test Asset",
        code="da-rt",
        layer="D5",
        domain="order",
        owner="order-team",
    )
    put_data_asset("tenant-acme", asset)

    results = list_data_assets("tenant-acme")
    assert len(results) == 1
    assert results[0].layer == "D5"
    assert results[0].domain == "order"


def test_tenant_isolation(sql_backend: None) -> None:
    """Verify tenant A cannot see tenant B's data."""
    put_application("tenant-acme", Application(
        id="app-acme", tenant_id="tenant-acme", name="Acme App", code="acme",
        category="platform", owner="a",
    ))
    put_application("tenant-globex", Application(
        id="app-globex", tenant_id="tenant-globex", name="Globex App", code="globex",
        category="data", owner="g",
    ))

    acme = list_applications("tenant-acme")
    globex = list_applications("tenant-globex")
    assert len(acme) == 1 and acme[0].id == "app-acme"
    assert len(globex) == 1 and globex[0].id == "app-globex"


def test_empty_tenant_returns_empty(sql_backend: None) -> None:
    """Empty or missing tenant_id should return an empty list."""
    assert list_applications("") == []
    assert list_capabilities("") == []


def test_seed_from_inmemory(sql_backend: None) -> None:
    """Bootstrap SQL store from in-memory seed data."""
    counts = seed_from_inmemory("tenant-acme")
    assert counts["applications"] >= 20  # in_memory seeds 20 apps
    assert counts["capabilities"] >= 15  # 15 capabilities
    assert counts["data_assets"] >= 10   # 12 data assets
    assert counts["data_entities"] >= 5  # 5 data entities
    assert counts["data_flows"] >= 3     # 3 data flows

    apps = list_applications("tenant-acme")
    assert len(apps) >= 20
    # Verify tuple fields survive seeding
    entities = list_data_entities("tenant-acme")
    assert len(entities) >= 5
    assert all(len(e.fields) > 0 for e in entities)
