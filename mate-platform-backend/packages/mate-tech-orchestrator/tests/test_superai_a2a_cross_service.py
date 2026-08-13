"""Cross-service E2E: SuperAI (orchestrator) → real A2A center, no mock.

The orchestrator's A2AWorker posts over a REAL HTTP transport (httpx
``ASGITransport``) to a live ``mate-app-a2a`` ASGI app. The A2A center
authenticates the service call (INSECURE profile), creates a
``DelegationTask`` for the target digital employee, and returns a W3C
Task. We then read the A2A center's repository directly to prove the
other agent really received the delegation — the whole SuperAI → A2A
scheduling scenario is exercised across two independent services.

Unlike ``test_superai_a2a_scheduling.py`` (which asserts the wire
envelope via ``respx``), this test does NOT mock the center: the
message travels through real HTTP parsing, real auth middleware, and
real persistence.

Requires the backend venv (``mate-app-a2a`` imports ``a2a-sdk``):

    cd mate-platform-backend
    .venv/Scripts/python.exe -m pytest \\
        packages/mate-tech-orchestrator/tests/test_superai_a2a_cross_service.py -v
"""
from __future__ import annotations

import time

import httpx
import jwt as pyjwt
from fastapi.testclient import TestClient
from mate_app_a2a.main import create_app as create_a2a_app
from mate_app_a2a.repositories import in_memory as a2a_repo
from mate_tech_orchestrator.main import create_app as create_orch_app
from mate_tech_orchestrator.scheduler.dispatcher import Dispatcher, set_dispatcher
from mate_tech_orchestrator.scheduler.role_registry import (
    CapabilityBinding,
    get_role_registry,
)
from mate_tech_orchestrator.workers.a2a import A2AWorker

from mate_clients.a2a.messages import A2AMessagesClient

TENANT = "tenant-acme"
TARGET_AGENT = "agent-recon"  # a digital employee seeded in the A2A center
JWT_SECRET = "test-secret"  # noqa: S105 - test-only signing key
A2A_BASE = "http://a2a-center"


def _jwt(*, tenant_id: str = TENANT, sub: str = "u-1") -> str:
    now = int(time.time())
    return pyjwt.encode(
        {
            "sub": sub,
            "iss": "http://localhost:8080/realms/metaplatform",
            "aud": "metaplatform-backend",
            "azp": "metaplatform-backend",
            "preferred_username": sub,
            "realm_access": {"roles": ["PLATFORM_SUPER_ADMIN"]},
            "scope": "platform.read platform.write",
            "attributes": {"tenant_id": [tenant_id]},
            "tenant_id": tenant_id,
            "roles": ["PLATFORM_SUPER_ADMIN"],
            "iat": now,
            "exp": now + 3600,
        },
        JWT_SECRET,
        algorithm="HS256",
    )


class _ServiceToken:
    """Token source for OutgoingAuthMiddleware on the orchestrator → A2A leg."""

    def __init__(self, tenant_id: str = TENANT) -> None:
        self._tenant_id = tenant_id

    def token(self) -> str:
        return _jwt(tenant_id=self._tenant_id, sub="mate-tech-orchestrator")


def _user_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {_jwt()}"}


def test_superai_delegates_to_agent_across_services() -> None:
    """The full scheduling flow lands a real delegation in the A2A center."""
    # --- Bring up both services -------------------------------------------
    a2a_repo.reset_store()
    a2a_app = create_a2a_app()

    # Point the orchestrator's A2AWorker at the REAL A2A center (in-process
    # ASGI), authenticating as a service identity the center trusts.
    a2a_client = A2AMessagesClient(
        base_url=A2A_BASE,
        transport=httpx.ASGITransport(app=a2a_app),
        auth=_ServiceToken(),
        tenant_id=TENANT,
    )
    a2a_worker = A2AWorker(client=a2a_client)

    orch_app = create_orch_app()
    registry = get_role_registry()
    registry.reset()  # deterministic plan: only the two roles below
    registry.register(
        tenant_id=TENANT,
        role="workflow",
        name="Workflow Employee",
        capabilities=[
            CapabilityBinding(name="delegate_run", worker_kind="a2a", ref=TARGET_AGENT),
        ],
    )
    # Trailing HITL step keeps the plan valid (decision B3) without dispatching.
    registry.register(
        tenant_id=TENANT,
        role="knowledge",
        name="Knowledge Employee",
        capabilities=[CapabilityBinding(name="kb_search", worker_kind="local", ref="")],
    )
    set_dispatcher(Dispatcher(registry, a2a_worker=a2a_worker))
    client = TestClient(orch_app)

    try:
        # --- The SuperAI scheduling flow ------------------------------------
        intent = client.post(
            "/api/v1/orchestrator/scheduling/intent/detect",
            json={"text": "run workflow"},
            headers=_user_headers(),
        )
        assert intent.status_code == 200, intent.text
        assert intent.json()["detectedEmployees"] == ["workflow"]

        plan = client.post(
            "/api/v1/orchestrator/scheduling/plan/generate",
            json={"intent_id": "intent-x"},
            headers=_user_headers(),
        )
        assert plan.status_code == 200, plan.text
        plan_id = plan.json()["planId"]

        exec_ = client.post(
            "/api/v1/orchestrator/scheduling/execution/start",
            json={"plan_id": plan_id},
            headers=_user_headers(),
        )
        assert exec_.status_code == 200, exec_.text

        # --- The proof: the A2A center really holds a new delegation --------
        delegated = [
            t for t in a2a_repo.list_delegations(TENANT)
            if str(t.context.get("messageId", "")).startswith("orch-")
        ]
        assert len(delegated) == 1, "SuperAI should open exactly one A2A delegation"
        task = delegated[0]
        assert task.target_agent_id == TARGET_AGENT  # addressed to the other agent
        assert task.tenant_id == TENANT
        assert task.status == "pending"  # internal model; maps to W3C "submitted"
        # W3C correlation ids are preserved on the A2A side.
        assert str(task.context["messageId"]).startswith("orch-")
        assert task.context["target_agent_id"] == TARGET_AGENT

        # And the plan surfaces the created A2A task id back to SuperAI.
        s1 = next(r for r in exec_.json()["results"] if r["stepId"] == "s1")
        assert s1["status"] == "completed"
        assert task.id in s1["output"]
    finally:
        set_dispatcher(None)
        get_role_registry().reset()
        a2a_repo.reset_store()
