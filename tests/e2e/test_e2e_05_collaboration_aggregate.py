"""链路5：多员工协作聚合 E2E 测试（V11-11）。

覆盖业务流程：
  保存多个员工对话 → 批量评分 → 生成聚合报告

依赖服务：TECH-AGENT（Python，真实 ASGI）
对应 V11-06 已实现端点（aggregate-report）。
"""

from __future__ import annotations

EVAL_BASE = "/api/v1/agent/evaluations"


def _conv_body(conv_id: str, employee_id: str) -> dict:
    return {
        "conversationId": conv_id,
        "employeeId": employee_id,
        "taskId": "task-e2e-05",
        "messages": [
            {
                "id": "msg-1",
                "role": "user",
                "content": "请帮我处理这个工单。",
                "timestamp": "2026-07-20T10:00:00Z",
            },
            {
                "id": "msg-2",
                "role": "assistant",
                "content": "好的，我已为您创建工单并分派给对应团队。",
                "timestamp": "2026-07-20T10:00:30Z",
            },
        ],
    }


async def _seed_scored_conv(client, headers: dict, conv_id: str, emp_id: str) -> None:
    """保存对话并自动评分。"""
    save = await client.post(
        f"{EVAL_BASE}/conversations",
        json=_conv_body(conv_id, emp_id),
        headers=headers,
    )
    assert save.status_code == 200, save.text
    score = await client.post(
        f"{EVAL_BASE}/conversations/{conv_id}/auto-score",
        json={},
        headers=headers,
    )
    assert score.status_code == 200, score.text


async def test_e2e_05_collaboration_aggregate_flow(
    agent_client,
    tenant_headers: dict[str, str],
    trace_id: str,
):
    """端到端：保存多个员工对话→批量评分→生成聚合报告。

    验证点：
    - 4 条 scored 对话聚合后 totalConversations == 4
    - totalEmployees == 2
    - avgQualityScore 在 [0, 100]
    - successRate 在 [0, 1]
    - 6 个维度评分都存在
    - 报告 markdown 包含核心章节
    - traceId 全链路一致
    """

    # 1. 为 2 个员工各保存 2 条对话并评分（共 4 条 scored）
    employees = ["emp-e2e-05-a", "emp-e2e-05-b"]
    for emp in employees:
        for j in range(2):
            await _seed_scored_conv(
                agent_client,
                tenant_headers,
                f"conv-e2e-05-{emp}-{j}",
                emp,
            )

    # 2. 批量评分（验证 batch-auto-score 端点）
    batch_resp = await agent_client.post(
        f"{EVAL_BASE}/conversations/batch-auto-score",
        json={"employeeId": employees[0]},
        headers=tenant_headers,
    )
    assert batch_resp.status_code == 200, batch_resp.text
    batch_data = batch_resp.json()["data"]
    assert batch_data["total"] == 2
    assert batch_data["scored"] == 2
    assert len(batch_data["results"]) == 2
    assert batch_resp.json()["traceId"] == trace_id

    # 3. 生成聚合报告
    agg_resp = await agent_client.post(
        f"{EVAL_BASE}/aggregate-report",
        json={
            "collaborationId": "col-e2e-05-001",
            "employeeIds": employees,
            "period": "2026-W29",
        },
        headers=tenant_headers,
    )
    assert agg_resp.status_code == 200, agg_resp.text
    agg = agg_resp.json()["data"]
    assert agg_resp.json()["traceId"] == trace_id

    # 核心字段断言
    assert agg["collaborationId"] == "col-e2e-05-001"
    assert agg["employeeIds"] == employees
    assert agg["totalEmployees"] == 2
    assert agg["totalConversations"] == 4
    assert 0 <= agg["avgQualityScore"] <= 100
    assert 0 <= agg["successRate"] <= 1
    # 6 个维度评分都应存在（因为有 scored 对话）
    assert len(agg["dimensions"]) == 6
    assert isinstance(agg["highlights"], list)
    assert isinstance(agg["issues"], list)
    # 报告 markdown 包含核心章节
    assert "# 多员工协作聚合报告" in agg["report"]
    assert "## 维度评分" in agg["report"]
    assert "## 参与员工" in agg["report"]
    assert employees[0] in agg["report"]
    assert employees[1] in agg["report"]
    assert "generatedAt" in agg


async def test_e2e_05_collaboration_dedup_employees(
    agent_client,
    tenant_headers: dict[str, str],
):
    """重复 employeeId 不应双倍计数。"""
    await _seed_scored_conv(
        agent_client, tenant_headers, "conv-e2e-05-dedup", "emp-e2e-05-dedup"
    )
    resp = await agent_client.post(
        f"{EVAL_BASE}/aggregate-report",
        json={"employeeIds": ["emp-e2e-05-dedup", "emp-e2e-05-dedup"]},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["totalEmployees"] == 1
    assert data["totalConversations"] == 1


async def test_e2e_05_collaboration_no_scores(
    agent_client,
    tenant_headers: dict[str, str],
):
    """无 scored 对话的员工聚合不应报错。"""
    # 仅保存对话，不评分
    await agent_client.post(
        f"{EVAL_BASE}/conversations",
        json=_conv_body("conv-e2e-05-unscored", "emp-e2e-05-unscored"),
        headers=tenant_headers,
    )
    resp = await agent_client.post(
        f"{EVAL_BASE}/aggregate-report",
        json={"employeeIds": ["emp-e2e-05-unscored"]},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["totalConversations"] == 0
    assert data["avgQualityScore"] == 0.0
    assert data["successRate"] == 0.0
    assert data["dimensions"] == []
    # 报告仍应渲染默认 highlights/issues
    assert "## 亮点" in data["report"]
    assert "## 待改进" in data["report"]
