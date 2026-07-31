"""Edge case tests for mate-tech-mcp (ST-5.3.6.2)."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from mate_tech_mcp.main import app
from mate_tech_mcp.tools.kb_search import KbSearchTool


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_prompts_endpoint_unauthorized(client: TestClient) -> None:
    """无 token 调 prompts → 401."""
    resp = client.post("/api/v1/mcp/prompts/summarize_doc", json={"document": "x"})
    assert resp.status_code == 401


def test_prompts_summarize_with_token(client: TestClient, auth_headers: dict[str, str]) -> None:
    """有 token + summarize_doc → 200."""
    resp = client.post(
        "/api/v1/mcp/prompts/summarize_doc",
        json={"document": "test document"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "test document" in body["rendered"]


def test_prompts_extract_entities(client: TestClient, auth_headers: dict[str, str]) -> None:
    resp = client.post(
        "/api/v1/mcp/prompts/extract_entities",
        json={"text": "concept X"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "JSON" in body["rendered"]


def test_prompts_plan_task(client: TestClient, auth_headers: dict[str, str]) -> None:
    resp = client.post(
        "/api/v1/mcp/prompts/plan_task",
        json={"task": "search X", "tools": "kb_search"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "search X" in body["rendered"]
    assert "kb_search" in body["rendered"]


def test_resources_endpoint(client: TestClient, auth_headers: dict[str, str]) -> None:
    """GET /api/v1/mcp/resources."""
    resp = client.get("/api/v1/mcp/resources", headers=auth_headers)
    assert resp.status_code == 200
    assert "resources" in resp.json()


def test_tools_endpoint_empty(client: TestClient, auth_headers: dict[str, str]) -> None:
    """GET /api/v1/mcp/tools (无 tools 时仍 200)."""
    # 重置全局以避免污染
    from mate_tech_mcp.main import mcp_server
    mcp_server._tools.clear()
    resp = client.get("/api/v1/mcp/tools", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["tools"] == []


def test_kb_search_tool_metadata() -> None:
    """ST-5.3.2: kb_search tool 元数据."""
    assert KbSearchTool.name == "kb_search"
    assert "知识库" in KbSearchTool.description or "检索" in KbSearchTool.description
    assert "query" in KbSearchTool.input_schema["required"]
    assert "top_k" in KbSearchTool.input_schema["properties"]