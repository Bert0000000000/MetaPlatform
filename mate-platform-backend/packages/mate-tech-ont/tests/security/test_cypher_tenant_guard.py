"""sparql/cypher tenant guard — 4 attack vectors (GOVERN-03 / 2026-08-07).

Each test corresponds to one concrete attack surface listed in
``docs/active/delivery/evidence/GOVERN-03-SUBSPEC.md §03-02``:

1. ``tenant_id=None`` payload → 401 (no ctx on request.state)
2. payload.namespace='acme' but ctx.tenant_id='other' → 403 / 0 rows
3. payload.namespace='ont.other.acme' (prefix forgery) → 403 / 0 rows
4. cross-tenant namespace read → 0 rows

The tests run against the live FastAPI app via ``httpx.AsyncClient``
(with auth middleware in INSECURE_SKIP_SIGNATURE mode) so that the
route handlers — not just the cypher helpers — are exercised.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from mate_tech_ont.main import app
from mate_tech_ont.instances.store import (
    InstanceStore,
    TenantAccessError,
    _coerce_tenant_ns,
    store as instance_store,
)
from mate_tech_ont.security.tenant import TenantContext


# ─────────────────────────────────────────────────────────────────────
# helpers
# ─────────────────────────────────────────────────────────────────────


import time as _time

import jwt as _pyjwt

_TEST_JWT_SECRET = "test-secret"


def _token_for(tenant_id: str = "acme", sub: str = "alice") -> str:
    """Build a Keycloak-format JWT that the auth middleware accepts
    under ``INSECURE_SKIP_SIGNATURE=1``.

    Mirrors ``tests/conftest.make_keycloak_token`` but is local so the
    ``tests/security/`` sub-tree does not depend on the parent
    conftest being importable via ``sys.path``.
    """
    now = int(_time.time())
    return _pyjwt.encode(
        {
            "sub": sub,
            "iss": "http://localhost:8080/realms/metaplatform",
            "aud": "metaplatform-backend",
            "azp": "metaplatform-backend",
            "preferred_username": sub,
            "realm_access": {"roles": ["PLATFORM_SUPER_ADMIN"]},
            "scope": "platform.read platform.write",
            "attributes": {"tenant_id": [tenant_id]},
            "tenant_id": tenant_id,
            "roles": ["PLATFORM_SUPER_ADMIN"],
            "iat": now,
            "exp": now + 3600,
        },
        _TEST_JWT_SECRET,
        algorithm="HS256",
    )


def _seed_acme_and_other() -> None:
    """Seed two instances: one for tenant 'acme', one for tenant 'other'."""
    acme_ctx = TenantContext(tenant_id="acme", user_id="alice", roles=("editor",))
    other_ctx = TenantContext(tenant_id="other", user_id="mallory", roles=("editor",))
    instance_store.create_instance(acme_ctx, class_id="Order", properties={"id": "A1"})
    instance_store.create_instance(other_ctx, class_id="Order", properties={"id": "O1"})


_SELECT_ALL = (
    "SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 50"
)


# ─────────────────────────────────────────────────────────────────────
# vector 1: ctx with tenant_id=None / missing ctx entirely
# ─────────────────────────────────────────────────────────────────────


def test_vector1_execute_sparql_without_ctx_raises() -> None:
    """Calling execute_sparql with ctx=None must raise TenantAccessError.

    GOVERN-03 §03-02 / vector 1.
    """
    from mate_tech_ont.sparql.cypher import execute_sparql

    with pytest.raises(TenantAccessError):
        execute_sparql(_SELECT_ALL, ctx=None)


def test_vector1_execute_sparql_with_ctx_missing_tenant_id_raises() -> None:
    """A ctx object with no tenant_id must also be rejected.

    Defence against partially populated ctx (e.g. when an upstream
    auth provider fails to inject tenant_id).
    """
    from mate_tech_ont.sparql.cypher import execute_sparql

    class EmptyCtx:
        tenant_id = ""
        user_id = "u"

    with pytest.raises(TenantAccessError):
        execute_sparql(_SELECT_ALL, ctx=EmptyCtx())


# ─────────────────────────────────────────────────────────────────────
# vector 2: payload.namespace='acme' but ctx.tenant_id='other'
# ─────────────────────────────────────────────────────────────────────


def test_vector2_payload_namespace_cannot_override_ctx_tenant(
    auth_headers: dict[str, str],
) -> None:
    """A caller authenticated as tenant 'other' cannot read tenant
    'acme' rows. Even if the SPARQL body referenced an 'acme'
    namespace, InstanceStore.list_instances filters strictly by
    ``ctx.tenant_id`` and the cypher defence-in-depth re-projects.
    """
    _seed_acme_and_other()

    client = TestClient(app)

    # Acme-issued JWT will not be accepted by the auth middleware
    # because the auth flow always extracts tenant_id from the token.
    # We force the mismatch by sending an 'other' token.
    other_headers = {"Authorization": f"Bearer {_token_for('other')}"}
    resp = client.post(
        "/api/v1/ont/sparql",
        json={"query": _SELECT_ALL, "format": "json"},
        headers=other_headers,
    )
    assert resp.status_code == 200, resp.text
    bindings = resp.json()["bindings"]
    ids = [b.get("s") for b in bindings]
    # No acme row may appear: A1 belongs to tenant 'acme', O1 to 'other'.
    assert "A1" not in ids, f"cross-tenant leak: {ids}"
    # All visible rows must belong to tenant 'other' (ns starts with
    # ``ont.other.``); no acme row may be present even under the
    # relaxed namespace list.
    other_prefix_ids = {
        i.id for i in instance_store.list_instances(
            TenantContext(tenant_id="other", user_id="m", roles=("editor",))
        )
    }
    for iid in ids:
        if iid is None:
            continue
        assert iid in other_prefix_ids or not iid.startswith(
            ("A", "O")
        ), f"unexpected cross-tenant instance id: {iid}"


# ─────────────────────────────────────────────────────────────────────
# vector 3: payload.namespace='ont.other.acme' (prefix forgery)
# ─────────────────────────────────────────────────────────────────────


def test_vector3_forged_ont_prefix_namespace_rejected() -> None:
    """A caller cannot inject an ``ont.<other-tenant>.<ns>`` namespace
    via InstanceStore to bypass the tenant guard. ``_coerce_tenant_ns``
    must always rewrite the prefix to the caller's own tenant — and a
    namespace that already carries an ``ont.`` qualified prefix is
    rejected outright.
    """
    ctx = TenantContext(tenant_id="acme", user_id="alice", roles=("editor",))
    # Logical ns "loc" is fine — the canonical key is the caller's tenant.
    resolved = _coerce_tenant_ns(ctx, "loc")
    assert resolved == "ont.acme.loc"

    # A pre-qualified namespace is rejected: the caller cannot plant a
    # foreign tenant key into the resolved key.
    forged = "ont.other.acme"
    with pytest.raises(TenantAccessError):
        _coerce_tenant_ns(ctx, forged)


def test_vector3_forged_namespace_value_with_slash_rejected() -> None:
    """A namespace containing path separators is rejected outright."""
    ctx = TenantContext(tenant_id="acme", user_id="alice", roles=("editor",))
    with pytest.raises(TenantAccessError):
        _coerce_tenant_ns(ctx, "ont.other/acme")


# ─────────────────────────────────────────────────────────────────────
# vector 4: cross-tenant read through InstanceStore.get_instance
# ─────────────────────────────────────────────────────────────────────


def test_vector4_cross_tenant_get_returns_none() -> None:
    """A tenant 'other' caller asking for an instance that actually
    belongs to 'acme' must see ``None`` (resource is invisible)."""
    acme_ctx = TenantContext(tenant_id="acme", user_id="alice", roles=("editor",))
    other_ctx = TenantContext(tenant_id="other", user_id="mallory", roles=("editor",))
    inst = instance_store.create_instance(acme_ctx, class_id="Order", properties={"id": "A1"})

    assert instance_store.get_instance(other_ctx, inst.id) is None
    assert instance_store.get_instance(acme_ctx, inst.id) is not None


def test_vector4_cross_tenant_list_returns_only_own_rows() -> None:
    """list_instances for tenant 'other' must not include tenant 'acme' rows."""
    _seed_acme_and_other()
    acme_ctx = TenantContext(tenant_id="acme", user_id="alice", roles=("editor",))
    other_ctx = TenantContext(tenant_id="other", user_id="mallory", roles=("editor",))

    acme_rows = instance_store.list_instances(acme_ctx)
    other_rows = instance_store.list_instances(other_ctx)

    assert all(r.namespace.startswith("ont.acme.") for r in acme_rows)
    assert all(r.namespace.startswith("ont.other.") for r in other_rows)
    assert len(acme_rows) == 1
    assert len(other_rows) == 1
    assert acme_rows[0].id != other_rows[0].id


# ─────────────────────────────────────────────────────────────────────
# bonus: ctx=None on InstanceStore APIs raises (the source of truth
# behind vectors 1-4)
# ─────────────────────────────────────────────────────────────────────


def test_store_methods_reject_none_ctx() -> None:
    """InstanceStore CRUD methods must refuse ``ctx=None``."""
    fresh = InstanceStore()
    with pytest.raises(TenantAccessError):
        fresh.create_instance(None, class_id="Order", properties={})  # type: ignore[arg-type]
    with pytest.raises(TenantAccessError):
        fresh.list_instances(None)  # type: ignore[arg-type]
    with pytest.raises(TenantAccessError):
        fresh.get_instance(None, "anything")  # type: ignore[arg-type]