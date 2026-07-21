"""Digital worker team collaboration API tests (V15-04)."""

from __future__ import annotations

from httpx import AsyncClient

BASE = "/api/v1/agent"


async def _create_employee(
    client: AsyncClient,
    headers: dict,
    *,
    name: str,
    code: str,
    description: str,
) -> dict:
    """Helper: create a digital employee (Agent) and return its projected JSON."""

    body = {
        "name": name,
        "code": code,
        "description": description,
        "modelId": "doubao-pro-32k",
        "systemPrompt": "你是数字员工",
        "tools": [],
        "ragScopes": [],
        "temperature": 0.3,
        "maxTokens": 2048,
        "status": "DRAFT",
    }
    resp = await client.post(f"{BASE}/employees", json=body, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]


async def _create_collaboration(
    client: AsyncClient,
    headers: dict,
    *,
    goal: str,
    employee_ids: list[str],
    title: str | None = None,
    split_strategy: str = "parallel",
) -> dict:
    body: dict = {
        "goal": goal,
        "employeeIds": employee_ids,
        "splitStrategy": split_strategy,
    }
    if title is not None:
        body["title"] = title
    resp = await client.post(
        f"{BASE}/collaboration/tasks", json=body, headers=headers
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]


# ----------------------------------------------------------------------- tests


async def test_create_collaboration_default_template(
    client: AsyncClient, tenant_headers: dict
):
    """默认模板：通用任务（3 步）"""

    emp1 = await _create_employee(
        client,
        tenant_headers,
        name="员工A",
        code="emp-a",
        description="通用助手",
    )
    emp2 = await _create_employee(
        client,
        tenant_headers,
        name="员工B",
        code="emp-b",
        description="通用助手",
    )

    task = await _create_collaboration(
        client,
        tenant_headers,
        goal="你好，介绍一下自己",
        employee_ids=[emp1["employeeId"], emp2["employeeId"]],
    )

    assert task["collaborationId"].startswith("collab-")
    assert task["status"] == "pending"
    assert task["title"] == "通用任务"
    assert len(task["subtasks"]) == 3
    # 并行策略：没有依赖
    for st in task["subtasks"]:
        assert st["dependsOn"] == []
        assert st["status"] == "pending"
        assert st["progress"] == 0
        assert st["employeeId"] in {emp1["employeeId"], emp2["employeeId"]}


async def test_create_collaboration_data_analysis_template(
    client: AsyncClient, tenant_headers: dict
):
    """数据分析 + 数据 → 数据分析模板（3 步）"""

    emp = await _create_employee(
        client,
        tenant_headers,
        name="数据分析师",
        code="data-analyst",
        description="负责数据统计与报表分析",
    )
    task = await _create_collaboration(
        client,
        tenant_headers,
        goal="按部门统计本月销售额并分析",
        employee_ids=[emp["employeeId"]],
    )
    assert task["title"] == "数据分析"
    subtasks = task["subtasks"]
    assert len(subtasks) == 3
    titles = [s["title"] for s in subtasks]
    assert titles == ["查询数据", "数据分析", "生成报告"]
    # 验证 skill 标签
    assert subtasks[0]["skillTags"] == ["数据"]
    assert subtasks[1]["skillTags"] == ["分析"]


async def test_create_collaboration_report_with_email_template(
    client: AsyncClient, tenant_headers: dict
):
    """周报 + 邮件 → 报告生成与发送模板（4 步）"""

    emp = await _create_employee(
        client,
        tenant_headers,
        name="助手",
        code="helper",
        description="通用助手",
    )
    task = await _create_collaboration(
        client,
        tenant_headers,
        goal="分析销售数据并生成周报，发送邮件给团队",
        employee_ids=[emp["employeeId"]],
    )
    assert task["title"] == "报告生成与发送"
    assert len(task["subtasks"]) == 4
    assert task["subtasks"][0]["title"] == "查询数据"
    assert task["subtasks"][-1]["title"] == "发送邮件"


async def test_create_collaboration_with_sequential_strategy(
    client: AsyncClient, tenant_headers: dict
):
    """顺序策略：每个子任务依赖前一个"""

    emp = await _create_employee(
        client,
        tenant_headers,
        name="员工",
        code="emp",
        description="通用助手",
    )
    task = await _create_collaboration(
        client,
        tenant_headers,
        goal="分析销售数据",
        employee_ids=[emp["employeeId"]],
        split_strategy="sequential",
    )
    subtasks = task["subtasks"]
    assert len(subtasks) == 3
    assert subtasks[0]["dependsOn"] == []
    assert subtasks[1]["dependsOn"] == [subtasks[0]["id"]]
    assert subtasks[2]["dependsOn"] == [subtasks[1]["id"]]


async def test_create_collaboration_with_hybrid_strategy(
    client: AsyncClient, tenant_headers: dict
):
    """混合策略：使用模板声明的依赖（report_with_email 是 0→1→2→3 链）"""

    emp = await _create_employee(
        client,
        tenant_headers,
        name="员工",
        code="emp",
        description="通用助手",
    )
    task = await _create_collaboration(
        client,
        tenant_headers,
        goal="生成周报并发送邮件",
        employee_ids=[emp["employeeId"]],
        split_strategy="hybrid",
    )
    subtasks = task["subtasks"]
    assert len(subtasks) == 4
    # 验证模板声明的依赖被正确连接
    assert subtasks[0]["dependsOn"] == []
    assert subtasks[1]["dependsOn"] == [subtasks[0]["id"]]
    assert subtasks[2]["dependsOn"] == [subtasks[1]["id"]]
    assert subtasks[3]["dependsOn"] == [subtasks[2]["id"]]


async def test_auto_assign_picks_best_match_by_skill_keyword(
    client: AsyncClient, tenant_headers: dict
):
    """技能匹配：财务子任务应分配给财务员工，而非通用员工"""

    finance_emp = await _create_employee(
        client,
        tenant_headers,
        name="财务助手",
        code="finance",
        description="负责发票报销等财务工作",
    )
    general_emp = await _create_employee(
        client,
        tenant_headers,
        name="通用助手",
        code="general",
        description="通用助手",
    )
    # 邮件任务模板第一步 skill 标签是 "通知"，匹配范围广；
    # 但财务员工在 "邮件" 关键词的角色列表中也包含 FINANCE，应优先被选。
    task = await _create_collaboration(
        client,
        tenant_headers,
        goal="发送续签提醒邮件",
        employee_ids=[finance_emp["employeeId"], general_emp["employeeId"]],
    )
    # 模板 "邮件任务" 第一步是 "准备内容"，skill="通知"
    # "通知" 的角色列表包含 FINANCE/HR/LEGAL/DATA_ANALYST/CUSTOMER_SERVICE
    # finance_emp 推断为 FINANCE，匹配得分 3；general_emp 推断为 CUSTOM，匹配得分 1
    # 因此准备内容应分配给 finance_emp
    prepare_step = task["subtasks"][0]
    assert prepare_step["title"] == "准备内容"
    assert prepare_step["employeeId"] == finance_emp["employeeId"]


async def test_get_collaboration_api(client: AsyncClient, tenant_headers: dict):
    emp = await _create_employee(
        client,
        tenant_headers,
        name="员工",
        code="emp",
        description="通用助手",
    )
    created = await _create_collaboration(
        client, tenant_headers, goal="分析数据", employee_ids=[emp["employeeId"]]
    )

    resp = await client.get(
        f"{BASE}/collaboration/tasks/{created['collaborationId']}",
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["collaborationId"] == created["collaborationId"]
    assert len(data["subtasks"]) == 3


async def test_get_collaboration_not_found(
    client: AsyncClient, tenant_headers: dict
):
    resp = await client.get(
        f"{BASE}/collaboration/tasks/collab-nonexistent",
        headers=tenant_headers,
    )
    assert resp.status_code == 400
    body = resp.json()
    assert "不存在" in body["message"]


async def test_list_collaborations_api(client: AsyncClient, tenant_headers: dict):
    emp = await _create_employee(
        client,
        tenant_headers,
        name="员工",
        code="emp",
        description="通用助手",
    )
    await _create_collaboration(
        client,
        tenant_headers,
        goal="分析数据",
        employee_ids=[emp["employeeId"]],
        title="协作一",
    )
    await _create_collaboration(
        client,
        tenant_headers,
        goal="发送邮件",
        employee_ids=[emp["employeeId"]],
        title="协作二",
    )

    resp = await client.get(
        f"{BASE}/collaboration/tasks", headers=tenant_headers
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 2
    assert len(data["items"]) == 2


async def test_list_collaborations_filter_by_status(
    client: AsyncClient, tenant_headers: dict
):
    """列表接口支持按 status 过滤"""

    emp = await _create_employee(
        client,
        tenant_headers,
        name="员工",
        code="emp",
        description="通用助手",
    )
    task1 = await _create_collaboration(
        client,
        tenant_headers,
        goal="分析数据",
        employee_ids=[emp["employeeId"]],
        title="协作一",
    )
    # 执行 task1 让它进入 completed 状态
    await client.post(
        f"{BASE}/collaboration/tasks/{task1['collaborationId']}/execute",
        headers=tenant_headers,
    )
    await _create_collaboration(
        client,
        tenant_headers,
        goal="发送邮件",
        employee_ids=[emp["employeeId"]],
        title="协作二",
    )

    resp = await client.get(
        f"{BASE}/collaboration/tasks",
        params={"status": "completed"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 1
    assert data["items"][0]["status"] == "completed"


async def test_execute_collaboration_marks_subtasks_completed(
    client: AsyncClient, tenant_headers: dict
):
    """执行后所有子任务应标记为 completed，并填充 actual_seconds 与 result"""

    emp = await _create_employee(
        client,
        tenant_headers,
        name="员工",
        code="emp",
        description="通用助手",
    )
    task = await _create_collaboration(
        client,
        tenant_headers,
        goal="分析销售数据",
        employee_ids=[emp["employeeId"]],
    )

    resp = await client.post(
        f"{BASE}/collaboration/tasks/{task['collaborationId']}/execute",
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["status"] == "completed"
    assert data["startedAt"] is not None
    assert data["completedAt"] is not None
    for st in data["subtasks"]:
        assert st["status"] == "completed"
        assert st["progress"] == 100
        assert st["actualSeconds"] >= 1
        assert st["result"] is not None
        assert st["startedAt"] is not None
        assert st["completedAt"] is not None


async def test_execute_collaboration_idempotent_guard(
    client: AsyncClient, tenant_headers: dict
):
    """已完成的协作任务不能再次执行"""

    emp = await _create_employee(
        client,
        tenant_headers,
        name="员工",
        code="emp",
        description="通用助手",
    )
    task = await _create_collaboration(
        client,
        tenant_headers,
        goal="分析销售数据",
        employee_ids=[emp["employeeId"]],
    )
    await client.post(
        f"{BASE}/collaboration/tasks/{task['collaborationId']}/execute",
        headers=tenant_headers,
    )

    resp = await client.post(
        f"{BASE}/collaboration/tasks/{task['collaborationId']}/execute",
        headers=tenant_headers,
    )
    assert resp.status_code == 400
    body = resp.json()
    assert "已结束" in body["message"]


async def test_get_collaboration_report(
    client: AsyncClient, tenant_headers: dict
):
    """协作报告应包含贡献统计与效率提升百分比"""

    emp1 = await _create_employee(
        client,
        tenant_headers,
        name="数据分析师",
        code="analyst",
        description="负责数据统计与报表分析",
    )
    emp2 = await _create_employee(
        client,
        tenant_headers,
        name="通用助手",
        code="helper",
        description="通用助手",
    )
    task = await _create_collaboration(
        client,
        tenant_headers,
        goal="分析销售数据并生成报告",
        employee_ids=[emp1["employeeId"], emp2["employeeId"]],
    )

    # 先执行再出报告
    await client.post(
        f"{BASE}/collaboration/tasks/{task['collaborationId']}/execute",
        headers=tenant_headers,
    )

    resp = await client.get(
        f"{BASE}/collaboration/tasks/{task['collaborationId']}/report",
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["collaborationId"] == task["collaborationId"]
    # goal "分析销售数据并生成报告" matches has_report + has_analysis + has_data
    # → "报告生成与发送" template (4 subtasks)
    assert data["totalSubtasks"] == 4
    assert data["completedSubtasks"] == 4
    assert data["failedSubtasks"] == 0
    # 顺序总时长 > 并行总时长，效率提升应为非负
    assert data["sequentialDurationSeconds"] >= data["parallelDurationSeconds"]
    assert data["efficiencyImprovementPct"] >= 0.0
    # 贡献列表至少包含一个员工
    assert len(data["contributions"]) >= 1
    contribution = data["contributions"][0]
    assert "employeeId" in contribution
    assert contribution["subtaskCount"] >= 1
    assert contribution["completedCount"] >= 1
    assert contribution["totalSeconds"] >= 1
    # 报告 markdown 不为空
    assert "协作报告" in data["finalReport"]


async def test_get_collaboration_report_task_not_found(
    client: AsyncClient, tenant_headers: dict
):
    """不存在的协作任务应返回 400"""

    resp = await client.get(
        f"{BASE}/collaboration/tasks/collab-nonexistent/report",
        headers=tenant_headers,
    )
    assert resp.status_code == 400


async def test_execute_collaboration_with_sequential_strategy_respects_deps(
    client: AsyncClient, tenant_headers: dict
):
    """顺序策略下，后续子任务的 startedAt 应不早于前置任务的 completedAt"""

    emp = await _create_employee(
        client,
        tenant_headers,
        name="员工",
        code="emp",
        description="通用助手",
    )
    task = await _create_collaboration(
        client,
        tenant_headers,
        goal="分析销售数据",
        employee_ids=[emp["employeeId"]],
        split_strategy="sequential",
    )
    resp = await client.post(
        f"{BASE}/collaboration/tasks/{task['collaborationId']}/execute",
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    subtasks = resp.json()["data"]["subtasks"]
    # 验证依赖被正确写入
    assert subtasks[1]["dependsOn"] == [subtasks[0]["id"]]
    assert subtasks[2]["dependsOn"] == [subtasks[1]["id"]]
    # 验证时间戳非递减
    assert subtasks[0]["completedAt"] is not None
    assert subtasks[1]["startedAt"] is not None
    # 顺序策略下：subtasks[1] 的 startedAt >= subtasks[0] 的 completedAt
    # 由于 mock 中我们使用同一时刻作为依赖完成时间和后续开始时间，所以 >= 即可
    t0_done = subtasks[0]["completedAt"]
    t1_start = subtasks[1]["startedAt"]
    assert t1_start >= t0_done


async def test_create_collaboration_requires_at_least_one_employee(
    client: AsyncClient, tenant_headers: dict
):
    """employee_ids 为空时应被参数校验拒绝（422）"""

    body = {
        "title": "无效协作",
        "goal": "分析数据",
        "employeeIds": [],
        "splitStrategy": "parallel",
    }
    resp = await client.post(
        f"{BASE}/collaboration/tasks", json=body, headers=tenant_headers
    )
    # Pydantic min_length=1 → RequestValidationError → 400
    assert resp.status_code in (400, 422)


async def test_create_collaboration_customer_churn_template(
    client: AsyncClient, tenant_headers: dict
):
    """客户 + 流失 → 客户流失分析模板"""

    emp = await _create_employee(
        client,
        tenant_headers,
        name="员工",
        code="emp",
        description="通用助手",
    )
    task = await _create_collaboration(
        client,
        tenant_headers,
        goal="分析客户流失原因并生成报告",
        employee_ids=[emp["employeeId"]],
    )
    assert task["title"] == "客户流失分析"
    subtasks = task["subtasks"]
    assert len(subtasks) == 3
    assert subtasks[0]["title"] == "查询客户数据"
    assert subtasks[1]["title"] == "分析流失原因"
    assert subtasks[2]["title"] == "生成分析报告"
