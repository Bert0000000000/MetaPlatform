"""G34 契约测试 —— 本体验证评估套件：题库 round-trip / 四象限 / JSONL / 回归对比 / sample。

全部走模块纯函数 + tmp_path 本地文件，无 PG / FastAPI 依赖。
"""
from __future__ import annotations

import json
import os
import sys

import pytest

_K = os.path.join(os.path.dirname(__file__), "..", "..", "mate-kernel", "src")
_O = os.path.join(os.path.dirname(__file__), "..", "src")
for _p in (_K, _O):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from mate_tech_ont.v2_kernel import evaluation as ev  # noqa: E402
from mate_tech_ont.v2_kernel.evaluation import (  # noqa: E402
    EvaluationQuestion,
    QuestionStages,
    RunRecord,
)


def _q(qid: str, *, tags: tuple[str, ...] = ("test",), expected: str | None = None) -> EvaluationQuestion:
    return EvaluationQuestion(
        id=qid,
        business_question=f"业务问题 {qid}",
        stages=QuestionStages(
            situation=f"情境：定位 {qid} 相关对象",
            cause=f"成因：追踪 {qid} 的成因链路",
            impact=f"影响：评估 {qid} 的影响面",
        ),
        expected_answer=expected,
        tags=tags,
    )


def _run(
    qid: str,
    participant: str,
    success: bool,
    *,
    answer: str = "",
    duration_ms: int = 10,
    run_at: str = "2026-09-10T10:00:00+00:00",
) -> RunRecord:
    return RunRecord(
        question_id=qid,
        participant=participant,
        success=success,
        answer=answer,
        duration_ms=duration_ms,
        run_at=run_at,
    )


# ---------------------------------------------------------------------------
# 题库 JSON round-trip
# ---------------------------------------------------------------------------


def test_suite_json_round_trip(tmp_path):
    questions = [
        _q("Q-1", tags=("order", "logistics"), expected="参考答案 1"),
        _q("Q-2", tags=()),
    ]
    path = tmp_path / "suite.json"
    ev.save_suite(path, questions)

    assert ev.load_suite(path) == questions

    raw = json.loads(path.read_text(encoding="utf-8"))
    assert raw["schema"] == ev.SUITE_SCHEMA
    assert len(raw["questions"]) == 2
    q0 = raw["questions"][0]
    assert set(q0["stages"]) == {"situation", "cause", "impact"}
    assert q0["tags"] == ["order", "logistics"]
    assert q0["expected_answer"] == "参考答案 1"
    assert raw["questions"][1]["expected_answer"] is None


def test_load_suite_rejects_bad_schema(tmp_path):
    path = tmp_path / "bad.json"
    path.write_text(json.dumps({"questions": [{"id": "Q-1"}]}), encoding="utf-8")
    with pytest.raises(ValueError):
        ev.load_suite(path)


# ---------------------------------------------------------------------------
# run_suite：执行器注入
# ---------------------------------------------------------------------------


def test_run_suite_delegates_runner_in_order():
    questions = [_q("Q-1"), _q("Q-2")]
    seen: list[str] = []

    def runner(q: EvaluationQuestion) -> RunRecord:
        seen.append(q.id)
        return _run(q.id, "ai", True)

    records = ev.run_suite(questions, runner)
    assert seen == ["Q-1", "Q-2"]
    assert [r.question_id for r in records] == ["Q-1", "Q-2"]
    assert all(r.success for r in records)


def test_run_suite_rejects_mismatched_question_id():
    def bad_runner(q: EvaluationQuestion) -> RunRecord:
        return _run("OTHER", "ai", True)

    with pytest.raises(ValueError, match="question_id"):
        ev.run_suite([_q("Q-1")], bad_runner)


# ---------------------------------------------------------------------------
# 四象限对比
# ---------------------------------------------------------------------------


def test_quadrant_report_four_quadrants():
    human = [
        _run("Q-both", "human", True),
        _run("Q-ai", "human", False),
        _run("Q-human", "human", True),
        _run("Q-fail", "human", False),
    ]
    ai = [
        _run("Q-both", "ai", True),
        _run("Q-ai", "ai", True),
        _run("Q-human", "ai", False),
        _run("Q-fail", "ai", False),
    ]
    report = ev.quadrant_report(human, ai)

    assert report["both_success"] == ["Q-both"]
    assert report["ai_only"] == ["Q-ai"]
    assert report["human_only"] == ["Q-human"]
    assert report["both_fail"] == ["Q-fail"]
    assert report["unknown"] == []

    counts = report["counts"]
    assert counts["both_success"] == 1
    assert counts["ai_only"] == 1
    assert counts["human_only"] == 1
    assert counts["both_fail"] == 1
    assert counts["unknown"] == 0
    assert counts["aligned"] == 4
    assert counts["human_total"] == 4
    assert counts["ai_total"] == 4
    # 诊断语义自带（self-describing report）
    assert set(report["diagnosis"]) >= {
        "both_success", "ai_only", "human_only", "both_fail", "unknown",
    }


def test_quadrant_report_unmatched_goes_to_unknown():
    # 明确策略：仅一侧有作答记录的题（人/机题集不重叠）归入 unknown，
    # 不强行猜象限；对齐题正常归类。
    human = [_run("Q-1", "human", True), _run("Q-2", "human", True)]
    ai = [_run("Q-2", "ai", False), _run("Q-3", "ai", True)]
    report = ev.quadrant_report(human, ai)

    assert report["unknown"] == ["Q-1", "Q-3"]  # Q-1 仅人、Q-3 仅 AI
    assert report["human_only"] == ["Q-2"]
    assert report["counts"]["unknown"] == 2
    assert report["counts"]["aligned"] == 1


def test_quadrant_report_last_run_wins_on_duplicates():
    human = [_run("Q-dup", "human", True), _run("Q-dup", "human", False)]
    ai = [_run("Q-dup", "ai", True)]
    report = ev.quadrant_report(human, ai)
    # 同题同侧多次作答取最后一条：human 最终失败 → ai_only
    assert report["ai_only"] == ["Q-dup"]


# ---------------------------------------------------------------------------
# JSONL 追加 / 回归对比
# ---------------------------------------------------------------------------


def test_append_runs_jsonl_and_load_runs(tmp_path):
    path = tmp_path / "runs" / "history.jsonl"  # 嵌套目录：父目录应自动创建
    first = [_run("Q-1", "ai", True, answer="ans-1", duration_ms=120)]
    second = [_run("Q-2", "ai", False, answer="ans-2", duration_ms=340)]

    ev.append_runs(path, first)
    ev.append_runs(path, second)

    lines = path.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 2  # 追加不覆盖
    loaded = ev.load_runs(path)
    assert loaded == first + second
    assert [r.question_id for r in loaded] == ["Q-1", "Q-2"]


def test_load_runs_rejects_bad_participant(tmp_path):
    path = tmp_path / "bad.jsonl"
    path.write_text(json.dumps({"question_id": "Q-1", "participant": "robot"}) + "\n", encoding="utf-8")
    with pytest.raises(ValueError, match="participant"):
        ev.load_runs(path)


def test_compare_to_baseline_detects_new_failures():
    baseline = [
        _run("Q-1", "ai", True),
        _run("Q-2", "ai", True),
        _run("Q-3", "ai", False),  # 基线本就失败
    ]
    current = [
        _run("Q-1", "ai", True),   # 仍通过
        _run("Q-2", "ai", False),  # 新失败 → 检出
        _run("Q-3", "ai", False),  # 基线失败延续 → 不算新失败
        _run("Q-4", "ai", False),  # 新增题（基线无记录）→ 不算新失败
    ]
    assert ev.compare_to_baseline(current, baseline) == ["Q-2"]

    # 修复后回归消失
    fixed = [_run("Q-2", "ai", True)]
    assert ev.compare_to_baseline(fixed, baseline) == []

    # 对齐键含 participant：human 的失败不会被 ai 的基线误判为新失败
    human_only = [_run("Q-2", "human", False)]
    assert ev.compare_to_baseline(human_only, baseline) == []


# ---------------------------------------------------------------------------
# 示例题库
# ---------------------------------------------------------------------------


def test_sample_suite_non_empty_and_complete_stages():
    questions = ev.sample_suite()
    assert len(questions) == 3
    assert len({q.id for q in questions}) == 3
    for q in questions:
        assert q.business_question.strip()
        assert q.tags
        for stage in (q.stages.situation, q.stages.cause, q.stages.impact):
            assert isinstance(stage, str) and stage.strip()

    # 三域覆盖：订单 / 客户 / 供应商
    joined = " ".join(q.business_question for q in questions)
    for domain in ("订单", "客户", "供应商"):
        assert domain in joined

    # 示例题库自身可 round-trip（下游可 save 后直接用）
    assert ev.sample_suite() == questions
