"""mate_app_copilot.a2a.client — A2AClient protocol + InMemoryA2AClient (TD-4).

The ``A2AClient`` protocol is the seam at which the copilot handler
delegates a task to a (potentially remote) A2A-compatible agent.
The default ``InMemoryA2AClient`` executes synchronously against the
local ``AgentCardRegistry`` — sufficient for tests / single-binary
deployments. A future HTTP-based client (TD-4 follow-up) will ship
the same protocol without touching the handler.

Status machine (PRD-A2A §4.2):
    pending → submitted → running → (completed | failed | cancelled | timeout)

The InMemoryA2AClient skips ``submitted`` / ``running`` and goes
straight to ``completed`` (or ``failed`` when the target agent is not
registered), since there is no real remote to round-trip to. The
status carries the same meaning to the caller.

Error codes follow PRD-A2A §6:
    - ``E_AGENT_NOT_FOUND``  when ``target_agent_id`` is unknown.
"""
from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from .models import AgentCard, DelegationRequest, DelegationResult, new_task_id
from .registry import AgentCardRegistry


@runtime_checkable
class A2AClient(Protocol):
    """A2A delegation + discovery protocol."""

    async def delegate(self, request: DelegationRequest) -> DelegationResult:
        """Delegate ``request`` to the target agent and return the result."""
        ...

    def discover_agents(
        self, tenant_id: str, capability: str | None = None
    ) -> list[AgentCard]:
        """List agent cards for a tenant, optionally filtered by capability."""
        ...


class InMemoryA2AClient:
    """Default in-process A2AClient.

    Uses an ``AgentCardRegistry`` for discovery and a synchronous
    stub execution path for ``delegate()``. The stub execution path
    is deterministic so tests can assert exact result shapes.
    """

    def __init__(self, registry: AgentCardRegistry | None = None) -> None:
        self._registry = registry or AgentCardRegistry()

    @property
    def registry(self) -> AgentCardRegistry:
        return self._registry

    async def delegate(self, request: DelegationRequest) -> DelegationResult:
        """Delegate a task and return the result.

        If the target agent is not in the registry, returns a
        ``DelegationResult`` with ``status="failed"`` and
        ``error_code="E_AGENT_NOT_FOUND"``. Otherwise the task is
        treated as completed synchronously and the result payload
        echoes the request message + agent card metadata.
        """
        task_id = new_task_id()
        target_agent_id = request.target_agent_id
        tenant_id = request.tenant_id

        card = self._registry.get(tenant_id, target_agent_id)
        if card is None:
            return DelegationResult(
                task_id=task_id,
                tenant_id=tenant_id,
                target_agent_id=target_agent_id,
                status="failed",
                error_code="E_AGENT_NOT_FOUND",
                error_message=(
                    f"agent {target_agent_id!r} not found "
                    f"for tenant {tenant_id!r}"
                ),
                lineage_hints=self._hints(request, card=None),
            )

        # In-memory execution: stub the agent's reply. A real client
        # would POST {request.message, request.context} to
        # {card.endpoint} here.
        result_payload: dict[str, Any] = {
            "message": request.message,
            "context": dict(request.context),
            "agent_name": card.name,
            "agent_endpoint": card.endpoint,
            "agent_capabilities": list(card.capabilities),
            "executed_at": request.trace_id or "",
        }

        return DelegationResult(
            task_id=task_id,
            tenant_id=tenant_id,
            target_agent_id=target_agent_id,
            status="completed",
            result=result_payload,
            lineage_hints=self._hints(request, card=card),
        )

    def discover_agents(
        self, tenant_id: str, capability: str | None = None
    ) -> list[AgentCard]:
        """List agent cards, optionally filtered by capability."""
        if capability:
            return self._registry.filter_by_capability(tenant_id, capability)
        return self._registry.discover(tenant_id)

    @staticmethod
    def _hints(
        request: DelegationRequest, *, card: AgentCard | None
    ) -> dict[str, Any]:
        """Build lineage hints for the delegation result.

        Per ADR-0016 §3.1 + hard rule 9: every cross-domain event
        carries ``tenant_id`` + ``correlation_id`` (the OTel trace_id).
        """
        hints: dict[str, Any] = {
            "tenant_id": request.tenant_id,
            "correlation_id": request.trace_id,
            "source_agent_id": request.source_agent_id,
            "target_agent_id": request.target_agent_id,
            "trace_id": request.trace_id,
            "source_system": "mate-app-copilot",
            "target_system": "a2a",
        }
        if card is not None:
            hints["target_endpoint"] = card.endpoint
            hints["target_capabilities"] = list(card.capabilities)
        return hints


# Module-level singleton — used by the FastAPI handler when no
# explicit client is wired on app.state. Tests can call reset()
# to drop the seeded state between cases.
_default_client = InMemoryA2AClient()


def get_default_client() -> InMemoryA2AClient:
    """Return the module-level InMemoryA2AClient singleton."""
    return _default_client


def reset_default_client() -> None:
    """Reset the singleton's registry. Used by tests."""
    _default_client.registry.reset()
