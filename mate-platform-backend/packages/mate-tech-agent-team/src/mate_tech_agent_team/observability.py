"""Agent 层的**结构化观测记录**（C-7 / `MP-OBSERVABILITY-DEEPEN-01`）。

**先说清楚它是什么、不是什么**，免得下游把日志当成 OTel 用：

* 它**是**一套无依赖的 span 记录器：每一次记录都是**一行结构化 JSON**，带上
  统一的关联键（``tenant_id / run_id / task_id / trace_id / conversation_id``）
  与"这是哪一层"的标签。日志管道把它当普通 JSON 行收走即可查询、聚合。
* 它**不是** OpenTelemetry 导出。本服务此前**没有任何埋点**——``grep`` 只在
  Dockerfile 里命中装好的 otel 包，代码里一次 ``get_tracer`` 都没有
  （``mate_platform.observability.tracing.setup_tracing`` 只是建了个 provider，
  没有任何调用方，也没有 exporter）。所以这一批交付的是**记录格式与埋点位置**；
  把同一批记录接到真 OTLP exporter 是**接线**问题（包已在镜像里），不是再写
  一套埋点。**没发 OTel span 就不说发了 OTel span。**

**八层 span**（roadmap C-7 点名的那八层，见下面的 ``SPAN_*`` 常量）：

```text
agent.run  一轮运行的总起落（终态）
└─ plan    拆任务图
└─ wave    一波（dispatch → 全部回来）
   └─ subagent  一个数字员工跑一件子任务
      ├─ llm    一轮模型调用（含 token 计量）
      └─ tool   一次工具调用（含耗时）
└─ approval 人工闸门的建立与决定
└─ artifact 一件交付物落库
```

**关联键是这一批的重点**：一条记录只有带上这五个键，跨层才拼得回一次交付。
``trace_id`` 在 ``BrainService.start`` 生成、随状态落检查点，于是**重启后续跑**
的记录仍带着同一个 trace（这是它比"日志里带个进程内 id"强的地方）。
``conversation_id`` 在**图这一层拿不到**——会话↔run 的关系由运行控制面写
（C-1），而 ``api/run_control.py`` 不在本工作流的可改范围；所以这里如实留空并
在边界登记里写明，不编一个。

**记录器绝不反噬业务**：:func:`emit` 吞掉记录器的任何异常——观测挂掉不该让一轮
交付挂掉。这是可观测性代码与业务代码之间唯一正确的失败方向。
"""

from __future__ import annotations

import json
import logging
import time
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any, Protocol

# ── 八层 span ────────────────────────────────────────────────────────────

SPAN_AGENT_RUN = "agent.run"
SPAN_PLAN = "plan"
SPAN_WAVE = "wave"
SPAN_SUBAGENT = "subagent"
SPAN_LLM = "llm"
SPAN_TOOL = "tool"
SPAN_APPROVAL = "approval"
SPAN_ARTIFACT = "artifact"

SPAN_KINDS: tuple[str, ...] = (
    SPAN_AGENT_RUN,
    SPAN_PLAN,
    SPAN_WAVE,
    SPAN_SUBAGENT,
    SPAN_LLM,
    SPAN_TOOL,
    SPAN_APPROVAL,
    SPAN_ARTIFACT,
)

#: 记录走这个 logger。**单独一个名字**：运维可以只把它接到日志管道，不必把
#: 服务的全部日志一起搬。
SPAN_LOGGER_NAME = "metaplatform.agent_team.spans"

# ── 失败类别（低基数，供告警聚合；不是自由文本）─────────────────────────

FAILURE_PROFILE_NOT_FOUND = "profile_not_found"
FAILURE_DEPTH_EXCEEDED = "depth_exceeded"
FAILURE_AUTHORITY = "authority"
FAILURE_RUNTIME_UNAVAILABLE = "runtime_unavailable"
FAILURE_MODEL_ERROR = "model_error"
FAILURE_TOOL_ERROR = "tool_error"
FAILURE_INVALID_OUTPUT = "invalid_output"
FAILURE_TIMEOUT = "timeout"

#: 子任务 ``error_code``（可判定的失败类别）→ 观测口径的失败类别。
#: 两套词表**刻意分开**：``error_code`` 是给调用方分支用的（稳定、进契约），
#: ``failure_category`` 是给指标聚合用的（低基数）。混成一套迟早要为一个
#: 指标名去改对外契约。
_ERROR_CODE_CATEGORIES: Mapping[str, str] = {
    "E_PROFILE_NOT_FOUND": FAILURE_PROFILE_NOT_FOUND,
    "E_DEPTH_EXCEEDED": FAILURE_DEPTH_EXCEEDED,
    "E_AUTHORITY_ESCALATION": FAILURE_AUTHORITY,
    "E_RUNTIME_UNAVAILABLE": FAILURE_RUNTIME_UNAVAILABLE,
}


def category_for_error_code(error_code: str) -> str:
    """``error_code`` → ``failure_category``（认不出来就是空串，**不猜**）。"""
    return _ERROR_CODE_CATEGORIES.get(error_code, "")


# ── 关联键 ───────────────────────────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class Correlation:
    """一次交付的五个关联键（C-7 的统一口径）。

    默认全空串是**有意**的：拿不到就留空，而不是编一个 id 出来——编出来的 id
    会让"这条日志属于哪一轮"看起来有答案，其实没有。
    """

    tenant_id: str = ""
    run_id: str = ""
    task_id: str = ""
    trace_id: str = ""
    conversation_id: str = ""

    def as_dict(self) -> dict[str, str]:
        return {
            "tenant_id": self.tenant_id,
            "run_id": self.run_id,
            "task_id": self.task_id,
            "trace_id": self.trace_id,
            "conversation_id": self.conversation_id,
        }

    def with_task(self, task_id: str) -> Correlation:
        """下钻一件子任务（其余键不变）。"""
        return Correlation(
            tenant_id=self.tenant_id,
            run_id=self.run_id,
            task_id=task_id,
            trace_id=self.trace_id,
            conversation_id=self.conversation_id,
        )


@dataclass(frozen=True, slots=True)
class SpanRecord:
    """一行记录：哪一层、什么时候、多久、什么结果、带着哪些属性。"""

    kind: str
    correlation: Correlation
    name: str = ""
    duration_ms: int = 0
    status: str = "ok"
    attributes: Mapping[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """落到日志里的那一份。关联键**平铺在顶层**——日志管道按顶层字段建索引
        最省事，塞进嵌套对象里就得配解析规则。"""
        return {
            "span": self.kind,
            "name": self.name,
            "durationMs": int(self.duration_ms),
            "status": self.status,
            **self.correlation.as_dict(),
            "attributes": dict(self.attributes),
        }


class SpanRecorder(Protocol):
    """记录面的协议（与其余模块同一条纪律：实现可换，语义一致）。"""

    def record(self, span: SpanRecord) -> None: ...


class NullRecorder:
    """**默认实现**：什么都不做。

    默认必须是它——本服务 500+ 条既有用例不注入记录器，行为因此与加这一批之前
    **逐字一致**（观测是附加物，不该改变任何一条既有判定的结果）。
    """

    def record(self, span: SpanRecord) -> None:  # pragma: no cover - 空实现
        return None


class LoggingSpanRecorder:
    """把每一行记录写成一条 JSON 日志（生产装配用这个）。"""

    def __init__(self, logger: logging.Logger | None = None) -> None:
        self._logger = logger or logging.getLogger(SPAN_LOGGER_NAME)

    def record(self, span: SpanRecord) -> None:
        # ``json.dumps`` 之后当作**一个** msg 打出去：多行/多字段的结构化日志
        # 各家管道解析规则不同，一行一个 JSON 对象是通吃的那一种。
        self._logger.info(json.dumps(span.to_dict(), ensure_ascii=False, default=str))


class InMemorySpanRecorder:
    """进程内留痕（测试与本地排查用）。"""

    def __init__(self) -> None:
        self.spans: list[SpanRecord] = []

    def record(self, span: SpanRecord) -> None:
        self.spans.append(span)

    def of_kind(self, kind: str) -> list[SpanRecord]:
        return [span for span in self.spans if span.kind == kind]


def elapsed_ms(started: float) -> int:
    """``perf_counter()`` 起算到现在的毫秒数（取整，最小 0）。"""
    return max(0, int((time.perf_counter() - started) * 1000))


def emit(
    recorder: SpanRecorder | None,
    kind: str,
    *,
    correlation: Correlation,
    name: str = "",
    duration_ms: int = 0,
    status: str = "ok",
    attributes: Mapping[str, Any] | None = None,
) -> None:
    """记一行。**绝不抛**——观测挂掉不该把一轮交付带下去（唯一的正确失败方向）。

    ``recorder is None`` 时直接返回（调用方不必到处判空）。
    """
    if recorder is None:
        return
    try:
        recorder.record(
            SpanRecord(
                kind=kind,
                correlation=correlation,
                name=name,
                duration_ms=duration_ms,
                status=status,
                attributes=dict(attributes or {}),
            )
        )
    except Exception:
        return


__all__ = [
    "FAILURE_AUTHORITY",
    "FAILURE_DEPTH_EXCEEDED",
    "FAILURE_INVALID_OUTPUT",
    "FAILURE_MODEL_ERROR",
    "FAILURE_PROFILE_NOT_FOUND",
    "FAILURE_RUNTIME_UNAVAILABLE",
    "FAILURE_TIMEOUT",
    "FAILURE_TOOL_ERROR",
    "SPAN_AGENT_RUN",
    "SPAN_APPROVAL",
    "SPAN_ARTIFACT",
    "SPAN_KINDS",
    "SPAN_LLM",
    "SPAN_LOGGER_NAME",
    "SPAN_PLAN",
    "SPAN_SUBAGENT",
    "SPAN_TOOL",
    "SPAN_WAVE",
    "Correlation",
    "InMemorySpanRecorder",
    "LoggingSpanRecorder",
    "NullRecorder",
    "SpanRecord",
    "SpanRecorder",
    "category_for_error_code",
    "elapsed_ms",
    "emit",
]
