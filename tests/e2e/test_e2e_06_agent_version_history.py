"""链路6：员工版本管理 E2E 测试（V11-11）。

覆盖业务流程：
  创建 agent → 更新 → 查看版本历史 → 查看操作日志

依赖服务：TECH-AGENT（Python，真实 ASGI）
对应 V11-05 已实现端点。
"""

from __future__ import annotations

AGENT_BASE = "/api/v1/agent/agents"


def _create_body(code: str = "e2e-agent-06") -> dict:
    return {
        "name": "E2E 测试数字员工",
        "code": code,
        "description": "V11-11 E2E 测试用员工",
        "modelId": "doubao-pro-32k",
        "systemPrompt": "你是一个专业的客服助手。",
        "tools": ["tool-e2e-001"],
        "ragScopes": ["scope-e2e-001"],
        "temperature": 0.3,
        "maxTokens": 2048,
        "status": "DRAFT",
    }


async def test_e2e_06_agent_version_history_flow(
    agent_client,
    tenant_headers: dict[str, str],
    trace_id: str,
):
    """端到端：创建 agent→更新→查看版本历史→查看操作日志。

    验证点：
    - 创建后返回 agentId，状态为 DRAFT
    - 多次更新后版本历史非空，每次更新对应一条版本记录
    - 操作日志包含 CREATE / UPDATE 等动作
    - 全链路 traceId 回传一致
    """

    # 1. 创建 agent
    create_resp = await agent_client.post(
        f"{AGENT_BASE}",
        json=_create_body("e2e-agent-06-vh"),
        headers=tenant_headers,
    )
    assert create_resp.status_code == 200, create_resp.text
    agent = create_resp.json()["data"]
    assert agent["code"] == "e2e-agent-06-vh"
    assert agent["status"] == "DRAFT"
    assert agent["modelId"] == "doubao-pro-32k"
    assert create_resp.json()["traceId"] == trace_id
    agent_id = agent["agentId"]

    # 2. 多次更新 agent（生成多条版本记录）
    updates = [
        {"description": "第一次更新：补充描述", "temperature": 0.5},
        {"systemPrompt": "你是一个专业的售后助手。", "maxTokens": 4096},
        {"status": "ACTIVE", "tools": ["tool-e2e-001", "tool-e2e-002"]},
    ]
    for upd in updates:
        upd_resp = await agent_client.put(
            f"{AGENT_BASE}/{agent_id}",
            json=upd,
            headers=tenant_headers,
        )
        assert upd_resp.status_code == 200, upd_resp.text
        assert upd_resp.json()["traceId"] == trace_id

    # 验证最后一次更新的字段生效
    final_resp = await agent_client.get(
        f"{AGENT_BASE}/{agent_id}", headers=tenant_headers
    )
    assert final_resp.status_code == 200
    final_agent = final_resp.json()["data"]
    assert final_agent["status"] == "ACTIVE"
    assert final_agent["temperature"] == 0.5
    assert final_agent["maxTokens"] == 4096
    assert "tool-e2e-002" in final_agent["tools"]

    # 3. 查看版本历史
    versions_resp = await agent_client.get(
        f"{AGENT_BASE}/{agent_id}/versions",
        headers=tenant_headers,
    )
    assert versions_resp.status_code == 200, versions_resp.text
    versions_page = versions_resp.json()["data"]
    assert versions_resp.json()["traceId"] == trace_id
    # 应至少有 1 条版本记录（每次 update 会生成一条）
    assert versions_page["total"] >= 1
    assert len(versions_page["items"]) >= 1
    first_version = versions_page["items"][0]
    assert "version" in first_version
    assert "timestamp" in first_version
    # 版本记录的 snapshot 中应包含正确的 agentId
    for v in versions_page["items"]:
        assert v["snapshot"]["agentId"] == agent_id

    # 4. 查看操作日志
    logs_resp = await agent_client.get(
        f"{AGENT_BASE}/{agent_id}/logs",
        headers=tenant_headers,
    )
    assert logs_resp.status_code == 200, logs_resp.text
    logs_page = logs_resp.json()["data"]
    assert logs_resp.json()["traceId"] == trace_id
    # 应至少有 CREATE + 3 次 UPDATE 共 4 条日志
    assert logs_page["total"] >= 4
    actions = {log["action"] for log in logs_page["items"]}
    assert "CREATE" in actions or "create" in actions
    assert "UPDATE" in actions or "update" in actions
    # 每条日志应包含必要字段
    for log in logs_page["items"]:
        assert "action" in log
        assert "timestamp" in log


async def test_e2e_06_agent_crud_lifecycle(
    agent_client,
    tenant_headers: dict[str, str],
):
    """Agent CRUD 完整生命周期：创建→查询→列表→删除。"""
    # 创建
    create_resp = await agent_client.post(
        f"{AGENT_BASE}",
        json=_create_body("e2e-agent-06-crud"),
        headers=tenant_headers,
    )
    assert create_resp.status_code == 200
    agent_id = create_resp.json()["data"]["agentId"]

    # 查询详情
    get_resp = await agent_client.get(
        f"{AGENT_BASE}/{agent_id}", headers=tenant_headers
    )
    assert get_resp.status_code == 200
    assert get_resp.json()["data"]["agentId"] == agent_id

    # 列表查询应包含新建的 agent
    list_resp = await agent_client.get(
        f"{AGENT_BASE}",
        params={"status": "DRAFT"},
        headers=tenant_headers,
    )
    assert list_resp.status_code == 200
    codes = [a["code"] for a in list_resp.json()["data"]["items"]]
    assert "e2e-agent-06-crud" in codes

    # 删除
    del_resp = await agent_client.delete(
        f"{AGENT_BASE}/{agent_id}", headers=tenant_headers
    )
    assert del_resp.status_code == 200
    assert del_resp.json()["data"]["deleted"] is True

    # 删除后列表不应再包含
    list_resp2 = await agent_client.get(
        f"{AGENT_BASE}",
        params={"status": "DRAFT"},
        headers=tenant_headers,
    )
    codes2 = [a["code"] for a in list_resp2.json()["data"]["items"]]
    assert "e2e-agent-06-crud" not in codes2


async def test_e2e_06_agent_status_transition(
    agent_client,
    tenant_headers: dict[str, str],
):
    """Agent 状态转换：DRAFT → ACTIVE → DISABLED。"""
    create_resp = await agent_client.post(
        f"{AGENT_BASE}",
        json=_create_body("e2e-agent-06-status"),
        headers=tenant_headers,
    )
    agent_id = create_resp.json()["data"]["agentId"]
    assert create_resp.json()["data"]["status"] == "DRAFT"

    # DRAFT → ACTIVE
    resp = await agent_client.put(
        f"{AGENT_BASE}/{agent_id}",
        json={"status": "ACTIVE"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "ACTIVE"

    # ACTIVE → DISABLED
    resp = await agent_client.put(
        f"{AGENT_BASE}/{agent_id}",
        json={"status": "DISABLED"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "DISABLED"
