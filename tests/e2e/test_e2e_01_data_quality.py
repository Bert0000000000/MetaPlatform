"""链路1：数据质量监控 E2E 测试（V11-11）。

覆盖业务流程：
  创建规则 → 触发检测 → 查看 issue → 更新状态 → 查看 overview

依赖服务：TECH-DATA（Python，真实 ASGI）
对应 V11-01 已实现端点。
"""

from __future__ import annotations

import pytest

DATA_BASE = "/api/v1/data/quality"


async def test_e2e_01_data_quality_full_flow(
    data_client,
    tenant_headers: dict[str, str],
    trace_id: str,
):
    """端到端：创建规则→触发检测→查看 issue→更新状态→查看 overview。

    验证点：
    - 全链路 HTTP 200
    - 每个响应都回传相同的 traceId
    - overview 在 run 之后反映 totalRules / lastRunAt
    - issue 状态更新后 resolvedAt 被设置
    """

    # 1. 创建一条 NOT_NULL 规则（映射到 completeness 维度）
    create_body = {
        "name": "e2e_orders_id_not_null",
        "table": "e2e_orders",
        "column": "id",
        "ruleType": "not_null",
        "params": {"expression": "id IS NOT NULL"},
        "severity": "HIGH",
        "enabled": True,
    }
    resp = await data_client.post(
        f"{DATA_BASE}/rules", json=create_body, headers=tenant_headers
    )
    assert resp.status_code == 200, resp.text
    rule_data = resp.json()["data"]
    assert rule_data["ruleType"] == "not_null"
    assert resp.json()["traceId"] == trace_id

    # 2. 触发检测任务（多次触发以提高随机失败概率，便于后续 issue 断言）
    job_ids: list[str] = []
    for _ in range(5):
        run_resp = await data_client.post(
            f"{DATA_BASE}/run", json={}, headers=tenant_headers
        )
        assert run_resp.status_code == 200
        run_data = run_resp.json()["data"]
        assert run_data["status"] == "completed"
        assert run_data["totalRules"] >= 1
        assert "jobId" in run_data
        assert "startedAt" in run_data
        job_ids.append(run_data["jobId"])
        assert run_resp.json()["traceId"] == trace_id

    # 3. 查看 issue 列表
    issues_resp = await data_client.get(
        f"{DATA_BASE}/issues", headers=tenant_headers
    )
    assert issues_resp.status_code == 200
    assert issues_resp.json()["traceId"] == trace_id
    issues = issues_resp.json()["data"]["items"]
    assert isinstance(issues, list)

    # 4. 如果生成了 issue，验证其字段并更新状态
    if issues:
        first_issue = issues[0]
        assert "issueId" in first_issue
        assert "ruleId" in first_issue
        assert "dimension" in first_issue
        assert "severity" in first_issue
        assert "status" in first_issue
        # NOT_NULL 规则映射到 completeness 维度
        assert first_issue["dimension"] == "completeness"
        # HIGH 严重度映射到 critical
        assert first_issue["severity"] == "critical"
        # 初始状态为 open
        assert first_issue["status"] == "open"

        issue_id = first_issue["issueId"]

        # 4a. 按 dimension 过滤验证
        dim_resp = await data_client.get(
            f"{DATA_BASE}/issues?dimension=completeness",
            headers=tenant_headers,
        )
        assert dim_resp.status_code == 200
        for it in dim_resp.json()["data"]["items"]:
            assert it["dimension"] == "completeness"

        # 4b. 更新状态为 resolved
        update_resp = await data_client.post(
            f"{DATA_BASE}/issues/{issue_id}/status",
            json={"status": "resolved"},
            headers=tenant_headers,
        )
        assert update_resp.status_code == 200, update_resp.text
        updated = update_resp.json()["data"]
        assert updated["status"] == "resolved"
        assert updated["resolvedAt"] is not None
        assert update_resp.json()["traceId"] == trace_id

        # 4c. 再次查询 issues，确认状态已变更（按 status 过滤）
        list_resp = await data_client.get(
            f"{DATA_BASE}/issues?status=resolved",
            headers=tenant_headers,
        )
        assert list_resp.status_code == 200
        items = list_resp.json()["data"]["items"]
        assert any(i["issueId"] == issue_id for i in items)

    # 5. 查看 overview 应反映规则与最近一次 run
    overview_resp = await data_client.get(
        f"{DATA_BASE}/overview", headers=tenant_headers
    )
    assert overview_resp.status_code == 200
    overview = overview_resp.json()["data"]
    assert overview["totalRules"] >= 1
    assert overview["enabledRules"] >= 1
    assert overview["lastRunAt"] is not None
    # 6 个维度评分都应存在
    assert len(overview["scores"]) == 6
    dims = {s["dimension"] for s in overview["scores"]}
    assert dims == {
        "completeness", "accuracy", "consistency",
        "timeliness", "uniqueness", "validity",
    }
    assert overview_resp.json()["traceId"] == trace_id


async def test_e2e_01_data_quality_overview_empty_state(
    data_client,
    tenant_headers: dict[str, str],
):
    """无规则时 overview 应返回合理默认值。"""
    resp = await data_client.get(f"{DATA_BASE}/overview", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["totalRules"] == 0
    assert data["enabledRules"] == 0
    assert data["totalIssues"] == 0
    assert data["openIssues"] == 0
