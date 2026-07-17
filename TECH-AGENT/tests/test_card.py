"""Agent Card generation API tests (P2-AGT-21)."""

from __future__ import annotations

from httpx import AsyncClient

BASE = "/api/v1/agent"


async def _create_agent(client: AsyncClient, headers: dict, **overrides) -> str:
    body = {
        "name": "卡片测试助手",
        "code": "card-test-agent",
        "description": "用于测试Agent Card的助手",
        "modelId": "doubao-pro-32k",
        "systemPrompt": "你是一个测试助手。",
        "tools": ["tool-001", "tool-002"],
        "ragScopes": ["kb-001"],
        "status": "ACTIVE",
    }
    body.update(overrides)
    resp = await client.post(f"{BASE}/agents", json=body, headers=headers)
    assert resp.status_code == 200
    return resp.json()["data"]["agentId"]


async def test_generate_card_api(client: AsyncClient, tenant_headers: dict):
    agent_id = await _create_agent(client, tenant_headers)

    resp = await client.get(
        f"{BASE}/agents/{agent_id}/card", headers=tenant_headers
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["@context"] == "https://www.w3.org/ns/agent-card/v1"
    assert data["@type"] == "AgentCard"
    assert data["name"] == "卡片测试助手"
    assert data["version"] == "1.0.0"
    assert data["capabilities"]["streaming"] is True
    assert len(data["endpoints"]) == 2
    assert data["authentication"]["scheme"] == "bearer"


async def test_card_includes_skills(client: AsyncClient, tenant_headers: dict):
    agent_id = await _create_agent(client, tenant_headers)

    resp = await client.get(
        f"{BASE}/agents/{agent_id}/card", headers=tenant_headers
    )
    data = resp.json()["data"]
    skills = data["skills"]
    # 2 tools + 1 RAG skill
    assert len(skills) == 3
    skill_ids = [s["id"] for s in skills]
    assert "tool-001" in skill_ids
    assert "rag-retrieval" in skill_ids


async def test_card_includes_metadata(client: AsyncClient, tenant_headers: dict):
    agent_id = await _create_agent(client, tenant_headers)

    resp = await client.get(
        f"{BASE}/agents/{agent_id}/card", headers=tenant_headers
    )
    data = resp.json()["data"]
    assert data["metadata"]["agentCode"] == "card-test-agent"
    assert data["metadata"]["modelId"] == "doubao-pro-32k"
    assert data["metadata"]["status"] == "ACTIVE"


async def test_card_for_nonexistent_agent(client: AsyncClient, tenant_headers: dict):
    resp = await client.get(
        f"{BASE}/agents/agt-nonexistent/card", headers=tenant_headers
    )
    assert resp.status_code == 404
