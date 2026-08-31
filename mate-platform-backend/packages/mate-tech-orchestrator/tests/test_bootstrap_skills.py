"""orchestrator bootstrap — 默认角色 skill 能力 seed 测试。"""
from __future__ import annotations

import pytest
from mate_tech_orchestrator.bootstrap import seed_default_roles
from mate_tech_orchestrator.scheduler.role_registry import CapabilityBinding, get_role_registry

from mate_kernel.agent.orchestrator import AgentRole


@pytest.fixture(autouse=True)
def _fresh_registry() -> None:
    get_role_registry().reset()
    yield
    get_role_registry().reset()


def test_seed_app_role_with_skill_capabilities() -> None:
    n = seed_default_roles(tenant_id="tenant-acme")
    assert n == 4  # App、Ontology、Workflow 和 Data Product 默认目录。
    role = get_role_registry().get("tenant-acme", AgentRole.APP.value)
    assert role is not None
    caps = {c.name for c in role.capabilities}
    assert {"search_skill", "read_skill"}.issubset(caps)
    # worker_kind=mcp，ref 即 MCP 中心工具名
    search = next(c for c in role.capabilities if c.name == "search_skill")
    assert search.worker_kind == "mcp"
    assert search.ref == "search_skill"


def test_seed_default_roles_can_explicitly_authorize_platform_admin() -> None:
    """Task5 must create the complete local default role catalogue with an explicit admin mapping."""
    n = seed_default_roles(
        tenant_id="tenant-acme",
        default_allowed_actor_roles=("PLATFORM_ADMIN",),
    )

    assert n == 4
    for role in (
        AgentRole.APP,
        AgentRole.WORKFLOW,
        AgentRole.DATA_PRODUCT,
        AgentRole.ONTOLOGY,
    ):
        saved = get_role_registry().get("tenant-acme", role.value)
        assert saved is not None
        assert saved.allowed_actor_roles == ("PLATFORM_ADMIN",)


def test_seed_can_backfill_only_empty_builtin_role_authorization() -> None:
    """An explicit local repair must preserve capabilities and non-empty tenant mappings."""
    registry = get_role_registry()
    registry.register(
        tenant_id="tenant-acme",
        role=AgentRole.APP.value,
        name="Custom App Employee",
        capabilities=[CapabilityBinding(name="custom_capability", worker_kind="local", ref="")],
    )
    registry.register(
        tenant_id="tenant-acme",
        role=AgentRole.ONTOLOGY.value,
        capabilities=[],
        allowed_actor_roles=["ONTOLOGY_OPERATOR"],
    )

    n = seed_default_roles(
        tenant_id="tenant-acme",
        default_allowed_actor_roles=("PLATFORM_ADMIN",),
        backfill_empty_authorization=True,
    )

    assert n == 3  # app repaired + workflow/data_product newly seeded.
    app = registry.get("tenant-acme", AgentRole.APP.value)
    ontology = registry.get("tenant-acme", AgentRole.ONTOLOGY.value)
    assert app is not None and ontology is not None
    assert app.name == "Custom App Employee"
    assert [capability.name for capability in app.capabilities] == ["custom_capability"]
    assert app.allowed_actor_roles == ("PLATFORM_ADMIN",)
    assert ontology.allowed_actor_roles == ("ONTOLOGY_OPERATOR",)


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
