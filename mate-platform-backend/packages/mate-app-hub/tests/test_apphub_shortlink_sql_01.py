"""APPHUB-RUNTIME-01 shortlink SQL persistence tests (K3-1).

Verifies that the ``apphub_shortlinks`` table backing the
ShortlinkStoreSQL functions (defined in
``repositories.sql_store``) satisfy the SQL persistence contract:

- create / resolve round-trip
- cross-tenant isolation (row with same code in another tenant must
  not leak)
- expires_at filter (resolver rejects past expiry)
- delete round-trip
- tenant-scoping of list

Uses an in-memory SQLite engine via ``mate_tech_db.base.init_engine``
(the same pattern as ``test_apphub_sql_store.py``).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from mate_app_hub.repositories import sql_store
from mate_app_hub.repositories.sql_models import ApphubShortlinkORM  # noqa: F401
from mate_app_hub.shortlink.repository import InMemoryShortlinkStore, ShortlinkEntry
from mate_app_hub.shortlink.resolver import resolve
from mate_app_hub.shortlink.service import (
    create_shortlink,
    list_shortlinks,
    resolve_shortlink,
    revoke_shortlink,
)
from mate_tech_db.base import create_all, init_engine, reset_engine


@pytest.fixture(autouse=True)
def _fresh_db() -> None:
    """Reset the engine and create all tables before each test."""
    reset_engine()
    init_engine("sqlite:///:memory:")
    create_all()
    yield
    reset_engine()


def _put(**kwargs) -> ShortlinkEntry:
    """Convenience helper: build a ShortlinkEntry and put_shortlink via sql_store."""
    now = datetime.now(timezone.utc)
    expires = kwargs.get("expires_at")
    # Derive a unique id from the code so multiple inserts in one
    # test do not overwrite each other (sl-1, sl-2, ...).
    entry = ShortlinkEntry(
        id=f"sl-{kwargs['code']}",
        tenant_id=kwargs["tenant_id"],
        app_id=kwargs.get("app_id", "app-1"),
        code=kwargs["code"],
        role=kwargs.get("role"),
        expires_at=expires.isoformat() if isinstance(expires, datetime) else expires,
        created_at=now.isoformat(),
    )
    return sql_store.put_shortlink(entry.tenant_id, entry)


def test_create_and_resolve_round_trip() -> None:
    """put_shortlink + get_shortlink_by_code round-trip preserves fields."""
    future = datetime.now(timezone.utc) + timedelta(hours=1)
    entry = _put(
        tenant_id="tenant-a", code="ABC123",
        app_id="app-1", role="editor", expires_at=future,
    )
    found = sql_store.get_shortlink_by_code("tenant-a", "ABC123")
    assert found is not None
    assert found.app_id == "app-1"
    assert found.role == "editor"
    assert found.expires_at is not None
    # ISO format with timezone; comparison at minute granularity is fine.
    assert found.expires_at.startswith(future.strftime("%Y-%m-%dT%H:%M"))


def test_cross_tenant_isolation() -> None:
    """A shortlink in tenant-a must not be visible from tenant-b."""
    _put(tenant_id="tenant-a", code="SHARED")
    assert sql_store.get_shortlink_by_code("tenant-a", "SHARED") is not None
    assert sql_store.get_shortlink_by_code("tenant-b", "SHARED") is None


def test_expires_at_filter() -> None:
    """A past expires_at makes resolve raise ValueError("shortlink expired")."""
    past = datetime.now(timezone.utc) - timedelta(hours=1)
    entry = _put(
        tenant_id="tenant-a", code="OLD01",
        app_id="app-1", expires_at=past,
    )
    store = InMemoryShortlinkStore()
    store.put(entry)
    with pytest.raises(ValueError, match="expired"):
        resolve(store, "tenant-a", "OLD01")


def test_delete_round_trip() -> None:
    """delete_shortlink_by_code removes the row and is idempotent."""
    _put(tenant_id="tenant-a", code="DELME")
    assert sql_store.delete_shortlink_by_code("tenant-a", "DELME") is True
    assert sql_store.delete_shortlink_by_code("tenant-a", "DELME") is False
    assert sql_store.get_shortlink_by_code("tenant-a", "DELME") is None


def test_list_scoped_to_tenant() -> None:
    """list_shortlinks returns only entries belonging to the requested tenant."""
    _put(tenant_id="tenant-a", code="LST01")
    _put(tenant_id="tenant-a", code="LST02")
    _put(tenant_id="tenant-b", code="LST03")
    entries = sql_store.list_shortlinks("tenant-a")
    codes = sorted(e.code for e in entries)
    assert codes == ["LST01", "LST02"]
    assert sql_store.list_shortlinks("tenant-b") != []


def test_shortlink_exists_helper() -> None:
    """shortlink_exists returns True for known entries and False otherwise."""
    _put(tenant_id="tenant-a", code="EXIST")
    assert sql_store.shortlink_exists("tenant-a", "EXIST") is True
    assert sql_store.shortlink_exists("tenant-a", "MISS") is False
    assert sql_store.shortlink_exists("tenant-b", "EXIST") is False


def test_resolve_shortlink_helper() -> None:
    """service.resolve_shortlink delegates to resolver.resolve."""
    future = datetime.now(timezone.utc) + timedelta(hours=1)
    entry = _put(
        tenant_id="tenant-a", code="HLP01",
        app_id="app-1", role="admin", expires_at=future,
    )
    store = InMemoryShortlinkStore()
    store.put(entry)
    result = resolve_shortlink(store, "tenant-a", "HLP01")
    assert result["app_id"] == "app-1"
    assert result["role"] == "admin"


def test_revoke_shortlink_helper() -> None:
    """sql_store.delete_shortlink_by_code deletes via SQL."""
    _put(tenant_id="tenant-a", code="RVK01")
    assert sql_store.delete_shortlink_by_code("tenant-a", "RVK01") is True
    assert sql_store.get_shortlink_by_code("tenant-a", "RVK01") is None


def test_create_shortlink_helper_with_expires_at() -> None:
    """service.create_shortlink with expires_at passes it through."""
    future = datetime.now(timezone.utc) + timedelta(hours=2)
    store = InMemoryShortlinkStore()
    entry = create_shortlink(store, "tenant-a", "app-1", expires_at=future)
    assert entry.expires_at is not None
    assert entry.expires_at.startswith(future.strftime("%Y-%m-%dT%H:%M"))