"""APPHUB-RUNTIME-01 phase C tests — short-link 4 modules + 3 endpoints.

Covers:
  - generator:  default length / type / no ambiguous chars / randomness
  - repository: put+get / nonexistent / list / empty tenant / delete / exists
  - resolver:   returns app_id / nonexistent raises / cross-tenant raises
  - service:    create generates code / stores entry / collision retry / revoke
  - endpoints:  POST 201 / GET resolve 200 / 404 / list items / cross-tenant 404
  - isolation:  two tenants same code / tenant A cannot read tenant B
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from mate_app_hub.main import create_app
from mate_app_hub.repositories import in_memory as in_memory_repo
from mate_app_hub.shortlink import (
    ALPHABET,
    InMemoryShortlinkStore,
    ShortlinkEntry,
    create_shortlink,
    generate_code,
    get_default_store,
    list_shortlinks,
    resolve,
    resolve_shortlink,
    revoke_shortlink,
)

from mate_platform.messaging.outbox import InMemoryOutboxWriter


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(autouse=True)
def _reset_store() -> None:  # pyright: ignore[reportUnusedFunction]
    """Reset both the apphub seed store and the shortlink default store."""
    in_memory_repo.reset_store()
    get_default_store().reset()
    yield
    in_memory_repo.reset_store()
    get_default_store().reset()


@pytest.fixture
def outbox() -> InMemoryOutboxWriter:
    return InMemoryOutboxWriter()


@pytest.fixture
def client(outbox: InMemoryOutboxWriter) -> TestClient:
    """Per-test TestClient with fresh store + outbox wired."""
    in_memory_repo.reset_store()
    get_default_store().reset()
    app = create_app()
    app.state.outbox_writer = outbox
    yield TestClient(app)
    in_memory_repo.reset_store()
    get_default_store().reset()


# ---------------------------------------------------------------------------
# Generator tests (4)
# ---------------------------------------------------------------------------
def test_generate_code_default_length_8()-> None:
    assert len(generate_code()) == 8


def test_generate_code_returns_string()-> None:
    code = generate_code()
    assert isinstance(code, str)


def test_generate_code_no_ambiguous_chars()-> None:
    ambiguous = set("0O1Il")
    for _ in range(100):
        code = generate_code()
        assert not (set(code) & ambiguous)
        # Every char must come from the declared alphabet.
        assert set(code) <= set(ALPHABET)


def test_generate_code_randomness()-> None:
    codes = {generate_code() for _ in range(50)}
    # 50 random 8-char codes should be (almost) all distinct.
    assert len(codes) > 1


# ---------------------------------------------------------------------------
# Repository tests (6)
# ---------------------------------------------------------------------------
def test_put_and_get_by_code()-> None:
    store = InMemoryShortlinkStore()
    entry = ShortlinkEntry(
        id="sl-abc12345", tenant_id="t1", app_id="kb",
        code="abc12345", created_at="2026-01-01T00:00:00+00:00",
    )
    store.put(entry)
    got = store.get_by_code("t1", "abc12345")
    assert got is not None
    assert got.app_id == "kb"


def test_get_by_code_nonexistent_returns_none()-> None:
    store = InMemoryShortlinkStore()
    assert store.get_by_code("t1", "nope") is None


def test_list_returns_all_entries()-> None:
    store = InMemoryShortlinkStore()
    store.put(ShortlinkEntry(id="sl-1", tenant_id="t1", app_id="a", code="c1"))
    store.put(ShortlinkEntry(id="sl-2", tenant_id="t1", app_id="b", code="c2"))
    items = store.list("t1")
    assert len(items) == 2


def test_list_empty_tenant_returns_empty()-> None:
    store = InMemoryShortlinkStore()
    assert store.list("t1") == []


def test_delete_removes_entry()-> None:
    store = InMemoryShortlinkStore()
    store.put(ShortlinkEntry(id="sl-1", tenant_id="t1", app_id="a", code="c1"))
    assert store.delete("t1", "c1") is True
    assert store.get_by_code("t1", "c1") is None
    assert store.delete("t1", "c1") is False


def test_exists_checks_presence()-> None:
    store = InMemoryShortlinkStore()
    assert store.exists("t1", "c1") is False
    store.put(ShortlinkEntry(id="sl-1", tenant_id="t1", app_id="a", code="c1"))
    assert store.exists("t1", "c1") is True


# ---------------------------------------------------------------------------
# Resolver tests (3)
# ---------------------------------------------------------------------------
def test_resolve_returns_app_id()-> None:
    store = InMemoryShortlinkStore()
    store.put(ShortlinkEntry(
        id="sl-1", tenant_id="t1", app_id="kb", code="c1",
        created_at="2026-01-01T00:00:00+00:00",
    ))
    result = resolve(store, "t1", "c1")
    assert result["app_id"] == "kb"


def test_resolve_nonexistent_raises()-> None:
    store = InMemoryShortlinkStore()
    with pytest.raises(ValueError, match="not found"):
        resolve(store, "t1", "nope")


def test_resolve_cross_tenant_raises()-> None:
    store = InMemoryShortlinkStore()
    store.put(ShortlinkEntry(id="sl-1", tenant_id="t1", app_id="kb", code="c1"))
    # tenant t2 has no such code → treated as not found.
    with pytest.raises(ValueError, match="not found"):
        resolve(store, "t2", "c1")


# ---------------------------------------------------------------------------
# Service tests (4)
# ---------------------------------------------------------------------------
def test_create_shortlink_generates_code()-> None:
    store = InMemoryShortlinkStore()
    entry = create_shortlink(store, "t1", "kb")
    assert entry.code
    assert len(entry.code) == 8
    assert entry.app_id == "kb"


def test_create_shortlink_stores_entry()-> None:
    store = InMemoryShortlinkStore()
    entry = create_shortlink(store, "t1", "kb", role="viewer")
    assert store.exists("t1", entry.code) is True
    got = store.get_by_code("t1", entry.code)
    assert got is not None
    assert got.role == "viewer"


def test_create_shortlink_collision_retry(monkeypatch: pytest.MonkeyPatch)-> None:
    """First two generated codes collide; third must succeed."""
    store = InMemoryShortlinkStore()
    # Pre-seed an entry with the code the generator will emit first.
    store.put(ShortlinkEntry(
        id="sl-x", tenant_id="t1", app_id="other", code="COLLIDE0",
    ))
    calls = {"n": 0}

    def fake_gen(length: int = 8) -> str:
        calls["n"] += 1
        if calls["n"] == 1:
            return "COLLIDE0"  # collides with seeded entry
        return "UNIQUE009"

    monkeypatch.setattr(
        "mate_app_hub.shortlink.service.generate_code", fake_gen,
    )
    entry = create_shortlink(store, "t1", "kb")
    assert entry.code == "UNIQUE009"
    assert calls["n"] == 2  # first collided, second succeeded


def test_revoke_shortlink()-> None:
    store = InMemoryShortlinkStore()
    entry = create_shortlink(store, "t1", "kb")
    assert revoke_shortlink(store, "t1", entry.code) is True
    assert store.exists("t1", entry.code) is False
    assert revoke_shortlink(store, "t1", entry.code) is False


# ---------------------------------------------------------------------------
# Endpoint tests (5)
# ---------------------------------------------------------------------------
def test_create_shortlink_endpoint_returns_201(client: TestClient, auth_headers_acme: dict[str, str])-> None:
    r = client.post(
        "/api/v1/apphub/shortlinks",
        json={"app_id": "kb", "role": "viewer"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["code"]
    assert body["app_id"] == "kb"
    assert body["created_at"]


def test_resolve_shortlink_endpoint_returns_200(client: TestClient, auth_headers_acme: dict[str, str])-> None:
    r_create = client.post(
        "/api/v1/apphub/shortlinks",
        json={"app_id": "kb"},
        headers=auth_headers_acme,
    )
    assert r_create.status_code == 201, r_create.text
    code = r_create.json()["code"]

    r = client.get(
        f"/api/v1/apphub/shortlinks/{code}",
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["app_id"] == "kb"


def test_resolve_shortlink_not_found_404(client: TestClient, auth_headers_acme: dict[str, str])-> None:
    r = client.get(
        "/api/v1/apphub/shortlinks/NOPE0000",
        headers=auth_headers_acme,
    )
    assert r.status_code == 404, r.text


def test_list_shortlinks_endpoint_returns_items(client: TestClient, auth_headers_acme: dict[str, str])-> None:
    # Create two shortlinks.
    for app_id in ("kb", "rag"):
        client.post(
            "/api/v1/apphub/shortlinks",
            json={"app_id": app_id},
            headers=auth_headers_acme,
        )
    r = client.get(
        "/api/v1/apphub/shortlinks",
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    assert len(items) == 2
    app_ids = {it["app_id"] for it in items}
    assert app_ids == {"kb", "rag"}


def test_cross_tenant_resolve_returns_404(client: TestClient, auth_headers_acme: dict[str, str], auth_headers_globex: dict[str, str])-> None:
    # Create a shortlink under tenant-acme.
    r_create = client.post(
        "/api/v1/apphub/shortlinks",
        json={"app_id": "kb"},
        headers=auth_headers_acme,
    )
    assert r_create.status_code == 201, r_create.text
    code = r_create.json()["code"]

    # tenant-globex cannot resolve tenant-acme's shortlink → 404.
    r = client.get(
        f"/api/v1/apphub/shortlinks/{code}",
        headers=auth_headers_globex,
    )
    assert r.status_code == 404, r.text


# ---------------------------------------------------------------------------
# Isolation tests (2)
# ---------------------------------------------------------------------------
def test_two_tenants_same_code_different_apps()-> None:
    """The same code can exist under different tenants pointing at
    different apps — codes are namespaced by tenant."""
    store = InMemoryShortlinkStore()
    store.put(ShortlinkEntry(
        id="sl-1", tenant_id="t1", app_id="kb", code="SHAREDCD0",
    ))
    store.put(ShortlinkEntry(
        id="sl-2", tenant_id="t2", app_id="rag", code="SHAREDCD0",
    ))
    assert resolve(store, "t1", "SHAREDCD0")["app_id"] == "kb"
    assert resolve(store, "t2", "SHAREDCD0")["app_id"] == "rag"


def test_shortlink_tenant_isolation()-> None:
    """Tenant A cannot list or resolve tenant B's shortlinks."""
    store = InMemoryShortlinkStore()
    create_shortlink(store, "tenant-a", "kb")
    # tenant-a has 1 entry; tenant-b has none.
    assert len(list_shortlinks(store, "tenant-a")) == 1
    assert list_shortlinks(store, "tenant-b") == []
    # Resolving tenant-a's code from tenant-b raises.
    entry_a = list_shortlinks(store, "tenant-a")[0]
    with pytest.raises(ValueError, match="not found"):
        resolve_shortlink(store, "tenant-b", entry_a.code)
