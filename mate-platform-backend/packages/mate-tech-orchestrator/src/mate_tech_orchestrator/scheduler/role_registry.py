"""mate_tech_orchestrator.scheduler.role_registry — digital-employee role registry.

A digital-employee role (one of the 7+N classes — Ontology, Workflow,
App, Data Product, OBS, Security, Knowledge Library, SuperAI, or a
3rd-party Marketplace role) binds its capabilities to workers:

- ``worker_kind=mcp``  → capability is an MCP tool at the MCP center
- ``worker_kind=a2a``  → capability is an A2A agent at the A2A center
- ``worker_kind=http`` → capability is an arbitrary HTTP endpoint
- ``worker_kind=local`` → capability executes locally (SuperAI stub)

The registry is tenant-scoped and dynamic (register / unregister at
runtime). The kernel ``AgentRole`` enum is the authoritative role
vocabulary; unknown slugs are rejected at registration time.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

import structlog

from mate_kernel.agent.orchestrator import AgentRole

logger = structlog.get_logger(__name__)

_WORKER_KINDS = ("mcp", "a2a", "http", "local")


class RoleRegistryError(Exception):
    """Base error for the role registry."""


class UnknownRoleError(RoleRegistryError):
    """Raised when a role slug is not a kernel AgentRole."""


@dataclass(frozen=True, slots=True)
class CapabilityBinding:
    """One capability of a digital-employee role → a worker ref."""

    name: str
    worker_kind: str  # mcp | a2a | http | local
    ref: str  # MCP tool name | A2A agent id | HTTP url | (local: ignored)


@dataclass(frozen=True, slots=True)
class DigitalEmployeeRole:
    """A registered digital-employee role for a tenant."""

    role: str  # AgentRole slug
    tenant_id: str
    name: str = ""
    capabilities: tuple[CapabilityBinding, ...] = ()
    enabled: bool = True
    created_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())


def validate_worker_kind(kind: str) -> str:
    if kind not in _WORKER_KINDS:
        raise UnknownRoleError(
            f"unknown worker_kind {kind!r}; expected one of {_WORKER_KINDS}"
        )
    return kind


class RoleRegistry:
    """Tenant-scoped dynamic registry of digital-employee roles.

    Mutations are mirrored to an optional persistence store (SQL when a
    DSN is configured; no-op otherwise). ``restore()`` reloads persisted
    roles at startup so the dynamic scheduling survives restarts.
    """

    def __init__(self, store: Any = None) -> None:
        self._roles: dict[tuple[str, str], DigitalEmployeeRole] = {}
        if store is None:
            from ..repositories.sql_store import default_role_store

            store = default_role_store()
        self._store = store

    def restore(self) -> int:
        """Load persisted roles into the registry. Returns the count."""
        loaded = 0
        for role in self._store.load():
            key = (role.tenant_id, role.role)
            if key not in self._roles:
                self._roles[key] = role
                loaded += 1
        return loaded

    def register(
        self,
        *,
        tenant_id: str,
        role: str,
        name: str = "",
        capabilities: list[CapabilityBinding] | tuple[CapabilityBinding, ...] = (),
    ) -> DigitalEmployeeRole:
        if not tenant_id:
            raise RoleRegistryError("tenant_id is required")
        try:
            AgentRole(role)
        except ValueError as e:
            raise UnknownRoleError(
                f"unknown digital-employee role {role!r}; expected one of "
                f"{[r.value for r in AgentRole]}"
            ) from e
        for cap in capabilities:
            validate_worker_kind(cap.worker_kind)
        entry = DigitalEmployeeRole(
            role=role,
            tenant_id=tenant_id,
            name=name or role,
            capabilities=tuple(capabilities),
        )
        self._roles[(tenant_id, role)] = entry
        try:
            self._store.save(entry)
        except Exception as e:
            logger.warning("orchestrator.role.persist_failed", role=role, error=str(e))
        return entry

    def get(self, tenant_id: str, role: str) -> DigitalEmployeeRole | None:
        return self._roles.get((tenant_id, role))

    def list(self, tenant_id: str) -> list[DigitalEmployeeRole]:
        return [r for (tid, _), r in self._roles.items() if tid == tenant_id]

    def unregister(self, tenant_id: str, role: str) -> bool:
        removed = self._roles.pop((tenant_id, role), None)
        if removed is None:
            return False
        try:
            self._store.delete(tenant_id, role)
        except Exception as e:
            logger.warning("orchestrator.role.delete_failed", role=role, error=str(e))
        return True

    def find_by_capability(
        self, tenant_id: str, capability: str,
    ) -> tuple[DigitalEmployeeRole, CapabilityBinding] | None:
        """Find an enabled role exposing ``capability`` (first match)."""
        for role in self.list(tenant_id):
            if not role.enabled:
                continue
            for binding in role.capabilities:
                if binding.name == capability:
                    return role, binding
        return None

    def reset(self) -> None:
        self._roles.clear()


_default_registry: RoleRegistry | None = None


def get_role_registry() -> RoleRegistry:
    global _default_registry
    if _default_registry is None:
        _default_registry = RoleRegistry()
    return _default_registry


def set_role_registry(registry: RoleRegistry | None) -> None:
    global _default_registry
    _default_registry = registry


def binding_to_dict(binding: CapabilityBinding) -> dict[str, Any]:
    return {
        "name": binding.name,
        "worker_kind": binding.worker_kind,
        "ref": binding.ref,
    }
