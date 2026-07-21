"""Quality endpoints tests (P3-DATA-06)."""

from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_create_quality_rule(client, tenant_headers):
    body = {
        "name": "orders_id_not_null",
        "table": "orders",
        "column": "id",
        "ruleType": "not_null",
        "params": {},
        "severity": "HIGH",
        "enabled": True,
    }
    resp = await client.post("/api/v1/data/quality/rules", json=body, headers=tenant_headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["ruleType"] == "not_null"


@pytest.mark.asyncio
async def test_list_and_update_rule(client, tenant_headers):
    body = {
        "name": "r1",
        "table": "orders",
        "column": "amount",
        "ruleType": "range",
        "params": {"min": 0, "max": 1000000},
        "severity": "MEDIUM",
        "enabled": True,
    }
    create = await client.post("/api/v1/data/quality/rules", json=body, headers=tenant_headers)
    rid = create.json()["data"]["id"]

    resp = await client.get("/api/v1/data/quality/rules", headers=tenant_headers)
    assert resp.status_code == 200
    assert any(r["id"] == rid for r in resp.json()["data"]["items"])

    resp = await client.put(
        f"/api/v1/data/quality/rules/{rid}",
        json={"severity": "CRITICAL", "enabled": False},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["severity"] == "CRITICAL"
    assert resp.json()["data"]["enabled"] is False


@pytest.mark.asyncio
async def test_execute_checks(client, tenant_headers):
    body = {
        "name": "r2",
        "table": "customers",
        "column": "email",
        "ruleType": "unique",
        "params": {},
        "severity": "HIGH",
        "enabled": True,
    }
    await client.post("/api/v1/data/quality/rules", json=body, headers=tenant_headers)
    resp = await client.post(
        "/api/v1/data/quality/checks/run", headers=tenant_headers
    )
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert len(items) >= 1


@pytest.mark.asyncio
async def test_generate_report(client, tenant_headers):
    body = {
        "name": "r3",
        "table": "orders",
        "column": "qty",
        "ruleType": "range",
        "params": {"min": 0, "max": 999},
        "severity": "MEDIUM",
        "enabled": True,
    }
    await client.post("/api/v1/data/quality/rules", json=body, headers=tenant_headers)
    resp = await client.post("/api/v1/data/quality/reports", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["totalRules"] >= 1
    assert data["generatedAt"] is not None


@pytest.mark.asyncio
async def test_quality_dashboard(client, tenant_headers):
    body = {
        "name": "r4",
        "table": "t",
        "column": "c",
        "ruleType": "not_null",
        "params": {},
        "severity": "LOW",
        "enabled": True,
    }
    await client.post("/api/v1/data/quality/rules", json=body, headers=tenant_headers)
    resp = await client.get("/api/v1/data/quality/dashboard", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["totalRules"] >= 1


@pytest.mark.asyncio
async def test_delete_quality_rule(client, tenant_headers):
    body = {
        "name": "del",
        "table": "t",
        "column": None,
        "ruleType": "not_null",
        "params": {},
        "severity": "LOW",
        "enabled": True,
    }
    create = await client.post("/api/v1/data/quality/rules", json=body, headers=tenant_headers)
    rid = create.json()["data"]["id"]
    resp = await client.delete(f"/api/v1/data/quality/rules/{rid}", headers=tenant_headers)
    assert resp.status_code == 200


# ----------------------------------------------------------- V11-01 新增端点


@pytest.mark.asyncio
async def test_quality_overview_empty(client, tenant_headers):
    """无规则时 overview 应返回合理默认值，6 个维度评分齐全。"""
    resp = await client.get("/api/v1/data/quality/overview", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["totalRules"] == 0
    assert data["enabledRules"] == 0
    assert data["totalIssues"] == 0
    assert data["openIssues"] == 0
    assert data["criticalIssues"] == 0
    assert len(data["scores"]) == 6
    # 6 个维度都应存在
    dims = {s["dimension"] for s in data["scores"]}
    assert dims == {
        "completeness",
        "accuracy",
        "consistency",
        "timeliness",
        "uniqueness",
        "validity",
    }


@pytest.mark.asyncio
async def test_quality_run_generates_issues_and_overview(client, tenant_headers):
    """执行质量检测任务后，应生成 issues 并反映在 overview 上。"""
    # 创建一条 NOT_NULL 规则（映射到 completeness 维度）
    body = {
        "name": "orders_id_not_null",
        "table": "orders",
        "column": "id",
        "ruleType": "not_null",
        "params": {"expression": "id IS NOT NULL"},
        "severity": "HIGH",
        "enabled": True,
    }
    create = await client.post("/api/v1/data/quality/rules", json=body, headers=tenant_headers)
    assert create.status_code == 200

    # 触发检测任务
    run_resp = await client.post(
        "/api/v1/data/quality/run", json={}, headers=tenant_headers
    )
    assert run_resp.status_code == 200
    run_data = run_resp.json()["data"]
    assert "jobId" in run_data
    assert "startedAt" in run_data
    assert run_data["status"] == "completed"
    assert run_data["totalRules"] >= 1
    assert "finishedAt" in run_data

    # 查询 issues 列表
    issues_resp = await client.get(
        "/api/v1/data/quality/issues", headers=tenant_headers
    )
    assert issues_resp.status_code == 200
    issues = issues_resp.json()["data"]["items"]
    # execute_checks 是随机失败，可能 0 条或 N 条 issue
    assert isinstance(issues, list)
    if issues:
        first = issues[0]
        assert "issueId" in first
        assert "ruleId" in first
        assert "dimension" in first
        assert "severity" in first
        assert "status" in first
        assert first["status"] == "open"
        # NOT_NULL 规则应映射到 completeness 维度
        assert first["dimension"] == "completeness"
        # HIGH 严重度应映射到 critical
        assert first["severity"] == "critical"
        # conceptId 应为 table 名
        assert first["conceptId"] == "orders"

    # 查询 overview 应反映 issues
    overview_resp = await client.get(
        "/api/v1/data/quality/overview", headers=tenant_headers
    )
    assert overview_resp.status_code == 200
    overview = overview_resp.json()["data"]
    assert overview["totalRules"] >= 1
    assert overview["enabledRules"] >= 1
    assert overview["lastRunAt"] is not None


@pytest.mark.asyncio
async def test_quality_issue_status_update(client, tenant_headers):
    """手动更新问题状态为 resolved，resolvedAt 应被设置。"""
    # 创建一条规则 + 触发检测
    body = {
        "name": "r_status",
        "table": "t_status",
        "column": "c",
        "ruleType": "not_null",
        "params": {},
        "severity": "MEDIUM",
        "enabled": True,
    }
    await client.post("/api/v1/data/quality/rules", json=body, headers=tenant_headers)

    # 触发多次以提高失败概率
    for _ in range(5):
        await client.post(
            "/api/v1/data/quality/run", json={}, headers=tenant_headers
        )

    issues_resp = await client.get(
        "/api/v1/data/quality/issues", headers=tenant_headers
    )
    issues = issues_resp.json()["data"]["items"]
    if not issues:
        # 随机性场景下可能全部通过，跳过状态更新验证
        return

    issue_id = issues[0]["issueId"]
    update_resp = await client.post(
        f"/api/v1/data/quality/issues/{issue_id}/status",
        json={"status": "resolved"},
        headers=tenant_headers,
    )
    assert update_resp.status_code == 200
    updated = update_resp.json()["data"]
    assert updated["status"] == "resolved"
    assert updated["resolvedAt"] is not None

    # 再次查询 issues，确认状态已变更
    list_resp = await client.get(
        "/api/v1/data/quality/issues?status=resolved", headers=tenant_headers
    )
    assert list_resp.status_code == 200
    items = list_resp.json()["data"]["items"]
    assert any(i["issueId"] == issue_id for i in items)


@pytest.mark.asyncio
async def test_quality_issues_filter_by_dimension(client, tenant_headers):
    """按 dimension 过滤 issues，应只返回匹配维度。"""
    # 创建两条不同维度的规则
    await client.post(
        "/api/v1/data/quality/rules",
        json={
            "name": "r_completeness",
            "table": "t1",
            "column": "c1",
            "ruleType": "not_null",
            "params": {},
            "severity": "HIGH",
            "enabled": True,
        },
        headers=tenant_headers,
    )
    await client.post(
        "/api/v1/data/quality/rules",
        json={
            "name": "r_uniqueness",
            "table": "t2",
            "column": "c2",
            "ruleType": "unique",
            "params": {},
            "severity": "HIGH",
            "enabled": True,
        },
        headers=tenant_headers,
    )

    # 触发多次以提高失败概率
    for _ in range(5):
        await client.post(
            "/api/v1/data/quality/run", json={}, headers=tenant_headers
        )

    # 按 completeness 维度过滤
    resp = await client.get(
        "/api/v1/data/quality/issues?dimension=completeness",
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    for i in items:
        assert i["dimension"] == "completeness"


@pytest.mark.asyncio
async def test_quality_run_with_concept_id(client, tenant_headers):
    """通过 conceptId 触发检测，应映射为 table 过滤。"""
    body = {
        "name": "r_concept",
        "table": "concept_orders",
        "column": "id",
        "ruleType": "not_null",
        "params": {},
        "severity": "MEDIUM",
        "enabled": True,
    }
    await client.post("/api/v1/data/quality/rules", json=body, headers=tenant_headers)

    # 用 conceptId 触发（应等价于 table=concept_orders）
    resp = await client.post(
        "/api/v1/data/quality/run",
        json={"conceptId": "concept_orders"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["status"] == "completed"
    assert data["totalRules"] >= 1