"""Cross-tenant integration tests (ADR-0014 step 5).

These tests exercise the auth + tenancy contract end-to-end:

  * test_missing_token_returns_401: no Authorization header → 401.
  * test_wrong_tenant_403: token bound to tenant A but X-Tenant-Id
    header asks for tenant B → 403.
  * test_empty_tenant_400: token with empty tenant_id → 400
    (require_tenant / hard rule 3).
  * test_correct_tenant_succeeds: token bound to tenant A reaches
    the handler and the outbox event is stamped with tenant A.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from mate_platform.messaging.outbox import InMemoryOutboxWriter

from mate_tech_deep_research.api import router as router_module
from mate_tech_deep_research.main import create_app
from tests.conftest import _StubDeerFlowClient, make_token


@pytest.fixture
def fresh_client() -> tuple[TestClient, InMemoryOutboxWriter, _StubDeerFlowClient]:
    """Per-test client with a clean outbox and a stub DeerFlow client."""
    outbox = InMemoryOutboxWriter()
    stub = _StubDeerFlowClient()
    prev = router_module._client_singleton
    router_module.set_deerflow_client(stub)
    app = create_app()
    app.state.outbox_writer = outbox
    client = TestClient(app, raise_server_exceptions=False)
    yield client, outbox, stub
    router_module.set_deerflow_client(prev)


_BODY = {
    "capability_id": "web-research",
    "input": {"query": "tenant test"},
}


def test_missing_token_returns_401(fresh_client) -> None:
    client, _, _ = fresh_client
    r = client.post("/api/v1/a2a/agent/deep-research/invoke", json=_BODY)
    assert r.status_code == 401, r.text


def test_wrong_tenant_403(fresh_client) -> None:
    client, _, _ = fresh_client
    token_a = make_token(tenant_id="tenant-acme")
    r = client.post(
        "/api/v1/a2a/agent/deep-research/invoke",
        json=_BODY,
        headers={
            "Authorization": f"Bearer {token_a}",
            "X-Tenant-Id": "tenant-globex",
        },
    )
    assert r.status_code == 403, r.text


def test_empty_tenant_400(fresh_client) -> None:
    client, _, _ = fresh_client
    token = make_token(tenant_id="")
    r = client.post(
        "/api/v1/a2a/agent/deep-research/invoke",
        json=_BODY,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 400, r.text
    assert r.json()["code"] == "E_TENANT_REQUIRED"


def test_correct_tenant_succeeds_and_stamps_event(fresh_client) -> None:
    client, outbox, _ = fresh_client
    token = make_token(tenant_id="tenant-acme")
    r = client.post(
        "/api/v1/a2a/agent/deep-research/invoke",
        json=_BODY,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text
    events = [rec.event for rec in outbox.all_records()]
    assert len(events) == 1
    assert events[0].tenant_id == "tenant-acme"


def test_two_tenants_get_disjoint_aggregate_ids(fresh_client) -> None:
    """Each tenant's event aggregate_id embeds its own tenant_id."""
    client, outbox, _ = fresh_client
    for tenant in ("tenant-acme", "tenant-globex"):
        token = make_token(tenant_id=tenant)
        r = client.post(
            "/api/v1/a2a/agent/deep-research/invoke",
            json={"capability_id": "web-research", "input": {"query": tenant}},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 200, r.text
    events = [rec.event for rec in outbox.all_records()]
    assert len(events) == 2
    agg_ids = {e.aggregate_id for e in events}
    assert agg_ids == {
        "deep-research-tenant-acme",
        "deep-research-tenant-globex",
    }
