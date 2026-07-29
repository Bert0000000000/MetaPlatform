"""kb_search tool tests (ST-5.3.2.2)."""
from __future__ import annotations

import pytest
import respx
from httpx import Response

from mate_tech_mcp.tools.kb_search import KbSearchTool, build_kb_search_tool


@pytest.mark.asyncio
@respx.mock
async def test_kb_search_returns_hits() -> None:
    """调通 tech-rag 返回 hits."""
    respx.post("http://localhost:8006/api/v1/rag/search").mock(
        return_value=Response(
            200,
            json={
                "hits": [
                    {"id": "doc1", "content": "hello", "score": 0.95},
                    {"id": "doc2", "content": "world", "score": 0.85},
                ],
                "total": 2,
            },
        )
    )
    tool = KbSearchTool()
    result = await tool(query="hello", top_k=2)
    assert result["query"] == "hello"
    assert result["top_k"] == 2
    assert len(result["hits"]) == 2
    assert result["total"] == 2
    await tool.aclose()


@pytest.mark.asyncio
@respx.mock
async def test_kb_search_with_kb_ids() -> None:
    """带 kb_ids 参数."""
    captured: dict = {}

    def capture(req) -> Response:
        import json
        captured["payload"] = json.loads(req.content)
        return Response(200, json={"hits": [], "total": 0})

    respx.post("http://localhost:8006/api/v1/rag/search").mock(
        side_effect=capture
    )
    tool = KbSearchTool()
    await tool(query="x", kb_ids=["kb1", "kb2"])
    assert captured["payload"]["kb_ids"] == ["kb1", "kb2"]
    await tool.aclose()


@pytest.mark.asyncio
@respx.mock
async def test_kb_search_http_error() -> None:
    """tech-rag 不可达 → 错误返回."""
    respx.post("http://localhost:8006/api/v1/rag/search").mock(
        return_value=Response(503, text="upstream down")
    )
    tool = KbSearchTool()
    result = await tool(query="x")
    assert "error" in result
    assert result["query"] == "x"
    await tool.aclose()


def test_kb_search_tool_metadata() -> None:
    """Tool 元数据：name/description/input_schema."""
    t = KbSearchTool
    assert t.name == "kb_search"
    assert "知识库" in t.description or "检索" in t.description
    assert t.input_schema["type"] == "object"
    assert "query" in t.input_schema["required"]


def test_build_factory() -> None:
    t = build_kb_search_tool()
    assert t.name == "kb_search"
    assert t.handler is t  # 自调用