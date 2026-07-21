"""链路10：跨服务 trace_id 传播验证 E2E 测试（V11-11）。

覆盖业务流程：
  验证请求头 X-Trace-Id 在所有服务的响应中回传

依赖服务：TECH-DATA / TECH-AGENT（Python 真实 ASGI） + TECH-RULE / TECH-WFE / TECH-EA（Java Mock）

架构约束（CLAUDE.md）：
  > trace_id 必须在所有系统组件间传播，Kafka 消息头包含 X-Trace-Id

本测试验证：
- 每个服务的响应体都包含 traceId 字段，且与请求头 X-Trace-Id 一致
- 当请求未携带 X-Trace-Id 时，服务自动生成 UUID v4 并回传
- 多服务串联调用时 trace_id 一致性
"""

from __future__ import annotations

import re
import uuid

DATA_BASE = "/api/v1/data"
AGENT_BASE = "/api/v1/agent"
RULE_BASE = "/api/v1/rule/decision-tables"
APPHUB_BASE = "/api/v1/apphub"
EA_BASE = "/api/v1/ea"


_UUID_V4_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


async def test_e2e_10_trace_id_propagation_tech_data(
    data_client,
    tenant_headers: dict[str, str],
    trace_id: str,
):
    """TECH-DATA：trace_id 在响应中回传。"""
    # GET 端点
    resp = await data_client.get(
        f"{DATA_BASE}/quality/overview", headers=tenant_headers
    )
    assert resp.status_code == 200
    assert resp.json()["traceId"] == trace_id

    # POST 端点
    resp = await data_client.get(
        f"{DATA_BASE}/lineage", headers=tenant_headers
    )
    assert resp.status_code == 200
    assert resp.json()["traceId"] == trace_id


async def test_e2e_10_trace_id_propagation_tech_agent(
    agent_client,
    tenant_headers: dict[str, str],
    trace_id: str,
):
    """TECH-AGENT：trace_id 在响应中回传。"""
    # GET 端点（rubrics 不需要任何前置数据）
    resp = await agent_client.get(
        f"{AGENT_BASE}/evaluations/rubrics", headers=tenant_headers
    )
    assert resp.status_code == 200
    assert resp.json()["traceId"] == trace_id

    # POST 端点（auto-score 不需要前置数据，会自动创建记录）
    resp = await agent_client.post(
        f"{AGENT_BASE}/evaluations/conversations/conv-trace-test/auto-score",
        json={},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["traceId"] == trace_id


async def test_e2e_10_trace_id_propagation_tech_rule(
    rule_client,
    mock_call_log,
    tenant_headers: dict[str, str],
    trace_id: str,
):
    """TECH-RULE（Java Mock）：trace_id 在响应中回传。"""
    resp = await rule_client.post(
        f"{RULE_BASE}",
        json={"name": "trace-test-table", "hitPolicy": "FIRST", "columns": []},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["traceId"] == trace_id

    # 验证请求 header 也携带了 trace_id
    assert mock_call_log.calls[-1].headers.get("X-Trace-Id") == trace_id


async def test_e2e_10_trace_id_propagation_tech_wfe(
    wfe_client,
    mock_call_log,
    tenant_headers: dict[str, str],
    trace_id: str,
):
    """TECH-WFE（Java Mock）：trace_id 在响应中回传。"""
    resp = await wfe_client.get(
        f"{APPHUB_BASE}/apps/app-trace/versions",
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["traceId"] == trace_id

    assert mock_call_log.calls[-1].headers.get("X-Trace-Id") == trace_id


async def test_e2e_10_trace_id_propagation_tech_ea(
    ea_client,
    mock_call_log,
    tenant_headers: dict[str, str],
    trace_id: str,
):
    """TECH-EA（Java Mock）：trace_id 在响应中回传。"""
    resp = await ea_client.get(
        f"{EA_BASE}/capability-mappings", headers=tenant_headers
    )
    assert resp.status_code == 200
    assert resp.json()["traceId"] == trace_id

    assert mock_call_log.calls[-1].headers.get("X-Trace-Id") == trace_id


async def test_e2e_10_trace_id_auto_generated_when_missing_tech_data(
    data_client,
):
    """请求未携带 X-Trace-Id 时，TECH-DATA 应自动生成 UUID v4 并回传。"""
    headers = {"X-Tenant-Id": "tenant-e2e"}  # 故意不传 X-Trace-Id
    resp = await data_client.get(
        f"{DATA_BASE}/quality/overview", headers=headers
    )
    assert resp.status_code == 200
    trace_id = resp.json()["traceId"]
    assert trace_id is not None
    assert _UUID_V4_RE.match(trace_id), f"trace_id 不是合法的 UUID v4: {trace_id}"


async def test_e2e_10_trace_id_auto_generated_when_missing_tech_agent(
    agent_client,
    auth_headers_no_trace: dict[str, str],
):
    """请求未携带 X-Trace-Id 时，TECH-AGENT 应自动生成 UUID v4 并回传。"""
    resp = await agent_client.get(
        f"{AGENT_BASE}/evaluations/rubrics", headers=auth_headers_no_trace
    )
    assert resp.status_code == 200
    trace_id = resp.json()["traceId"]
    assert trace_id is not None
    assert _UUID_V4_RE.match(trace_id), f"trace_id 不是合法的 UUID v4: {trace_id}"


async def test_e2e_10_trace_id_cross_service_consistency(
    data_client,
    agent_client,
    rule_client,
    wfe_client,
    ea_client,
    mock_call_log,
    tenant_headers: dict[str, str],
    trace_id: str,
):
    """跨服务串联调用：同一 trace_id 在所有服务的响应中一致回传。

    模拟一个跨服务业务场景：
    1. 在 TECH-DATA 查询血缘（获取 conceptId）
    2. 在 TECH-AGENT 创建 agent（绑定 concept）
    3. 在 TECH-RULE 创建决策表（绑定 concept）
    4. 在 TECH-WFE 创建 app 版本（绑定 agent）
    5. 在 TECH-EA 查询 capability-mapping（验证一致性）

    所有请求使用同一个 trace_id，验证每个服务都正确回传。
    """
    headers = {
        "X-Tenant-Id": "tenant-e2e",
        "X-Trace-Id": trace_id,
        "Authorization": tenant_headers["Authorization"],
    }

    # 1. TECH-DATA 血缘查询
    resp1 = await data_client.get(
        f"{DATA_BASE}/lineage?scope=customer", headers=headers
    )
    assert resp1.status_code == 200
    assert resp1.json()["traceId"] == trace_id

    # 2. TECH-AGENT 创建 agent
    resp2 = await agent_client.post(
        f"{AGENT_BASE}/agents",
        json={
            "name": "跨服务 trace 测试员工",
            "code": "e2e-agent-10-cross",
            "modelId": "doubao-pro-32k",
            "systemPrompt": "你是一个测试助手。",
            "status": "DRAFT",
        },
        headers=headers,
    )
    assert resp2.status_code == 200
    assert resp2.json()["traceId"] == trace_id

    # 3. TECH-RULE 创建决策表
    resp3 = await rule_client.post(
        f"{RULE_BASE}",
        json={"name": "cross-trace-table", "hitPolicy": "FIRST", "columns": []},
        headers=headers,
    )
    assert resp3.status_code == 200
    assert resp3.json()["traceId"] == trace_id

    # 4. TECH-WFE 创建 app 版本
    resp4 = await wfe_client.post(
        f"{APPHUB_BASE}/apps/app-cross-trace/versions",
        json={"version": "v1", "snapshot": "{}"},
        headers=headers,
    )
    assert resp4.status_code == 200
    assert resp4.json()["traceId"] == trace_id

    # 5. TECH-EA 查询 capability-mapping
    resp5 = await ea_client.get(
        f"{EA_BASE}/capability-mappings", headers=headers
    )
    assert resp5.status_code == 200
    assert resp5.json()["traceId"] == trace_id

    # 验证 Java 服务的 Mock 调用都携带了正确的 trace_id header
    for call in mock_call_log.calls:
        assert call.headers.get("X-Trace-Id") == trace_id, (
            f"调用 {call.method} {call.path} 未携带正确的 trace_id"
        )


async def test_e2e_10_trace_id_per_request_isolation(
    data_client,
    agent_client,
):
    """不同请求使用不同 trace_id，确保 trace_id 不会被错误复用。"""
    headers1 = {
        "X-Tenant-Id": "tenant-e2e",
        "X-Trace-Id": "trace-request-1",
    }
    headers2 = {
        "X-Tenant-Id": "tenant-e2e",
        "X-Trace-Id": "trace-request-2",
    }

    resp1 = await data_client.get(
        f"{DATA_BASE}/quality/overview", headers=headers1
    )
    resp2 = await agent_client.get(
        f"{AGENT_BASE}/evaluations/rubrics", headers=headers2
    )

    assert resp1.json()["traceId"] == "trace-request-1"
    assert resp2.json()["traceId"] == "trace-request-2"
    assert resp1.json()["traceId"] != resp2.json()["traceId"]


async def test_e2e_10_trace_id_uuid_v4_format_validation(
    data_client,
    agent_client,
):
    """验证自动生成的 trace_id 符合 UUID v4 格式。"""
    headers = {"X-Tenant-Id": "tenant-e2e"}

    # 多次请求，每次都应生成不同的 UUID v4
    trace_ids = set()
    for _ in range(3):
        resp = await data_client.get(
            f"{DATA_BASE}/quality/overview", headers=headers
        )
        assert resp.status_code == 200
        tid = resp.json()["traceId"]
        assert _UUID_V4_RE.match(tid), f"trace_id 不是合法的 UUID v4: {tid}"
        trace_ids.add(tid)

    # 3 次请求应生成 3 个不同的 trace_id
    assert len(trace_ids) == 3, "自动生成的 trace_id 出现重复"
