"""W3 tests: plan submit → execute → HITL gate → review (decision B3)."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from mate_tech_orchestrator.scheduler.dispatcher import Dispatcher, set_dispatcher
from mate_tech_orchestrator.scheduler.plan_runner import PlanRunner, set_plan_runner
from mate_tech_orchestrator.scheduler.role_registry import CapabilityBinding, get_role_registry


class FakeMcpWorker:
    async def invoke(self, *, tenant_id, ref, arguments):
        return {"source": "mcp", "tool": ref}


@pytest.fixture
def orchestrated(client: TestClient):
    """Wire a dispatcher (fake MCP worker) + plan runner with the role."""
    dispatcher = Dispatcher(get_role_registry(), mcp_worker=FakeMcpWorker())
    runner = PlanRunner(dispatcher=dispatcher)
    set_dispatcher(dispatcher)
    set_plan_runner(runner)
    get_role_registry().register(
        tenant_id="tenant-acme",
        role="knowledge",
        capabilities=[CapabilityBinding(name="kb_search", worker_kind="mcp", ref="kb_search")],
    )
    yield
    set_dispatcher(None)
    set_plan_runner(None)
    get_role_registry().reset()


def _plan(steps=None) -> dict:
    return {
        "author_user_id": "u-1",
        "steps": steps or [
            {"step_id": "s1", "kind": "call_agent", "target": "kb.tenant.acme.doc.v1", "payload": {"action": "kb_search"}, "requires_hitl": False},
            {"step_id": "s2", "kind": "call_agent", "target": "kb.tenant.acme.doc.v1", "payload": {"action": "kb_search"}, "requires_hitl": True},
        ],
    }


def test_submit_plan_requires_hitl(client: TestClient, auth_headers_acme, orchestrated) -> None:
    r = client.post(
        "/api/v1/orchestrator/plans",
        json=_plan(steps=[{"step_id": "s1", "kind": "call_agent", "target": "kb.x", "payload": {}, "requires_hitl": False}]),
        headers=auth_headers_acme,
    )
    assert r.status_code == 422, r.text
    assert "HITL" in r.json()["detail"]


def test_plan_execute_stops_at_hitl_then_review_resumes(
    client: TestClient, auth_headers_acme, orchestrated,
) -> None:
    sub = client.post("/api/v1/orchestrator/plans", json=_plan(), headers=auth_headers_acme)
    assert sub.status_code == 201, sub.text
    plan_id = sub.json()["plan_id"]

    # execute: step s1 runs (mcp worker), stops at s2 (HITL)
    ex = client.post(f"/api/v1/orchestrator/plans/{plan_id}/execute", headers=auth_headers_acme)
    assert ex.status_code == 200, ex.text
    assert ex.json()["status"] == "hitl_waiting"
    assert ex.json()["current_step_id"] == "s2"
    assert len(ex.json()["results"]) == 1  # s1 completed

    # plan status shows s2 as hitl_waiting
    st = client.get(f"/api/v1/orchestrator/plans/{plan_id}", headers=auth_headers_acme)
    assert st.json()["current_step_id"] == "s2"
    hitl_steps = [h for h in st.json()["history"] if h["status"] == "hitl_waiting"]
    assert len(hitl_steps) == 1

    # review approve → s2 completes, plan completes
    rv = client.post(
        f"/api/v1/orchestrator/plans/{plan_id}/steps/s2/review",
        json={"approved": True, "feedback": "ok"},
        headers=auth_headers_acme,
    )
    assert rv.status_code == 200, rv.text
    assert rv.json()["status"] == "completed"

    # review reject → aborted
    sub2 = client.post("/api/v1/orchestrator/plans", json=_plan(), headers=auth_headers_acme)
    plan2 = sub2.json()["plan_id"]
    client.post(f"/api/v1/orchestrator/plans/{plan2}/execute", headers=auth_headers_acme)
    rj = client.post(
        f"/api/v1/orchestrator/plans/{plan2}/steps/s2/review",
        json={"approved": False, "feedback": "no"},
        headers=auth_headers_acme,
    )
    assert rj.status_code == 200
    assert rj.json()["status"] == "aborted"


def test_plan_unknown_404(client: TestClient, auth_headers_acme, orchestrated) -> None:
    r = client.get("/api/v1/orchestrator/plans/nope", headers=auth_headers_acme)
    assert r.status_code == 404, r.text


def test_plan_submit_emits_outbox(client: TestClient, auth_headers_acme, orchestrated, outbox) -> None:
    client.post("/api/v1/orchestrator/plans", json=_plan(), headers=auth_headers_acme)
    types = {rec.event.type for rec in outbox.all_records()}
    assert "orchestrator.plan.submitted" in types
