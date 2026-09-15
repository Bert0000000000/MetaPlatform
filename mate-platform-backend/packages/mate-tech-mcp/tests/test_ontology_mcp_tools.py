"""2026-09-14 本体 MCP 能力面增量测试。

覆盖：5 个新工具（多态浏览/语义搜索/三闸门自检/指标/Interface 清单）、
provenance 自动注入、HITL 协议边界加固（外部 __caller__ 剥除）。
"""

from __future__ import annotations

import json
from typing import Any

import httpx
import pytest

from mate_tech_mcp.tools.ontology_proxy import build_ontology_proxy_tools


class _CaptureTransport(httpx.AsyncBaseTransport):
    """捕获请求的 mock transport（record + 可配置响应）。"""

    def __init__(self, responses: list[Any] | None = None) -> None:
        self.requests: list[httpx.Request] = []
        self._responses = list(responses or [])

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        status, body = self._responses.pop(0) if self._responses else (200, {})
        return httpx.Response(status, json=body)


def _tool(name: str):
    for t in build_ontology_proxy_tools():
        if t.name == name:
            return t
    raise KeyError(name)


def _client(transport: _CaptureTransport) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=transport, base_url="http://ont.test")


class TestNewToolset:
    def test_factory_contains_fifteen_tools(self):
        tools = build_ontology_proxy_tools()
        names = {t.name for t in tools}
        assert len(tools) == 15
        for expected in (
            "ont_list_classes",
            "ont_list_individuals",
            "ont_search_objects",
            "ont_validate_preflight",
            "ont_agent_metrics",
            "ont_list_interfaces",
            "ont_propose_instance",
            "ont_confirm_proposal",
        ):
            assert expected in names

    @pytest.mark.asyncio
    async def test_list_individuals_passes_class_rid(self):
        tr = _CaptureTransport([(200, [])])
        t = _tool("ont_list_individuals")
        t._client = _client(tr)
        out = await t(class_rid="ont.t.if.facility.v1")
        assert out == []
        req = tr.requests[0]
        assert req.url.path.endswith("/api/v1/ont/v2/individuals")
        assert "class_rid=ont.t.if.facility.v1" in str(req.url)

    @pytest.mark.asyncio
    async def test_search_objects_posts_payload(self):
        tr = _CaptureTransport([(200, {"results": []})])
        t = _tool("ont_search_objects")
        t._client = _client(tr)
        await t(text="客户", class_rid="ont.t.obj.crm.v1", top_k=5)
        body = json.loads(tr.requests[0].read())
        assert body == {"text": "客户", "top_k": 5, "class_rid": "ont.t.obj.crm.v1"}

    @pytest.mark.asyncio
    async def test_validate_preflight_composes_schema_and_shacl(self):
        tr = _CaptureTransport(
            [
                (200, {"valid": False, "errors": ["必填属性缺失: id"]}),
                (200, {"conforms": False, "violations": [{"constraint": "minCount"}]}),
            ]
        )
        t = _tool("ont_validate_preflight")
        t._client = _client(tr)
        out = await t(class_rid="ont.t.obj.order.v1", fields={"name": "x"})
        assert out["schema"]["valid"] is False
        assert out["shacl"]["conforms"] is False

    @pytest.mark.asyncio
    async def test_validate_preflight_degrades_when_shacl_fails(self):
        tr = _CaptureTransport([(200, {"valid": True, "errors": []}), (500, {"e": 1})])
        t = _tool("ont_validate_preflight")
        t._client = _client(tr)
        out = await t(class_rid="ont.t.obj.order.v1", fields={})
        assert out["schema"]["valid"] is True
        assert out["shacl"]["conforms"] is None

    @pytest.mark.asyncio
    async def test_agent_metrics_calls_summary(self):
        tr = _CaptureTransport([(200, {"total": 5, "acceptance_rate": 1.0})])
        t = _tool("ont_agent_metrics")
        t._client = _client(tr)
        out = await t(days=7)
        assert out["total"] == 5
        assert "days=7" in str(tr.requests[0].url)


class TestProvenanceInjection:
    @pytest.mark.asyncio
    async def test_propose_instance_injects_ai_provenance(self):
        tr = _CaptureTransport([(200, {"proposal_id": "p1", "preflight": {"blocked": False}})])
        t = _tool("ont_propose_instance")
        t._client = _client(tr)
        await t(
            class_rid="ont.t.obj.order.v1",
            fields={"order-id": "O-1"},
            impact_summary="x",
            client_provenance={"model": "claude-opus-5"},
        )
        body = json.loads(tr.requests[0].read())
        assert body["provenance"] == {
            "source": "ai",
            "client": "mcp",
            "model": "claude-opus-5",
        }

    @pytest.mark.asyncio
    async def test_propose_instance_provenance_explicit_keys_win(self):
        tr = _CaptureTransport([(200, {"proposal_id": "p2"})])
        t = _tool("ont_propose_instance")
        t._client = _client(tr)
        await t(
            class_rid="ont.t.obj.order.v1",
            fields={},
            impact_summary="x",
            client_provenance={"source": "user-declared"},
        )
        body = json.loads(tr.requests[0].read())
        # 显式键优先，但平台强制 source=ai 在前、client 键随后可覆盖 source
        assert body["provenance"]["source"] == "user-declared"
        assert body["provenance"]["client"] == "mcp"

    @pytest.mark.asyncio
    async def test_propose_model_type_injects_provenance(self):
        tr = _CaptureTransport([(200, {"proposal_id": "p3"})])
        t = _tool("ont_propose_model_type")
        t._client = _client(tr)
        await t(name="发票", slug="invoice", impact_summary="建模")
        body = json.loads(tr.requests[0].read())
        assert body["provenance"]["source"] == "ai"


class TestHitlBoundaryHardening:
    def test_hitl_tools_not_agent_invokable(self):
        for name in ("ont_confirm_proposal", "ont_reject_proposal", "ont_execute_proposal"):
            t = _tool(name)
            assert t.agent_invokable is False, name

    @pytest.mark.asyncio
    async def test_streamable_strips_external_caller_and_blocks_hitl(self):
        """外部 MCP 客户端伪造 __caller__='user' 也必须被剥除 → PermissionError。"""
        from mate_tech_mcp.main import mcp_server
        from mate_tech_mcp.protocol.streamable import MateStreamableHttpServer

        surface = MateStreamableHttpServer(mcp_server)
        with pytest.raises(PermissionError):
            await surface.call_tool(
                "ont_execute_proposal",
                {"proposal_id": "p-x", "__caller__": "user"},
            )

    @pytest.mark.asyncio
    async def test_agent_cannot_execute_even_with_correct_args(self):
        from mate_tech_mcp.main import mcp_server

        with pytest.raises(PermissionError):
            await mcp_server.call_tool("ont_execute_proposal", {"proposal_id": "p-x"})
