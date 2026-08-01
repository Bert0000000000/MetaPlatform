"""Tests for mate_tech_ont.repositories.sql_store — SQL persistence (P3-W4)."""
from __future__ import annotations

import pytest

from mate_tech_db.base import Base, create_all, init_engine, reset_engine
from mate_tech_ont.repositories import in_memory as mem
from mate_tech_ont.repositories import sql_models as models  # noqa: F401
from mate_tech_ont.repositories import sql_store as sql


@pytest.fixture(autouse=True)
def _fresh_db() -> None:
    reset_engine()
    init_engine("sqlite:///:memory:")
    create_all()
    yield
    reset_engine()


_TENANT_A = "tenant-acme"
_TENANT_B = "tenant-bigo"


def test_put_and_get_ontology() -> None:
    ont = mem.Ontology(
        id="ont-1", tenant_id=_TENANT_A, namespace="sales",
        description="Sales domain", created_at="2026-08-01T00:00:00Z",
    )
    sql.put_ontology(_TENANT_A, ont)
    fetched = sql.get_ontology(_TENANT_A, "ont-1")
    assert fetched is not None
    assert fetched.namespace == "sales"
    assert fetched.description == "Sales domain"


def test_put_ontology_upsert() -> None:
    ont = mem.Ontology(id="ont-2", tenant_id=_TENANT_A, namespace="hr")
    sql.put_ontology(_TENANT_A, ont)
    ont = mem.Ontology(id="ont-2", tenant_id=_TENANT_A, namespace="hr2", description="updated")
    sql.put_ontology(_TENANT_A, ont)
    fetched = sql.get_ontology(_TENANT_A, "ont-2")
    assert fetched is not None
    assert fetched.namespace == "hr2"
    assert fetched.description == "updated"


def test_delete_ontology() -> None:
    sql.put_ontology(_TENANT_A, mem.Ontology(id="ont-del", tenant_id=_TENANT_A))
    assert sql.delete_ontology(_TENANT_A, "ont-del") is True
    assert sql.get_ontology(_TENANT_A, "ont-del") is None
    assert sql.delete_ontology(_TENANT_A, "ont-del") is False


def test_put_and_get_class() -> None:
    cls = mem.OntologyClass(
        id="cls-1", tenant_id=_TENANT_A, ontology_id="ont-1",
        label="Customer", properties={"fields": "name,code"},
    )
    sql.put_class(_TENANT_A, cls)
    fetched = sql.get_class(_TENANT_A, "cls-1")
    assert fetched is not None
    assert fetched.label == "Customer"
    assert fetched.properties == {"fields": "name,code"}


def test_put_class_upsert() -> None:
    cls = mem.OntologyClass(id="cls-2", tenant_id=_TENANT_A, label="Old")
    sql.put_class(_TENANT_A, cls)
    cls = mem.OntologyClass(
        id="cls-2", tenant_id=_TENANT_A, label="New",
        properties={"key": "val"},
    )
    sql.put_class(_TENANT_A, cls)
    fetched = sql.get_class(_TENANT_A, "cls-2")
    assert fetched is not None
    assert fetched.label == "New"
    assert fetched.properties == {"key": "val"}


def test_delete_class_cross_tenant() -> None:
    sql.put_class(_TENANT_A, mem.OntologyClass(id="cls-x", tenant_id=_TENANT_A))
    assert sql.delete_class(_TENANT_B, "cls-x") is False
    assert sql.get_class(_TENANT_A, "cls-x") is not None


def test_put_and_get_instance() -> None:
    inst = mem.OntologyInstance(
        id="inst-1", tenant_id=_TENANT_A, class_id="cls-1",
        properties={"name": "Acme"},
    )
    sql.put_instance(_TENANT_A, inst)
    fetched = sql.get_instance(_TENANT_A, "inst-1")
    assert fetched is not None
    assert fetched.class_id == "cls-1"
    assert fetched.properties == {"name": "Acme"}


def test_put_and_get_version() -> None:
    ver = mem.OntologyVersion(
        id="ver-1", tenant_id=_TENANT_A, ontology_id="ont-1",
        version="v1.0.0", metadata={"author": "test"},
    )
    sql.put_version(_TENANT_A, ver)
    fetched = sql.get_version(_TENANT_A, "ver-1")
    assert fetched is not None
    assert fetched.version == "v1.0.0"
    assert fetched.metadata == {"author": "test"}


def test_tenant_isolation() -> None:
    sql.put_ontology(_TENANT_A, mem.Ontology(id="ont-a", tenant_id=_TENANT_A))
    sql.put_ontology(_TENANT_B, mem.Ontology(id="ont-b", tenant_id=_TENANT_B))
    assert [o.id for o in sql.list_ontologies(_TENANT_A)] == ["ont-a"]
    assert [o.id for o in sql.list_ontologies(_TENANT_B)] == ["ont-b"]
    assert sql.get_ontology(_TENANT_B, "ont-a") is None


def test_anonymous_tenant_returns_empty() -> None:
    assert sql.list_ontologies("") == []
    assert sql.list_classes("") == []
    assert sql.list_instances("") == []
    assert sql.list_versions("") == []
    assert sql.get_ontology("", "ont-1") is None


def test_seed_from_inmemory() -> None:
    counts = sql.seed_from_inmemory(_TENANT_A)
    assert counts["ontologies"] >= 3
    assert counts["classes"] >= 3
    assert counts["instances"] >= 3
    assert counts["versions"] >= 2
    assert len(sql.list_ontologies(_TENANT_A)) >= 3
    assert sql.list_ontologies(_TENANT_B) == []
