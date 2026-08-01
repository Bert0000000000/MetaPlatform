"""Cross-tenant integration tests for mate-tech-metrics (ADR-0014 step 5)."""
from __future__ import annotations

import time

import jwt as pyjwt
import pytest
from fastapi.testclient import TestClient
from mate_tech_metrics.main import create_app
from mate_tech_metrics.repositories import in_memory as in_memory_repo

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
    in_memory_repo.reset_store()
    return TestClient(create_app(), raise_server_exceptions=False)


def test_wrong_tenant_403(fresh_app: TestClient) -> None:
    token_a = _token(tenant_id="tenant-acme")
    r = fresh_app.get(
        "/api/v1/metrics",
        headers={
            "Authorization": f"Bearer {token_a}",
            "X-Tenant-Id": "tenant-globex",
        },
    )
    assert r.status_code == 403, r.text
    assert "tenant" in r.text.lower()


def test_no_tenant_400(fresh_app: TestClient) -> None:
    token = _token(tenant_id="")
    r = fresh_app.get(
        "/api/v1/metrics",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 400, r.text
    assert r.json()["code"] == "E_TENANT_REQUIRED"


def test_tenant_isolation(fresh_app: TestClient) -> None:
    token_acme = _token(tenant_id="tenant-acme")
    token_globex = _token(tenant_id="tenant-globex")

    r1 = fresh_app.get(
        "/api/v1/metrics",
        headers={"Authorization": f"Bearer {token_acme}"},
    )
    r2 = fresh_app.get(
        "/api/v1/metrics",
        headers={"Authorization": f"Bearer {token_globex}"},
    )
    assert r1.status_code == 200, r1.text
    assert r2.status_code == 200, r2.text
    assert all(m["tenant_id"] == "tenant-acme" for m in r1.json()["items"])
    assert all(m["tenant_id"] == "tenant-globex" for m in r2.json()["items"])


def test_cross_tenant_404(fresh_app: TestClient) -> None:
    token_acme = _token(tenant_id="tenant-acme")
    create = fresh_app.post(
        "/api/v1/metrics",
        json={"name": "Acme Only Metric", "expression": "COUNT(*)"},
        headers={"Authorization": f"Bearer {token_acme}"},
    )
    assert create.status_code == 200, create.text
    metric_id = create.json()["id"]

    token_globex = _token(tenant_id="tenant-globex")
    r = fresh_app.get(
        f"/api/v1/metrics/{metric_id}",
        headers={"Authorization": f"Bearer {token_globex}"},
    )
    assert r.status_code == 404, r.text


def test_cross_tenant_delete_404(fresh_app: TestClient) -> None:
    token_acme = _token(tenant_id="tenant-acme")
    create = fresh_app.post(
        "/api/v1/metrics",
        json={"name": "Acme Protected", "expression": "COUNT(*)"},
        headers={"Authorization": f"Bearer {token_acme}"},
    )
    assert create.status_code == 200, create.text
    metric_id = create.json()["id"]

    token_globex = _token(tenant_id="tenant-globex")
    r = fresh_app.delete(
        f"/api/v1/metrics/{metric_id}",
        headers={"Authorization": f"Bearer {token_globex}"},
    )
    assert r.status_code == 404, r.text


def test_health_anonymous_ok(fresh_app: TestClient) -> None:
    r = fresh_app.get("/api/v1/metrics/health")
    assert r.status_code == 200, r.text
    assert r.json() == {"status": "ok"}
