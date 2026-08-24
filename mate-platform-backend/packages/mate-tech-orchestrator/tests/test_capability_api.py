"""MP-COMP-01 pilot: capability endpoints + dispatch gate (ADR-0042)."""
from __future__ import annotations

import time

from fastapi.testclient import TestClient
from jwt import encode as jwt_encode
from mate_tech_orchestrator.main import create_app
from mate_tech_orchestrator.scheduler.role_registry import get_role_registry


def _keycloak_token(*, tenant_id: str = "tenant-acme") -> str:
    now = int(time.time())
    return jwt_encode(
        {
            "sub": "u-1",
            "iss": "http://localhost:8080/realms/metaplatform",
            "aud": "metaplatform-backend",
            "azp": "metaplatform-backend",
            "preferred_username": "u-1",
            "realm_access": {"roles": ["PLATFORM_SUPER_ADMIN"]},
            "scope": "platform.read platform.write",
            "attributes": {"tenant_id": [tenant_id]},
            "tenant_id": tenant_id,
            "roles": ["PLATFORM_SUPER_ADMIN"],
            "iat": now,
            "exp": now + 3600,
        },
        "test-secret",
        algorithm="HS256",
    )


def _lifespan_client() -> TestClient:
    """TestClient used as a context manager → the app lifespan runs."""
    get_role_registry().reset()
    return TestClient(create_app())


def _headers(tenant: str = "tenant-acme") -> dict[str, str]:
    return {"Authorization": f"Bearer {_keycloak_token(tenant_id=tenant)}"}


def test_capability_endpoint_drives_reactivity() -> None:
    with _lifespan_client() as client:
        # Register a role that needs the search_skill MCP capability.
        resp = client.post(
            "/api/v1/orchestrator/roles",
            json={
                "role": "app",
                "name": "App",
                "capabilities": [
                    {"name": "search_skill", "worker_kind": "mcp", "ref": "tools/search"},
                ],
            },
            headers=_headers(),
        )
        assert resp.status_code == 201, resp.text

        # Tool registers at the MCP center → capability tracked → role fiber ACTIVE.
        resp = client.post(
            "/api/v1/orchestrator/capabilities",
            json={"name": "search_skill", "ref": "tools/search"},
            headers=_headers(),
        )
        assert resp.status_code == 201, resp.text
        roles = resp.json()["snapshot"]["roles"]
        assert roles.get("tenant-acme:app") == "active"

        # Tool unregisters → role fiber deactivates reactively.
        resp = client.delete(
            "/api/v1/orchestrator/capabilities/search_skill", headers=_headers(),
        )
        assert resp.status_code == 200, resp.text
        roles = resp.json()["snapshot"]["roles"]
        assert roles.get("tenant-acme:app") == "pending"


def test_dispatch_rejects_deactivated_capability() -> None:
    with _lifespan_client() as client:
        client.post(
            "/api/v1/orchestrator/roles",
            json={
                "role": "app",
                "name": "App",
                "capabilities": [
                    {"name": "search_skill", "worker_kind": "mcp", "ref": "tools/search"},
                ],
            },
            headers=_headers(),
        )
        resp = client.post(
            "/api/v1/orchestrator/capabilities",
            json={"name": "search_skill", "ref": "tools/search"},
            headers=_headers(),
        )
        assert resp.status_code == 201

        client.delete(
            "/api/v1/orchestrator/capabilities/search_skill", headers=_headers(),
        )
        # The stale binding still exists in the registry, but the overlay
        # refuses dispatch before a doomed MCP call is made.
        resp = client.post(
            "/api/v1/orchestrator/dispatch",
            json={"capability": "search_skill"},
            headers=_headers(),
        )
        assert resp.status_code == 404
        assert "not available" in resp.json()["detail"]


def test_capabilities_503_without_lifespan() -> None:
    # Bare TestClient (like the legacy conftest fixture) → no lifespan →
    # the runtime is absent and the endpoints report 503 while the rest
    # of the app keeps working.
    get_role_registry().reset()
    client = TestClient(create_app())
    resp = client.get("/api/v1/orchestrator/capabilities", headers=_headers())
    assert resp.status_code == 503
    health = client.get("/healthz")
    assert health.status_code == 200


def test_dispatch_fallback_when_untracked() -> None:
    # Untracked capability → legacy path: NoRoleForTaskError only because
    # no role exposes it (not because the overlay refused).
    with _lifespan_client() as client:
        client.post(
            "/api/v1/orchestrator/roles",
            json={
                "role": "app",
                "name": "App",
                "capabilities": [
                    {"name": "search_skill", "worker_kind": "local", "ref": ""},
                ],
            },
            headers=_headers(),
        )
        resp = client.post(
            "/api/v1/orchestrator/dispatch",
            json={"capability": "other_skill"},
            headers=_headers(),
        )
        assert resp.status_code == 404
        assert "no registered digital-employee role" in resp.json()["detail"]
