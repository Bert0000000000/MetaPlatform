"""orchestrator bootstrap — 默认角色 skill 能力 seed 测试。"""
from __future__ import annotations

import pytest
from mate_tech_orchestrator.bootstrap import seed_default_roles
from mate_tech_orchestrator.scheduler.role_registry import get_role_registry

from mate_kernel.agent.orchestrator import AgentRole


@pytest.fixture(autouse=True)
def _fresh_registry() -> None:
    get_role_registry().reset()
    yield
    get_role_registry().reset()


def test_seed_app_role_with_skill_capabilities() -> None:
    n = seed_default_roles(tenant_id="tenant-acme")
    assert n == 1  # 仅 App 角色带 skill 能力
    role = get_role_registry().get("tenant-acme", AgentRole.APP.value)
    assert role is not None
    caps = {c.name for c in role.capabilities}
    assert {"search_skill", "read_skill"}.issubset(caps)
    # worker_kind=mcp，ref 即 MCP 中心工具名
    search = next(c for c in role.capabilities if c.name == "search_skill")
    assert search.worker_kind == "mcp"
    assert search.ref == "search_skill"


def test_seed_is_idempotent() -> None:
    seed_default_roles(tenant_id="tenant-acme")
    n2 = seed_default_roles(tenant_id="tenant-acme")
    assert n2 == 0  # 已存在则跳过


def test_find_by_capability_hits_app_role() -> None:
    seed_default_roles(tenant_id="tenant-acme")
    found = get_role_registry().find_by_capability("tenant-acme", "search_skill")
    assert found is not None
    role, binding = found
    assert role.role == AgentRole.APP.value
    assert binding.ref == "search_skill"
