"""Conversation management API tests (P2-AGT-16/17)."""

from __future__ import annotations

from httpx import AsyncClient

BASE = "/api/v1/agent"


async def _create_active_agent(
    client: AsyncClient, headers: dict, code: str = "conv-assistant"
) -> str:
    body = {
        "name": "会话助手",
        "code": code,
        "modelId": "doubao-pro-32k",
        "systemPrompt": "你是一个会话助手。",
        "status": "ACTIVE",
    }
    resp = await client.post(f"{BASE}/agents", json=body, headers=headers)
    assert resp.status_code == 200
    return resp.json()["data"]["agentId"]


async def test_create_conversation_api(client: AsyncClient, tenant_headers: dict):
    agent_id = await _create_active_agent(client, tenant_headers)

    resp = await client.post(
        f"{BASE}/conversations",
        json={"agentId": agent_id, "title": "测试会话"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["conversationId"].startswith("conv-")
    assert data["agentId"] == agent_id
    assert data["title"] == "测试会话"
    assert data["status"] == "ACTIVE"


async def test_list_conversations_api(client: AsyncClient, tenant_headers: dict):
    agent_id = await _create_active_agent(client, tenant_headers)
    for i in range(3):
        await client.post(
            f"{BASE}/conversations",
            json={"agentId": agent_id, "title": f"会话{i}"},
            headers=tenant_headers,
        )

    resp = await client.get(
        f"{BASE}/conversations",
        params={"agentId": agent_id},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 3


async def test_get_conversation_api(client: AsyncClient, tenant_headers: dict):
    agent_id = await _create_active_agent(client, tenant_headers)
    resp = await client.post(
        f"{BASE}/conversations",
        json={"agentId": agent_id, "title": "详情测试"},
        headers=tenant_headers,
    )
    conv_id = resp.json()["data"]["conversationId"]

    resp = await client.get(
        f"{BASE}/conversations/{conv_id}", headers=tenant_headers
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["conversationId"] == conv_id


async def test_send_message_api(client: AsyncClient, tenant_headers: dict):
    agent_id = await _create_active_agent(client, tenant_headers, code="msg-agent")
    resp = await client.post(
        f"{BASE}/conversations",
        json={"agentId": agent_id, "title": "消息测试"},
        headers=tenant_headers,
    )
    conv_id = resp.json()["data"]["conversationId"]

    resp = await client.post(
        f"{BASE}/conversations/{conv_id}/messages",
        json={"content": "你好"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["role"] == "assistant"
    assert data["content"]


async def test_get_history_api(client: AsyncClient, tenant_headers: dict):
    agent_id = await _create_active_agent(client, tenant_headers, code="hist-agent")
    resp = await client.post(
        f"{BASE}/conversations",
        json={"agentId": agent_id, "title": "历史测试"},
        headers=tenant_headers,
    )
    conv_id = resp.json()["data"]["conversationId"]

    await client.post(
        f"{BASE}/conversations/{conv_id}/messages",
        json={"content": "第一条消息"},
        headers=tenant_headers,
    )

    resp = await client.get(
        f"{BASE}/conversations/{conv_id}/messages", headers=tenant_headers
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] >= 2  # user + assistant
    roles = [m["role"] for m in data["items"]]
    assert "user" in roles
    assert "assistant" in roles


async def test_end_conversation_api(client: AsyncClient, tenant_headers: dict):
    agent_id = await _create_active_agent(client, tenant_headers, code="end-agent")
    resp = await client.post(
        f"{BASE}/conversations",
        json={"agentId": agent_id, "title": "结束测试"},
        headers=tenant_headers,
    )
    conv_id = resp.json()["data"]["conversationId"]

    resp = await client.post(
        f"{BASE}/conversations/{conv_id}/end", headers=tenant_headers
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "ENDED"


async def test_send_message_to_ended_conversation(
    client: AsyncClient, tenant_headers: dict
):
    agent_id = await _create_active_agent(
        client, tenant_headers, code="ended-conv-agent"
    )
    resp = await client.post(
        f"{BASE}/conversations",
        json={"agentId": agent_id, "title": "已结束会话"},
        headers=tenant_headers,
    )
    conv_id = resp.json()["data"]["conversationId"]

    await client.post(
        f"{BASE}/conversations/{conv_id}/end", headers=tenant_headers
    )

    resp = await client.post(
        f"{BASE}/conversations/{conv_id}/messages",
        json={"content": "不应该发送"},
        headers=tenant_headers,
    )
    assert resp.status_code == 400
