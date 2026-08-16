"""mate_tech_orchestrator.scheduler.capability_runtime — reactive capabilities.

MP-COMP-01 pilot (ADR-0042): digital-employee capability availability
becomes a coeffect — ``capability:{tenant}:{name}`` — provided by one
fiber per MCP tool and injected by one fiber per registered role. When
a tool unregisters, every dependent role fiber deactivates with its
effects reverted (temporal composability) and reactivates when the
tool returns (spatial composability) — no restart, no stale dispatch.

``RoleRegistry`` remains the single source of truth for role data and
persistence; the runtime derives an activation overlay from fiber
states only. When the runtime is absent (bare TestClient without
lifespan) or a capability is untracked, dispatch behaves exactly as
before.
"""
from __future__ import annotations

from mate_platform.composition import Component, Context, Fiber, FiberState, create_context

from .role_registry import CapabilityBinding, DigitalEmployeeRole

__all__ = ["CapabilityRuntime", "capability_key", "get_capability_runtime", "set_capability_runtime"]


def capability_key(tenant_id: str, name: str) -> str:
    """Coeffect key for one tenant-scoped capability."""
    return f"capability:{tenant_id}:{name}"


class CapabilityRuntime:
    """Owns a composition context wiring capabilities to roles."""

    def __init__(self) -> None:
        self._ctx: Context = create_context("orchestrator-capabilities")
        self._capability_fibers: dict[str, Fiber] = {}
        self._role_fibers: dict[tuple[str, str], Fiber] = {}
        self._active_roles: dict[tuple[str, str], tuple[CapabilityBinding, ...]] = {}

    # -- capability providers (MCP tool liveness) ------------------------
    async def track_capability(self, tenant_id: str, name: str, ref: str) -> None:
        """Announce that ``name`` is available as ``ref`` (e.g. tool mounted)."""
        key = capability_key(tenant_id, name)
        existing = self._capability_fibers.get(key)
        if existing is not None:
            await existing.dispose()
            del self._capability_fibers[key]
            await self._ctx.start()

        async def apply(fctx: Context):
            fctx.set(key, ref)

        component = Component(
            name=f"cap:{name}",
            inject=frozenset(),
            provide=frozenset({key}),
            apply=apply,
        )
        self._capability_fibers[key] = await self._ctx.use(component)
        await self._ctx.start()

    async def untrack_capability(self, tenant_id: str, name: str) -> bool:
        """Withdraw ``name``; dependent roles deactivate reactively.

        The fiber stays registered (DISPOSED) so ``allows`` keeps refusing
        dispatch — a withdrawn capability is tracked-but-unavailable, not
        untracked (the legacy allow-all fallback).
        """
        key = capability_key(tenant_id, name)
        fiber = self._capability_fibers.get(key)
        if fiber is None or fiber.state is FiberState.DISPOSED:
            return False
        await fiber.dispose()
        await self._ctx.start()
        return True

    # -- role consumers (activation overlay) ------------------------------
    async def attach_role(self, role: DigitalEmployeeRole) -> Fiber | None:
        """Bind a role's fate to the liveness of its MCP capabilities."""
        role_key = (role.tenant_id, role.role)
        existing = self._role_fibers.get(role_key)
        if existing is not None:
            await existing.dispose()
            del self._role_fibers[role_key]
            await self._ctx.start()

        inject = frozenset(
            capability_key(role.tenant_id, b.name)
            for b in role.capabilities
            if b.worker_kind == "mcp"
        )

        async def apply(fctx: Context):
            self._active_roles[role_key] = role.capabilities

            def deactivate() -> None:
                self._active_roles.pop(role_key, None)

            yield deactivate

        component = Component(
            name=f"role:{role.role}",
            inject=inject,
            provide=frozenset(),
            apply=apply,
        )
        fiber = await self._ctx.use(component)
        self._role_fibers[role_key] = fiber
        await self._ctx.start()
        return fiber

    async def detach_role(self, tenant_id: str, role: str) -> bool:
        role_key = (tenant_id, role)
        fiber = self._role_fibers.pop(role_key, None)
        if fiber is None:
            return False
        await fiber.dispose()
        await self._ctx.start()
        return True

    # -- overlay reads (sync — pure fiber-state reads) --------------------
    def is_tracked(self, tenant_id: str, capability: str) -> bool:
        return capability_key(tenant_id, capability) in self._capability_fibers

    def allows(self, tenant_id: str, capability: str) -> bool:
        """Dispatch gate: True when untracked (legacy fallback) or live."""
        fiber = self._capability_fibers.get(capability_key(tenant_id, capability))
        if fiber is None:
            return True
        return fiber.state is FiberState.ACTIVE

    def is_role_active(self, tenant_id: str, role: str) -> bool:
        fiber = self._role_fibers.get((tenant_id, role))
        return fiber is not None and fiber.state is FiberState.ACTIVE

    def active_capabilities(self, tenant_id: str, role: str) -> tuple[CapabilityBinding, ...]:
        """The role's committed activation marker (empty when inactive)."""
        return self._active_roles.get((tenant_id, role), ())

    def snapshot(self) -> dict[str, dict[str, str]]:
        """Observability view: fiber states by key."""
        capabilities = {
            key: fiber.state.value for key, fiber in self._capability_fibers.items()
        }
        roles = {
            f"{tenant}:{role}": fiber.state.value
            for (tenant, role), fiber in self._role_fibers.items()
        }
        return {"capabilities": capabilities, "roles": roles}

    # -- lifecycle ---------------------------------------------------------
    async def attach_registered_roles(self) -> int:
        """Attach every currently registered role (startup wiring)."""
        from .role_registry import get_role_registry

        count = 0
        for role in get_role_registry().iter_all():
            await self.attach_role(role)
            count += 1
        return count

    async def dispose(self) -> None:
        await self._ctx.dispose()
        self._capability_fibers.clear()
        self._role_fibers.clear()
        self._active_roles.clear()


# Module-level singleton + DI seam (mirrors role_registry / dispatcher).
_default_runtime: CapabilityRuntime | None = None


def get_capability_runtime() -> CapabilityRuntime | None:
    """The active runtime, or None when the app lifespan did not run."""
    return _default_runtime


def set_capability_runtime(runtime: CapabilityRuntime | None) -> None:
    global _default_runtime
    _default_runtime = runtime
