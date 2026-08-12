"""mate_tech_orchestrator.scheduler.dispatcher — task → role → worker.

Resolves a task to the right digital-employee role (by rid prefix via
the kernel ``AgentSelector``, or by capability via the role registry),
then routes to the role's worker (MCP / A2A / HTTP / local).
"""
from __future__ import annotations

import uuid
from typing import Any

from mate_kernel.agent.orchestrator import AgentRole, AgentSelector

from .role_registry import (
    CapabilityBinding,
    DigitalEmployeeRole,
    RoleRegistry,
    binding_to_dict,
    get_role_registry,
)


class DispatcherError(Exception):
    """Base error for the dispatcher."""


class NoRoleForTaskError(DispatcherError):
    """No role can serve the requested task (unknown rid / capability)."""


class UnknownWorkerKindError(DispatcherError):
    """The role's capability references an unsupported worker kind."""


class Dispatcher:
    """Match a task to a digital-employee role and invoke its worker."""

    def __init__(
        self,
        registry: RoleRegistry | None = None,
        *,
        mcp_worker: Any = None,
        a2a_worker: Any = None,
        local_executor: Any = None,
    ) -> None:
        self._registry = registry or get_role_registry()
        self._selector = AgentSelector()
        # Workers are injected (or lazily resolved) so tests can mock them.
        self._mcp_worker = mcp_worker
        self._a2a_worker = a2a_worker
        self._local_executor = local_executor

    async def dispatch(
        self,
        *,
        tenant_id: str,
        target_rid: str | None = None,
        capability: str | None = None,
        action: str = "",
        arguments: dict[str, Any] | None = None,
        trace_id: str = "",
    ) -> dict[str, Any]:
        """Dispatch a single task and return the worker result envelope."""
        args = arguments or {}
        if target_rid:
            role, binding = self._resolve_by_rid(tenant_id, target_rid, action or capability)
        elif capability:
            role, binding = self._resolve_by_capability(tenant_id, capability)
        else:
            raise NoRoleForTaskError("either target_rid or capability is required")

        result = await self._invoke_binding(
            tenant_id=tenant_id,
            role=role,
            binding=binding,
            arguments=args,
            trace_id=trace_id,
        )
        return {
            "task_id": f"orch-{uuid.uuid4().hex[:12]}",
            "role": role.role,
            "capability": binding.name,
            "worker_kind": binding.worker_kind,
            "result": result,
            "status": "completed",
        }

    # -- role resolution -------------------------------------------------
    def _resolve_by_rid(
        self, tenant_id: str, target_rid: str, action: str | None,
    ) -> tuple[DigitalEmployeeRole, CapabilityBinding]:
        # A bare role slug (e.g. "knowledge") resolves directly; otherwise
        # fall back to the kernel AgentSelector rid-prefix routing.
        role = self._registry.get(tenant_id, target_rid)
        if role is None:
            role_slug = self._selector.select(target_rid).value
            role = self._registry.get(tenant_id, role_slug)
        if role is None:
            raise NoRoleForTaskError(
                f"role {target_rid!r} (or rid-prefix {self._selector.select(target_rid).value!r}) "
                f"is not registered for tenant {tenant_id!r}"
            )
        binding = self._pick_binding(role, action)
        return role, binding

    def _resolve_by_capability(
        self, tenant_id: str, capability: str,
    ) -> tuple[DigitalEmployeeRole, CapabilityBinding]:
        found = self._registry.find_by_capability(tenant_id, capability)
        if found is None:
            raise NoRoleForTaskError(
                f"no registered digital-employee role exposes capability "
                f"{capability!r} for tenant {tenant_id!r}"
            )
        return found

    @staticmethod
    def _pick_binding(role: DigitalEmployeeRole, action: str | None) -> CapabilityBinding:
        if action:
            for binding in role.capabilities:
                if binding.name == action:
                    return binding
        if role.capabilities:
            return role.capabilities[0]
        raise NoRoleForTaskError(
            f"role {role.role!r} has no capability to serve action {action!r}"
        )

    # -- worker invocation -----------------------------------------------
    async def _invoke_binding(
        self,
        *,
        tenant_id: str,
        role: DigitalEmployeeRole,
        binding: CapabilityBinding,
        arguments: dict[str, Any],
        trace_id: str,
    ) -> Any:
        if binding.worker_kind == "mcp":
            worker = self._mcp_worker or _mcp_worker()
            return await worker.invoke(tenant_id=tenant_id, ref=binding.ref, arguments=arguments)
        if binding.worker_kind == "a2a":
            worker = self._a2a_worker or _a2a_worker()
            return await worker.invoke(tenant_id=tenant_id, ref=binding.ref, arguments=arguments)
        if binding.worker_kind == "http":
            raise UnknownWorkerKindError(
                "http worker_kind is reserved (ACL client wiring lands with "
                "the Pi-Agent / external-worker batch)"
            )
        if binding.worker_kind == "local":
            if self._local_executor is not None:
                return await self._local_executor(tenant_id, role.role, arguments)
            # SuperAI local fallback (Pi Agent 对接点留在此处).
            return {
                "note": f"local execution for role {role.role}",
                "role": role.role,
                "capability": binding.name,
                "deferred": True,
            }
        raise UnknownWorkerKindError(f"unknown worker_kind {binding.worker_kind!r}")


def _mcp_worker() -> Any:
    from ..workers.mcp import get_mcp_worker

    return get_mcp_worker()


def _a2a_worker() -> Any:
    from ..workers.a2a import get_a2a_worker

    return get_a2a_worker()


def dispatch_result_to_dict(result: dict[str, Any]) -> dict[str, Any]:
    """Serialize a dispatch result (worker_kind + role + capability)."""
    return result


# Module-level singleton + DI seam.
_default_dispatcher: Dispatcher | None = None


def get_dispatcher() -> Dispatcher:
    global _default_dispatcher
    if _default_dispatcher is None:
        _default_dispatcher = Dispatcher()
    return _default_dispatcher


def set_dispatcher(dispatcher: Dispatcher | None) -> None:
    global _default_dispatcher
    _default_dispatcher = dispatcher


__all__ = [
    "AgentRole",
    "Dispatcher",
    "DispatcherError",
    "NoRoleForTaskError",
    "UnknownWorkerKindError",
    "binding_to_dict",
    "dispatch_result_to_dict",
    "get_dispatcher",
    "set_dispatcher",
]
