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

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from mate_tech_iam.api.dashboard import router as dashboard_router

from mate_platform.messaging.outbox import InMemoryOutboxWriter
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
def outbox() -> InMemoryOutboxWriter:
    """Fresh in-memory outbox per test for assertion against
    `fetch_pending()`."""
    return InMemoryOutboxWriter()


@pytest.fixture
def dashboard_app(outbox: InMemoryOutboxWriter) -> FastAPI:
    """Stand-alone FastAPI app that mounts only the dashboard router.

    We mount the router directly (no install_auth) and rely on a
    tiny test middleware that injects a stable RequestContext per
    request. This keeps these tests independent of the IAM/Keycloak
    integration status.

    The shared `outbox` fixture is wired onto `app.state.outbox_writer`
    so write handlers route their `Event` through the real
    `InMemoryOutboxWriter.append` path (ADR-0014 step 3).
    """
    app = FastAPI(title="dashboard-test")
    app.include_router(dashboard_router)
    app.state.outbox_writer = outbox

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


def test_put_settings_emits_outbox_event(
    client: TestClient,
    outbox: InMemoryOutboxWriter,
) -> None:
    """PUT /settings must publish a typed outbox event.

    Drives the real `InMemoryOutboxWriter.append` path (ADR-0014
    step 3) — no monkey-patching of `_emit`. The pending records
    are read back via `fetch_pending()` and asserted on type,
    tenant_id and payload.
    """
    r = client.put(
        "/api/v1/dashboard/settings",
        json={"theme": "light"},
    )
    assert r.status_code == 200, r.text

    pending = outbox.fetch_pending()
    assert pending, "outbox is empty after PUT /settings"

    types = [record.event.type for record in pending]
    assert "dashboard.settings.updated" in types, types

    settings_event = next(
        r for r in pending if r.event.type == "dashboard.settings.updated"
    )
    assert settings_event.event.tenant_id == "tenant-default"
    # The handler uses the caller user id as the aggregate id;
    # settings is per-user state, not a single canonical row.
    assert settings_event.event.aggregate_id == "u-1"
    assert "fields" in settings_event.event.payload
    # Hard rule 3: every outbox event must carry a non-empty tenant.
    assert settings_event.event.tenant_id
    # Event type follows the <domain>.<aggregate>.<verb> convention.
    assert settings_event.event.type.count(".") >= 2
    # Records start in pending state (not yet published to Kafka).
    assert not settings_event.published
    assert settings_event.attempts == 0


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
