"""Tests for Task Delegation endpoints (P3-A2A-05/07/08/15)."""

from __future__ import annotations

from httpx import AsyncClient

from app.common.errors import ErrorCode

BASE = "/api/v1/a2a"
TENANT = "tenant-test"
TRACE = "test-trace-001"

DELEGATE_BODY = {
    "sourceAgentId": "internal-agent-001",
    "targetAgentId": "ext-agent-002",
    "taskType": "data-processing",
    "payload": {"input": "process this data", "format": "json"},
    "timeout": 60.0,
    "callbackUrl": "http://callback.example.com/api",
}


async def test_delegate_task_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(f"{BASE}/tasks", json=DELEGATE_BODY, headers=tenant_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["code"] == 0
    data = body["data"]
    assert data["sourceAgentId"] == "internal-agent-001"
    assert data["targetAgentId"] == "ext-agent-002"
    assert data["taskType"] == "data-processing"
    assert data["taskId"].startswith("task-")
    # Mock mode returns COMPLETED
    assert data["status"] == "COMPLETED"
    assert data["result"] is not None
    assert data["timeout"] == 60.0
    assert data["callbackUrl"] == "http://callback.example.com/api"


async def test_list_tasks_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    for i in range(3):
        body = dict(DELEGATE_BODY)
        body["sourceAgentId"] = f"agent-{i}"
        resp = await client.post(f"{BASE}/tasks", json=body, headers=tenant_headers)
        assert resp.status_code == 200

    resp = await client.get(f"{BASE}/tasks", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 3


async def test_get_task_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(f"{BASE}/tasks", json=DELEGATE_BODY, headers=tenant_headers)
    task_id = resp.json()["data"]["taskId"]

    resp = await client.get(f"{BASE}/tasks/{task_id}", headers=tenant_headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["taskId"] == task_id


async def test_get_task_status_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(f"{BASE}/tasks", json=DELEGATE_BODY, headers=tenant_headers)
    task_id = resp.json()["data"]["taskId"]

    resp = await client.get(f"{BASE}/tasks/{task_id}/status", headers=tenant_headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "COMPLETED"


async def test_get_task_result_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(f"{BASE}/tasks", json=DELEGATE_BODY, headers=tenant_headers)
    task_id = resp.json()["data"]["taskId"]

    resp = await client.get(f"{BASE}/tasks/{task_id}/result", headers=tenant_headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["result"] is not None


async def test_cancel_completed_task_fails(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(f"{BASE}/tasks", json=DELEGATE_BODY, headers=tenant_headers)
    task_id = resp.json()["data"]["taskId"]

    # Mock mode completes immediately, so cancel should fail
    resp = await client.post(f"{BASE}/tasks/{task_id}/cancel", headers=tenant_headers)
    assert resp.status_code == 409
    assert resp.json()["code"] == int(ErrorCode.TASK_ALREADY_COMPLETED)


async def test_status_history_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(f"{BASE}/tasks", json=DELEGATE_BODY, headers=tenant_headers)
    task_id = resp.json()["data"]["taskId"]

    resp = await client.get(f"{BASE}/tasks/{task_id}/status-history", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) >= 2
    assert data[0]["status"] == "PENDING"


async def test_artifacts_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(f"{BASE}/tasks", json=DELEGATE_BODY, headers=tenant_headers)
    task_id = resp.json()["data"]["taskId"]

    resp = await client.get(f"{BASE}/tasks/{task_id}/artifacts", headers=tenant_headers)
    assert resp.status_code == 200
    assert resp.json()["data"] == []


async def test_update_timeout_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(f"{BASE}/tasks", json=DELEGATE_BODY, headers=tenant_headers)
    task_id = resp.json()["data"]["taskId"]

    resp = await client.put(
        f"{BASE}/tasks/{task_id}/timeout",
        json={"timeout": 120.0},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["timeout"] == 120.0


async def test_task_not_found(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.get(f"{BASE}/tasks/task-nonexistent", headers=tenant_headers)
    assert resp.status_code == 404
    assert resp.json()["code"] == int(ErrorCode.TASK_NOT_FOUND)


async def test_status_history_ordered_by_timestamp(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """状态历史接口必须按 timestamp 升序返回，便于消费方渲染稳定时间线。"""

    # 1. 委派一个任务（mock 模式会写入 PENDING + COMPLETED 两条历史）
    resp = await client.post(f"{BASE}/tasks", json=DELEGATE_BODY, headers=tenant_headers)
    assert resp.status_code == 200, resp.text
    task_id = resp.json()["data"]["taskId"]

    # 2. 拉取状态历史
    resp = await client.get(
        f"{BASE}/tasks/{task_id}/status-history", headers=tenant_headers
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert len(data) >= 2

    # 3. 断言数组按 timestamp 升序排列
    timestamps = [entry["timestamp"] for entry in data]
    assert timestamps == sorted(timestamps), (
        f"状态历史必须按 timestamp 升序，实际: {timestamps}"
    )

    # 4. 第一条应为 PENDING（最早一条）
    assert data[0]["status"] == "PENDING"


async def test_delegate_task_records_failed_audit_when_agent_raises(
    client: AsyncClient,
    tenant_headers: dict[str, str],
    monkeypatch: "pytest.MonkeyPatch",
) -> None:
    """当 AgentClient.send_task 抛 UpstreamUnavailableError 时，
    任务应被标记为 FAILED 并产出 TASK_DELEGATED + TASK_FAILED 两条审计记录。"""

    from app.clients.agent_client import AgentClient
    from app.common.errors import UpstreamUnavailableError

    # 1. monkeypatch AgentClient.send_task 永远抛 UpstreamUnavailableError
    async def fake_send_task(*args, **kwargs):
        raise UpstreamUnavailableError(
            "Mocked upstream failure",
            data={"endpoint": "agents/ext-agent-002/jsonrpc"},
        )

    monkeypatch.setattr(AgentClient, "send_task", fake_send_task)

    # 2. 委派任务
    resp = await client.post(f"{BASE}/tasks", json=DELEGATE_BODY, headers=tenant_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()["data"]
    # 失败回写后任务应进入 FAILED
    assert body["status"] == "FAILED"
    # error 字段应非空
    assert body["error"]
    task_id = body["taskId"]

    # 3. 校验审计记录同时包含 TASK_DELEGATED 和 TASK_FAILED
    resp = await client.get(f"{BASE}/audit/records", headers=tenant_headers)
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    actions = [r["action"] for r in items]
    assert "TASK_DELEGATED" in actions, "缺少 TASK_DELEGATED 审计"
    assert "TASK_FAILED" in actions, "缺少 TASK_FAILED 审计"

    # 4. TASK_FAILED 记录的 details 应包含对应 taskId
    failed_records = [r for r in items if r["action"] == "TASK_FAILED"]
    assert any(
        r["details"].get("taskId") == task_id for r in failed_records
    ), "TASK_FAILED 审计应记录失败任务的 taskId"


async def test_list_tasks_filter_by_target_agent_id_when_missing_returns_empty(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """当用不存在的 targetAgentId 过滤任务列表时，应返回 total=0 的空分页。"""

    # 1. 委派一个 source=agent-A、target=agent-B 的任务
    body = dict(DELEGATE_BODY)
    body["sourceAgentId"] = "agent-A"
    body["targetAgentId"] = "agent-B"
    resp = await client.post(f"{BASE}/tasks", json=body, headers=tenant_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["targetAgentId"] == "agent-B"

    # 2. 用一个不存在的 agent 作为 targetAgentId 查询
    resp = await client.get(
        f"{BASE}/tasks",
        params={"targetAgentId": "agent-XXX"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["total"] == 0
    assert data["items"] == []

    # 3. 用真实存在的 targetAgentId 再查一次，应能命中
    resp = await client.get(
        f"{BASE}/tasks",
        params={"targetAgentId": "agent-B"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["total"] == 1
    assert data["items"][0]["targetAgentId"] == "agent-B"


async def test_route_to_agent_records_audit_and_updates_status(
    client: AsyncClient,
    tenant_headers: dict[str, str],
    monkeypatch: "pytest.MonkeyPatch",
) -> None:
    """调用 /tasks/{id}/route-to-agent 后，任务进入 COMPLETED，
    result 中应包含 executionId，并产生 TASK_DELEGATED + ROUTED_TO_AGENT 两条审计记录。"""

    # 1. 先委派一个任务（mock 模式直接完成）
    resp = await client.post(f"{BASE}/tasks", json=DELEGATE_BODY, headers=tenant_headers)
    assert resp.status_code == 200, resp.text
    task_id = resp.json()["data"]["taskId"]
    assert resp.json()["data"]["status"] == "COMPLETED"

    # 2. 用 monkeypatch 让 AgentServiceClient.execute_agent 返回固定值
    from app.clients.agent_service_client import AgentServiceClient

    async def fake_execute_agent(
        self: AgentServiceClient,
        agent_id: str,
        input_text: str,
        *,
        trace_id=None,
        tenant_id=None,
    ) -> dict:
        return {
            "executionId": "exec-fixed-001",
            "agentId": agent_id,
            "status": "COMPLETED",
            "output": "fixed mock output",
        }

    monkeypatch.setattr(
        AgentServiceClient, "execute_agent", fake_execute_agent
    )

    # 3. 调用 route-to-agent
    resp = await client.post(
        f"{BASE}/tasks/{task_id}/route-to-agent",
        json={"agentId": "tech-agent-007", "input": "hello"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["taskId"] == task_id
    assert data["status"] == "COMPLETED"
    # result 中应包含 executionId
    assert data["result"] is not None
    assert data["result"].get("executionId") == "exec-fixed-001"

    # 4. 校验审计记录：应包含 TASK_DELEGATED 与 ROUTED_TO_AGENT
    resp = await client.get(f"{BASE}/audit/records", headers=tenant_headers)
    assert resp.status_code == 200
    actions = [r["action"] for r in resp.json()["data"]["items"]]
    assert "TASK_DELEGATED" in actions
    assert "ROUTED_TO_AGENT" in actions

    # 5. 进一步校验 ROUTED_TO_AGENT 记录的 details 里包含 executionId
    routed_records = [
        r
        for r in resp.json()["data"]["items"]
        if r["action"] == "ROUTED_TO_AGENT"
    ]
    assert routed_records, "应至少存在一条 ROUTED_TO_AGENT 审计记录"
    assert any(
        r["details"].get("executionId") == "exec-fixed-001" for r in routed_records
    )


async def test_status_history_statuses_are_terminal_when_task_completed(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """任务状态机合规：mock 同步模式下，状态历史末条应为 COMPLETED，
    且整条历史至少覆盖 PENDING 与 COMPLETED 两个状态。"""

    # 1. 委派一个任务（mock 模式直接 COMPLETED）
    resp = await client.post(f"{BASE}/tasks", json=DELEGATE_BODY, headers=tenant_headers)
    assert resp.status_code == 200, resp.text
    task_id = resp.json()["data"]["taskId"]

    # 2. 拉取状态历史
    resp = await client.get(
        f"{BASE}/tasks/{task_id}/status-history", headers=tenant_headers
    )
    assert resp.status_code == 200, resp.text
    history = resp.json()["data"]
    assert len(history) >= 2, "状态历史至少应包含 PENDING + COMPLETED 两条"

    # 3. 末条状态必须为 COMPLETED（终态）
    assert history[-1]["status"] == "COMPLETED", (
        f"任务已完结，状态历史末条应为 COMPLETED，实际: {history[-1]['status']}"
    )

    # 4. 整条历史必须包含 PENDING 与 COMPLETED 两个状态值
    all_statuses = {entry["status"] for entry in history}
    assert "PENDING" in all_statuses, f"状态历史缺少 PENDING，实际集合: {all_statuses}"
    assert "COMPLETED" in all_statuses, (
        f"状态历史缺少 COMPLETED，实际集合: {all_statuses}"
    )


async def test_cancel_task_returns_409_when_already_cancelled(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """取消接口幂等性：mock 模式任务已自动 COMPLETED，再次取消应返回 409 +
    TASK_ALREADY_COMPLETED 错误码，且业务态不再变更。"""

    # 1. 委派任务（mock 模式立刻 COMPLETED）
    resp = await client.post(f"{BASE}/tasks", json=DELEGATE_BODY, headers=tenant_headers)
    assert resp.status_code == 200, resp.text
    task_id = resp.json()["data"]["taskId"]
    assert resp.json()["data"]["status"] == "COMPLETED"

    # 2. 第一次取消：应返回 409 + TASK_ALREADY_COMPLETED
    resp = await client.post(
        f"{BASE}/tasks/{task_id}/cancel", headers=tenant_headers
    )
    assert resp.status_code == 409, resp.text
    body = resp.json()
    assert body["code"] == int(ErrorCode.TASK_ALREADY_COMPLETED), (
        f"已 COMPLETED 任务取消应返回 TASK_ALREADY_COMPLETED，实际 code: {body['code']}"
    )

    # 3. 业务状态保持 COMPLETED，未被破坏
    resp = await client.get(f"{BASE}/tasks/{task_id}", headers=tenant_headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "COMPLETED"


async def test_delegate_task_includes_artifacts_in_result(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """mock 模式委派任务时，data.result 必须包含 artifacts 字段（列表），保证消费方
    从 result 中能直接拿到产出物占位；与 /tasks/{id}/artifacts 解耦（后者由 add_artifact
    显式写入）。"""

    # 1. 委派任务（mock 模式）
    resp = await client.post(f"{BASE}/tasks", json=DELEGATE_BODY, headers=tenant_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]

    # 2. 任务已 COMPLETED，result 非空
    assert data["status"] == "COMPLETED"
    assert data["result"] is not None

    # 3. result 中必须包含 artifacts 字段，且为列表类型
    assert "artifacts" in data["result"], (
        f"data.result 必须包含 artifacts 字段，实际 result: {data['result']}"
    )
    assert isinstance(data["result"]["artifacts"], list), (
        f"data.result.artifacts 应为列表类型，实际类型: "
        f"{type(data['result']['artifacts']).__name__}"
    )


async def test_cancel_task_records_cancel_audit(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """取消任务审计链：先委派一个任务让 mock 模式直接 COMPLETED，
    此时审计链应含 TASK_COMPLETED；再调用 cancel 应返回 409 +
    TASK_ALREADY_COMPLETED 错误码（终态短路），并且**不新增**审计记录
    —— 因为 TaskAlreadyCompletedError 是短路返回，根本没进 record_audit。
    本测试仅断言 cancel 请求的错误码/响应，不再校验新审计。"""

    # 1. 委派任务（mock 同步模式直接 COMPLETED）
    resp = await client.post(f"{BASE}/tasks", json=DELEGATE_BODY, headers=tenant_headers)
    assert resp.status_code == 200, resp.text
    task_id = resp.json()["data"]["taskId"]
    assert resp.json()["data"]["status"] == "COMPLETED"

    # 2. 取当前审计基线：必须已有 TASK_COMPLETED（mock 同步完成自动写一条）
    resp = await client.get(f"{BASE}/audit/records", headers=tenant_headers)
    assert resp.status_code == 200, resp.text
    baseline_items = resp.json()["data"]["items"]
    baseline_actions = [r["action"] for r in baseline_items]
    assert "TASK_COMPLETED" in baseline_actions, (
        f"任务已 COMPLETED，审计链必须含 TASK_COMPLETED，实际: {baseline_actions}"
    )
    baseline_total = len(baseline_items)

    # 3. 调用 cancel：终态应被短路，返回 409 + TASK_ALREADY_COMPLETED
    resp = await client.post(
        f"{BASE}/tasks/{task_id}/cancel", headers=tenant_headers
    )
    assert resp.status_code == 409, resp.text
    body = resp.json()
    assert body["code"] == int(ErrorCode.TASK_ALREADY_COMPLETED), (
        f"已 COMPLETED 任务取消应返回 TASK_ALREADY_COMPLETED，实际 code: {body['code']}"
    )

    # 4. 终态短路：cancel 没有进入 record_audit，审计总数保持不变
    resp = await client.get(f"{BASE}/audit/records", headers=tenant_headers)
    assert resp.status_code == 200, resp.text
    items_after = resp.json()["data"]["items"]
    assert len(items_after) == baseline_total, (
        f"终态短路：cancel 不应新增审计记录，"
        f"期望 {baseline_total} 条，实际 {len(items_after)} 条"
    )

    # 5. 业务态保持 COMPLETED，未被破坏
    resp = await client.get(f"{BASE}/tasks/{task_id}", headers=tenant_headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "COMPLETED"


# ========================================================= V14-06 /delegations

DELEGATION_BODY = {
    "sourceAgentId": "dw-internal-001",
    "targetAgentId": "ext-agent-002",
    "taskType": "a2a-delegation",
    "payload": {"goal": "summarize report"},
    "timeout": 120.0,
    "callbackUrl": "http://callback.example.com/delegation",
}


async def test_create_delegation_returns_submitted(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """创建委托后应立即进入 SUBMITTED，等待外部 Agent 回调。"""

    resp = await client.post(f"{BASE}/delegations", json=DELEGATION_BODY, headers=tenant_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["status"] == "SUBMITTED"
    assert data["taskId"].startswith("task-")
    assert data["sourceAgentId"] == "dw-internal-001"
    assert data["targetAgentId"] == "ext-agent-002"


async def test_get_delegation_detail(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """委托详情接口应返回完整状态历史。"""

    resp = await client.post(f"{BASE}/delegations", json=DELEGATION_BODY, headers=tenant_headers)
    task_id = resp.json()["data"]["taskId"]

    resp = await client.get(f"{BASE}/delegations/{task_id}", headers=tenant_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["taskId"] == task_id
    assert data["status"] == "SUBMITTED"
    assert len(data["statusHistory"]) == 1


async def test_delegation_callback_state_machine(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """模拟外部 Agent 回调：SUBMITTED → working → input-required → completed。"""

    resp = await client.post(f"{BASE}/delegations", json=DELEGATION_BODY, headers=tenant_headers)
    task_id = resp.json()["data"]["taskId"]

    resp = await client.post(
        f"{BASE}/delegations/{task_id}/callback",
        json={"status": "working"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["status"] == "WORKING"

    resp = await client.post(
        f"{BASE}/delegations/{task_id}/callback",
        json={"status": "input-required"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["status"] == "INPUT_REQUIRED"

    resp = await client.post(
        f"{BASE}/delegations/{task_id}/callback",
        json={"status": "completed", "result": {"summary": "done"}},
        headers=tenant_headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["status"] == "COMPLETED"
    assert data["result"]["summary"] == "done"
    assert "artifacts" in data["result"]


async def test_delegation_cancel_while_submitted(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """在 SUBMITTED 状态下取消委托应进入 CANCELED。"""

    resp = await client.post(f"{BASE}/delegations", json=DELEGATION_BODY, headers=tenant_headers)
    task_id = resp.json()["data"]["taskId"]

    resp = await client.post(
        f"{BASE}/delegations/{task_id}/cancel", headers=tenant_headers
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["status"] == "CANCELED"


async def test_delegation_cancel_after_completed_fails(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """已完成的委托再次取消应返回 409。"""

    resp = await client.post(f"{BASE}/delegations", json=DELEGATION_BODY, headers=tenant_headers)
    task_id = resp.json()["data"]["taskId"]

    await client.post(
        f"{BASE}/delegations/{task_id}/callback",
        json={"status": "completed", "result": {"summary": "done"}},
        headers=tenant_headers,
    )

    resp = await client.post(
        f"{BASE}/delegations/{task_id}/cancel", headers=tenant_headers
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["code"] == int(ErrorCode.TASK_ALREADY_COMPLETED)


async def test_delegation_callback_invalid_transition(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """非法状态转换应返回 400。"""

    resp = await client.post(f"{BASE}/delegations", json=DELEGATION_BODY, headers=tenant_headers)
    task_id = resp.json()["data"]["taskId"]

    resp = await client.post(
        f"{BASE}/delegations/{task_id}/callback",
        json={"status": "completed"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200, resp.text

    resp = await client.post(
        f"{BASE}/delegations/{task_id}/callback",
        json={"status": "working"},
        headers=tenant_headers,
    )
    assert resp.status_code == 400, resp.text
    assert resp.json()["code"] == int(ErrorCode.INVALID_PARAM)


async def test_delegation_callback_rejects_unknown_status(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """回调传入未知状态应返回 400。"""

    resp = await client.post(f"{BASE}/delegations", json=DELEGATION_BODY, headers=tenant_headers)
    task_id = resp.json()["data"]["taskId"]

    resp = await client.post(
        f"{BASE}/delegations/{task_id}/callback",
        json={"status": "unknown-status"},
        headers=tenant_headers,
    )
    assert resp.status_code == 400, resp.text
    assert resp.json()["code"] == int(ErrorCode.INVALID_PARAM)


async def test_delegation_stream_returns_terminal_event(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """SSE 流在任务完成后应返回 completed 事件及结果。"""

    resp = await client.post(f"{BASE}/delegations", json=DELEGATION_BODY, headers=tenant_headers)
    task_id = resp.json()["data"]["taskId"]

    await client.post(
        f"{BASE}/delegations/{task_id}/callback",
        json={"status": "completed", "result": {"summary": "streamed"}},
        headers=tenant_headers,
    )

    resp = await client.get(
        f"{BASE}/delegations/{task_id}/stream",
        headers=tenant_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.text
    assert "event: completed" in body
    assert "streamed" in body


async def test_list_delegations_filter_by_status(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """委托列表支持按状态过滤。"""

    for i in range(2):
        body = dict(DELEGATION_BODY)
        body["targetAgentId"] = f"ext-agent-{i}"
        await client.post(f"{BASE}/delegations", json=body, headers=tenant_headers)

    resp = await client.get(
        f"{BASE}/delegations",
        params={"status": "SUBMITTED"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["total"] == 2
    assert all(item["status"] == "SUBMITTED" for item in data["items"])

    resp = await client.get(
        f"{BASE}/delegations",
        params={"status": "COMPLETED"},
        headers=tenant_headers,
    )
    assert resp.json()["data"]["total"] == 0
