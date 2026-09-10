"""ONT-G15 Rule DSL 最小闭环单测（解析 + 正向链 + 幂等 + 错误面）。"""

from __future__ import annotations

import os
import sys

_K = os.path.join(os.path.dirname(__file__), "..", "src")
if _K not in sys.path:
    sys.path.insert(0, _K)

from mate_kernel.ontology.rulesdsl import (
    parse_rules,
    run_rules,
)

TEXT = """
senior-rule: IF employee(?x) AND project_lead(?x) THEN senior(?x)
manager-rule: IF senior(?x) AND manages_budget(?x) THEN manager(?x)
# 注释行
bad-line-here
"""


def test_parse_rules_with_error_report():
    rules, errors = parse_rules(TEXT)
    assert len(rules) == 2 and len(errors) == 1
    assert rules[0].name == "senior-rule"
    assert (rules[0].body[0].predicate, rules[0].head.predicate) == ("employee", "senior")


def test_forward_chain_single_step():
    rules, errors = parse_rules(TEXT)
    assert errors[:1]
    r = run_rules(
        rules,
        {
            "employee": {"e1", "e2"},
            "project_lead": {"e1"},
            "manages_budget": set(),
        },
    )
    assert r.facts["senior"] == {"e1"}
    assert r.derived == [{"rule": "senior-rule", "predicate": "senior", "id": "e1"}]


def test_forward_chain_transitive_two_rules():
    rules, _ = parse_rules(TEXT)
    r = run_rules(
        rules,
        {
            "employee": {"e1"},
            "project_lead": {"e1"},
            "manages_budget": {"e1"},
        },
    )
    # e1 → senior → manager（链式推导）
    assert r.facts["senior"] == {"e1"}
    assert r.facts["manager"] == {"e1"}


def test_idempotent_rerun_no_new_facts():
    rules, _ = parse_rules(TEXT)
    facts = {"employee": {"e1"}, "project_lead": {"e1"}, "manages_budget": {"e1"}}
    first = run_rules(rules, facts)
    before = {p: set(v) for p, v in first.facts.items()}
    second = run_rules(rules, first.facts)
    assert second.derived == []
    assert {p: set(v) for p, v in second.facts.items()} == before


def test_join_on_shared_variable():
    rules, _ = parse_rules("pair: IF employee(?x) AND employee(?y) THEN pair(?x)")
    r = run_rules(rules, {"employee": {"a", "b"}})
    assert r.facts["pair"] == {"a", "b"}


def test_unsatisfied_body_derives_nothing():
    rules, _ = parse_rules(TEXT)
    r = run_rules(rules, {"employee": {"e1"}})  # 无 project_lead
    assert "senior" not in r.facts and r.derived == []
