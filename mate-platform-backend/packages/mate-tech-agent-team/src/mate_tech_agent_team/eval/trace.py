"""把一次 agent-team run 的原始回执归一成可判分的 :class:`RunTrace`（C-6）。

**为什么要有这一层**：判分只能对着"一次运行到底发生了什么"，而不是对着 HTTP
响应里到处散落的字段。归一化同时是**假回执的关口**——`:func:`assert_real_provider`
在这里对每一次员工产出做三查，任一命中就抛 :class:`FakeReceiptError`。

三查（对应 llmgw 回显的两个来源 + 未接线）：

1. 产出正文含 ``[stub-fallback]`` —— llmgw 把指令抄回来了（回显）；
2. ``source == "stub"`` 而产出非空 —— **一次模型调用都没发生**却有产出；
3. ``status == "ok"`` 且 ``llm_calls == 0`` 而产出非空 —— 同上，换了个字段看。

**为什么不能只看 source**：llmgw 回显走的是 200 + 正常 JSON，agent-team 侧
``source`` 仍是 ``"llm"``（``employee.py`` 里写死）。所以判"真答了没有"必须
落到**正文字符串**与**模型轮次计数**上，而不是那个字段。
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

#: llmgw 回显的标记（``RealOpenAIProvider`` 兜底时拼进正文的那个前缀）。
STUB_MARKER = "[stub-fallback]"

#: RID 形状：``ont.<tenant>.<kind>.<slug>.<version>``（ADR-0021）。评测只认这个
#: 前缀，避免把 ``http://...`` 之类误当 RID。
_RID = re.compile(r"\bont\.[a-z0-9-]+\.[a-z0-9-]+\.[a-z0-9._-]+\.v\d+\b")

#: 侧写类工具（会改状态）。重放副作用重复数以此为口径。
_SIDE_EFFECT_PREFIXES: tuple[str, ...] = ("ont_propose", "ont_confirm", "ont_reject", "ont_execute")


class FakeReceiptError(RuntimeError):
    """产出是假回执（回显 / 零模型调用）——**不得**计入好答案。

    这不是"这个任务答得差"，而是"这次评测根本没测到模型"。两者必须分开：
    前者是质量信号，后者是 harness 失效。
    """


@dataclass(frozen=True, slots=True)
class EmployeeResult:
    task_id: str
    profile_id: str
    status: str
    output: str
    source: str
    llm_calls: int
    tool_calls: tuple[dict[str, Any], ...]
    evidence: tuple[dict[str, Any], ...]
    error_code: str
    artifacts: tuple[dict[str, Any], ...]

    @property
    def tool_names(self) -> tuple[str, ...]:
        names = []
        for call in self.tool_calls:
            name = call.get("name") or call.get("tool") or ""
            if name:
                names.append(str(name))
        return tuple(names)


def _as_dicts(raw: Any) -> tuple[dict[str, Any], ...]:
    if not isinstance(raw, list):
        return ()
    return tuple(item for item in raw if isinstance(item, dict))


def find_rids(text: str) -> tuple[str, ...]:
    """从任意文本里抽出 RID（去重、保序）。"""
    return tuple(dict.fromkeys(_RID.findall(text or "")))


def _echo_reasons(result: EmployeeResult) -> list[str]:
    """一次员工产出里所有"这是假回执"的理由（空 = 看着是真的）。"""
    reasons: list[str] = []
    if STUB_MARKER in result.output:
        reasons.append("产出正文含 [stub-fallback]（llmgw 回显）")
    has_body = bool(result.output.strip())
    if has_body and result.source == "stub":
        reasons.append("source=stub（一次模型调用都没发生）却有非空产出")
    if has_body and result.status == "ok" and result.llm_calls == 0:
        reasons.append("status=ok 且 llm_calls=0，却有非空产出")
    return reasons


@dataclass(slots=True)
class RunTrace:
    """一次 run 的可判分快照。"""

    task_id: str
    run_id: str
    goal: str
    status: str
    #: 轮询期间**观察到**的状态序列（保序去重）。判定"是否过了人工闸门"用它，
    #: 而不是只看终态——终态是 completed 也可能从没停过闸门。
    observed_statuses: tuple[str, ...]
    subtasks: tuple[dict[str, Any], ...]
    results: tuple[EmployeeResult, ...]
    summary: str
    approval_gate: dict[str, Any]
    #: 墙钟：从 POST /runs 到首次观察到"有子任务"的秒数（首响应）。
    first_response_seconds: float
    #: 墙钟：从 POST /runs 到跑到终态（或超时放弃）的总秒数。
    total_seconds: float
    #: 本次运行的原始回执（原样留档，便于事后复核）。
    raw: dict[str, Any] = field(default_factory=dict)

    # -- 派生量 ---------------------------------------------------------

    @property
    def profile_ids(self) -> tuple[str, ...]:
        """**执行过**的员工（来自回执）。"""
        return tuple(r.profile_id for r in self.results) or self.planned_profile_ids

    @property
    def planned_profile_ids(self) -> tuple[str, ...]:
        """**计划里派出去**的员工（来自 subtasks）。

        拆解完整率看的是"大脑有没有挑对人"，那是计划面的事实——所以它用这个，
        而不是执行面那个（计划对了但某件没跑成，是执行问题，不是拆解问题）。
        """
        return tuple(str(s.get("profile_id") or "") for s in self.subtasks)

    @property
    def llm_calls_total(self) -> int:
        return sum(r.llm_calls for r in self.results)

    @property
    def tool_names(self) -> tuple[str, ...]:
        return tuple(name for r in self.results for name in r.tool_names)

    @property
    def evidence_count(self) -> int:
        return sum(len(r.evidence) for r in self.results)

    @property
    def plan_text(self) -> str:
        """计划面 + 产出面的全部文本，供词法覆盖判定。"""
        parts = [str(s.get("instruction") or "") for s in self.subtasks]
        parts += [r.output for r in self.results]
        return "\n".join(parts)

    @property
    def cited_rids(self) -> tuple[str, ...]:
        """产出/证据里出现过的 RID（去重、保序）。"""
        chunks: list[str] = [r.output for r in self.results]
        for r in self.results:
            for item in r.evidence:
                chunks.append(str(item.get("ref") or ""))
                chunks.append(str(item.get("concept") or ""))
        found: list[str] = []
        for chunk in chunks:
            found.extend(find_rids(chunk))
        return tuple(dict.fromkeys(found))

    @property
    def hit_approval_gate(self) -> bool:
        return any("awaiting_approval" in s for s in self.observed_statuses) or bool(
            self.approval_gate
        )

    def echo_reasons(self) -> list[str]:
        """整轮里所有假回执的理由（带上是哪个员工）。"""
        found: list[str] = []
        for result in self.results:
            for reason in _echo_reasons(result):
                found.append(f"{result.task_id}/{result.profile_id}: {reason}")
        return found

    def side_effect_calls(self) -> tuple[str, ...]:
        """侧写类工具调用（带参数指纹），供重放副作用判定。"""
        out: list[str] = []
        for result in self.results:
            for call in result.tool_calls:
                name = str(call.get("name") or call.get("tool") or "")
                if name.startswith(_SIDE_EFFECT_PREFIXES):
                    out.append(f"{name}:{call.get('args') or call.get('arguments') or ''}")
        return tuple(out)


def assert_real_provider(trace: RunTrace) -> None:
    """整轮**必须**是真实 provider 产出，否则抛 :class:`FakeReceiptError`。

    调用方（runner / 打分器）据此把这一轮判为 harness 失效，如实失败，
    **绝不**把它的分数记进基线。
    """
    reasons = trace.echo_reasons()
    if reasons:
        raise FakeReceiptError(
            f"run {trace.run_id}（任务 {trace.task_id}）出现假回执，评测退出：" + "；".join(reasons)
        )


def parse_run_state(
    *,
    task_id: str,
    raw: dict[str, Any],
    observed_statuses: tuple[str, ...],
    first_response_seconds: float,
    total_seconds: float,
) -> RunTrace:
    """把 ``GET /runs/{id}`` 的响应体归一成 :class:`RunTrace`。"""
    results: list[EmployeeResult] = []
    raw_results = raw.get("results")
    if isinstance(raw_results, dict):
        for task_label in sorted(raw_results):
            row = raw_results[task_label]
            if not isinstance(row, dict):
                continue
            results.append(
                EmployeeResult(
                    task_id=str(row.get("task_id") or task_label),
                    profile_id=str(row.get("profile_id") or ""),
                    status=str(row.get("status") or ""),
                    output=str(row.get("output") or ""),
                    source=str(row.get("source") or ""),
                    llm_calls=int(row.get("llm_calls") or 0),
                    tool_calls=_as_dicts(row.get("tool_calls")),
                    evidence=_as_dicts(row.get("evidence")),
                    error_code=str(row.get("error_code") or ""),
                    artifacts=_as_dicts(row.get("artifacts")),
                )
            )
    return RunTrace(
        task_id=task_id,
        run_id=str(raw.get("run_id") or ""),
        goal=str(raw.get("goal") or ""),
        status=str(raw.get("status") or ""),
        observed_statuses=observed_statuses,
        subtasks=_as_dicts(raw.get("subtasks")),
        results=tuple(results),
        summary=str(raw.get("summary") or ""),
        approval_gate=dict(raw.get("approval_gate") or {}),
        first_response_seconds=first_response_seconds,
        total_seconds=total_seconds,
        raw=raw,
    )


def structural_fingerprint(trace: RunTrace) -> dict[str, Any]:
    """一次 run 的**结构指纹**：重启/重跑后应当逐字相同的那部分。

    刻意**不含**产出的自由文本（模型非确定性，正文会变）——那份东西按"重跑
    应当一致"来判会把正常抖动读成回归。含的是：终态、子任务数、员工集合、
    profile 到 status 的映射、是否过了闸门。
    """
    return {
        "status": trace.status,
        "subtask_count": len(trace.subtasks),
        "profiles": sorted(trace.profile_ids),
        "statuses": sorted(f"{r.profile_id}={r.status}" for r in trace.results),
        "hit_gate": trace.hit_approval_gate,
    }


__all__ = [
    "STUB_MARKER",
    "EmployeeResult",
    "FakeReceiptError",
    "RunTrace",
    "assert_real_provider",
    "find_rids",
    "parse_run_state",
    "structural_fingerprint",
]
