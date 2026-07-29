"""Edge case tests for MCP API (ST-5.3.8.x)."""
from __future__ import annotations

import pytest

from mate_tech_mcp.auth import make_test_token
from mate_tech_mcp.main import app


@pytest.mark.asyncio
async def test_call_tool_no_token() -> None:
    """无 Bearer token → 401."""
    from fastapi.testclient import TestClient

    client = TestClient(app)
    resp = client.post("/api/v1/mcp/tools/kb_search", json={"arguments": {"query": "x"}})
    assert resp.status_code == 401
    assert "Bearer" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_call_tool_unknown_tool() -> None:
    """已知 token + 未知工具 → 404."""
    from fastapi.testclient import TestClient

    client = TestClient(app)
    token = make_test_token(sub="alice", tenant_id="acme")
    resp = client.post(
        "/api/v1/mcp/tools/nonexistent_tool",
        json={"arguments": {}},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404
    assert "nonexistent_tool" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_call_tool_expired_token() -> None:
    """过期 token → 401."""
    from fastapi.testclient import TestClient

    client = TestClient(app)
    token = make_test_token(sub="alice", tenant_id="acme", expires_in=-10)
    resp = client.post(
        "/api/v1/mcp/tools/kb_search",
        json={"arguments": {"query": "x"}},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_call_tool_success() -> None:
    """正常路径 → 200 + 工具结果."""
    import respx
    from fastapi.testclient import TestClient
    from httpx import Response

    respx.post("http://localhost:8006/api/v1/rag/search").mock(
        return_value=Response(
            200,
            json={"hits": [{"id": "doc1", "score": 0.9}], "total": 1},
        )
    )

    client = TestClient(app)
    token = make_test_token(sub="alice", tenant_id="acme")
    resp = client.post(
        "/api/v1/mcp/tools/kb_search",
        json={"arguments": {"query": "test", "top_k": 1}},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["tool"] == "kb_search"
    assert "result" in body


@pytest.mark.asyncio
async def test_prompt_unknown_404() -> None:
    """未知 prompt → 404."""
    from fastapi.testclient import TestClient

    client = TestClient(app)
    resp = client.post("/api/v1/mcp/prompts/missing", json={})
    assert resp.status_code == 404