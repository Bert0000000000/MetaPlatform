"""RunTrace 归一 + **假回执守卫**（MP-EVAL-GOLDEN-01 / C-6）。

本文件的核心是那条硬要求：**回显绝不能算成好答案**。三查（正文含标记 /
source=stub 却有产出 / status=ok 且零模型调用却有产出）各写一条负例，
再写一条正例证明真产出不被误伤。
"""

from __future__ import annotations

from typing import Any

import pytest
from mate_tech_agent_team.eval.trace import (
    FakeReceiptError,
    assert_real_provider,
    find_rids,
    parse_run_state,
    structural_fingerprint,
)


def _state(
    *, output: str = "", source: str = "llm", status: str = "ok", llm_calls: int = 2
) -> dict:
    return {
        "run_id": "r-1",
        "status": "completed",
        "subtasks": [{"task_id": "t1", "profile_id": "EMP-ANALYST", "instruction": "查订单"}],
        "results": {
            "t1": {
                "task_id": "t1",
                "profile_id": "EMP-ANALYST",
                "status": status,
                "output": output,
                "source": source,
                "llm_calls": llm_calls,
                "tool_calls": [{"name": "ont_list_classes"}],
                "evidence": [{"ref": "ont.t-1.obj.order.v1"}],
            }
        },
    }


def _trace(raw: dict[str, Any]):
    return parse_run_state(
        task_id="T-1",
        raw=raw,
        observed_statuses=("running", "awaiting_approval", "completed"),
        first_response_seconds=1.5,
        total_seconds=9.0,
    )


# ── 归一的正确性 ────────────────────────────────────────────────────────


def test_parse_run_state_extracts_results_and_metrics() -> None:
    trace = _trace(_state(output="订单 ont.t-1.obj.order.v1 共 3 条"))
    assert trace.status == "completed"
    assert len(trace.subtasks) == 1
    assert trace.results[0].profile_id == "EMP-ANALYST"
    assert trace.tool_names == ("ont_list_classes",)
    assert trace.llm_calls_total == 2
    assert trace.evidence_count == 1
    assert trace.cited_rids == ("ont.t-1.obj.order.v1",)
    assert trace.hit_approval_gate is True


def test_structural_fingerprint_ignores_free_text() -> None:
    """指纹**不含**自由文本：重跑时正文会抖，那不是回归。"""
    a = _trace(_state(output="结论 A"))
    b = _trace(_state(output="结论 B（措辞完全不同）"))
    assert structural_fingerprint(a) == structural_fingerprint(b)


def test_structural_fingerprint_catches_a_real_difference() -> None:
    a = _trace(_state(output="x"))
    b = _trace(_state(output="x", status="error"))
    assert structural_fingerprint(a) != structural_fingerprint(b)


def test_find_rids_picks_only_ontology_rids() -> None:
    text = "见 ont.t-1.obj.order.v1 与 https://example.com/x 以及 ont.t-1.obj.order.v1"
    assert find_rids(text) == ("ont.t-1.obj.order.v1",)


# ── 假回执守卫（三查 + 正例）────────────────────────────────────────────


def test_stub_marker_in_output_is_a_fake_receipt() -> None:
    """llmgw 把输入抄回来（回显）——最典型的一种假回执。"""
    trace = _trace(_state(output="[stub-fallback] 你是数据分析师… Echo: 查订单"))
    with pytest.raises(FakeReceiptError, match="stub-fallback"):
        assert_real_provider(trace)


def test_source_stub_with_body_is_a_fake_receipt() -> None:
    """一次模型调用都没发生，却有非空产出 —— 未接线。"""
    trace = _trace(_state(output="看起来像结论的一段话", source="stub", llm_calls=0))
    with pytest.raises(FakeReceiptError, match="source=stub"):
        assert_real_provider(trace)


def test_ok_with_zero_llm_calls_and_body_is_a_fake_receipt() -> None:
    """换一个字段看同一件事：status=ok 且 llm_calls=0，正文却非空。"""
    trace = _trace(_state(output="有产出", source="llm", llm_calls=0))
    with pytest.raises(FakeReceiptError, match="llm_calls=0"):
        assert_real_provider(trace)


def test_real_provider_output_passes_the_guard() -> None:
    """正例：真产出不被误伤——这是守卫不能过严的反证。"""
    trace = _trace(_state(output="订单对象 ont.t-1.obj.order.v1 有 3 条记录", llm_calls=3))
    assert_real_provider(trace)  # 不抛即通过
    assert trace.echo_reasons() == []


def test_error_result_with_empty_body_is_not_a_fake_receipt() -> None:
    """如实失败（status=error、空产出）**不是**假回执——它是可接受的一种结果。"""
    trace = _trace(_state(output="", status="error", llm_calls=0))
    assert_real_provider(trace)
    assert trace.echo_reasons() == []
