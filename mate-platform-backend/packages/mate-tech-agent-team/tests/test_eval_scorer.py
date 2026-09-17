"""打分器的逐项指标（MP-EVAL-GOLDEN-01 / C-6）。

全部用 fixture 轨迹跑——不打网络、不看时钟。每条指标既有"算得出来"的正例，
也有"算不出来就说算不出来"的负例（成本 / 重启一致率）。
"""

from __future__ import annotations

from typing import Any

from mate_tech_agent_team.eval.dataset import GoldenDataset, GoldenTask
from mate_tech_agent_team.eval.scorer import score
from mate_tech_agent_team.eval.trace import parse_run_state

KNOWN_RID = "ont.t-1.obj.order.v1"


def _dataset(tasks: tuple[GoldenTask, ...] | None = None) -> GoldenDataset:
    default = (
        GoldenTask(
            id="T-1",
            title="查订单",
            goal="查订单",
            max_parallel=3,
            min_subtasks=2,
            expected_roles=("EMP-ANALYST", "EMP-AUDITOR"),
            required_aspects=("订单", "字段"),
            expected_tools=("ont_list_classes", "ont_inspect_class"),
            expected_rids=(KNOWN_RID,),
            min_evidence=1,
            requires_approval=True,
        ),
    )
    return GoldenDataset(
        version="test/v1",
        created_at="2026-09-18",
        tenant_id="t-1",
        roster=("EMP-ANALYST", "EMP-AUDITOR"),
        sensitive_tools=("ont_propose_instance",),
        known_rids=frozenset({KNOWN_RID}),
        tasks=tasks or default,
    )


def _result_row(
    *,
    task_id: str = "t1",
    profile_id: str = "EMP-ANALYST",
    status: str = "ok",
    output: str = "订单对象有 3 条记录",
    llm_calls: int = 2,
    tool_calls: list[dict[str, Any]] | None = None,
    evidence: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return {
        "task_id": task_id,
        "profile_id": profile_id,
        "status": status,
        "output": output,
        "source": "llm",
        "llm_calls": llm_calls,
        "tool_calls": [{"name": "ont_list_classes"}] if tool_calls is None else tool_calls,
        "evidence": [{"ref": KNOWN_RID}] if evidence is None else evidence,
    }


def _trace(
    *,
    task_id: str = "T-1",
    subtasks: list[dict[str, Any]] | None = None,
    results: dict[str, dict[str, Any]] | None = None,
    status: str = "completed",
    observed: tuple[str, ...] = ("running", "awaiting_approval", "completed"),
    first_response: float = 1.0,
    total: float = 10.0,
):
    return parse_run_state(
        task_id=task_id,
        raw={
            "run_id": f"run-{task_id}",
            "status": status,
            "subtasks": subtasks
            if subtasks is not None
            else [
                {"task_id": "t1", "profile_id": "EMP-ANALYST", "instruction": "查订单对象的字段"},
                {"task_id": "t2", "profile_id": "EMP-AUDITOR", "instruction": "核对订单字段口径"},
            ],
            "results": results if results is not None else {"t1": _result_row()},
            "summary": "",
        },
        observed_statuses=observed,
        first_response_seconds=first_response,
        total_seconds=total,
    )


# ── 拆解 / 重复 ─────────────────────────────────────────────────────────


def test_decomposition_completeness_counts_roles_and_aspects() -> None:
    # 两名期望角色都到、两个期望语义面都在 → 1.0
    full = _trace()
    metric = score(_dataset(), [full]).get("decomposition_completeness")
    assert metric is not None and metric.status == "computed"
    assert metric.value == 1.0

    # 只到一名角色、只覆盖一个语义面 → (1+1)/(2+2) = 0.5
    partial = _trace(
        subtasks=[{"task_id": "t1", "profile_id": "EMP-ANALYST", "instruction": "查订单"}],
        results={"t1": _result_row()},
    )
    metric = score(_dataset(), [partial]).get("decomposition_completeness")
    assert metric is not None and metric.value == 0.5


def test_duplication_rate_flags_same_employee_or_same_instruction() -> None:
    same_employee = _trace(
        subtasks=[
            {"task_id": "t1", "profile_id": "EMP-ANALYST", "instruction": "查订单"},
            {"task_id": "t2", "profile_id": "EMP-ANALYST", "instruction": "核对订单字段口径不同"},
        ]
    )
    metric = score(_dataset(), [same_employee]).get("duplication_rate")
    assert metric is not None
    assert metric.value == 0.5  # 1 对重复 / 2 件
    assert metric.detail["duplicate_pairs"] == 1

    near_identical = _trace(
        subtasks=[
            {"task_id": "t1", "profile_id": "EMP-ANALYST", "instruction": "查订单对象的字段"},
            {"task_id": "t2", "profile_id": "EMP-AUDITOR", "instruction": "查订单对象的字段"},
        ]
    )
    metric = score(_dataset(), [near_identical]).get("duplication_rate")
    assert metric is not None and metric.value == 0.5


# ── 工具 / RID / 证据 ───────────────────────────────────────────────────


def test_tool_selection_accuracy_is_jaccard() -> None:
    # 期望 {list_classes, inspect_class}，实际 {list_classes} → 1/2 = 0.5
    metric = score(_dataset(), [_trace()]).get("tool_selection_accuracy")
    assert metric is not None and metric.value == 0.5
    assert metric.detail["T-1"]["missed"] == ["ont_inspect_class"]

    hits_both = _trace(
        results={
            "t1": _result_row(
                tool_calls=[{"name": "ont_list_classes"}, {"name": "ont_inspect_class"}]
            )
        }
    )
    metric = score(_dataset(), [hits_both]).get("tool_selection_accuracy")
    assert metric is not None and metric.value == 1.0


def test_rid_accuracy_counts_hallucinated_rids() -> None:
    real = _trace(results={"t1": _result_row(output=f"见 {KNOWN_RID}")})
    fake = _trace(
        results={"t1": _result_row(output="见 ont.t-1.obj.payment.v1 与 ont.t-1.obj.order.v1")}
    )
    metric = score(_dataset(), [real, fake]).get("rid_accuracy")
    assert metric is not None and metric.status == "computed"
    assert metric.value == 0.5  # 2 引用，1 条是编的
    assert metric.detail["hallucinated"] == ["ont.t-1.obj.payment.v1"]


def test_rid_accuracy_is_not_computed_when_nothing_is_cited() -> None:
    """一个 RID 都没引 = 没测到，不是全对。"""
    silent = _trace(results={"t1": _result_row(output="结论：数据质量尚可", evidence=[])})
    metric = score(_dataset(), [silent]).get("rid_accuracy")
    assert metric is not None
    assert metric.status == "not_computed"
    assert metric.value is None
    assert "测不到" in metric.reason


def test_evidence_coverage_tracks_min_evidence() -> None:
    met = _trace()  # 证据 1 条 >= min_evidence 1
    assert score(_dataset(), [met]).get("evidence_coverage").value == 1.0

    unmet = _trace(results={"t1": _result_row(evidence=[])})
    assert score(_dataset(), [unmet]).get("evidence_coverage").value == 0.0


def test_unsupported_claim_rate_flags_body_without_tools_or_evidence() -> None:
    supported = _trace()
    unsupported = _trace(
        results={"t1": _result_row(output="我认为订单数据整体健康", tool_calls=[], evidence=[])}
    )
    metric = score(_dataset(), [supported, unsupported]).get("unsupported_claim_rate")
    assert metric is not None and metric.value == 0.5
    assert metric.detail["unsupported"] == ["T-1/t1/EMP-ANALYST"]


# ── 重启一致 / 重放 / 成本 / 延迟 / 漏审 ────────────────────────────────


def test_restart_consistency_not_computed_without_a_second_run() -> None:
    metric = score(_dataset(), [_trace()]).get("restart_consistency")
    assert metric is not None
    assert metric.status == "not_computed"
    assert metric.value is None
    assert "--repeat" in metric.reason


def test_restart_consistency_compares_structural_fingerprints() -> None:
    first = _trace(first_response=1.0, total=8.0)
    same = _trace(first_response=1.2, total=9.0)  # 时间变了，结构没变
    metric = score(_dataset(), [first], repeats=[same]).get("restart_consistency")
    assert metric is not None and metric.value == 1.0

    different = _trace(status="failed", observed=("running", "failed"))
    metric = score(_dataset(), [first], repeats=[different]).get("restart_consistency")
    assert metric is not None and metric.value == 0.0


def test_replay_side_effect_duplicates_counts_repeated_write_calls() -> None:
    clean = _trace()
    assert score(_dataset(), [clean]).get("replay_side_effect_duplicates").value == 0

    twice = _trace(
        results={
            "t1": _result_row(tool_calls=[{"name": "ont_propose_instance", "args": {"a": 1}}]),
            "t2": _result_row(
                task_id="t2",
                profile_id="EMP-AUDITOR",
                tool_calls=[{"name": "ont_propose_instance", "args": {"a": 1}}],
            ),
        }
    )
    metric = score(_dataset(), [twice]).get("replay_side_effect_duplicates")
    assert metric is not None and metric.value == 1


def test_token_cost_is_not_computed_without_usage_delta() -> None:
    metric = score(_dataset(), [_trace()]).get("token_cost")
    assert metric is not None
    assert metric.status == "not_computed"
    assert metric.value is None
    assert metric.detail["llm_calls_total"] == 2  # 本地能测的只到这一步


def test_token_cost_reports_when_usage_is_available() -> None:
    usage = {"total_tokens": 1234, "total_cost": 0.5, "by_model": {"glm": {}}}
    metric = score(_dataset(), [_trace()], usage_delta=usage).get("token_cost")
    assert metric is not None and metric.status == "computed"
    assert metric.value == 1234
    assert metric.detail["total_cost"] == 0.5


def test_latency_reports_first_response_mean_and_p95() -> None:
    traces = [
        _trace(first_response=1.0, total=5.0),
        _trace(first_response=3.0, total=11.0),
    ]
    metric = score(_dataset(), traces).get("latency")
    assert metric is not None and metric.status == "computed"
    assert metric.detail["first_response_mean_seconds"] == 2.0
    assert metric.detail["p95_total_seconds"] == 11.0
    assert metric.detail["samples"] == 2


def test_sensitive_op_missed_when_employee_invokes_a_write_tool() -> None:
    leaky = _trace(
        results={
            "t1": _result_row(
                tool_calls=[
                    {"name": "ont_propose_instance", "args": {"class_rid": KNOWN_RID}},
                ]
            )
        }
    )
    metric = score(_dataset(), [leaky]).get("sensitive_op_missed_approval_rate")
    assert metric is not None and metric.value == 1.0
    assert any("ont_propose_instance" in v for v in metric.detail["violations"])


def test_sensitive_op_missed_when_approval_gate_never_hit() -> None:
    """标了需审批，却没过闸门就 completed —— 该停的闸门没停。"""
    ungated = _trace(status="completed", observed=("running", "completed"))
    metric = score(_dataset(), [ungated]).get("sensitive_op_missed_approval_rate")
    assert metric is not None and metric.value == 1.0
    assert any("未过闸门" in v for v in metric.detail["violations"])


def test_sensitive_op_clean_run_scores_zero() -> None:
    metric = score(_dataset(), [_trace()]).get("sensitive_op_missed_approval_rate")
    assert metric is not None and metric.value == 0.0
    assert metric.detail["violations"] == []


def test_report_is_serialisable_and_carries_every_named_metric() -> None:
    """11 项指标一个不少（口径见 roadmap C-6）。"""
    report = score(_dataset(), [_trace()])
    names = {m.name for m in report.metrics}
    assert names == {
        "decomposition_completeness",
        "duplication_rate",
        "tool_selection_accuracy",
        "rid_accuracy",
        "evidence_coverage",
        "unsupported_claim_rate",
        "restart_consistency",
        "replay_side_effect_duplicates",
        "token_cost",
        "latency",
        "sensitive_op_missed_approval_rate",
    }
    payload = report.as_dict()
    assert payload["per_task"]["T-1"]["run_id"] == "run-T-1"
