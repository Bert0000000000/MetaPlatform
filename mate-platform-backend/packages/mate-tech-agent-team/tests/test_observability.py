"""C-7 / `MP-OBSERVABILITY-DEEPEN-01` · Span 分层 + token / 成本 / 延迟计量。

**先说清楚验的是什么**：验的是**结构化日志记录**的格式与埋点，不是 OTel 导出
（本服务没有 OTel 埋点，理由写在 :mod:`mate_tech_agent_team.observability` 的
模块头）。所以这里的断言是"记录里有这些字段、关联键齐且一致"，**不是**
"trace 能在 Jaeger 里看见"。

三条判据：

1. **八层 span**里本服务真的会走到的那几层各有记录，且都带同一组关联键
   （``tenant_id / run_id / task_id / trace_id / conversation_id``）；
2. **计量**：token 三类与耗时按**真的拿得到**的值落进回执（拿不到就是 0，
   不编）；
3. **记录绝不反噬业务**：记录器抛异常时业务照跑（``emit`` 吞掉）。
"""

from __future__ import annotations

import json
import logging
import time
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import HumanMessage
from mate_tech_agent_team import (
    BrainService,
    InMemoryArtifacts,
    InMemoryCheckpointerProvider,
    InMemoryTeamTasks,
    ProfileRegistry,
    StaticPlanner,
    SubTask,
    SubTaskResult,
    TeamBus,
)
from mate_tech_agent_team.chat_model import LlmgwChatModel, RunTrace, usage_tokens
from mate_tech_agent_team.main import create_app
from mate_tech_agent_team.observability import (
    FAILURE_AUTHORITY,
    SPAN_AGENT_RUN,
    SPAN_APPROVAL,
    SPAN_ARTIFACT,
    SPAN_KINDS,
    SPAN_LLM,
    SPAN_LOGGER_NAME,
    SPAN_PLAN,
    SPAN_SUBAGENT,
    SPAN_WAVE,
    Correlation,
    InMemorySpanRecorder,
    LoggingSpanRecorder,
    NullRecorder,
    SpanRecord,
    category_for_error_code,
    emit,
)

TENANT = "tenant-acme"
RUN_ID = "run-c7-0001"
BASE = "/api/v1/agent-team"

#: 关联键的**统一口径**（五元组）。少一个就等于这条记录拼不回一次交付。
CORRELATION_KEYS = frozenset({"tenant_id", "run_id", "task_id", "trace_id", "conversation_id"})

#: 停在闸门或终态（受理制下"提交"与"有结果"是两件事）。
_SETTLED = frozenset({"awaiting_approval", "completed", "failed", "cancelled", "timeout"})


class _AccountingRuntime:
    """交一份带完整计量的回执（模拟 ``LlmEmployeeRuntime`` 的成功路径）。

    **不调真模型**：这一层验的是"计量字段从运行时一路带得出去"；真 token 的
    归一化由 :class:`LlmgwChatModel` 那一层单独验（见下）。
    """

    async def run(self, *, subtask: SubTask, tenant_id: str) -> SubTaskResult:
        return SubTaskResult(
            task_id=subtask["task_id"],
            team_task_id=subtask.get("team_task_id", ""),
            profile_id=subtask["profile_id"],
            status="ok",
            output=f"# {subtask['profile_id']} 的分析报告\n\n结论：异常订单 3 笔。",
            llm_calls=2,
            source="llm",
            runtime_kind="superai",
            model="glm-5.3-flash",
            prompt_digest="deadbeefdeadbeef",
            input_tokens=1200,
            output_tokens=340,
            cached_tokens=64,
            latency_ms=1500,
            llm_latency_ms=1200,
            tool_latency_ms=180,
        )


def _service(recorder: Any, *, bus: TeamBus | None = None) -> BrainService:
    return BrainService(
        planner_for=lambda _ctx: StaticPlanner(),
        runtime_for=lambda _ctx: _AccountingRuntime(),
        checkpointer=InMemoryCheckpointerProvider(),
        team_bus=bus or TeamBus(registry=ProfileRegistry(), tasks=InMemoryTeamTasks()),
        artifacts=InMemoryArtifacts(),
        recorder=recorder,
    )


def _wait_settled(
    client: TestClient, run_id: str, token: str, timeout: float = 8.0
) -> dict[str, Any]:
    headers = {"Authorization": f"Bearer {token}"}
    body: dict[str, Any] = {}
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        body = client.get(f"{BASE}/runs/{run_id}", headers=headers).json()
        if body.get("status") in _SETTLED:
            return body
        time.sleep(0.02)
    return body


# ── 记录器本身 ──────────────────────────────────────────────────────────


def test_the_correlation_tuple_is_the_documented_five() -> None:
    assert set(Correlation().as_dict()) == CORRELATION_KEYS
    # 下钻一件子任务时只有 task_id 变——trace 不能跟着变，否则拼不回一次交付
    child = Correlation(tenant_id="t", run_id="r", trace_id="tr").with_task("t1")
    assert child.task_id == "t1"
    assert (child.tenant_id, child.run_id, child.trace_id) == ("t", "r", "tr")


def test_the_span_kinds_are_exactly_the_documented_eight() -> None:
    assert set(SPAN_KINDS) == {
        "agent.run",
        "plan",
        "wave",
        "subagent",
        "llm",
        "tool",
        "approval",
        "artifact",
    }


def test_the_logging_recorder_writes_one_json_line_with_flat_correlation(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """一行一个 JSON 对象，**关联键平铺在顶层**（日志管道按顶层字段建索引最省事）。"""
    recorder = LoggingSpanRecorder()
    with caplog.at_level(logging.INFO, logger=SPAN_LOGGER_NAME):
        recorder.record(
            SpanRecord(
                kind=SPAN_SUBAGENT,
                correlation=Correlation(
                    tenant_id="t-1", run_id="r-1", task_id="t1", trace_id="tr-1"
                ),
                duration_ms=42,
                attributes={"k": "v"},
            )
        )
    assert len(caplog.records) == 1
    payload = json.loads(caplog.records[0].message)
    assert payload["span"] == SPAN_SUBAGENT
    assert payload["durationMs"] == 42
    assert set(payload) >= CORRELATION_KEYS
    assert payload["attributes"] == {"k": "v"}


def test_emit_never_raises_when_the_recorder_blows_up() -> None:
    """唯一正确的失败方向：观测挂掉不能把业务带下去。"""

    class _Broken:
        def record(self, span: SpanRecord) -> None:
            raise RuntimeError("记录器坏了")

    emit(_Broken(), SPAN_PLAN, correlation=Correlation())  # 不抛就是通过
    emit(None, SPAN_PLAN, correlation=Correlation())  # 没接记录器同理
    NullRecorder().record(SpanRecord(kind=SPAN_PLAN, correlation=Correlation()))  # 空实现


def test_failure_categories_are_low_cardinality_and_reuse_error_codes() -> None:
    assert category_for_error_code("E_AUTHORITY_ESCALATION") == FAILURE_AUTHORITY
    assert category_for_error_code("E_RUNTIME_UNAVAILABLE") == "runtime_unavailable"
    # 认不出来就是空串——**不猜**（猜出来的类别会让告警聚合失真）
    assert category_for_error_code("E_SOMETHING_NEW") == ""


# ── 模型面的 token 计量 ─────────────────────────────────────────────────


class _Gateway:
    """假 llmgw：回包里带 OpenAI 形状的 ``usage``（含缓存明细）。"""

    def __init__(self, usage: dict[str, Any] | None = None) -> None:
        self.usage = usage if usage is not None else {}
        self.calls = 0

    async def chat_with_tools(self, **_: Any) -> dict[str, Any]:
        self.calls += 1
        return {"content": "结论：3 笔。", "model": "glm-5.3-flash", "usage": self.usage}


def test_usage_tokens_reads_the_openai_shape_and_stays_honest_when_absent() -> None:
    assert usage_tokens({"prompt_tokens": 7, "completion_tokens": 3}) == (7, 3, 0)
    assert usage_tokens(
        {"prompt_tokens": 7, "completion_tokens": 3, "prompt_tokens_details": {"cached_tokens": 2}}
    ) == (7, 3, 2)
    # 没有 / 形状不对 = 0，**不编**
    assert usage_tokens(None) == (0, 0, 0)
    assert usage_tokens({"prompt_tokens": "seven"}) == (0, 0, 0)


@pytest.mark.asyncio
async def test_the_llm_span_carries_tokens_and_run_trace_accumulates_them() -> None:
    recorder = InMemorySpanRecorder()
    correlation = Correlation(tenant_id="t-1", run_id="r-1", task_id="t1", trace_id="tr-1")
    model = LlmgwChatModel(
        gateway=_Gateway(
            {
                "prompt_tokens": 7,
                "completion_tokens": 3,
                "prompt_tokens_details": {"cached_tokens": 2},
            }
        ),
        llm_model="glm-5.3-flash",
        trace=RunTrace(),
        recorder=recorder,
        correlation=correlation,
    )
    await model.ainvoke([HumanMessage(content="分析一下")])

    spans = recorder.of_kind(SPAN_LLM)
    assert len(spans) == 1
    assert spans[0].attributes["inputTokens"] == 7
    assert spans[0].attributes["outputTokens"] == 3
    assert spans[0].attributes["cachedTokens"] == 2
    assert spans[0].correlation.trace_id == "tr-1"
    # 绑定过工具的副本共用同一个 trace（``bind_tools`` 走 model_copy），计量才不丢
    assert model.trace.input_tokens == 7
    assert model.trace.output_tokens == 3
    assert model.trace.cached_tokens == 2
    assert model.trace.latency_ms >= 0


# ── 图上的分层记录 ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_the_graph_emits_its_layers_under_one_trace(admin_token: str) -> None:
    recorder = InMemorySpanRecorder()
    service = _service(recorder)

    state = await service.start(
        tenant_id=TENANT, goal="找出本月异常订单", user_token=admin_token, run_id=RUN_ID
    )
    trace_id = str(state["trace_id"])
    assert trace_id, "开跑就该有 trace_id（C-7 的关联键之一）"

    kinds = {span.kind for span in recorder.spans}
    assert {SPAN_PLAN, SPAN_WAVE, SPAN_SUBAGENT, SPAN_ARTIFACT} <= kinds
    assert SPAN_AGENT_RUN not in kinds, "run 还停在闸门，收官记录不该提前出现"

    # 审批 + 续跑到收官：``approval`` 与终态 ``agent.run`` 两层这时才有
    resumed = await service.resume(
        tenant_id=TENANT, run_id=RUN_ID, approved=True, user_token=admin_token
    )
    assert resumed["status"] == "completed"
    kinds = {span.kind for span in recorder.spans}
    assert {SPAN_APPROVAL, SPAN_AGENT_RUN} <= kinds

    # 关联键：五元组齐，且 tenant / run / trace 跨层**一致**（这就是"拼得回去"）
    for span in recorder.spans:
        assert set(span.correlation.as_dict()) == CORRELATION_KEYS
        assert span.correlation.tenant_id == TENANT
        assert span.correlation.run_id == RUN_ID
        assert span.correlation.trace_id == trace_id
    # 子任务层带着 task_id，run 级的不带——层级就是这样表达的
    assert {span.correlation.task_id for span in recorder.of_kind(SPAN_SUBAGENT)} == {
        "t1",
        "t2",
        "t3",
    }
    assert all(span.correlation.task_id == "" for span in recorder.of_kind(SPAN_WAVE))
    # ``conversation_id`` 在图里拿不到（会话↔run 关系在运行控制面 C-1，本工作流
    # 不改它）——**留空**，不编一个
    assert all(span.correlation.conversation_id == "" for span in recorder.spans)
    # 子任务记录带着运行时报上来的执行面（不是图自己猜的）
    assert {span.attributes.get("runtimeKind") for span in recorder.of_kind(SPAN_SUBAGENT)} == {
        "superai"
    }


# ── HTTP 面：回执带着计量与 trace ───────────────────────────────────────


@pytest.fixture
def bus() -> TeamBus:
    return TeamBus(registry=ProfileRegistry(), tasks=InMemoryTeamTasks())


@pytest.fixture
def client(bus: TeamBus) -> Iterator[TestClient]:
    """同一个 bus 交给服务与 HTTP 面（两个实例等于两个信箱）。"""
    with TestClient(
        create_app(service=_service(InMemorySpanRecorder(), bus=bus), team_bus=bus)
    ) as app:
        yield app


def test_the_run_state_exposes_the_trace_and_accounting(
    client: TestClient, admin_token: str
) -> None:
    accepted = client.post(
        f"{BASE}/runs",
        json={"goal": "找出本月异常订单"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert accepted.status_code == 202, accepted.text
    run_id = str(accepted.json()["run_id"])
    body = _wait_settled(client, run_id, admin_token)
    assert body["status"] == "awaiting_approval", body

    assert body["trace_id"], body
    row = next(iter(body["results"].values()))
    assert row["runtime_kind"] == "superai"
    assert row["model"] == "glm-5.3-flash"
    assert row["prompt_digest"] == "deadbeefdeadbeef"
    assert (row["input_tokens"], row["output_tokens"], row["cached_tokens"]) == (1200, 340, 64)
    assert row["latency_ms"] == 1500
    assert row["llm_latency_ms"] == 1200
    assert row["tool_latency_ms"] == 180
    assert row["failure_category"] == ""
