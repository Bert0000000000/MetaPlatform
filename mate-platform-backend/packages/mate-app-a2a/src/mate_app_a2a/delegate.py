"""mate_app_a2a.delegate — A2A delegation orchestrator (TD-4 real).

P3-W7 real implementation: resolves an agent card from the tenant's
store, then dispatches the task payload to the agent's HTTP endpoint
via ``ExternalAgentClient``. On success the delegation task is marked
``completed`` and the result is returned. On timeout / connection
error the task stays ``pending`` (the caller can poll later or submit
the result manually via ``POST /tasks/{id}/result``).

The orchestrator is the single seam between the FastAPI handler and
the outbound HTTP transport, so tests can inject a mock client to
exercise the full delegation flow without a real network.
"""
from __future__ import annotations

from typing import Any

import httpx
import structlog

from .clients import ExternalAgentClient
from .repositories import (
    ExternalAgent,
    get_agent,
    get_delegation,
    list_external_agents,
    update_delegation_result,
)

logger = structlog.get_logger(__name__)


class A2ADelegator:
    """Orchestrates a single A2A delegation lifecycle.

    Steps:
      1. Resolve the target agent from the tenant store (internal or
         external). Unknown agents raise ``AgentNotFoundError``.
      2. Build the A2A task payload (message + context + lineage hints).
      3. POST to the agent endpoint via ``ExternalAgentClient``.
      4. On success, update the delegation task to ``completed`` and
         return the result dict.
      5. On timeout / HTTP error, log a warning and return a
         ``pending`` result so the caller can retry or poll.
    """

    def __init__(self, client: ExternalAgentClient | None = None) -> None:
        self._client = client or ExternalAgentClient(timeout=10.0)

    async def delegate_to_external(
        self,
        *,
        tenant_id: str,
        external_agent_id: str,
        message: str,
        context: dict[str, Any],
        trace_id: str = "",
    ) -> dict[str, Any]:
        """Call a registered external (federated) agent by id.

        Returns ``{"status": ..., "result": ..., "agent": ...}``.

        Raises ``AgentNotFoundError`` if the external agent is not
        registered for this tenant.
        """
        agent = self._find_external_agent(tenant_id, external_agent_id)
        if agent is None:
            raise AgentNotFoundError(
                f"external agent {external_agent_id!r} not found "
                f"for tenant {tenant_id!r}"
            )

        payload: dict[str, Any] = {
            "message": message,
            "context": dict(context),
            "tenant_id": tenant_id,
            "trace_id": trace_id,
        }

        try:
            result = await self._client.call(
                endpoint=agent.endpoint,
                payload=payload,
                tenant_id=tenant_id,
                trace_id=trace_id,
            )
        except httpx.TimeoutException:
            logger.warning(
                "a2a.delegate.timeout",
                agent_id=external_agent_id,
                endpoint=agent.endpoint,
                tenant_id=tenant_id,
            )
            return {
                "status": "timeout",
                "result": {"error": "timeout", "endpoint": agent.endpoint},
                "agent": _agent_summary(agent),
            }
        except httpx.HTTPError as e:
            logger.warning(
                "a2a.delegate.http_error",
                agent_id=external_agent_id,
                endpoint=agent.endpoint,
                error=str(e),
                tenant_id=tenant_id,
            )
            return {
                "status": "failed",
                "result": {"error": str(e), "endpoint": agent.endpoint},
                "agent": _agent_summary(agent),
            }

        return {
            "status": "completed",
            "result": result,
            "agent": _agent_summary(agent),
        }

    async def delegate_and_update(
        self,
        *,
        tenant_id: str,
        task_id: str,
        target_agent_id: str,
        message: str,
        context: dict[str, Any],
        trace_id: str = "",
    ) -> dict[str, Any]:
        """Delegate + update the stored DelegationTask in one call.

        Looks up the task, tries the external agent, and patches the
        task status / result via ``update_delegation_result``.
        """
        task = get_delegation(tenant_id, task_id)
        if task is None:
            raise AgentNotFoundError(
                f"delegation task {task_id!r} not found "
                f"for tenant {tenant_id!r}"
            )

        # First check internal agents; if found, the task is in-process.
        internal = get_agent(tenant_id, target_agent_id)
        if internal is not None:
            # Internal agent: synchronous stub execution.
            result_payload = {
                "message": message,
                "context": dict(context),
                "agent_name": internal.name,
                "agent_endpoint": internal.endpoint,
            }
            update_delegation_result(tenant_id, task_id, result_payload, "completed")
            return {"status": "completed", "result": result_payload, "task_id": task_id}

        # External agent path.
        outcome = await self.delegate_to_external(
            tenant_id=tenant_id,
            external_agent_id=target_agent_id,
            message=message,
            context=context,
            trace_id=trace_id,
        )
        status = outcome["status"]
        # Map timeout → pending (retryable), failed → failed
        task_status = "pending" if status == "timeout" else status
        update_delegation_result(tenant_id, task_id, outcome["result"], task_status)
        outcome["task_id"] = task_id
        return outcome

    def _find_external_agent(
        self, tenant_id: str, agent_id: str,
    ) -> ExternalAgent | None:
        for agent in list_external_agents(tenant_id):
            if agent.id == agent_id:
                return agent
        return None

    async def aclose(self) -> None:
        await self._client.aclose()


class AgentNotFoundError(Exception):
    """Raised when the target agent is not registered for the tenant."""


def _agent_summary(agent: ExternalAgent) -> dict[str, Any]:
    return {
        "id": agent.id,
        "name": agent.name,
        "endpoint": agent.endpoint,
        "capabilities": list(agent.capabilities),
    }


# Module-level singleton — the FastAPI handler uses this when no
# explicit delegator is wired on app.state.
_default_delegator: A2ADelegator | None = None


def get_default_delegator() -> A2ADelegator:
    """Return (or lazily create) the module-level A2ADelegator singleton."""
    global _default_delegator
    if _default_delegator is None:
        _default_delegator = A2ADelegator()
    return _default_delegator


def set_default_delegator(delegator: A2ADelegator | None) -> None:
    """Inject a custom delegator (used by tests to mock the HTTP transport)."""
    global _default_delegator
    _default_delegator = delegator
