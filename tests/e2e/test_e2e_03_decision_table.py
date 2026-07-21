"""链路3：决策表执行 E2E 测试（V11-11）。

覆盖业务流程：
  创建决策表 → 添加测试用例（行）→ 批量导入 → 执行 → 查看结果

依赖服务：TECH-RULE（Java，Mock FastAPI）
对应 V11-03 已实现端点。

由于 TECH-RULE 是 Java 服务，无法在 Python pytest 中直接启动。
本测试通过 Mock FastAPI app 模拟 Java 服务的响应，验证：
- 链路定义完整（请求顺序、路径、参数契约）
- trace_id 在请求头中传递，并在响应中回传
- 业务字段契约对齐（hitPolicy、rows、execute 结果结构）
"""

from __future__ import annotations

RULE_BASE = "/api/v1/rule/decision-tables"


async def test_e2e_03_decision_table_full_flow(
    rule_client,
    mock_call_log,
    tenant_headers: dict[str, str],
    trace_id: str,
):
    """端到端：创建决策表→添加测试用例→批量导入→执行→查看结果。

    验证点：
    - 全链路 HTTP 200
    - 决策表创建返回 id / hitPolicy / columns
    - 单行添加与批量导入都能成功
    - 执行决策表返回 matchedRows / outputs / executionTimeMs
    - trace_id 在每个响应中回传一致
    - Mock 调用顺序符合业务链路定义
    """

    # 1. 创建决策表
    create_body = {
        "name": "e2e_age_level_table",
        "description": "根据 age 判定 level",
        "hitPolicy": "FIRST",
        "columns": [
            {"id": "col-in-1", "name": "age", "type": "INPUT", "dataType": "number"},
            {"id": "col-out-1", "name": "level", "type": "OUTPUT", "dataType": "string"},
        ],
    }
    resp = await rule_client.post(
        f"{RULE_BASE}", json=create_body, headers=tenant_headers
    )
    assert resp.status_code == 200, resp.text
    table_data = resp.json()["data"]
    assert table_data["id"] == "dt-mock-001"
    assert table_data["name"] == "e2e_age_level_table"
    assert table_data["hitPolicy"] == "FIRST"
    assert resp.json()["traceId"] == trace_id
    table_id = table_data["id"]

    # 2. 添加单条测试用例（行）
    add_row_resp = await rule_client.post(
        f"{RULE_BASE}/{table_id}/rows",
        json={
            "inputs": {"age": 30},
            "outputs": {"level": "adult"},
            "enabled": True,
        },
        headers=tenant_headers,
    )
    assert add_row_resp.status_code == 200
    row_data = add_row_resp.json()["data"]
    assert row_data["id"] == "row-mock-001"
    assert row_data["inputs"] == {"age": 30}
    assert row_data["outputs"] == {"level": "adult"}
    assert add_row_resp.json()["traceId"] == trace_id

    # 3. 批量导入更多行
    batch_resp = await rule_client.post(
        f"{RULE_BASE}/{table_id}/rows/batch",
        json={
            "rows": [
                {"inputs": {"age": 10}, "outputs": {"level": "child"}},
                {"inputs": {"age": 65}, "outputs": {"level": "senior"}},
            ],
        },
        headers=tenant_headers,
    )
    assert batch_resp.status_code == 200
    batch_rows = batch_resp.json()["data"]
    assert len(batch_rows) == 2
    assert batch_resp.json()["traceId"] == trace_id

    # 4. 查询决策表详情（应包含 rows 字段）
    get_resp = await rule_client.get(
        f"{RULE_BASE}/{table_id}", headers=tenant_headers
    )
    assert get_resp.status_code == 200
    fetched = get_resp.json()["data"]
    assert fetched["id"] == table_id
    assert len(fetched["rows"]) >= 1
    assert get_resp.json()["traceId"] == trace_id

    # 5. 执行决策表（命中 age==30 的行）
    exec_resp = await rule_client.post(
        f"{RULE_BASE}/{table_id}/execute",
        json={"inputData": {"age": 30}},
        headers=tenant_headers,
    )
    assert exec_resp.status_code == 200, exec_resp.text
    exec_data = exec_resp.json()["data"]
    assert "matchedRows" in exec_data
    assert "outputs" in exec_data
    assert "executionTimeMs" in exec_data
    assert len(exec_data["matchedRows"]) == 1
    assert exec_data["matchedRows"][0]["outputs"] == {"level": "adult"}
    assert exec_data["outputs"] == [{"level": "adult"}]
    assert exec_resp.json()["traceId"] == trace_id

    # 6. 执行未命中的输入
    miss_resp = await rule_client.post(
        f"{RULE_BASE}/{table_id}/execute",
        json={"inputData": {"age": 999}},
        headers=tenant_headers,
    )
    assert miss_resp.status_code == 200
    miss_data = miss_resp.json()["data"]
    assert miss_data["matchedRows"] == []
    assert miss_data["outputs"] == []

    # 7. 验证 Mock 调用顺序符合业务链路定义
    expected_paths = [
        f"{RULE_BASE}",                       # POST 创建
        f"{RULE_BASE}/{table_id}/rows",       # POST 添加行
        f"{RULE_BASE}/{table_id}/rows/batch", # POST 批量导入
        f"{RULE_BASE}/{table_id}",            # GET 详情
        f"{RULE_BASE}/{table_id}/execute",    # POST 执行（命中）
        f"{RULE_BASE}/{table_id}/execute",    # POST 执行（未命中）
    ]
    assert mock_call_log.paths == expected_paths, (
        f"调用顺序不符: 期望 {expected_paths}, 实际 {mock_call_log.paths}"
    )

    # 8. 验证每次调用都携带了 trace_id header
    for call in mock_call_log.calls:
        assert call.headers.get("X-Trace-Id") == trace_id
        assert call.headers.get("X-Tenant-Id") == "tenant-e2e"


async def test_e2e_03_decision_table_test_endpoint(
    rule_client,
    mock_call_log,
    tenant_headers: dict[str, str],
    trace_id: str,
):
    """验证 /test 端点契约（与 /execute 不同的测试入口）。"""
    table_id = "dt-test-001"
    resp = await rule_client.post(
        f"{RULE_BASE}/{table_id}/test",
        json={"inputData": {"age": 30}},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["tableId"] == table_id
    assert data["inputData"] == {"age": 30}
    assert "success" in data
    assert "executionTimeMs" in data
    assert resp.json()["traceId"] == trace_id
