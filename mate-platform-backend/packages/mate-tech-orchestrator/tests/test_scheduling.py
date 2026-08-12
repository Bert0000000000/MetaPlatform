"""A3 absorption tests: orchestrator scheduling 编排入口.

The orchestrator takes over copilot's ``scheduling/*`` entry with real
machinery (role registry + plan runner). These tests exercise the
intent → match → plan → execute flow.
"""
from __future__ import annotations

from fastapi.testclient import TestClient
from mate_tech_orchestrator.scheduler.dispatcher import Dispatcher, set_dispatcher
from mate_tech_orchestrator.scheduler.role_registry import CapabilityBinding, get_role_registry


class FakeMcpWorker:
    async def invoke(self, *, tenant_id, ref, arguments):
        return {"source": "mcp", "tool": ref}


def _register_roles() -> None:
    reg = get_role_registry()
    reg.register(
        tenant_id="tenant-acme", role="knowledge",
        capabilities=[CapabilityBinding(name="kb_search", worker_kind="mcp", ref="kb_search")],
    )
    reg.register(
        tenant_id="tenant-acme", role="workflow",
        capabilities=[CapabilityBinding(name="flow_run", worker_kind="mcp", ref="flow_run")],
    )


def _wire_dispatcher() -> None:
    set_dispatcher(Dispatcher(get_role_registry(), mcp_worker=FakeMcpWorker()))


def _reset() -> None:
    set_dispatcher(None)
    get_role_registry().reset()


def test_intent_detect_and_match(client: TestClient, auth_headers_acme) -> None:
    _register_roles()
    try:
        r = client.post(
            "/api/v1/orchestrator/scheduling/intent/detect",
            json={"text": "search knowledge base"},
            headers=auth_headers_acme,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["detectedEmployees"] == ["knowledge"]

        m = client.post(
            "/api/v1/orchestrator/scheduling/employees/match",
            json={"intent": "knowledge"},
            headers=auth_headers_acme,
        )
        assert m.status_code == 200
        assert any(e["employeeId"] == "knowledge" for e in m.json())
    finally:
        _reset()


def test_plan_generate_and_execute(client: TestClient, auth_headers_acme) -> None:
    _register_roles()
    _wire_dispatcher()
    try:
        p = client.post(
            "/api/v1/orchestrator/scheduling/plan/generate",
            json={"intent_id": "intent-1"},
            headers=auth_headers_acme,
        )
        assert p.status_code == 200, p.text
        plan = p.json()
        assert plan["planId"]
        assert len(plan["steps"]) >= 1

        ex = client.post(
            "/api/v1/orchestrator/scheduling/execution/start",
            json={"plan_id": plan["planId"]},
            headers=auth_headers_acme,
        )
        assert ex.status_code == 200, ex.text
        assert ex.json()["planId"] == plan["planId"]
        assert ex.json()["status"] in ("running", "hitl_waiting", "completed")

        report = client.get(
            f"/api/v1/orchestrator/scheduling/execution/{ex.json()['executionId']}/report",
            headers=auth_headers_acme,
        )
        assert report.status_code == 200
    finally:
        _reset()


def test_templates(client: TestClient, auth_headers_acme) -> None:
    r = client.get("/api/v1/orchestrator/scheduling/templates", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    post = client.post(
        "/api/v1/orchestrator/scheduling/templates",
        json={"name": "research", "description": "research flow"},
        headers=auth_headers_acme,
    )
    assert post.status_code == 200, post.text
    assert post.json()["name"] == "research"
