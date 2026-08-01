"""Tests for mate_tech_db.protocol — Repository + WritableRepository protocols."""
from __future__ import annotations

from mate_tech_db.protocol import Repository, WritableRepository


# ---------------------------------------------------------------------------
# Concrete implementations for protocol checking
# ---------------------------------------------------------------------------
class _ReadOnlyRepo:
    def list_all(self, tenant_id: str) -> list:
        return []

    def get(self, tenant_id: str, entity_id: str):
        return None


class _WritableRepo:
    def list_all(self, tenant_id: str) -> list:
        return []

    def get(self, tenant_id: str, entity_id: str):
        return None

    def put(self, tenant_id: str, entity) -> object:
        return entity

    def delete(self, tenant_id: str, entity_id: str) -> bool:
        return False

    def count(self, tenant_id: str) -> int:
        return 0


class _IncompleteRepo:
    def list_all(self, tenant_id: str) -> list:
        return []


def test_readonly_repo_satisfies_repository() -> None:
    """A class with list_all + get satisfies the Repository protocol."""
    assert isinstance(_ReadOnlyRepo(), Repository)


def test_writable_repo_satisfies_repository() -> None:
    """A WritableRepo also satisfies the base Repository protocol."""
    assert isinstance(_WritableRepo(), Repository)


def test_writable_repo_satisfies_writable_repository() -> None:
    """A class with put/delete/count satisfies WritableRepository."""
    assert isinstance(_WritableRepo(), WritableRepository)


def test_readonly_repo_does_not_satisfy_writable() -> None:
    """A read-only repo does NOT satisfy WritableRepository."""
    assert not isinstance(_ReadOnlyRepo(), WritableRepository)


def test_incomplete_repo_does_not_satisfy_repository() -> None:
    """A class missing 'get' does NOT satisfy Repository."""
    assert not isinstance(_IncompleteRepo(), Repository)
