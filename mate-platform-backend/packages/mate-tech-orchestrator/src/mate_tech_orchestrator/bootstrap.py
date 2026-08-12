"""orchestrator bootstrap — seed default digital-employee roles with skill capabilities.

为 App 数字员工角色预注册 skill 检索能力（search_skill / read_skill，
worker_kind=mcp），使 agent 经 dispatch 时可按能力检索 skillhub 的
SKILL.md 作为搭应用上下文。

幂等：角色已注册则跳过，不覆盖既有能力。
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
}


def seed_default_roles(*, tenant_id: str = "tenant-default") -> int:
    """Seed skill capabilities for default roles. Returns count seeded.

    Idempotent: an already-registered role is left untouched (its
    capabilities are preserved), so re-runs don't clobber tenant config.
    """
    registry = get_role_registry()
    seeded = 0
    for role, caps in _DEFAULT_ROLE_CAPABILITIES.items():
        existing = registry.get(tenant_id, role.value)
        if existing is not None:
            continue  # preserve tenant-configured capabilities
        registry.register(
            tenant_id=tenant_id,
            role=role.value,
            name=role.value,
            capabilities=list(caps),
        )
        seeded += 1
        logger.info("orchestrator.seed.role", tenant=tenant_id, role=role.value)
    return seeded
