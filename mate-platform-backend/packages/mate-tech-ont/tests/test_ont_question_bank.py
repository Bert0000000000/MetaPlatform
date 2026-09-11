"""G34 题库（question_bank）契约测试 —— 50 题业务题库的结构与分布门禁。

锁定：总数、域分布（crm/hr/it/finance/cross-domain）、场景类型分布
（lookup/trend/root-cause/impact/scenario 各 ≥5）、三段式完整性、id
唯一性，以及与 evaluation.save_suite/load_suite 的 round-trip 兼容。
"""

from __future__ import annotations

import os
import sys

_K = os.path.join(os.path.dirname(__file__), "..", "..", "mate-kernel", "src")
_O = os.path.join(os.path.dirname(__file__), "..", "src")
for _p in (_K, _O):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from mate_tech_ont.v2_kernel import evaluation as ev
from mate_tech_ont.v2_kernel.question_bank import (
    QUESTION_BANK_VERSION,
    build_question_bank,
)

#: 域 → 期望题数（与 question_bank 模块分布一一对应）。
_DOMAIN_EXPECTED = {
    "crm": 12,
    "hr": 10,
    "it": 8,
    "finance": 10,
    "cross-domain": 10,
}

#: 场景类型（每类至少 5 题）。
_SCENARIO_TAGS = ("lookup", "trend", "root-cause", "impact", "scenario")


# ---------------------------------------------------------------------------
# 总数与分布
# ---------------------------------------------------------------------------


def test_total_is_50():
    questions = build_question_bank()
    assert len(questions) == 50


def test_domain_distribution():
    questions = build_question_bank()
    for domain, expected in _DOMAIN_EXPECTED.items():
        actual = sum(1 for q in questions if domain in q.tags)
        assert actual == expected, f"域 {domain} 期望 {expected} 题，实际 {actual} 题"

    # 域合计恰为总数：每题恰好一枚域标签，无漏标/多标
    for q in questions:
        domain_tags = [t for t in q.tags if t in _DOMAIN_EXPECTED]
        assert len(domain_tags) == 1, f"{q.id} 域标签应恰为一枚，实际 {domain_tags}"


def test_scenario_distribution():
    questions = build_question_bank()
    for scenario in _SCENARIO_TAGS:
        count = sum(1 for q in questions if scenario in q.tags)
        assert count >= 5, f"场景 {scenario} 至少 5 题，实际 {count} 题"

    # 每题恰好一枚场景标签：五类计数合计 = 总题数
    for q in questions:
        scenario_tags = [t for t in q.tags if t in _SCENARIO_TAGS]
        assert len(scenario_tags) == 1, f"{q.id} 场景标签应恰为一枚，实际 {scenario_tags}"
    total = sum(1 for q in questions for t in q.tags if t in _SCENARIO_TAGS)
    assert total == 50


# ---------------------------------------------------------------------------
# 单题结构完整性
# ---------------------------------------------------------------------------


def test_each_question_structure():
    questions = build_question_bank()
    ids = [q.id for q in questions]
    assert len(ids) == len(set(ids)), "题目 id 必须唯一"

    for q in questions:
        assert len(q.business_question) > 10, f"{q.id} business_question 过短"
        assert q.expected_answer is not None and q.expected_answer.strip(), (
            f"{q.id} 缺 expected_answer"
        )
        assert len(q.tags) >= 1, f"{q.id} tags 为空"
        for stage_name, stage in (
            ("situation", q.stages.situation),
            ("cause", q.stages.cause),
            ("impact", q.stages.impact),
        ):
            assert isinstance(stage, str) and stage.strip(), f"{q.id} stages.{stage_name} 为空"


def test_version_constant():
    assert QUESTION_BANK_VERSION == "1.0"


# ---------------------------------------------------------------------------
# 与 evaluation 套件读写兼容
# ---------------------------------------------------------------------------


def test_save_load_round_trip_first_five(tmp_path):
    questions = build_question_bank()[:5]
    path = tmp_path / "question_bank.json"
    ev.save_suite(path, questions)

    loaded = ev.load_suite(path)
    assert loaded == questions
    assert [q.id for q in loaded] == [q.id for q in questions]
