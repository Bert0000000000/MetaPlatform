"""MP-COMP-01 pilot: reactive capability runtime unit tests (ADR-0042)."""
from __future__ import annotations

import pytest
from mate_tech_orchestrator.scheduler.capability_runtime import (
    CapabilityRuntime,
    capability_key,
)
from mate_tech_orchestrator.scheduler.role_registry import (
    CapabilityBinding,
    DigitalEmployeeRole,
)

TENANT = "tenant-acme"


def _role(*caps: CapabilityBinding) -> DigitalEmployeeRole:
    return DigitalEmployeeRole(
        role="app", tenant_id=TENANT, name="App", capabilities=caps,
    )


@pytest.mark.asyncio
async def test_tool_unregister_deactivates_role() -> None:
    runtime = CapabilityRuntime()
    role = _role(CapabilityBinding(name="search_skill", worker_kind="mcp", ref="tools/search"))
    await runtime.attach_role(role)

    await runtime.track_capability(TENANT, "search_skill", "tools/search")
    assert runtime.is_role_active(TENANT, "app")
    assert runtime.allows(TENANT, "search_skill")

    await runtime.untrack_capability(TENANT, "search_skill")
    assert not runtime.is_role_active(TENANT, "app")
    assert not runtime.allows(TENANT, "search_skill")
    await runtime.dispose()


@pytest.mark.asyncio
async def test_tool_reregister_reactivates_role() -> None:
    runtime = CapabilityRuntime()
    role = _role(CapabilityBinding(name="search_skill", worker_kind="mcp", ref="tools/search"))
    await runtime.attach_role(role)
    await runtime.track_capability(TENANT, "search_skill", "tools/search")
    await runtime.untrack_capability(TENANT, "search_skill")
    assert not runtime.is_role_active(TENANT, "app")

    await runtime.track_capability(TENANT, "search_skill", "tools/search")
    assert runtime.is_role_active(TENANT, "app")
    await runtime.dispose()


@pytest.mark.asyncio
async def test_role_effect_side_effects_reverted_on_deactivation() -> None:
    runtime = CapabilityRuntime()
    role = _role(
        CapabilityBinding(name="search_skill", worker_kind="mcp", ref="tools/search"),
        CapabilityBinding(name="read_skill", worker_kind="mcp", ref="tools/read"),
    )
    await runtime.attach_role(role)

    # Only one of the two MCP capabilities is available → role inactive.
    await runtime.track_capability(TENANT, "search_skill", "tools/search")
    assert not runtime.is_role_active(TENANT, "app")
    assert runtime.active_capabilities(TENANT, "app") == ()

    # Both available → the activation marker (the role fiber's effect)
    # is mounted; withdraw one → the marker reverts automatically.
    await runtime.track_capability(TENANT, "read_skill", "tools/read")
    assert runtime.is_role_active(TENANT, "app")
    assert len(runtime.active_capabilities(TENANT, "app")) == 2

    await runtime.untrack_capability(TENANT, "read_skill")
    assert not runtime.is_role_active(TENANT, "app")
    assert runtime.active_capabilities(TENANT, "app") == ()
    await runtime.dispose()


@pytest.mark.asyncio
async def test_allows_fallback_when_untracked() -> None:
    runtime = CapabilityRuntime()
    assert not runtime.is_tracked(TENANT, "anything")
    assert runtime.allows(TENANT, "anything")  # legacy fallback: allow
    await runtime.dispose()


def test_capability_key_format() -> None:
    assert capability_key("t1", "search") == "capability:t1:search"
