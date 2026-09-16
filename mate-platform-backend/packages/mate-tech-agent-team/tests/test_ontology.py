"""任务 3 · 打通本体的验收用例。

判据：让员工"查本月异常订单" → 返回真实数据。

单元层面守住三件事：
  1. 员工能用的是**本体既有工具面**（不是新造的一套交互）；
  2. 工具调用真的打到本体客户端，参数按既有端点签名传；
  3. **写只到 proposal**——confirm / reject / execute 三个工具根本不存在于员工面。
"""

from __future__ import annotations

from typing import Any

import pytest
from mate_tech_agent_team import OntologyToolbox, ToolNotAllowed
from mate_tech_agent_team.ontology_toolbox import CompositeToolbox

ALL_READ = ("ont_list_classes", "ont_inspect_class", "ont_object_query")
ALL_ALLOWED = (*ALL_READ, "ont_propose_instance")


class FakeOntClient:
    """本体客户端的替身：记录调用，回真形状的结果。"""

    def __init__(self) -> None:
        self.calls: list[tuple[str, Any]] = []

    async def list_classes(self, limit: int = 200) -> Any:
        self.calls.append(("list_classes", limit))
        return [
            {
                "rid": "ont.tenant-default.obj.sopbench-order-fulfillment.v1",
                "properties": [
                    {"rid": "ont.tenant-default.prop.sopbench-order-fulfillment-order-id.v1"}
                ],
            }
        ]

    async def inspect_class(self, class_rid: str) -> Any:
        self.calls.append(("inspect_class", class_rid))
        return {"class_rid": class_rid, "properties": [{"name": "order-id"}]}

    async def object_query(self, payload: dict[str, Any]) -> Any:
        self.calls.append(("object_query", payload))
        return {"kind": "objects", "rows": [{"__rid__": "ont.x.ind.ord", "order-id": "ORD006"}]}

    async def propose_instance(self, class_rid: str, props: dict, impact_summary: str = "") -> Any:
        self.calls.append(("propose_instance", (class_rid, props, impact_summary)))
        return {"proposal_id": "p-1", "status": "pending"}


@pytest.mark.asyncio
async def test_list_classes_is_compacted_for_the_model() -> None:
    """47 个类型的完整定义会淹没模型——只回 rid + 名称 + 属性名。"""
    client = FakeOntClient()
    result = await OntologyToolbox(client).invoke(
        name="ont_list_classes", arguments={}, allowed=ALL_ALLOWED
    )
    assert result["count"] == 1
    assert result["classes"][0]["rid"] == "ont.tenant-default.obj.sopbench-order-fulfillment.v1"
    assert result["classes"][0]["name"] == "sopbench-order-fulfillment"
    assert "properties" in result["classes"][0]


@pytest.mark.asyncio
async def test_object_query_passes_through_to_the_real_endpoint() -> None:
    client = FakeOntClient()
    result = await OntologyToolbox(client).invoke(
        name="ont_object_query",
        arguments={
            "source": "ont.tenant-default.obj.sopbench-order-fulfillment.v1",
            "paging_limit": 5,
        },
        allowed=ALL_ALLOWED,
    )
    assert client.calls == [
        (
            "object_query",
            {"source": "ont.tenant-default.obj.sopbench-order-fulfillment.v1", "paging_limit": 5},
        )
    ]
    assert result["rows"][0]["order-id"] == "ORD006"


@pytest.mark.asyncio
async def test_none_arguments_are_dropped_before_the_call() -> None:
    client = FakeOntClient()
    await OntologyToolbox(client).invoke(
        name="ont_object_query",
        arguments={"source": "rid-1", "filters": None, "aggregation": None},
        allowed=ALL_ALLOWED,
    )
    _, payload = client.calls[0]
    assert payload == {"source": "rid-1"}


@pytest.mark.asyncio
async def test_propose_is_allowed_but_never_applies() -> None:
    client = FakeOntClient()
    result = await OntologyToolbox(client).invoke(
        name="ont_propose_instance",
        arguments={"class_rid": "rid-1", "props": {"order-id": "ORD999"}},
        allowed=ALL_ALLOWED,
    )
    assert result["status"] == "pending"
    assert client.calls[0][0] == "propose_instance"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "forbidden", ["ont_confirm_proposal", "ont_reject_proposal", "ont_execute_proposal"]
)
async def test_human_gate_tools_are_not_part_of_the_employee_surface(forbidden: str) -> None:
    """写只有 proposal 一步；确认/驳回/执行**不在员工面上**，写进白名单也不给。"""
    client = FakeOntClient()
    toolbox = OntologyToolbox(client)
    with pytest.raises(ToolNotAllowed):
        await toolbox.invoke(
            name=forbidden,
            arguments={"proposal_id": "p-1"},
            allowed=(*ALL_ALLOWED, forbidden),
        )
    assert client.calls == [], "人工闸门类工具不该产生任何本体调用"


@pytest.mark.asyncio
async def test_human_gate_tools_are_not_offered_in_schemas() -> None:
    toolbox = OntologyToolbox(FakeOntClient())
    schemas = await toolbox.schemas(allowed=("ont_confirm_proposal", "ont_object_query"))
    assert [s["function"]["name"] for s in schemas] == ["ont_object_query"]


@pytest.mark.asyncio
async def test_whitelist_gate_applies_to_the_ontology_path_too() -> None:
    client = FakeOntClient()
    with pytest.raises(ToolNotAllowed) as excinfo:
        await OntologyToolbox(client).invoke(
            name="ont_object_query", arguments={"source": "rid-1"}, allowed=("ont_list_classes",)
        )
    assert excinfo.value.reason == "not_in_employee_tool_whitelist"
    assert client.calls == []


# ── 路由：本体走本体面，其余走 MCP 中心 ─────────────────────────────────


class _RecordingMcp:
    def __init__(self) -> None:
        self.invoked: list[str] = []

    async def schemas(self, *, allowed):
        return [
            {"type": "function", "function": {"name": n, "description": "", "parameters": {}}}
            for n in allowed
            if n == "kb_search"
        ]

    async def invoke(self, *, name, arguments, allowed):
        self.invoked.append(name)
        return {"hits": []}


@pytest.mark.asyncio
async def test_composite_routes_ontology_to_ontology_and_the_rest_to_mcp() -> None:
    ont_client = FakeOntClient()
    mcp = _RecordingMcp()
    composite = CompositeToolbox(ontology=OntologyToolbox(ont_client), mcp=mcp)
    allowed = ("ont_list_classes", "kb_search")

    schemas = await composite.schemas(allowed=allowed)
    assert {s["function"]["name"] for s in schemas} == {"ont_list_classes", "kb_search"}

    await composite.invoke(name="ont_list_classes", arguments={}, allowed=allowed)
    await composite.invoke(name="kb_search", arguments={"query": "x"}, allowed=allowed)
    assert [c[0] for c in ont_client.calls] == ["list_classes"]
    assert mcp.invoked == ["kb_search"]


@pytest.mark.asyncio
async def test_composite_enforces_the_whitelist_before_routing() -> None:
    ont_client = FakeOntClient()
    composite = CompositeToolbox(ontology=OntologyToolbox(ont_client), mcp=_RecordingMcp())
    with pytest.raises(ToolNotAllowed):
        await composite.invoke(name="ont_object_query", arguments={}, allowed=("kb_search",))
    assert ont_client.calls == []
