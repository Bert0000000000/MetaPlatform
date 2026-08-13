"""Verification: SuperAI schedules another agent (digital employee) over A2A.

The orchestrator *is* SuperAI's scheduling engine (it absorbed copilot's
``scheduling/*`` entry — see ``api/scheduling.py``). These tests prove the
full chain end-to-end:

    SuperAI intent → employee match → plan generate → plan execute
        → Dispatcher → A2AWorker → A2AMessagesClient
        → POST /api/v1/a2a/messages  (real W3C envelope on the wire)

The A2A center's HTTP surface is intercepted with ``respx`` (not mocked at
the worker boundary), so the assertion is on the *actual* message the
orchestrator sends to another agent — i.e. SuperAI really dispatches a
digital employee over A2A, target_agent_id and all. The receive-side
(mate-app-a2a turning that message into a delegation task) is covered by
that service's own suite; here we verify the scheduling/dispatch leg.
"""
from __future__ import annotations

import json

import httpx
import pytest
import respx
from fastapi.testclient import TestClient
from mate_tech_orchestrator.scheduler.dispatcher import Dispatcher, set_dispatcher
from mate_tech_orchestrator.scheduler.role_registry import (
    CapabilityBinding,
    get_role_registry,
)
from mate_tech_orchestrator.workers.a2a import A2AWorker

from mate_clients.a2a.messages import A2AMessagesClient

# A virtual A2A center the respx router stands up in front of.
A2A_BASE = "http://mock-a2a-center:8502"
MESSAGES_URL = f"{A2A_BASE}/api/v1/a2a/messages"

TARGET_AGENT = "ext-translator"  # the "other agent" / digital employee being scheduled


def _register_roles() -> None:
    """Two digital employees for tenant-acme.

    ``workflow`` is A2A-bound (its capability delegates to another agent);
    it is seeded first so the plan generator makes it the non-HITL step
    that actually dispatches. ``knowledge`` is the trailing HITL step.
    """
    reg = get_role_registry()
    reg.register(
        tenant_id="tenant-acme",
        role="workflow",
        name="Workflow Employee",
        capabilities=[
            CapabilityBinding(name="delegate_run", worker_kind="a2a", ref=TARGET_AGENT),
        ],
    )
    reg.register(
        tenant_id="tenant-acme",
        role="knowledge",
        name="Knowledge Employee",
        capabilities=[CapabilityBinding(name="kb_search", worker_kind="local", ref="")],
    )


def _wire_real_a2a_dispatcher() -> A2AWorker:
    """Wire the Dispatcher with the REAL A2AWorker pointing at respx's center."""
    client = A2AMessagesClient(base_url=A2A_BASE)  # no auth — respx doesn't enforce it
    a2a_worker = A2AWorker(client=client)
    set_dispatcher(Dispatcher(get_role_registry(), a2a_worker=a2a_worker))
    return a2a_worker


def _reset() -> None:
    set_dispatcher(None)
    get_role_registry().reset()


def _a2a_task_response() -> dict[str, object]:
    """The W3C A2A Task object the center returns (matches a2a.yaml contract)."""
    return {
        "id": "task-a2a-delegated-1",
        "contextId": "ctx-1",
        "status": {"state": "submitted"},
        "artifacts": [],
        "history": [],
    }


@respx.mock
def test_superai_schedules_other_agent_over_a2a(
    client: TestClient, auth_headers_acme: dict[str, str],
) -> None:
    """Full SuperAI scheduling flow dispatches a digital employee via A2A."""
    _register_roles()
    _wire_real_a2a_dispatcher()
    try:
        route = respx.post(MESSAGES_URL)
        route.return_value = httpx.Response(200, json=_a2a_task_response())

        # 1. Intent detection — text → intent → matched employee.
        intent = client.post(
            "/api/v1/orchestrator/scheduling/intent/detect",
            json={"text": "run the workflow employee"},
            headers=auth_headers_acme,
        )
        assert intent.status_code == 200, intent.text
        assert "workflow" in intent.json()["detectedEmployees"]

        # 2. Employee match — the A2A-bound role is selectable.
        match = client.post(
            "/api/v1/orchestrator/scheduling/employees/match",
            json={"intent": "workflow"},
            headers=auth_headers_acme,
        )
        assert match.status_code == 200, match.text
        assert any(e["employeeId"] == "workflow" for e in match.json())

        # 3. Plan generation — a step targets the workflow role.
        plan = client.post(
            "/api/v1/orchestrator/scheduling/plan/generate",
            json={"intent_id": "intent-1"},
            headers=auth_headers_acme,
        )
        assert plan.status_code == 200, plan.text
        plan_id = plan.json()["planId"]
        assert any(s["employeeId"] == "workflow" for s in plan.json()["steps"])

        # 4. Execution — the non-HITL workflow step dispatches to the A2A worker,
        #    which posts a real W3C message to the A2A center.
        exec_ = client.post(
            "/api/v1/orchestrator/scheduling/execution/start",
            json={"plan_id": plan_id},
            headers=auth_headers_acme,
        )
        assert exec_.status_code == 200, exec_.text

        # The A2A center was really called exactly once.
        assert route.called, "SuperAI never dispatched to the A2A center"
        assert len(route.calls) == 1

        # --- The proof: the on-the-wire W3C envelope ---
        envelope = json.loads(route.calls.last.request.content)
        assert envelope["role"] == "user"
        assert envelope["messageId"].startswith("orch-")
        data_part = next(p for p in envelope["parts"] if p["kind"] == "data")
        text_part = next(p for p in envelope["parts"] if p["kind"] == "text")
        assert data_part["data"]["target_agent_id"] == TARGET_AGENT, (
            "SuperAI must address the dispatched message to the other agent"
        )
        assert text_part["text"]  # carries a delegation message body

        # The plan surfaces the A2A task created for the other agent.
        results = {r["stepId"]: r for r in exec_.json()["results"]}
        assert "s1" in results
        assert results["s1"]["status"] == "completed"
    finally:
        _reset()


@respx.mock
@pytest.mark.asyncio
async def test_a2a_worker_emits_w3c_envelope_to_target_agent() -> None:
    """Unit-level proof: the A2AWorker writes the canonical W3C envelope.

    Invokes the real worker (no Dispatcher) so the wire format is verified
    in isolation from the plan runner's HITL mechanics.
    """
    route = respx.post(MESSAGES_URL)
    route.return_value = httpx.Response(200, json=_a2a_task_response())

    worker = A2AWorker(client=A2AMessagesClient(base_url=A2A_BASE))
    try:
        task = await worker.invoke(
            tenant_id="tenant-acme",
            ref=TARGET_AGENT,
            arguments={"message": "translate this contract", "lang": "en"},
        )
        assert route.called
        envelope = json.loads(route.calls.last.request.content)
        assert envelope["role"] == "user"
        data_part = next(p for p in envelope["parts"] if p["kind"] == "data")
        assert data_part["data"] == {
            "target_agent_id": TARGET_AGENT,
            "lang": "en",
        }
        text_part = next(p for p in envelope["parts"] if p["kind"] == "text")
        assert text_part["text"] == "translate this contract"
        # The worker echoes back the agent it dispatched to.
        assert task["id"] == "task-a2a-delegated-1"
        assert task["target_agent_id"] == TARGET_AGENT
    finally:
        await worker.aclose()
