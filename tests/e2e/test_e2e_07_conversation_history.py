"""链路7：会话历史 E2E 测试（V11-11）。

覆盖业务流程：
  创建会话 → 发送消息 → 查看历史 → 结束会话

依赖服务：TECH-AGENT（Python，真实 ASGI）
对应 V11-07 已实现端点（APP-SUPERAI 会话历史 API）。
"""

from __future__ import annotations

AGENT_BASE = "/api/v1/agent/agents"
CONV_BASE = "/api/v1/agent/conversations"


async def _create_active_agent(client, headers: dict, code: str) -> str:
    body = {
        "name": f"E2E 会话助手 {code}",
        "code": code,
        "modelId": "doubao-pro-32k",
        "systemPrompt": "你是一个专业的会话助手。",
        "status": "ACTIVE",
    }
    resp = await client.post(f"{AGENT_BASE}", json=body, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]["agentId"]


async def test_e2e_07_conversation_history_flow(
    agent_client,
    tenant_headers: dict[str, str],
    trace_id: str,
):
    """端到端：创建会话→发送消息→查看历史→结束会话。

    验证点：
    - 创建会话返回 conversationId，状态 ACTIVE
    - 发送消息后返回 assistant 角色响应
    - 历史记录包含 user + assistant 消息
    - 结束会话后状态变为 ENDED
    - 全链路 traceId 回传一致
    """

    # 1. 创建一个 ACTIVE 状态的 agent（会话必须绑定 agent）
    agent_id = await _create_active_agent(
        agent_client, tenant_headers, "e2e-agent-07-conv"
    )

    # 2. 创建会话
    create_resp = await agent_client.post(
        f"{CONV_BASE}",
        json={"agentId": agent_id, "title": "E2E 会话历史测试", "mode": "chat"},
        headers=tenant_headers,
    )
    assert create_resp.status_code == 200, create_resp.text
    conv = create_resp.json()["data"]
    assert conv["conversationId"].startswith("conv-")
    assert conv["agentId"] == agent_id
    assert conv["title"] == "E2E 会话历史测试"
    assert conv["status"] == "ACTIVE"
    assert conv["mode"] == "chat"
    assert create_resp.json()["traceId"] == trace_id
    conv_id = conv["conversationId"]

    # 3. 发送第一条消息
    msg1_resp = await agent_client.post(
        f"{CONV_BASE}/{conv_id}/messages",
        json={"content": "你好，请帮我查询订单状态。"},
        headers=tenant_headers,
    )
    assert msg1_resp.status_code == 200, msg1_resp.text
    msg1 = msg1_resp.json()["data"]
    assert msg1["role"] == "assistant"
    assert msg1["content"]
    assert msg1["conversationId"] == conv_id
    assert msg1_resp.json()["traceId"] == trace_id

    # 4. 发送第二条消息
    msg2_resp = await agent_client.post(
        f"{CONV_BASE}/{conv_id}/messages",
        json={"content": "我的订单号是 #20260720-0001"},
        headers=tenant_headers,
    )
    assert msg2_resp.status_code == 200
    assert msg2_resp.json()["data"]["role"] == "assistant"

    # 5. 查看历史消息
    history_resp = await agent_client.get(
        f"{CONV_BASE}/{conv_id}/messages",
        headers=tenant_headers,
    )
    assert history_resp.status_code == 200, history_resp.text
    history = history_resp.json()["data"]
    assert history_resp.json()["traceId"] == trace_id
    # 应包含 user + assistant 共 4 条消息（2 次发送各产生 user + assistant）
    assert history["total"] >= 4
    roles = [m["role"] for m in history["items"]]
    assert "user" in roles
    assert "assistant" in roles
    # 每条消息应包含必要字段
    for m in history["items"]:
        assert "messageId" in m
        assert "conversationId" in m
        assert "role" in m
        assert "content" in m
        assert m["conversationId"] == conv_id

    # 6. 查看会话详情（应反映 messageCount）
    detail_resp = await agent_client.get(
        f"{CONV_BASE}/{conv_id}", headers=tenant_headers
    )
    assert detail_resp.status_code == 200
    detail = detail_resp.json()["data"]
    assert detail["conversationId"] == conv_id
    assert detail["messageCount"] >= 4

    # 7. 结束会话
    end_resp = await agent_client.post(
        f"{CONV_BASE}/{conv_id}/end", headers=tenant_headers
    )
    assert end_resp.status_code == 200, end_resp.text
    ended = end_resp.json()["data"]
    assert ended["conversationId"] == conv_id
    assert ended["status"] == "ENDED"
    assert end_resp.json()["traceId"] == trace_id

    # 8. 验证会话列表中能查询到已结束的会话
    list_resp = await agent_client.get(
        f"{CONV_BASE}",
        params={"agentId": agent_id},
        headers=tenant_headers,
    )
    assert list_resp.status_code == 200
    conv_ids = [c["conversationId"] for c in list_resp.json()["data"]["items"]]
    assert conv_id in conv_ids


async def test_e2e_07_conversation_default_agent(
    agent_client,
    tenant_headers: dict[str, str],
):
    """APP-SUPERAI 不感知 agent 概念，传 'default' 时后端应自动创建默认 agent。"""
    resp = await agent_client.post(
        f"{CONV_BASE}",
        json={"agentId": "default", "title": "E2E 默认 agent 会话"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["conversationId"].startswith("conv-")

    # 第二次调用应复用已创建的 default agent
    resp2 = await agent_client.post(
        f"{CONV_BASE}",
        json={"agentId": "default", "title": "E2E 第二次会话"},
        headers=tenant_headers,
    )
    assert resp2.status_code == 200
    assert resp2.json()["data"]["title"] == "E2E 第二次会话"


async def test_e2e_07_conversation_filters(
    agent_client,
    tenant_headers: dict[str, str],
):
    """会话列表过滤器：keyword / favorite / mode。"""
    agent_id = await _create_active_agent(
        agent_client, tenant_headers, "e2e-agent-07-filter"
    )

    # 创建一个普通会话
    await agent_client.post(
        f"{CONV_BASE}",
        json={"agentId": agent_id, "title": "E2E 关键词测试", "mode": "chat"},
        headers=tenant_headers,
    )
    # 创建一个收藏会话
    fav_resp = await agent_client.post(
        f"{CONV_BASE}",
        json={"agentId": agent_id, "title": "E2E 收藏", "mode": "analysis"},
        headers=tenant_headers,
    )
    fav_id = fav_resp.json()["data"]["conversationId"]
    await agent_client.post(
        f"{CONV_BASE}/{fav_id}/favorite", headers=tenant_headers
    )

    # keyword 过滤
    resp = await agent_client.get(
        f"{CONV_BASE}",
        params={"keyword": "关键词"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["total"] == 1

    # favorite 过滤
    resp = await agent_client.get(
        f"{CONV_BASE}",
        params={"favorite": True},
        headers=tenant_headers,
    )
    assert resp.json()["data"]["total"] >= 1

    # mode 过滤
    resp = await agent_client.get(
        f"{CONV_BASE}",
        params={"mode": "analysis"},
        headers=tenant_headers,
    )
    assert resp.json()["data"]["total"] >= 1
