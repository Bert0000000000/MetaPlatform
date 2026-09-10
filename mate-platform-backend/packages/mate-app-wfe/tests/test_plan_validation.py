"""Tests for the server-owned Plan graph validator."""

from __future__ import annotations

from mate_app_wfe.plan_validation import validate_plan


def _valid_plan() -> dict:
    return {
        "nodes": [
            {"id": "start", "type": "start"},
            {
                "id": "review",
                "type": "action",
                "action_type": "order.review",
                "input": {"order_id": "order-1"},
                "requires_confirmation": True,
            },
            {"id": "end", "type": "end"},
        ],
        "edges": [
            {"source": "start", "target": "review"},
            {"source": "review", "target": "end"},
        ],
    }


def test_valid_plan_is_accepted_and_preserves_business_steps() -> None:
    result = validate_plan(_valid_plan())
    assert result.valid is True
    assert result.issues == ()


def test_validator_returns_actionable_issues_for_unknown_action_and_input() -> None:
    plan = _valid_plan()
    plan["nodes"][1] = {
        "id": "review",
        "type": "action",
        "action_type": "unknown.action",
        "input": {},
    }
    result = validate_plan(plan)
    assert result.valid is False
    assert any(
        issue.node_id == "review" and issue.code == "unknown_action_type" for issue in result.issues
    )


def test_validator_rejects_duplicate_and_dangling_graph_nodes() -> None:
    plan = _valid_plan()
    plan["nodes"].append({"id": "review", "type": "end"})
    plan["edges"].append({"source": "missing", "target": "end"})
    result = validate_plan(plan)
    codes = {issue.code for issue in result.issues}
    assert {"duplicate_node_id", "unknown_edge_endpoint"} <= codes


def test_order_review_must_require_confirmation() -> None:
    plan = _valid_plan()
    plan["nodes"][1]["requires_confirmation"] = False
    result = validate_plan(plan)
    assert any(issue.code == "confirmation_required" for issue in result.issues)
