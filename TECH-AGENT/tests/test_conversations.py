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


async def test_create_conversation_with_mode(client: AsyncClient, tenant_headers: dict):
    agent_id = await _create_active_agent(client, tenant_headers, code="mode-agent")

    resp = await client.post(
        f"{BASE}/conversations",
        json={"agentId": agent_id, "title": "模式测试", "mode": "analysis"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["mode"] == "analysis"
    assert data["favorite"] is False


async def test_toggle_favorite_api(client: AsyncClient, tenant_headers: dict):
    agent_id = await _create_active_agent(client, tenant_headers, code="fav-agent")

    resp = await client.post(
        f"{BASE}/conversations",
        json={"agentId": agent_id, "title": "收藏测试"},
        headers=tenant_headers,
    )
    conv_id = resp.json()["data"]["conversationId"]
    assert resp.json()["data"]["favorite"] is False

    resp = await client.post(
        f"{BASE}/conversations/{conv_id}/favorite",
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["favorite"] is True

    resp = await client.post(
        f"{BASE}/conversations/{conv_id}/favorite",
        headers=tenant_headers,
    )
    assert resp.json()["data"]["favorite"] is False


async def test_list_conversations_with_filters(client: AsyncClient, tenant_headers: dict):
    agent_id = await _create_active_agent(client, tenant_headers, code="filter-agent")

    await client.post(
        f"{BASE}/conversations",
        json={"agentId": agent_id, "title": "关键词测试", "mode": "chat"},
        headers=tenant_headers,
    )
    resp = await client.post(
        f"{BASE}/conversations",
        json={"agentId": agent_id, "title": "另一个", "mode": "analysis"},
        headers=tenant_headers,
    )
    conv_id = resp.json()["data"]["conversationId"]
    await client.post(
        f"{BASE}/conversations/{conv_id}/favorite",
        headers=tenant_headers,
    )

    resp = await client.get(
        f"{BASE}/conversations",
        params={"keyword": "关键词"},
        headers=tenant_headers,
    )
    assert resp.json()["data"]["total"] == 1

    resp = await client.get(
        f"{BASE}/conversations",
        params={"favorite": True},
        headers=tenant_headers,
    )
    assert resp.json()["data"]["total"] == 1

    resp = await client.get(
        f"{BASE}/conversations",
        params={"mode": "analysis"},
        headers=tenant_headers,
    )
    assert resp.json()["data"]["total"] == 1


async def test_create_conversation_with_default_agent(
    client: AsyncClient, tenant_headers: dict
):
    """APP-SUPERAI 不感知 agent 概念，传 'default' 时后端应自动创建默认 agent。"""
    resp = await client.post(
        f"{BASE}/conversations",
        json={"agentId": "default", "title": "默认 agent 测试"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["conversationId"].startswith("conv-")
    assert data["title"] == "默认 agent 测试"

    # 第二次调用应复用已创建的 default agent（不抛 DuplicateAgentCodeError）
    resp2 = await client.post(
        f"{BASE}/conversations",
        json={"agentId": "default", "title": "第二次会话"},
        headers=tenant_headers,
    )
    assert resp2.status_code == 200
    assert resp2.json()["data"]["title"] == "第二次会话"

    # default agent 应在 agents 列表中
    agents_resp = await client.get(
        f"{BASE}/agents", params={"page": 1, "pageSize": 50}, headers=tenant_headers
    )
    agents_data = agents_resp.json()["data"]
    codes = [a.get("code") for a in agents_data["items"]]
    assert "default" in codes


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
