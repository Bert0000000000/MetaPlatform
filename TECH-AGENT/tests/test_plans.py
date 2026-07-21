"""Autonomous task planning API tests (V15-02)."""

from __future__ import annotations

from httpx import AsyncClient

BASE = "/api/v1/agent"


async def _create_plan(
    client: AsyncClient,
    headers: dict,
    user_input: str = "帮我分析销售数据",
    **overrides,
) -> dict:
    body = {"userInput": user_input, **overrides}
    resp = await client.post(f"{BASE}/plans", json=body, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]


async def test_create_plan_data_analysis(client: AsyncClient, tenant_headers: dict):
    """分析 + 数据 → 数据分析模板（3 步）"""

    plan = await _create_plan(
        client, tenant_headers, "按部门统计本月销售额并分析"
    )
    assert plan["planId"].startswith("plan-")
    assert plan["status"] == "ready"
    assert plan["title"] == "数据分析"
    steps = plan["steps"]
    assert len(steps) == 3
    assert steps[0]["title"] == "查询数据"
    assert steps[0]["action"] == "query_data"
    assert steps[0]["requiresApproval"] is True
    assert steps[0]["status"] == "pending"
    assert steps[1]["title"] == "数据分析"
    assert steps[2]["title"] == "生成报告"


async def test_create_plan_report_with_email(
    client: AsyncClient, tenant_headers: dict
):
    """周报 + 发送邮件 → 报告生成与发送模板（4 步）"""

    plan = await _create_plan(
        client, tenant_headers, "分析销售数据并生成周报，发送邮件给团队"
    )
    assert plan["title"] == "报告生成与发送"
    steps = plan["steps"]
    assert len(steps) == 4
    assert steps[0]["action"] == "query_data"
    assert steps[3]["action"] == "send_email"


async def test_create_plan_customer_churn(
    client: AsyncClient, tenant_headers: dict
):
    """客户 + 流失 → 客户流失分析模板"""

    plan = await _create_plan(
        client, tenant_headers, "分析客户流失原因并生成报告"
    )
    assert plan["title"] == "客户流失分析"
    steps = plan["steps"]
    assert len(steps) == 3
    assert steps[0]["action"] == "query_customer_data"
    assert steps[1]["action"] == "analyze_churn"
    assert steps[2]["action"] == "generate_report"


async def test_create_plan_email_only(client: AsyncClient, tenant_headers: dict):
    """邮件 → 邮件任务模板（2 步）"""

    plan = await _create_plan(
        client, tenant_headers, "给合同到期的客户发送续签提醒邮件"
    )
    assert plan["title"] == "邮件任务"
    steps = plan["steps"]
    assert len(steps) == 2
    assert steps[0]["action"] == "prepare_content"
    assert steps[1]["action"] == "send_email"


async def test_create_plan_default_template(client: AsyncClient, tenant_headers: dict):
    """兜底模板：通用任务"""

    plan = await _create_plan(
        client, tenant_headers, "你好，介绍一下自己"
    )
    assert plan["title"] == "通用任务"
    steps = plan["steps"]
    assert len(steps) == 3
    assert steps[0]["action"] == "understand_intent"


async def test_get_plan_api(client: AsyncClient, tenant_headers: dict):
    plan = await _create_plan(client, tenant_headers)

    resp = await client.get(
        f"{BASE}/plans/{plan['planId']}", headers=tenant_headers
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["planId"] == plan["planId"]
    assert len(data["steps"]) == 3


async def test_get_plan_not_found(client: AsyncClient, tenant_headers: dict):
    resp = await client.get(
        f"{BASE}/plans/plan-nonexistent", headers=tenant_headers
    )
    assert resp.status_code == 400
    body = resp.json()
    assert "不存在" in body["message"]


async def test_list_plans_api(client: AsyncClient, tenant_headers: dict):
    await _create_plan(client, tenant_headers, "分析销售数据")
    await _create_plan(client, tenant_headers, "发送邮件提醒")

    resp = await client.get(f"{BASE}/plans", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 2
    assert len(data["items"]) == 2


async def test_approve_step_api(client: AsyncClient, tenant_headers: dict):
    plan = await _create_plan(client, tenant_headers, "分析销售数据")

    step_id = plan["steps"][0]["stepId"]
    resp = await client.post(
        f"{BASE}/plans/{plan['planId']}/steps/{step_id}/approve",
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    approved = [s for s in data["steps"] if s["stepId"] == step_id][0]
    assert approved["status"] == "approved"


async def test_approve_step_invalid_status(
    client: AsyncClient, tenant_headers: dict
):
    """已完成的步骤不能再次批准"""

    plan = await _create_plan(client, tenant_headers, "分析销售数据")
    step_id = plan["steps"][0]["stepId"]

    # 先批准再执行
    await client.post(
        f"{BASE}/plans/{plan['planId']}/steps/{step_id}/approve",
        headers=tenant_headers,
    )
    await client.post(
        f"{BASE}/plans/{plan['planId']}/execute", headers=tenant_headers
    )

    # 再次批准 → 应失败
    resp = await client.post(
        f"{BASE}/plans/{plan['planId']}/steps/{step_id}/approve",
        headers=tenant_headers,
    )
    assert resp.status_code == 400


async def test_skip_step_api(client: AsyncClient, tenant_headers: dict):
    plan = await _create_plan(client, tenant_headers, "分析销售数据")

    step_id = plan["steps"][1]["stepId"]  # 数据分析步骤
    resp = await client.post(
        f"{BASE}/plans/{plan['planId']}/steps/{step_id}/skip",
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    skipped = [s for s in data["steps"] if s["stepId"] == step_id][0]
    assert skipped["status"] == "skipped"


async def test_execute_plan_with_approval(
    client: AsyncClient, tenant_headers: dict
):
    """批准第一步后执行 → 第一步 completed，后续步骤需要再次批准"""

    plan = await _create_plan(client, tenant_headers, "分析销售数据")
    plan_id = plan["planId"]

    # 批准第一步
    step0 = plan["steps"][0]["stepId"]
    await client.post(
        f"{BASE}/plans/{plan_id}/steps/{step0}/approve", headers=tenant_headers
    )

    # 执行计划
    resp = await client.post(
        f"{BASE}/plans/{plan_id}/execute", headers=tenant_headers
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    # 计划状态：仍在运行（后续步骤未批准）
    assert data["status"] in ("running", "completed")

    # 第一步应已完成
    s0 = [s for s in data["steps"] if s["stepId"] == step0][0]
    assert s0["status"] == "completed"
    assert s0["output"]["mock"] is True
    assert s0["output"]["action"] == "query_data"


async def test_execute_plan_skips_remaining_unapproved_steps(
    client: AsyncClient, tenant_headers: dict
):
    """执行时未批准的步骤保持 pending，计划保持 running 状态"""

    plan = await _create_plan(client, tenant_headers, "分析销售数据")
    resp = await client.post(
        f"{BASE}/plans/{plan['planId']}/execute", headers=tenant_headers
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    # 没有任何步骤被批准过，所以所有步骤保持 pending
    assert all(s["status"] == "pending" for s in data["steps"])
    assert data["status"] == "running"


async def test_execute_plan_idempotent_guard(
    client: AsyncClient, tenant_headers: dict
):
    """已完成的计划不能再次执行"""

    plan = await _create_plan(client, tenant_headers, "分析销售数据")
    plan_id = plan["planId"]

    # 全部步骤都不需要批准，可以直接执行完毕
    # 这里通过逐个批准然后执行来让计划完成
    for s in plan["steps"]:
        if s["requiresApproval"]:
            await client.post(
                f"{BASE}/plans/{plan_id}/steps/{s['stepId']}/approve",
                headers=tenant_headers,
            )

    await client.post(
        f"{BASE}/plans/{plan_id}/execute", headers=tenant_headers
    )

    # 再次执行 → 应失败
    resp = await client.post(
        f"{BASE}/plans/{plan_id}/execute", headers=tenant_headers
    )
    assert resp.status_code == 400


async def test_skip_completed_step_blocked(
    client: AsyncClient, tenant_headers: dict
):
    """跳过已完成的步骤应失败"""

    plan = await _create_plan(client, tenant_headers, "分析销售数据")
    plan_id = plan["planId"]
    step0 = plan["steps"][0]["stepId"]

    # 批准并执行
    await client.post(
        f"{BASE}/plans/{plan_id}/steps/{step0}/approve", headers=tenant_headers
    )
    await client.post(
        f"{BASE}/plans/{plan_id}/execute", headers=tenant_headers
    )

    # 尝试跳过已完成的步骤 → 应失败
    resp = await client.post(
        f"{BASE}/plans/{plan_id}/steps/{step0}/skip", headers=tenant_headers
    )
    assert resp.status_code == 400


async def test_dynamic_adjustment_via_skip_and_execute(
    client: AsyncClient, tenant_headers: dict
):
    """验证动态调整：跳过某步 + 批准后续步骤 + 再次执行"""

    plan = await _create_plan(
        client, tenant_headers, "分析销售数据"
    )
    plan_id = plan["planId"]
    steps = plan["steps"]
    # 跳过"数据分析"步骤
    analysis_step_id = steps[1]["stepId"]
    resp = await client.post(
        f"{BASE}/plans/{plan_id}/steps/{analysis_step_id}/skip",
        headers=tenant_headers,
    )
    assert resp.status_code == 200

    # 批准"查询数据"步骤
    query_step_id = steps[0]["stepId"]
    await client.post(
        f"{BASE}/plans/{plan_id}/steps/{query_step_id}/approve",
        headers=tenant_headers,
    )
    # 批准"生成报告"步骤
    report_step_id = steps[2]["stepId"]
    await client.post(
        f"{BASE}/plans/{plan_id}/steps/{report_step_id}/approve",
        headers=tenant_headers,
    )

    resp = await client.post(
        f"{BASE}/plans/{plan_id}/execute", headers=tenant_headers
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["status"] == "completed"
    statuses = {s["stepId"]: s["status"] for s in data["steps"]}
    assert statuses[query_step_id] == "completed"
    assert statuses[analysis_step_id] == "skipped"
    assert statuses[report_step_id] == "completed"
