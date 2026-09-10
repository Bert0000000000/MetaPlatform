"""G34: 本体验证评估套件 —— Palantir 方法论的工程化落地。

Palantir 本体方法论的核心验收主张：本体好不好不由建模者自评，而要用
**真实业务问题**去验证。本模块把它工程化为三条闭环：

1. **题库（suite）**：把业务问题固化为三段式题目（situation 建立情境 →
   cause 追踪成因 → impact 评估影响），JSON 落盘、随业务演进持续沉淀。
2. **人机双盲四象限对比（`quadrant_report`）**：同一题库，领域专家
   （human）与 AI 通道（ai）各自独立作答，按题对齐出四象限，从象限
   分布诊断本体缺陷（诊断语义见 `quadrant_report` 与 `DIAGNOSIS`）。
3. **回归评估（`compare_to_baseline`）**：题库长期演化为回归套件——
   本体 schema / 数据 / 检索配置变更后重跑，与基线对比揪出「新失败」，
   防止语义回归静默发生。

本模块为纯 stdlib 实现（无 FastAPI / PG 依赖，独立模块风格同
object_search.py）：仅提供数据结构 + 对齐/对比算法 + 本地 JSON/JSONL
读写；人/机作答执行器由调用方注入（见 `run_suite`），模块自身不做任何
网络与外部系统 IO。
"""

from __future__ import annotations

import json
import os
from collections.abc import Callable, Iterable, Sequence
from dataclasses import dataclass
from typing import Any

__all__ = [
    "DIAGNOSIS",
    "SUITE_SCHEMA",
    "EvaluationQuestion",
    "QuestionStages",
    "RunRecord",
    "append_runs",
    "compare_to_baseline",
    "load_runs",
    "load_suite",
    "quadrant_report",
    "run_suite",
    "sample_suite",
    "save_suite",
]


# ---------------------------------------------------------------------------
# 数据结构
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class QuestionStages:
    """三段式提问结构：先建立情境、再追踪成因、最后评估影响。

    Palantir 强调好的本体验证问题不是一句「XX 是什么」，而应引导作答者
    在本体上走完一条完整的业务推理路径。
    """

    situation: str  # 建立情境：定位/圈选相关对象
    cause: str  # 追踪成因：沿 LinkType / 属性追溯原因链路
    impact: str  # 评估影响：量化/圈定波及面


@dataclass(frozen=True)
class EvaluationQuestion:
    """题库条目：一道用于验证本体的真实业务问题。"""

    id: str
    business_question: str
    stages: QuestionStages
    expected_answer: str | None = None  # 可选参考答案（评卷依据由调用方定）
    tags: tuple[str, ...] = ()


@dataclass(frozen=True)
class RunRecord:
    """一次作答记录（participant: "human"=领域专家 / "ai"=本体检索推理通道）。"""

    question_id: str
    participant: str  # "human" | "ai"
    success: bool
    answer: str
    duration_ms: int
    run_at: str  # ISO 8601 字符串，由执行器写入


# ---------------------------------------------------------------------------
# 序列化
# ---------------------------------------------------------------------------

SUITE_SCHEMA = "ont.evaluation.suite/v1"

_STAGE_KEYS = ("situation", "cause", "impact")
_PARTICIPANTS = ("human", "ai")


def _question_to_dict(q: EvaluationQuestion) -> dict[str, Any]:
    return {
        "id": q.id,
        "business_question": q.business_question,
        "stages": {
            "situation": q.stages.situation,
            "cause": q.stages.cause,
            "impact": q.stages.impact,
        },
        "expected_answer": q.expected_answer,
        "tags": list(q.tags),
    }


def _question_from_dict(d: dict[str, Any]) -> EvaluationQuestion:
    try:
        stages_raw = d["stages"]
        stages = QuestionStages(
            situation=stages_raw["situation"],
            cause=stages_raw["cause"],
            impact=stages_raw["impact"],
        )
        return EvaluationQuestion(
            id=d["id"],
            business_question=d["business_question"],
            stages=stages,
            expected_answer=d.get("expected_answer"),
            tags=tuple(d.get("tags", ())),
        )
    except (KeyError, TypeError) as exc:
        raise ValueError(f"题目 JSON 不符合 schema（{SUITE_SCHEMA}）: {d!r}") from exc


def _run_to_dict(r: RunRecord) -> dict[str, Any]:
    return {
        "question_id": r.question_id,
        "participant": r.participant,
        "success": r.success,
        "answer": r.answer,
        "duration_ms": r.duration_ms,
        "run_at": r.run_at,
    }


def _run_from_dict(d: dict[str, Any]) -> RunRecord:
    participant = d.get("participant")
    if participant not in _PARTICIPANTS:
        raise ValueError(
            f"participant 必须是 {'/'.join(_PARTICIPANTS)}， got {participant!r}: {d!r}"
        )
    try:
        return RunRecord(
            question_id=d["question_id"],
            participant=participant,
            success=bool(d["success"]),
            answer=d.get("answer", ""),
            duration_ms=int(d["duration_ms"]),
            run_at=d["run_at"],
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError(f"作答记录 JSON 不符合 schema: {d!r}") from exc


def _ensure_parent(path: str | os.PathLike[str]) -> None:
    parent = os.path.dirname(os.fspath(path))
    if parent:
        os.makedirs(parent, exist_ok=True)


# ---------------------------------------------------------------------------
# 题库读写 / 执行
# ---------------------------------------------------------------------------


def save_suite(path: str | os.PathLike[str], questions: Sequence[EvaluationQuestion]) -> None:
    """题库落盘为 JSON。

    顶层结构 ``{"schema": SUITE_SCHEMA, "questions": [...]}``；带 schema
    版本号，便于题库长期演化（回归套件）时做兼容迁移。
    """
    _ensure_parent(path)
    payload = {
        "schema": SUITE_SCHEMA,
        "questions": [_question_to_dict(q) for q in questions],
    }
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
        fh.write("\n")


def load_suite(path: str | os.PathLike[str]) -> list[EvaluationQuestion]:
    """读取题库 JSON；兼容顶层裸数组（手写/历史文件）。"""
    with open(path, encoding="utf-8") as fh:
        payload = json.load(fh)
    items = payload["questions"] if isinstance(payload, dict) else payload
    if not isinstance(items, list):
        raise ValueError(f"题库顶层应为 {{schema, questions}} 或数组， got {type(items).__name__}")
    return [_question_from_dict(x) for x in items]


def run_suite(
    questions: Sequence[EvaluationQuestion],
    runner: Callable[[EvaluationQuestion], RunRecord],
) -> list[RunRecord]:
    """逐题调用注入的执行器作答，返回 RunRecord 列表（顺序与题库一致）。

    runner 是 ``Callable[[EvaluationQuestion], RunRecord]``：人（领域专家
    作答界面）或 AI（本体检索/推理通道）的执行器由调用方注入——本函数
    不做任何 IO，也不关心作答方式（计时、时间戳由执行器写入记录）。
    返回记录的 question_id 必须与题目一致，否则立即 ValueError
    （fail-fast，避免脏数据流入四象限对比）。
    """
    records: list[RunRecord] = []
    for q in questions:
        record = runner(q)
        if record.question_id != q.id:
            raise ValueError(
                f"runner 返回的 question_id={record.question_id!r} 与题目 id={q.id!r} 不一致"
            )
        records.append(record)
    return records


# ---------------------------------------------------------------------------
# 四象限对比
# ---------------------------------------------------------------------------

#: 象限 → 诊断语义（quadrant_report 的 self-describing 附件）。
DIAGNOSIS: dict[str, str] = {
    "both_success": "本体可发现可表达：该题可沉淀为回归基线。",
    "ai_only": "审查命名/别名/描述：AI 能找到而领域专家找不到，说明对人不友好。",
    "human_only": "最关键信号：隐性领域知识未显性化，需补属性/链接/描述。",
    "both_fail": "缺数据或缺关系：先补数据接入或 LinkType，再谈表达力。",
    "unknown": "人/机题集未对齐（仅一侧有作答），补跑缺失一侧后再归类。",
}


def quadrant_report(
    human_runs: Iterable[RunRecord],
    ai_runs: Iterable[RunRecord],
) -> dict[str, Any]:
    """人机双盲四象限对比。

    按 question_id 对齐 human / ai 两组 RunRecord（同题同侧多次作答取
    **最后一条**）；仅一侧有记录的题归入 ``unknown``——这是明确策略：
    单侧作答无法判定象限，补跑缺失一侧后再归类。

    返回结构::

        {
          "both_success": [question_id, ...],
          "ai_only":      [question_id, ...],
          "human_only":   [question_id, ...],
          "both_fail":    [question_id, ...],
          "unknown":      [question_id, ...],
          "counts": {"both_success": n, "ai_only": n, "human_only": n,
                     "both_fail": n, "unknown": n,
                     "aligned": n, "human_total": n, "ai_total": n},
          "diagnosis": {象限 → 诊断语义}，
        }

    四象限诊断语义（Palantir 方法论落地）：

    - ``both_success`` —— 人机都答对：本体**可发现、可表达**，该题可
      沉淀为回归基线。
    - ``ai_only`` —— AI 答对、人答不对：本体对 AI 可检索但对领域专家
      不可发现，**审查命名/别名/描述**（ObjectType/Property 的 title、
      alias、description）。
    - ``human_only`` —— 人答对、AI 答不对：**最关键信号**——专家脑中
      的**隐性领域知识未显性化**到本体，AI 通道检索不到这些语义，需要
      **补属性 / 链接 / 描述**。
    - ``both_fail`` —— 人机都答不对：本体**缺数据或缺关系**，先补数据
      接入或 LinkType，再谈表达力。
    """
    human = {r.question_id: r for r in human_runs}
    ai = {r.question_id: r for r in ai_runs}

    both_success: list[str] = []
    ai_only: list[str] = []
    human_only: list[str] = []
    both_fail: list[str] = []
    unknown: list[str] = []

    for qid in sorted(set(human) | set(ai)):
        h = human.get(qid)
        a = ai.get(qid)
        if h is None or a is None:
            unknown.append(qid)
        elif h.success and a.success:
            both_success.append(qid)
        elif a.success:
            ai_only.append(qid)
        elif h.success:
            human_only.append(qid)
        else:
            both_fail.append(qid)

    counts = {
        "both_success": len(both_success),
        "ai_only": len(ai_only),
        "human_only": len(human_only),
        "both_fail": len(both_fail),
        "unknown": len(unknown),
        "aligned": len(both_success) + len(ai_only) + len(human_only) + len(both_fail),
        "human_total": len(human),
        "ai_total": len(ai),
    }
    return {
        "both_success": both_success,
        "ai_only": ai_only,
        "human_only": human_only,
        "both_fail": both_fail,
        "unknown": unknown,
        "counts": counts,
        "diagnosis": dict(DIAGNOSIS),
    }


# ---------------------------------------------------------------------------
# JSONL 追加 / 回归对比
# ---------------------------------------------------------------------------


def append_runs(path: str | os.PathLike[str], runs: Iterable[RunRecord]) -> None:
    """作答记录以 JSONL 追加写入（每行一条，累积为长期评估历史）。"""
    _ensure_parent(path)
    with open(path, "a", encoding="utf-8", newline="\n") as fh:
        for r in runs:
            fh.write(json.dumps(_run_to_dict(r), ensure_ascii=False) + "\n")


def load_runs(path: str | os.PathLike[str]) -> list[RunRecord]:
    """读取 JSONL 作答记录（`append_runs` 的配套读取；空文件返回 []）。"""
    records: list[RunRecord] = []
    with open(path, encoding="utf-8") as fh:
        for lineno, line in enumerate(fh, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                records.append(_run_from_dict(json.loads(line)))
            except ValueError as exc:
                raise ValueError(f"{os.fspath(path)}:{lineno} {exc}") from exc
    return records


def compare_to_baseline(
    current_runs: Iterable[RunRecord],
    baseline_runs: Iterable[RunRecord],
) -> list[str]:
    """回归对比：返回「新失败」的 question_id 列表（已排序去重）。

    对齐键为 ``(participant, question_id)``——同一参与者口径下比较；
    同键多次作答取最后一条。判定规则：**baseline success 且 current
    fail** 才算新失败；baseline 本就失败、或 current 新增（baseline 没有
    的键）均不计入——本函数只回答一个问题：既有基线是否发生语义回归。
    题库随业务持续演化，本函数即「题库 → 回归评估套件」的门禁。
    """
    baseline = {(r.participant, r.question_id): r.success for r in baseline_runs}
    current = {(r.participant, r.question_id): r.success for r in current_runs}
    newly_failed = {
        qid
        for (participant, qid), success in current.items()
        if baseline.get((participant, qid)) is True and success is False
    }
    return sorted(newly_failed)


# ---------------------------------------------------------------------------
# 示例题库
# ---------------------------------------------------------------------------


def sample_suite() -> list[EvaluationQuestion]:
    """3 个示例问题（订单 / 客户 / 供应商域，均三段式），供下游快速试用。"""
    return [
        EvaluationQuestion(
            id="q-order-delay-001",
            business_question="过去 30 天华东区交付延迟的订单集中在哪个履约环节，涉及多少应收金额？",
            stages=QuestionStages(
                situation="圈选近 30 天交付状态为「延迟」且收货区域为华东的订单对象。",
                cause="沿 订单→物流单→承运商/仓 链路定位延迟发生环节（揽收/干线/末端）。",
                impact="汇总延迟订单金额与受影响客户数，评估对当季履约率的影响。",
            ),
            expected_answer=None,
            tags=("order", "logistics", "sla"),
        ),
        EvaluationQuestion(
            id="q-customer-churn-002",
            business_question="近 90 天活跃度显著下降的高价值客户有哪些？下降与服务工单量是否相关？",
            stages=QuestionStages(
                situation="圈选年消费 Top 分位且近 90 天活跃度环比降幅超 50% 的客户。",
                cause="关联该客群同期服务工单/投诉记录，判断活跃度下降与工单爆发的先后关系。",
                impact="估算流失风险敞口（该客群年贡献收入），给出挽留优先级排序。",
            ),
            expected_answer=None,
            tags=("customer", "churn", "retention"),
        ),
        EvaluationQuestion(
            id="q-supplier-quality-003",
            business_question="供应商 S-1021 近一季的原材料批次质量问题波及哪些在产订单？",
            stages=QuestionStages(
                situation="定位供应商 S-1021 近一季被标记「质量异常」的来料批次。",
                cause="沿 批次→BOM→在产订单 链路追踪问题批次的消耗去向。",
                impact="汇总受影响在产订单的停产/返工风险与交付承诺延误。",
            ),
            expected_answer=None,
            tags=("supplier", "quality", "traceability"),
        ),
    ]
