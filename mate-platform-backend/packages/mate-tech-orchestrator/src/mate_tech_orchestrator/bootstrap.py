"""Orchestrator bootstrap for the four built-in, fail-closed digital roles.

New App, Ontology, Workflow and Data Product roles receive their capability
bindings but no actor authorization by default.  A local profile may explicitly
backfill only an existing empty authorization mapping; it never replaces role
metadata, capabilities, enabled state, or a non-empty tenant mapping.
"""

from __future__ import annotations

import structlog

from mate_kernel.agent.orchestrator import AgentRole

from .scheduler.role_registry import CapabilityBinding, get_role_registry

logger = structlog.get_logger(__name__)

# App 角色绑定的 skill 检索能力（ref 即 MCP 中心注册的工具名）
_DEFAULT_ROLE_CAPABILITIES: dict[AgentRole, tuple[CapabilityBinding, ...]] = {
    AgentRole.APP: (
        CapabilityBinding(name="search_skill", worker_kind="mcp", ref="search_skill"),
        CapabilityBinding(name="read_skill", worker_kind="mcp", ref="read_skill"),
    ),
    # MP-SAL 接线：本体数字员工——能力绑定 MCP 中心的 ontology 代理工具
    # （SAL-01 注册：ont_list_classes / ont_inspect_class / ont_object_query，
    # 转发 tech-ont v2）。SuperAI 系统提示因此列出本体员工，dispatch 可派。
    AgentRole.ONTOLOGY: (
        CapabilityBinding(name="list_classes", worker_kind="mcp", ref="ont_list_classes"),
        CapabilityBinding(name="inspect_class", worker_kind="mcp", ref="ont_inspect_class"),
        CapabilityBinding(name="object_query", worker_kind="mcp", ref="ont_object_query"),
    ),
    AgentRole.WORKFLOW: (
        CapabilityBinding(name="delegate_run", worker_kind="a2a", ref="agent-recon"),
    ),
    AgentRole.DATA_PRODUCT: (
        CapabilityBinding(name="query", worker_kind="a2a", ref="agent-analyst"),
    ),
}

_DEFAULT_ROLE_NAMES: dict[AgentRole, str] = {
    AgentRole.APP: "app",
    AgentRole.ONTOLOGY: "ontology",
    AgentRole.WORKFLOW: "Workflow Employee",
    AgentRole.DATA_PRODUCT: "Data Analyst",
}


def seed_default_roles(
    *,
    tenant_id: str = "tenant-default",
    default_allowed_actor_roles: tuple[str, ...] = (),
    backfill_empty_authorization: bool = False,
) -> int:
    """Seed default roles and optionally repair empty mappings in an explicit local profile.

    Without ``default_allowed_actor_roles``, new roles remain denied by default.
    A non-empty mapping can be supplied by a local profile.  Existing roles are
    only changed when ``backfill_empty_authorization`` is explicitly enabled;
    their name, capabilities, enabled state and non-empty tenant mappings are
    then preserved.
    """
    registry = get_role_registry()
    changed = 0
    allowed = tuple(
        dict.fromkeys(value.strip() for value in default_allowed_actor_roles if value.strip())
    )
    for role, caps in _DEFAULT_ROLE_CAPABILITIES.items():
        existing = registry.get(tenant_id, role.value)
        if existing is not None:
            if backfill_empty_authorization and allowed and not existing.allowed_actor_roles:
                registry.set_allowed_actor_roles(tenant_id, role.value, allowed)
                changed += 1
                logger.info(
                    "orchestrator.seed.role_authorization_backfilled",
                    tenant=tenant_id,
                    role=role.value,
                )
            continue
        registry.register(
            tenant_id=tenant_id,
            role=role.value,
            name=_DEFAULT_ROLE_NAMES[role],
            capabilities=list(caps),
            allowed_actor_roles=allowed,
        )
        changed += 1
        logger.info("orchestrator.seed.role", tenant=tenant_id, role=role.value)
    return changed
