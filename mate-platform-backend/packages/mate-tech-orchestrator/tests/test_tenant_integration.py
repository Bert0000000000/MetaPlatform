"""W3 tests: cross-tenant isolation negatives (ADR-0014 step 2)."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from mate_tech_orchestrator.scheduler.dispatcher import Dispatcher, set_dispatcher
from mate_tech_orchestrator.scheduler.role_registry import CapabilityBinding, get_role_registry


@pytest.fixture
def setup(client: TestClient):
    """Register a role for tenant-acme; inject a dispatcher."""
    get_role_registry().register(
        tenant_id="tenant-acme",
        role="knowledge",
        capabilities=[CapabilityBinding(name="kb_search", worker_kind="mcp", ref="kb_search")],
    )
    set_dispatcher(Dispatcher(get_role_registry(), mcp_worker=object()))
    yield
    set_dispatcher(None)
    get_role_registry().reset()


def test_cross_tenant_role_invisible(client: TestClient, auth_headers_acme, auth_headers_globex, setup) -> None:
    lst = client.get("/api/v1/orchestrator/roles", headers=auth_headers_globex)
    assert lst.json()["total"] == 0
    lst_acme = client.get("/api/v1/orchestrator/roles", headers=auth_headers_acme)
    assert lst_acme.json()["total"] == 1


def test_cross_tenant_dispatch_404(client: TestClient, auth_headers_globex, setup) -> None:
    # tenant-globex has no knowledge role → dispatch by rid 404
    r = client.post(
        "/api/v1/orchestrator/dispatch",
        json={"target_rid": "kb.tenant-globex.doc.v1", "action": "", "arguments": {}},
        headers=auth_headers_globex,
    )
    assert r.status_code == 404, r.text


def test_tenant_guard_required(client: TestClient, setup) -> None:
    # No token → install_auth rejects before the handler (401).
    r = client.post("/api/v1/orchestrator/dispatch", json={"capability": "kb_search", "arguments": {}})
    assert r.status_code in (400, 401), r.text
