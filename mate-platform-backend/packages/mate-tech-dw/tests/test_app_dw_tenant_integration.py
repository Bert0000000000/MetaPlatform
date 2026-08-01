"""Cross-tenant integration tests for mate-tech-dw (ADR-0014 step 5).

These tests exercise the auth + tenancy contract end-to-end:

  - test_wrong_tenant_403: token binds tenant A but caller requests
    data scoped to tenant B (via X-Tenant-Id header) -> 403.
  - test_missing_scope_403: token with no scopes reaches the handler
    (current behaviour; pinned because step 4 ACL wiring is out of
    scope for PR#15).
  - test_no_tenant_400: token with empty tenant_id is rejected by
    require_tenant (TenantAccessError -> 400).
  - test_tenant_isolation_ok: two tenants querying the same
    endpoint see disjoint catalogs.
  - test_upload_isolated: documents uploaded by tenant A are
    not visible to tenant B.
"""
from __future__ import annotations

import time

import jwt as pyjwt
import pytest
from fastapi.testclient import TestClient
from mate_tech_dw.main import create_app
from mate_tech_dw.repositories import in_memory as in_memory_repo

JWT_SECRET = "test-secret"


def _token(*, tenant_id: str, scopes: str = "platform.read platform.write") -> str:
    now = int(time.time())
    return pyjwt.encode(
        {
            "sub": "u-1",
            "iss": "http://localhost:8080/realms/metaplatform",
            "aud": "metaplatform-backend",
            "azp": "metaplatform-backend",
            "preferred_username": "u-1",
            "realm_access": {"roles": ["PLATFORM_SUPER_ADMIN"]},
            "scope": scopes,
            "attributes": {"tenant_id": [tenant_id]},
            "tenant_id": tenant_id,
            "roles": ["PLATFORM_SUPER_ADMIN"],
            "iat": now,
            "exp": now + 3600,
        },
        JWT_SECRET,
        algorithm="HS256",
    )


@pytest.fixture
def fresh_app() -> TestClient:
    """Per-test TestClient with a clean in-memory store."""
    in_memory_repo.reset_store()
    return TestClient(create_app(), raise_server_exceptions=False)


def test_wrong_tenant_403(fresh_app: TestClient) -> None:
    """Token binds tenant A, X-Tenant-Id header asks for tenant B -> 403."""
    token_a = _token(tenant_id="tenant-acme")
    r = fresh_app.get(
        "/api/v1/dw/employees",
        headers={
            "Authorization": f"Bearer {token_a}",
            "X-Tenant-Id": "tenant-globex",
        },
    )
    assert r.status_code == 403, r.text
    assert "tenant" in r.text.lower()


def test_missing_scope_403(fresh_app: TestClient) -> None:
    """Token without `platform.read` still reaches the handler today.

    Step 4 (per-scope ACL wiring via mate_clients.security.BearerAuth)
    is out of scope for PR#15; this test pins the current behaviour
    so we notice when the contract lands.
    """
    token = _token(tenant_id="tenant-acme", scopes="")
    r = fresh_app.get(
        "/api/v1/dw/employees",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text


def test_no_tenant_400(fresh_app: TestClient) -> None:
    """Token with empty tenant_id is rejected by require_tenant."""
    token = _token(tenant_id="")
    r = fresh_app.get(
        "/api/v1/dw/employees",
        headers={"Authorization": f"Bearer {token}"},
    )
    # require_tenant raises TenantAccessError which the platform maps
    # to a structured 400 Bad Request (registered in install_auth).
    assert r.status_code == 400, r.text
    assert r.json()["code"] == "E_TENANT_REQUIRED"


def test_tenant_isolation_ok(fresh_app: TestClient) -> None:
    """Acme and globex must see disjoint catalogs.

    This is the strongest isolation guarantee: same endpoint,
    different tenants, completely different data. The in-memory
    repo seeds independently per tenant_id.
    """
    token_acme = _token(tenant_id="tenant-acme")
    token_globex = _token(tenant_id="tenant-globex")

    r1 = fresh_app.get(
        "/api/v1/dw/employees",
        headers={"Authorization": f"Bearer {token_acme}"},
    )
    r2 = fresh_app.get(
        "/api/v1/dw/employees",
        headers={"Authorization": f"Bearer {token_globex}"},
    )
    assert r1.status_code == 200, r1.text
    assert r2.status_code == 200, r2.text

    # Every item must carry its own tenant_id and never leak.
    assert all(
        item["tenant_id"] == "tenant-acme" for item in r1.json()["items"]
    )
    assert all(
        item["tenant_id"] == "tenant-globex" for item in r2.json()["items"]
    )


def test_upload_isolation(fresh_app: TestClient) -> None:
    """Documents uploaded by tenant A must NOT be visible to tenant B.

    This is the write-side isolation guarantee: even though both
    tenants share the same endpoint and same in-memory backend,
    tenant B's GET /documents must never return tenant A's uploads.
    """
    token_acme = _token(tenant_id="tenant-acme")
    token_globex = _token(tenant_id="tenant-globex")

    # Acme uploads a document
    r_upload = fresh_app.post(
        "/api/v1/dw/documents/upload",
        headers={"Authorization": f"Bearer {token_acme}"},
        json={
            "name": "acme-confidential.pdf",
            "kind": "pdf",
            "size_bytes": 9999,
            "kb_id": "dw-kb-1",
        },
    )
    assert r_upload.status_code == 200, r_upload.text
    uploaded_id = r_upload.json()["data"]["id"]

    # Globex must not see the acme-uploaded document
    r_globex = fresh_app.get(
        "/api/v1/dw/documents",
        headers={"Authorization": f"Bearer {token_globex}"},
    )
    assert r_globex.status_code == 200, r_globex.text
    globex_ids = {item["id"] for item in r_globex.json()["items"]}
    assert uploaded_id not in globex_ids, "tenant B sees tenant A's upload!"


def test_wrong_tenant_403_on_all_endpoints(fresh_app: TestClient) -> None:
    """Every GET endpoint must reject tenant-mismatched requests.

    This is the strongest negative guarantee: no endpoint accidentally
    forgets to call require_tenant() and leaks data across tenants.
    """
    token_a = _token(tenant_id="tenant-acme")
    headers = {
        "Authorization": f"Bearer {token_a}",
        "X-Tenant-Id": "tenant-globex",
    }
    paths = [
        "/api/v1/dw/auth/login",
        "/api/v1/dw/collaborations",
        "/api/v1/dw/commit",
        "/api/v1/dw/documents",
        "/api/v1/dw/employees",
        "/api/v1/dw/employees/tasks",
        "/api/v1/dw/evaluations",
        "/api/v1/dw/extract",
        "/api/v1/dw/knowledge-bases",
        "/api/v1/dw/learning/extract",
        "/api/v1/dw/learning/feedback",
        "/api/v1/dw/models",
        "/api/v1/dw/tools",
        "/api/v1/dw/traces",
    ]
    for path in paths:
        r = fresh_app.get(path, headers=headers)
        assert r.status_code == 403, f"{path} -> {r.status_code}: {r.text}"
        assert "tenant" in r.text.lower()
