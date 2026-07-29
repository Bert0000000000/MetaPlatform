"""Instance + relation tests (ST-5.4.7)."""
from __future__ import annotations

import pytest

from mate_tech_ont.instances.store import InstanceStore


@pytest.fixture
def fresh_store() -> InstanceStore:
    return InstanceStore()


def test_create_instance(fresh_store: InstanceStore) -> None:
    inst = fresh_store.create_instance("Concept", {"name": "X"})
    assert inst.class_id == "Concept"
    assert inst.properties == {"name": "X"}
    assert inst.id


def test_list_instances_by_class(fresh_store: InstanceStore) -> None:
    fresh_store.create_instance("Concept", {})
    fresh_store.create_instance("Concept", {})
    fresh_store.create_instance("Object", {})
    concepts = fresh_store.list_instances("Concept")
    objects = fresh_store.list_instances("Object")
    assert len(concepts) == 2
    assert len(objects) == 1


def test_create_relation_requires_existing_instances(fresh_store: InstanceStore) -> None:
    a = fresh_store.create_instance("Concept", {})
    with pytest.raises(ValueError, match="not found"):
        fresh_store.create_relation("subclass_of", a.id, "missing-id")


def test_delete_instance_cascades_relations(fresh_store: InstanceStore) -> None:
    a = fresh_store.create_instance("Concept", {})
    b = fresh_store.create_instance("Object", {})
    fresh_store.create_relation("type_of", a.id, b.id)
    assert len(fresh_store.list_relations()) == 1
    fresh_store.delete_instance(a.id)
    assert len(fresh_store.list_relations()) == 0


def test_get_unknown_instance_returns_none(fresh_store: InstanceStore) -> None:
    assert fresh_store.get_instance("nope") is None
