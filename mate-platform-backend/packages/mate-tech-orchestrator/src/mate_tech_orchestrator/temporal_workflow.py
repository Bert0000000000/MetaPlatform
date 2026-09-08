"""mate_tech_orchestrator.temporal_workflow — durable PlanWorkflow defn.

ADR-0061 Sprint 1A Milestone 1. Kept in its own module (not the ``__main__``
entry) so the Temporal workflow sandbox can re-import it by package path.
Execution delegates to activities wrapping :class:`PlanRunner`
(``orch_start_plan`` / ``orch_review_step``) — HITL 合一 semantics
(review approve = proposal confirm + apply) are preserved untouched;
Temporal adds durability, retry, and the HITL signal channel.
"""
from __future__ import annotations

import datetime
from typing import Any

from temporalio import workflow
from temporalio.common import RetryPolicy

from mate_tech_orchestrator.temporal_translation import ReviewSignal

_ACTIVITY_TIMEOUT = datetime.timedelta(minutes=10)
_RETRY = RetryPolicy(maximum_attempts=3)


@workflow.defn
class PlanWorkflow:
    """Durable plan execution: run → HITL signal → resume → … → terminal."""

    def __init__(self) -> None:
        self._review: ReviewSignal | None = None
        self._status = "running"

    @workflow.run
    async def run(self, inp: Any) -> dict[str, Any]:
        started = await workflow.execute_activity(
            "orch_start_plan", inp,
            start_to_close_timeout=_ACTIVITY_TIMEOUT, retry_policy=_RETRY,
        )
        plan_id: str = started["plan_id"]
        status: str = str(started.get("status", "failed"))

        while status == "hitl_waiting":
            step_id = str(started.get("current_step_id") or "")
            self._status = f"hitl_waiting:{step_id}"
            await workflow.wait_condition(lambda: self._review is not None)
            decision, self._review = self._review, None
            assert decision is not None
            self._status = "resuming"
            started = await workflow.execute_activity(
                "orch_review_step",
                {
                    "plan_id": plan_id,
                    "step_id": step_id,
                    "approved": decision.approved,
                    "feedback": decision.feedback,
                    "tenant_id": str(inp["tenant_id"]),
                    "token": str(inp.get("token", "")),
                },
                start_to_close_timeout=_ACTIVITY_TIMEOUT, retry_policy=_RETRY,
            )
            status = str(started.get("status", "failed"))
            if not decision.approved:
                break

        self._status = status
        return {"plan_id": plan_id, **{
            k: v for k, v in started.items() if k != "plan_id"
        }}

    @workflow.signal
    async def review(self, signal: ReviewSignal) -> None:
        self._review = signal

    @workflow.query
    def status(self) -> str:
        return self._status


@workflow.defn
class RevertWorkflow:
    """PRD-02 M3（FR-ACT-CONFIRM-007）：长补偿链 —— Temporal 驱动 proposal revert。

    单 activity 起步（幂等、可重试、历史留痕）；未来补偿链多步（外部系统
    广播、级联还原）在此 workflow 内扩展，不占业务语义。
    """

    def __init__(self) -> None:
        self._status = "running"

    @workflow.run
    async def run(self, inp: Any) -> dict[str, Any]:
        out = await workflow.execute_activity(
            "orch_revert_proposal", inp,
            start_to_close_timeout=_ACTIVITY_TIMEOUT, retry_policy=_RETRY,
        )
        self._status = str(out.get("status", "failed"))
        return out

    @workflow.query
    def status(self) -> str:
        return self._status
