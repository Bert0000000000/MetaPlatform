"""Cross-tenant integration tests for mate-app-copilot (ADR-0014 step 5).

5 tests: wrong-tenant 403, missing-scope pinned, no-tenant non-200,
tenant-isolation ok, a2a delegate proxies to mate-app-a2a.
"""
from __future__ import annotations

import time

import jwt as pyjwt
import pytest
from fastapi.testclient import TestClient
from mate_app_copilot.main import create_app
from mate_app_copilot.repositories import in_memory as in_memory_repo

JWT_SECRET = "test-secret"  # noqa: S105


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
    in_memory_repo.reset_store()
    return TestClient(create_app(), raise_server_exceptions=False)


def test_wrong_tenant_403(fresh_app: TestClient) -> None:
    token_a = _token(tenant_id="tenant-acme")
    r = fresh_app.get(
        "/api/v1/copilot/conversations",
        headers={
            "Authorization": f"Bearer {token_a}",
            "X-Tenant-Id": "tenant-globex",
        },
    )
    assert r.status_code == 403, r.text
    assert "tenant" in r.text.lower()


def test_missing_scope_pinned(fresh_app: TestClient) -> None:
    """Step 4 ACL wiring is out of scope for PR#14; pin current behaviour."""
    token = _token(tenant_id="tenant-acme", scopes="")
    r = fresh_app.get(
        "/api/v1/copilot/conversations",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text


def test_no_tenant_non_200(fresh_app: TestClient) -> None:
    token = _token(tenant_id="")
    r = fresh_app.get(
        "/api/v1/copilot/conversations",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 400, r.text
    assert r.json()["code"] == "E_TENANT_REQUIRED"


def test_tenant_isolation_ok(fresh_app: TestClient) -> None:
    token_acme = _token(tenant_id="tenant-acme")
    token_globex = _token(tenant_id="tenant-globex")

    r1 = fresh_app.get(
        "/api/v1/copilot/conversations",
        headers={"Authorization": f"Bearer {token_acme}"},
    )
    r2 = fresh_app.get(
        "/api/v1/copilot/conversations",
        headers={"Authorization": f"Bearer {token_globex}"},
    )
    assert r1.status_code == 200, r1.text
    assert r2.status_code == 200, r2.text
    assert all(c["tenant_id"] == "tenant-acme" for c in r1.json()["items"])
    assert all(c["tenant_id"] == "tenant-globex" for c in r2.json()["items"])


def test_a2a_delegate_proxies_to_a2a(fresh_app: TestClient) -> None:
    """POST /a2a/delegate now proxies to mate-app-a2a (not 501).

    P2-W3: the 501 stub has been replaced with an in-process proxy
    to mate_app_a2a.repositories.create_delegation.
    """
    from mate_app_a2a.repositories import in_memory as a2a_repo  # noqa: PLC0415

    a2a_repo.reset_store()

    token = _token(tenant_id="tenant-acme")
    r = fresh_app.post(
        "/api/v1/copilot/a2a/delegate",
        json={
            "target_agent_id": "agent-rag",
            "message": "summarize document",
            "context": {"doc_id": "doc-1"},
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "pending"
    assert body["target_agent_id"] == "agent-rag"
    assert body["id"].startswith("task-")

    a2a_repo.reset_store()
