"""Version store tests (ST-5.4.8)."""
from __future__ import annotations

import pytest

from mate_tech_ont.versioning.store import VersionStore


@pytest.fixture
def fresh() -> VersionStore:
    return VersionStore()


def test_create_version(fresh: VersionStore) -> None:
    v = fresh.create("default", "v1.0.0")
    assert v.ontology_id == "default"
    assert v.version == "v1.0.0"


def test_duplicate_version_raises(fresh: VersionStore) -> None:
    fresh.create("default", "v1.0.0")
    with pytest.raises(ValueError, match="exists"):
        fresh.create("default", "v1.0.0")


def test_list_for_ontology(fresh: VersionStore) -> None:
    fresh.create("default", "v1.0.0")
    fresh.create("default", "v1.1.0")
    fresh.create("other", "v1.0.0")
    default_versions = fresh.list_for_ontology("default")
    assert len(default_versions) == 2
    assert {v.version for v in default_versions} == {"v1.0.0", "v1.1.0"}


def test_parent_version(fresh: VersionStore) -> None:
    fresh.create("default", "v1.0.0")
    v2 = fresh.create("default", "v1.1.0", parent="v1.0.0")
    assert v2.parent == "v1.0.0"


def test_delete_version(fresh: VersionStore) -> None:
    fresh.create("default", "v1.0.0")
    assert fresh.delete("default", "v1.0.0") is True
    assert fresh.get("default", "v1.0.0") is None


def test_metadata(fresh: VersionStore) -> None:
    v = fresh.create("default", "v1.0.0", metadata={"author": "alice"})
    assert v.metadata == {"author": "alice"}
