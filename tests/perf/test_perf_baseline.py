"""V11-12 性能基线测试套件。

覆盖 7 个核心 API，每个 API 至少 20 次调用，断言 P95 < 500ms：

- TECH-DATA（真实 ASGI）
    * GET  /api/v1/data/quality/overview
    * GET  /api/v1/data/lineage
- TECH-AGENT（真实 ASGI）
    * POST /api/v1/agent/evaluations/conversations/{id}/auto-score
    * POST /api/v1/agent/evaluations/aggregate-report
- TECH-RULE（Mock FastAPI）
    * POST /api/v1/rule/decision-tables/{id}/execute
- TECH-WFE（Mock FastAPI）
    * GET  /api/v1/apphub/apps/{id}/versions
    * POST /api/v1/apphub/versions/{id}/publish

运行方式：
    pytest tests/perf/                      # 默认 20 次/API
    pytest tests/perf/ --perf-iterations=50  # 自定义迭代次数

测试在 session 结束时打印统一报告表。
"""

from __future__ import annotations

import sys
from pathlib import Path

# Ensure tests/perf/ is on sys.path so perf_stats is importable.
_HERE = str(Path(__file__).resolve().parent)
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

from perf_stats import (
    P95_THRESHOLD_MS,
    measure,
)


# =====================================================================
# 模块级辅助
# =====================================================================


def _conv_body(conv_id: str, employee_id: str = "emp-perf") -> dict:
    """构造一条评估对话记录。"""
    return {
        "conversationId": conv_id,
        "employeeId": employee_id,
        "taskId": "task-perf",
        "messages": [
            {
                "id": "msg-1",
                "role": "user",
                "content": "我的订单什么时候发货？",
                "timestamp": "2026-07-20T10:00:00Z",
            },
            {
                "id": "msg-2",
                "role": "assistant",
                "content": "您的订单已在配送中，预计今日送达。",
                "timestamp": "2026-07-20T10:00:30Z",
            },
        ],
    }


async def _seed_one_scored_conv(client, headers: dict, conv_id: str, emp: str) -> None:
    """保存一条对话并自动评分，用于准备 aggregate-report 测试数据。"""
    r1 = await client.post(
        "/api/v1/agent/evaluations/conversations",
        json=_conv_body(conv_id, emp),
        headers=headers,
    )
    assert r1.status_code == 200, r1.text
    r2 = await client.post(
        f"/api/v1/agent/evaluations/conversations/{conv_id}/auto-score",
        json={},
        headers=headers,
    )
    assert r2.status_code == 200, r2.text


# =====================================================================
# TECH-DATA: GET /api/v1/data/quality/overview
# =====================================================================


async def test_perf_data_quality_overview(
    data_client,
    tenant_headers: dict[str, str],
    perf_iterations: int,
    make_stats,
):
    """GET /api/v1/data/quality/overview 性能基线（空状态，无副作用）。

    期望 P95 < 500ms。
    """
    api = "GET /api/v1/data/quality/overview"
    stats = make_stats(api)
    url = "/api/v1/data/quality/overview"

    async def _call():
        r = await data_client.get(url, headers=tenant_headers)
        assert r.status_code == 200, r.text

    # 一次预热（不计时），触发首次 import / JIT 路径
    await _call()
    # 真正的测量
    await measure(_call, stats, iterations=perf_iterations)
    summary = stats.summary()
    assert summary["p95_ms"] < P95_THRESHOLD_MS, (
        f"{api} P95={summary['p95_ms']:.2f}ms 超过阈值 {P95_THRESHOLD_MS}ms"
    )


# =====================================================================
# TECH-DATA: GET /api/v1/data/lineage
# =====================================================================


async def test_perf_data_lineage(
    data_client,
    tenant_headers: dict[str, str],
    perf_iterations: int,
    make_stats,
):
    """GET /api/v1/data/lineage 性能基线（默认 scope=all）。

    期望 P95 < 500ms。
    """
    api = "GET /api/v1/data/lineage"
    stats = make_stats(api)
    url = "/api/v1/data/lineage"

    async def _call():
        r = await data_client.get(url, headers=tenant_headers)
        assert r.status_code == 200, r.text

    await _call()  # 预热
    await measure(_call, stats, iterations=perf_iterations)
    summary = stats.summary()
    assert summary["p95_ms"] < P95_THRESHOLD_MS, (
        f"{api} P95={summary['p95_ms']:.2f}ms 超过阈值 {P95_THRESHOLD_MS}ms"
    )


# =====================================================================
# TECH-AGENT: POST /evaluations/conversations/{id}/auto-score
# =====================================================================


async def test_perf_agent_auto_score(
    agent_client,
    tenant_headers: dict[str, str],
    perf_iterations: int,
    make_stats,
):
    """POST /api/v1/agent/evaluations/conversations/{id}/auto-score 性能基线。

    评分逻辑在 TECH-AGENT evaluation/service.py 中使用 md5 启发式，
    期望 P95 < 500ms。

    流程：
      1. 先保存一条 conversation（不计时）
      2. 多次调用 auto-score（评分逻辑稳定，幂等可重复）
    """
    api = "POST /evaluations/conversations/{id}/auto-score"
    stats = make_stats(api)
    conv_id = "conv-perf-auto-score"

    # 准备：保存一条 conversation
    seed_resp = await agent_client.post(
        "/api/v1/agent/evaluations/conversations",
        json=_conv_body(conv_id, "emp-perf-score"),
        headers=tenant_headers,
    )
    assert seed_resp.status_code == 200, seed_resp.text

    url = f"/api/v1/agent/evaluations/conversations/{conv_id}/auto-score"

    async def _call():
        r = await agent_client.post(url, json={}, headers=tenant_headers)
        assert r.status_code == 200, r.text

    await _call()  # 预热
    await measure(_call, stats, iterations=perf_iterations)
    summary = stats.summary()
    assert summary["p95_ms"] < P95_THRESHOLD_MS, (
        f"{api} P95={summary['p95_ms']:.2f}ms 超过阈值 {P95_THRESHOLD_MS}ms"
    )


# =====================================================================
# TECH-AGENT: POST /evaluations/aggregate-report
# =====================================================================


async def test_perf_agent_aggregate_report(
    agent_client,
    tenant_headers: dict[str, str],
    perf_iterations: int,
    make_stats,
):
    """POST /api/v1/agent/evaluations/aggregate-report 性能基线。

    先 seed 4 条 scored conversation（2 个员工各 2 条），然后多次
    调用 aggregate-report（只读聚合，幂等）。期望 P95 < 500ms。
    """
    api = "POST /evaluations/aggregate-report"
    stats = make_stats(api)

    employees = ["emp-perf-agg-a", "emp-perf-agg-b"]
    for emp in employees:
        for j in range(2):
            await _seed_one_scored_conv(
                agent_client,
                tenant_headers,
                f"conv-perf-agg-{emp}-{j}",
                emp,
            )

    payload = {
        "collaborationId": "col-perf-001",
        "employeeIds": employees,
        "period": "2026-W29",
    }

    async def _call():
        r = await agent_client.post(
            "/api/v1/agent/evaluations/aggregate-report",
            json=payload,
            headers=tenant_headers,
        )
        assert r.status_code == 200, r.text

    await _call()  # 预热
    await measure(_call, stats, iterations=perf_iterations)
    summary = stats.summary()
    assert summary["p95_ms"] < P95_THRESHOLD_MS, (
        f"{api} P95={summary['p95_ms']:.2f}ms 超过阈值 {P95_THRESHOLD_MS}ms"
    )


# =====================================================================
# TECH-RULE: POST /api/v1/rule/decision-tables/{id}/execute
# =====================================================================


async def test_perf_rule_decision_table_execute(
    rule_client,
    tenant_headers: dict[str, str],
    perf_iterations: int,
    make_stats,
):
    """POST /api/v1/rule/decision-tables/{id}/execute 性能基线（Mock Java 服务）。

    虽然是 Mock，但验证 trace_id 中间件 + 响应序列化链路的开销。
    期望 P95 < 500ms。
    """
    api = "POST /rule/decision-tables/{id}/execute"
    stats = make_stats(api)
    table_id = "dt-perf-001"
    url = f"/api/v1/rule/decision-tables/{table_id}/execute"
    payload = {"inputData": {"age": 30}}

    async def _call():
        r = await rule_client.post(url, json=payload, headers=tenant_headers)
        assert r.status_code == 200, r.text

    await _call()  # 预热
    await measure(_call, stats, iterations=perf_iterations)
    summary = stats.summary()
    assert summary["p95_ms"] < P95_THRESHOLD_MS, (
        f"{api} P95={summary['p95_ms']:.2f}ms 超过阈值 {P95_THRESHOLD_MS}ms"
    )


# =====================================================================
# TECH-WFE: GET /api/v1/apphub/apps/{id}/versions
# =====================================================================


async def test_perf_wfe_apphub_versions_list(
    wfe_client,
    tenant_headers: dict[str, str],
    perf_iterations: int,
    make_stats,
):
    """GET /api/v1/apphub/apps/{id}/versions 性能基线（Mock Java 服务）。

    期望 P95 < 500ms。
    """
    api = "GET /api/v1/apphub/apps/{id}/versions"
    stats = make_stats(api)
    app_id = "app-perf-001"
    url = f"/api/v1/apphub/apps/{app_id}/versions"

    async def _call():
        r = await wfe_client.get(url, headers=tenant_headers)
        assert r.status_code == 200, r.text

    await _call()  # 预热
    await measure(_call, stats, iterations=perf_iterations)
    summary = stats.summary()
    assert summary["p95_ms"] < P95_THRESHOLD_MS, (
        f"{api} P95={summary['p95_ms']:.2f}ms 超过阈值 {P95_THRESHOLD_MS}ms"
    )


# =====================================================================
# TECH-WFE: POST /api/v1/apphub/versions/{id}/publish
# =====================================================================


async def test_perf_wfe_apphub_version_publish(
    wfe_client,
    tenant_headers: dict[str, str],
    perf_iterations: int,
    make_stats,
):
    """POST /api/v1/apphub/versions/{id}/publish 性能基线（Mock Java 服务）。

    期望 P95 < 500ms。
    """
    api = "POST /api/v1/apphub/versions/{id}/publish"
    stats = make_stats(api)
    version_id = "v-perf-001"
    url = f"/api/v1/apphub/versions/{version_id}/publish"

    async def _call():
        r = await wfe_client.post(url, headers=tenant_headers)
        assert r.status_code == 200, r.text

    await _call()  # 预热
    await measure(_call, stats, iterations=perf_iterations)
    summary = stats.summary()
    assert summary["p95_ms"] < P95_THRESHOLD_MS, (
        f"{api} P95={summary['p95_ms']:.2f}ms 超过阈值 {P95_THRESHOLD_MS}ms"
    )
