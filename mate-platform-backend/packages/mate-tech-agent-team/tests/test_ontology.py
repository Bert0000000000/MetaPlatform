"""任务 3 验收（1.1 修订）· 本体工具经 MCP 总线。

1.0 时 MCP 的本体代理用**服务身份** client_credentials token 出去，而该
token 不带 tenant claim，本体 ``AuthMiddleware`` 直接 401；agent-team 因此
绕过总线、带用户 token 直连本体。1.1 task 1c 修好了透传（MCP 侧逐请求带上
调用方 token + 租户），于是直连旁路被删除。

本文件守住三件事：

  1. 本体工具与其它工具**走同一条总线**（MCP 中心），不再有第二套客户端；
  2. 直连旁路（``OntologyToolbox`` / ``mate_clients.ontology``）已从
     agent-team 消失；
  3. **写只到 proposal**——confirm / reject / execute 在总线处即被
     ``agentInvokable=False`` 拒绝，写进白名单也不给。
"""

from __future__ import annotations

from typing import Any

import pytest
from mate_tech_agent_team import CompositeToolbox, McpToolbox, ToolNotAllowed

READ_TOOLS = ("ont_list_classes", "ont_inspect_class", "ont_object_query")
WRITE_TOOLS = ("ont_propose_instance",)


def _descriptor(name: str, *, agent_invokable: bool = True) -> dict[str, Any]:
    return {
        "name": name,
        "description": f"{name} descriptor",
        "inputSchema": {"type": "object", "properties": {}},
        "agentInvokable": agent_invokable,
    }


class FakeCenter:
    """MCP 中心客户端替身：回工具清单，记录调用。"""

    def __init__(self, descriptors: list[dict[str, Any]]) -> None:
        self._descriptors = descriptors
        self.calls: list[tuple[str, dict[str, Any]]] = []

    async def list_tools(self) -> list[dict[str, Any]]:
        return list(self._descriptors)

    async def call_tool(self, *, name: str, arguments: dict[str, Any]) -> Any:
        self.calls.append((name, arguments))
        return {"ok": True, "tool": name}


def _center() -> FakeCenter:
    descriptors = [_descriptor(n) for n in (*READ_TOOLS, *WRITE_TOOLS)]
    descriptors.append(_descriptor("kb_search"))
    # 中心把人工闸门工具标为 agentInvokable=False（ADR-0044）。
    descriptors.append(_descriptor("ont_confirm_proposal", agent_invokable=False))
    return FakeCenter(descriptors)


# ── 总线：本体与其它工具同路 ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_ontology_tools_are_dispatched_through_the_center() -> None:
    center = _center()
    composite = CompositeToolbox(mcp=McpToolbox(center))
    allowed = ("ont_list_classes", "ont_object_query", "kb_search")

    schemas = await composite.schemas(allowed=allowed)
    assert {s["function"]["name"] for s in schemas} == set(allowed)

    await composite.invoke(name="ont_list_classes", arguments={}, allowed=allowed)
    await composite.invoke(name="kb_search", arguments={"query": "x"}, allowed=allowed)

    assert [c[0] for c in center.calls] == ["ont_list_classes", "kb_search"]


@pytest.mark.asyncio
async def test_write_proposal_tool_travels_the_same_bus() -> None:
    center = _center()
    composite = CompositeToolbox(mcp=McpToolbox(center))
    await composite.invoke(
        name="ont_propose_instance",
        arguments={"class_rid": "rid-1", "props": {"order-id": "ORD999"}},
        allowed=(*READ_TOOLS, *WRITE_TOOLS),
    )
    assert center.calls == [
        ("ont_propose_instance", {"class_rid": "rid-1", "props": {"order-id": "ORD999"}})
    ]


@pytest.mark.asyncio
async def test_whitelist_gate_applies_before_the_bus() -> None:
    center = _center()
    composite = CompositeToolbox(mcp=McpToolbox(center))
    with pytest.raises(ToolNotAllowed) as excinfo:
        await composite.invoke(name="ont_object_query", arguments={}, allowed=("kb_search",))
    assert excinfo.value.reason == "not_in_employee_tool_whitelist"
    assert center.calls == [], "闸门拒绝的调用不该打到中心"


# ── 直连旁路已删除 ──────────────────────────────────────────────────────


def test_no_direct_ontology_bypass_remains_in_agent_team() -> None:
    """旁路删除的守门：模块与客户端都不该再被 agent-team 引用。"""
    import importlib

    import mate_tech_agent_team

    assert not hasattr(mate_tech_agent_team, "OntologyToolbox")
    with pytest.raises(ModuleNotFoundError):
        importlib.import_module("mate_tech_agent_team.ontology_toolbox")

    # 运行时装配也不该再构造本体客户端。
    import inspect

    from mate_tech_agent_team import wiring

    source = inspect.getsource(wiring)
    assert "OntAgentToolsClient" not in source
    assert "OntologyToolbox" not in source


# ── 人工闸门仍在（中心标志） ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_human_gate_tools_are_rejected_even_when_whitelisted() -> None:
    center = _center()
    toolbox = McpToolbox(center)
    with pytest.raises(ToolNotAllowed) as excinfo:
        await toolbox.invoke(
            name="ont_confirm_proposal",
            arguments={"proposal_id": "p-1"},
            allowed=(*READ_TOOLS, "ont_confirm_proposal"),
        )
    assert excinfo.value.reason == "center_marks_not_agent_invokable"
    assert center.calls == [], "人工闸门类工具不该产生任何中心调用"


@pytest.mark.asyncio
async def test_human_gate_tools_are_not_offered_in_schemas() -> None:
    toolbox = McpToolbox(_center())
    schemas = await toolbox.schemas(allowed=("ont_confirm_proposal", "ont_object_query"))
    assert [s["function"]["name"] for s in schemas] == ["ont_object_query"]
