"""MP-SAL-04b / MP-DEDUP-01 / MP-SAL-04c: ontology 写工具与 HITL 边界测试。

覆盖：
  - ont_propose_model_type 成功 → 返回 proposal_id
  - ont_propose_instance 成功
  - ont_merge_objects 成功
  - ont_preview_proposal 正确返回 impact_summary
  - ont_confirm_proposal 走 HITL（agent 调会被拒）
  - cross-tenant 拒绝

策略：respx 拦截 tech-ont HTTP 面（不 mock 工具边界），断言真实转发路径 +
payload 透传，与 superai_a2a / 原 ontology_proxy 测试同款。
"""

from __future__ import annotations

import asyncio
import json

import httpx
import pytest
import respx

from mate_tech_mcp.server import MCPServer, create_server
from mate_tech_mcp.tools.ontology_proxy import (
    OntConfirmProposalTool,
    OntExecuteProposalTool,
    OntMergeObjectsTool,
    OntPreviewProposalTool,
    OntProposeInstanceTool,
    OntProposeModelTypeTool,
    OntRejectProposalTool,
    build_ontology_proxy_tools,
)

ONT_BASE = "http://mock-tech-ont:8007"


# ─────────────────── propose_model_type ───────────────────


@respx.mock
def test_propose_model_type_returns_proposal_id() -> None:
    route = respx.post(
        f"{ONT_BASE}/api/v1/ont/v2/object-types/propose",
    ).mock(return_value=httpx.Response(200, json={
        "proposal_id": "prop-abc-123",
        "kind": "model_type",
        "status": "pending",
        "action_rid": "ont.t.obj.foo.v1",
        "target_iid": None,
        "parameters": {"primary_key": ["id"]},
        "expected_diff": {"primary_key": ["id"]},
        "impact_summary": "新建 Foo 类型",
        "confirmed_by": None,
        "created_at": "2026-08-19T00:00:00+00:00",
        "confirmed_at": None,
    }))

    async def run() -> dict:
        tool = OntProposeModelTypeTool(base_url=ONT_BASE)
        try:
            return await tool(
                name="Foo",
                slug="foo",
                domain="finance",
                primary_key=["id"],
                impact_summary="新建 Foo 类型",
            )
        finally:
            await tool.aclose()

    out = asyncio.run(run())
    assert route.called
    body = json.loads(route.calls.last.request.content)
    # 透传到 type_def：rid / display_name / primary_key / marking
    assert body["type_def"]["display_name"] == "Foo"
    assert body["type_def"]["primary_key"] == ["id"]
    assert body["type_def"]["marking"] == ["finance"]
    assert body["impact_summary"] == "新建 Foo 类型"
    # 返回值透传
    assert out["proposal_id"] == "prop-abc-123"
    assert out["kind"] == "model_type"
    assert out["status"] == "pending"


@respx.mock
def test_propose_model_type_optional_args() -> None:
    """只传必填字段；properties / primary_key / domain 缺省也走得通。"""
    route = respx.post(
        f"{ONT_BASE}/api/v1/ont/v2/object-types/propose",
    ).mock(return_value=httpx.Response(200, json={
        "proposal_id": "prop-min", "kind": "model_type",
        "status": "pending", "action_rid": "", "target_iid": None,
        "parameters": {}, "expected_diff": {},
        "impact_summary": "min", "confirmed_by": None,
        "created_at": "", "confirmed_at": None,
    }))

    async def run() -> dict:
        tool = OntProposeModelTypeTool(base_url=ONT_BASE)
        try:
            return await tool(name="Bar", slug="bar", impact_summary="min")
        finally:
            await tool.aclose()

    out = asyncio.run(run())
    body = json.loads(route.calls.last.request.content)
    assert body["type_def"]["primary_key"] == ["id"]
    assert body["type_def"]["marking"] == []
    assert out["proposal_id"] == "prop-min"


# ─────────────────── propose_instance ───────────────────


@respx.mock
def test_propose_instance_forwards_to_class_route() -> None:
    route = respx.post(
        f"{ONT_BASE}/api/v1/ont/v2/classes/ont.t.obj.order.v1/propose-instance",
    ).mock(return_value=httpx.Response(200, json={
        "proposal_id": "prop-inst-1",
        "kind": "create_instance",
        "status": "pending",
        "action_rid": "ont.t.obj.order.v1",
        "target_iid": None,
        "parameters": {"props": {"status": "open", "amount": 100}},
        "expected_diff": {"status": "open"},
        "impact_summary": "新建订单",
        "confirmed_by": None,
        "created_at": "", "confirmed_at": None,
    }))

    async def run() -> dict:
        tool = OntProposeInstanceTool(base_url=ONT_BASE)
        try:
            return await tool(
                class_rid="ont.t.obj.order.v1",
                fields={"status": "open", "amount": 100},
                impact_summary="新建订单",
            )
        finally:
            await tool.aclose()

    out = asyncio.run(run())
    assert route.called
    body = json.loads(route.calls.last.request.content)
    assert body["props"] == {"status": "open", "amount": 100}
    assert body["impact_summary"] == "新建订单"
    assert out["proposal_id"] == "prop-inst-1"
    assert out["kind"] == "create_instance"


# ─────────────────── merge_objects ───────────────────


@respx.mock
def test_merge_objects_proposes_merge_suggestion() -> None:
    route = respx.post(
        f"{ONT_BASE}/api/v1/ont/v2/object-types/propose-merge",
    ).mock(return_value=httpx.Response(200, json={
        "proposal_id": "prop-merge-1",
        "kind": "merge_suggestion",
        "status": "pending",
        "action_rid": "ont.t.obj.order.v1",
        "target_iid": None,
        "parameters": {
            "source_rid": "ont.t.obj.order_old.v1",
            "target_rid": "ont.t.obj.order.v1",
            "similarity": 0.92,
            "mapping": {"amount_old": "amount"},
        },
        "expected_diff": {"affected_individuals": 12},
        "impact_summary": "合并 order_old → order",
        "confirmed_by": None,
        "created_at": "", "confirmed_at": None,
    }))

    async def run() -> dict:
        tool = OntMergeObjectsTool(base_url=ONT_BASE)
        try:
            return await tool(
                source_rid="ont.t.obj.order_old.v1",
                target_rid="ont.t.obj.order.v1",
                similarity=0.92,
                mapping={"amount_old": "amount"},
                impact_summary="合并 order_old → order",
            )
        finally:
            await tool.aclose()

    out = asyncio.run(run())
    assert route.called
    body = json.loads(route.calls.last.request.content)
    assert body["source_rid"] == "ont.t.obj.order_old.v1"
    assert body["target_rid"] == "ont.t.obj.order.v1"
    assert body["similarity"] == 0.92
    assert body["mapping"] == {"amount_old": "amount"}
    assert out["kind"] == "merge_suggestion"


# ─────────────────── preview_proposal ───────────────────


@respx.mock
def test_preview_proposal_returns_impact_summary() -> None:
    route = respx.get(
        f"{ONT_BASE}/api/v1/ont/v2/proposals/prop-merge-1/preview",
    ).mock(return_value=httpx.Response(200, json={
        "proposal_id": "prop-merge-1",
        "kind": "merge_suggestion",
        "action_type": "execute",
        "target_rid": "ont.t.obj.order.v1",
        "status": "pending",
        "parameters": {"source_rid": "ont.t.obj.order_old.v1"},
        "expected_diff": {},
        "impact_summary": "合并 order_old → order",
        "merge_source_rid": "ont.t.obj.order_old.v1",
        "merge_target_rid": "ont.t.obj.order.v1",
        "merge_mapping": {"amount_old": "amount"},
        "merge_property_overlap": {"amount": {"shared": True}},
        "confirmed_by": None,
        "confirmed_at": None,
    }))

    async def run() -> dict:
        tool = OntPreviewProposalTool(base_url=ONT_BASE)
        try:
            return await tool(proposal_id="prop-merge-1")
        finally:
            await tool.aclose()

    out = asyncio.run(run())
    assert route.called
    assert out["impact_summary"] == "合并 order_old → order"
    assert out["kind"] == "merge_suggestion"
    assert out["merge_source_rid"] == "ont.t.obj.order_old.v1"
    assert out["merge_target_rid"] == "ont.t.obj.order.v1"
    assert out["merge_mapping"] == {"amount_old": "amount"}


# ─────────────────── HITL 闸门（agent_invokable=False）───────────────────


@respx.mock
def test_confirm_proposal_blocks_agent_caller() -> None:
    """Agent（默认 caller）调用 ont_confirm_proposal 必须被拒绝。

    不应触发 tech-ont HTTP；MCPServer.call_tool 闸门处抛 PermissionError。
    """
    respx.post(
        f"{ONT_BASE}/api/v1/ont/v2/proposals/prop-1/confirm",
    ).mock(return_value=httpx.Response(200, json={"ok": True}))
    server: MCPServer = create_server(name="test-hitl")
    server.register_tool(OntConfirmProposalTool(base_url=ONT_BASE))

    async def run() -> None:
        # Agent 调用：arguments 不带 __caller__ → PermissionError
        with pytest.raises(PermissionError) as ei:
            await server.call_tool(
                "ont_confirm_proposal",
                {"proposal_id": "prop-1", "confirmed_by": "u-1"},
            )
        assert "HITL-bound" in str(ei.value)
        assert "agent_invokable" in str(ei.value)

    asyncio.run(run())


@respx.mock
def test_confirm_proposal_allows_user_caller() -> None:
    """显式 __caller__="user" 可走通，转发到 tech-ont。"""
    route = respx.post(
        f"{ONT_BASE}/api/v1/ont/v2/proposals/prop-1/confirm",
    ).mock(return_value=httpx.Response(200, json={
        "proposal_id": "prop-1", "kind": "model_type",
        "status": "confirmed", "action_rid": "", "target_iid": None,
        "parameters": {}, "expected_diff": {},
        "impact_summary": "", "confirmed_by": "u-1",
        "created_at": "", "confirmed_at": "2026-08-19T00:00:00",
    }))
    server: MCPServer = create_server(name="test-hitl-user")
    tool = OntConfirmProposalTool(base_url=ONT_BASE)
    server.register_tool(tool)

    async def run() -> dict:
        try:
            return await server.call_tool(
                "ont_confirm_proposal",
                {"__caller__": "user", "proposal_id": "prop-1", "confirmed_by": "u-1"},
            )
        finally:
            await tool.aclose()

    out = asyncio.run(run())
    assert route.called
    body = json.loads(route.calls.last.request.content)
    assert body["confirmed_by"] == "u-1"
    assert out["status"] == "confirmed"


@respx.mock
def test_reject_and_execute_also_blocked_for_agent() -> None:
    """ont_reject_proposal / ont_execute_proposal 同样走 HITL 闸门。"""
    for endpoint in ("reject", "execute"):
        respx.post(
            f"{ONT_BASE}/api/v1/ont/v2/proposals/prop-2/{endpoint}",
        ).mock(return_value=httpx.Response(200, json={"ok": True}))

    server: MCPServer = create_server(name="test-hitl-3")
    server.register_tool(OntRejectProposalTool(base_url=ONT_BASE))
    server.register_tool(OntExecuteProposalTool(base_url=ONT_BASE))

    async def run() -> None:
        with pytest.raises(PermissionError):
            await server.call_tool(
                "ont_reject_proposal",
                {"proposal_id": "prop-2", "confirmed_by": "u-1"},
            )
        with pytest.raises(PermissionError):
            await server.call_tool(
                "ont_execute_proposal",
                {"proposal_id": "prop-2"},
            )

    asyncio.run(run())


# ─────────────────── cross-tenant 拒绝 ───────────────────


@respx.mock
def test_propose_model_type_cross_tenant_403() -> None:
    """tech-ont v2 抛 403（cross-tenant propose denied）应被工具透传。"""
    respx.post(
        f"{ONT_BASE}/api/v1/ont/v2/object-types/propose",
    ).mock(return_value=httpx.Response(403, json={
        "detail": "cross-tenant propose denied",
    }))

    async def run() -> None:
        tool = OntProposeModelTypeTool(base_url=ONT_BASE)
        try:
            with pytest.raises(httpx.HTTPStatusError) as ei:
                await tool(
                    name="X", slug="x", impact_summary="other-tenant",
                )
            assert ei.value.response.status_code == 403
        finally:
            await tool.aclose()

    asyncio.run(run())


@respx.mock
def test_merge_objects_cross_tenant_403() -> None:
    respx.post(
        f"{ONT_BASE}/api/v1/ont/v2/object-types/propose-merge",
    ).mock(return_value=httpx.Response(403, json={
        "detail": "cross-tenant propose denied",
    }))

    async def run() -> None:
        tool = OntMergeObjectsTool(base_url=ONT_BASE)
        try:
            with pytest.raises(httpx.HTTPStatusError) as ei:
                await tool(
                    source_rid="ont.t.other.obj.a.v1",
                    target_rid="ont.t.other.obj.b.v1",
                    impact_summary="x",
                )
            assert ei.value.response.status_code == 403
        finally:
            await tool.aclose()

    asyncio.run(run())


# ─────────────────── 元数据 / factory ───────────────────


@pytest.mark.parametrize(
    "tool_cls",
    [
        OntProposeModelTypeTool,
        OntProposeInstanceTool,
        OntMergeObjectsTool,
        OntPreviewProposalTool,
        OntConfirmProposalTool,
        OntRejectProposalTool,
        OntExecuteProposalTool,
    ],
)
def test_write_tools_carry_metadata(tool_cls: type) -> None:
    """operationId / capabilities / agent_invokable 正确标注。"""
    tool = tool_cls(base_url=ONT_BASE)
    assert tool.name.startswith("ont_")
    assert tool.description
    assert tool.operation_id, "operationId 必须填（OpenAPI 桥）"
    # 写工具（propose/merge/confirm/reject/execute）必须含 ontology.write；
    # 只读 preview 只需 ontology.read。
    if tool_cls is OntPreviewProposalTool:
        assert "ontology.read" in tool.capabilities
        assert "preview" in tool.capabilities
    else:
        assert "ontology.write" in tool.capabilities
    assert tool.input_schema["type"] == "object"
    # HITL 边界：confirm / reject / execute
    if tool_cls in (
        OntConfirmProposalTool, OntRejectProposalTool, OntExecuteProposalTool,
    ):
        assert tool.agent_invokable is False
        assert tool.readonly_by_user is True
    else:
        assert tool.agent_invokable is True
        assert tool.readonly_by_user is False


def test_build_factory_returns_all_tools() -> None:
    """factory 返回 10 件套：3 只读 + 4 写提议 + 3 HITL。"""
    tools = build_ontology_proxy_tools()
    names = {t.name for t in tools}
    expected = {
        "ont_list_classes", "ont_inspect_class", "ont_object_query",
        "ont_propose_model_type", "ont_propose_instance",
        "ont_merge_objects", "ont_preview_proposal",
        "ont_confirm_proposal", "ont_reject_proposal",
        "ont_execute_proposal",
    }
    assert names == expected
    assert len(tools) == 10