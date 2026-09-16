"""MP-SAL-01: ontology 代理三件套 —— tech-ont v2 转发测试。

respx 拦截 tech-ont HTTP 面(不 mock 工具边界),断言真实转发路径与
payload 透传,与 superai_a2a 测试同一策略。
"""

from __future__ import annotations

import asyncio

import httpx
import pytest
import respx

from mate_tech_mcp.tools.ontology_proxy import (
    OntInspectClassTool,
    OntListClassesTool,
    OntObjectQueryTool,
)

ONT_BASE = "http://mock-tech-ont:8007"


@respx.mock
def test_list_classes_proxies_object_types_endpoint() -> None:
    """1.1 task 1c: list the tenant's *object types*, compacted to rid + name.

    Regression guard: this tool used to call ``/agent-tools``, which returns
    the virtual *tool* registry (``query_<slug>`` …) — rows with no ``rid`` —
    so the compaction below produced ``count: 0`` on every call. The class
    list comes from ``/object-types``.

    Returning the engine's raw type definitions is also wrong: 47 types'
    field lists blow past the per-result truncation limit and the model then
    picks the wrong class (see the env-facts card §6).
    """
    route = respx.get(f"{ONT_BASE}/api/v1/ont/v2/object-types").mock(
        return_value=httpx.Response(
            200,
            json=[
                {
                    "rid": "ont.tenant-default.obj.order-fulfillment.v1",
                    "properties": [{"rid": "ont.tenant-default.prop.order-id.v1"}],
                },
            ],
        ),
    )

    async def run() -> dict:
        tool = OntListClassesTool(base_url=ONT_BASE)
        try:
            return await tool(limit=50)
        finally:
            await tool.aclose()

    out = asyncio.run(run())
    assert route.called
    assert route.calls.last.request.url.params["limit"] == "50"
    assert out["count"] == 1
    assert out["classes"] == [
        {"rid": "ont.tenant-default.obj.order-fulfillment.v1", "name": "order-fulfillment"}
    ]


@respx.mock
def test_inspect_class_proxies_inspect_endpoint() -> None:
    route = respx.get(
        f"{ONT_BASE}/api/v1/ont/v2/classes/ont.t.obj.order.v1/inspect",
    ).mock(return_value=httpx.Response(200, json={"rid": "ont.t.obj.order.v1"}))

    async def run() -> dict:
        tool = OntInspectClassTool(base_url=ONT_BASE)
        try:
            return await tool(class_rid="ont.t.obj.order.v1")
        finally:
            await tool.aclose()

    out = asyncio.run(run())
    assert route.called
    assert out["rid"] == "ont.t.obj.order.v1"


@respx.mock
def test_object_query_proxies_ir_endpoint() -> None:
    route = respx.post(f"{ONT_BASE}/api/v1/ont/v2/object-query").mock(
        return_value=httpx.Response(
            200,
            json={
                "kind": "aggregates",
                "rows": [{"region": "north", "sum_amount": 450.0}],
                "result_schema": {"sum_amount": {"fn": "sum"}},
            },
        ),
    )

    async def run() -> dict:
        tool = OntObjectQueryTool(base_url=ONT_BASE)
        try:
            return await tool(
                source="ont.t.obj.order.v1",
                filters=[{"field": "status", "op": "eq", "value": "open"}],
                aggregation={
                    "group_by": ["region"],
                    "metrics": [{"fn": "sum", "field": "amount"}],
                },
            )
        finally:
            await tool.aclose()

    out = asyncio.run(run())
    assert route.called
    import json as _json

    body = _json.loads(route.calls.last.request.content)
    assert body["source"] == "ont.t.obj.order.v1"
    assert body["aggregation"]["metrics"][0]["fn"] == "sum"
    assert out["kind"] == "aggregates"


@pytest.mark.parametrize(
    "tool_cls",
    [OntListClassesTool, OntInspectClassTool, OntObjectQueryTool],
)
def test_proxy_tools_carry_schema_and_description(tool_cls: type) -> None:
    tool = tool_cls(base_url=ONT_BASE)
    assert tool.name.startswith("ont_")
    assert tool.description
    assert tool.input_schema["type"] == "object"
