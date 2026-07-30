"""Happy-path smoke tests for the dashboard router (FR-DASH-001..010).

These tests bypass the bearer-token middleware by injecting a
synthesised RequestContext directly into `request.state` before
each handler runs. Production deployments install
`mate_platform.auth.install_auth(app)` on the host app and the
middleware populates the same field — the resulting ctx is
identical for the handler's purposes.

Refs: ADR-0014 5-step pattern; see
`docs/active/specs/2026-07-30-p2-wave-2-spec.md` §4.1.
"""
from __future__ import annotations

from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from mate_tech_iam.api.dashboard import router as dashboard_router

from mate_platform.tenancy.context import (
    AuthMethod,
    RequestContext,
    TenantId,
    UserId,
)


def _ctx(tenant_id: str = "tenant-default") -> RequestContext:
    return RequestContext(
        request_id="req-1",
        trace_id="trace-1",
        tenant_id=TenantId(tenant_id),
        user_id=UserId("u-1"),
        roles=frozenset({"PLATFORM_SUPER_ADMIN"}),
        permissions=frozenset(),
        scopes=frozenset({"platform.read", "platform.write"}),
        client_id="metaplatform-backend",
        auth_method=AuthMethod.USER,
    )


@pytest.fixture
def dashboard_app() -> FastAPI:
    """Stand-alone FastAPI app that mounts only the dashboard router.

    We mount the router directly (no install_auth) and rely on a
    tiny test middleware that injects a stable RequestContext per
    request. This keeps these tests independent of the IAM/Keycloak
    integration status.
    """
    app = FastAPI(title="dashboard-test")
    app.include_router(dashboard_router)

    @app.middleware("http")
    async def _inject_ctx(request, call_next):  # type: ignore[no-redef]
        if not hasattr(request.state, "ctx") or request.state.ctx is None:
            request.state.ctx = _ctx(
                tenant_id=request.headers.get("x-mate-tenant-id", "tenant-default")
            )
        return await call_next(request)

    return app


@pytest.fixture
def client(dashboard_app: FastAPI) -> TestClient:
    return TestClient(dashboard_app)


def test_get_profile_ok(client: TestClient) -> None:
    r = client.get("/api/v1/dashboard/profile")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["id"] == "u-1"
    assert body["tenantId"] == "tenant-default"


def test_get_metrics_ok(client: TestClient) -> None:
    r = client.get("/api/v1/dashboard/metrics")
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)
    assert len(r.json()) >= 4  # active_users / api_calls / errors / tasks


def test_list_notifications_ok(client: TestClient) -> None:
    r = client.get("/api/v1/dashboard/notifications")
    assert r.status_code == 200, r.text
    items = r.json()
    assert len(items) >= 5  # 5 seeded notifications


def test_put_settings_emits_outbox_event(client: TestClient) -> None:
    """PUT /settings must call `_emit` with the right event type."""
    import mate_tech_iam.api.dashboard as mod

    captured: list[dict] = []

    def fake_emit(request, *, event_type, aggregate_id, payload, tenant_id=""):
        captured.append({
            "event_type": event_type,
            "aggregate_id": aggregate_id,
            "payload": payload,
            "tenant_id": tenant_id,
        })

    with patch.object(mod, "_emit", side_effect=fake_emit):
        r = client.put(
            "/api/v1/dashboard/settings",
            json={"theme": "light"},
        )
    assert r.status_code == 200, r.text
    assert captured, "no outbox events were emitted"
    types = [c["event_type"] for c in captured]
    assert "dashboard.settings.updated" in types


def test_search_ok(client: TestClient) -> None:
    r = client.get("/api/v1/dashboard/search", params={"keyword": "agent"})
    assert r.status_code == 200, r.text
    items = r.json()
    assert any("Agent" in it["title"] for it in items)


def test_workers_list_ok(client: TestClient) -> None:
    r = client.get("/api/v1/dashboard/workers")
    assert r.status_code == 200, r.text
    items = r.json()
    assert len(items) == 4  # 4 seeded digital workers
