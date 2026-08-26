"""Temporal workflow and activity contract tests."""
from __future__ import annotations

import asyncio
from typing import Any

import pytest
from mate_app_wfe.temporal_worker import PlanWorkflow, make_action_activity
from temporalio.testing import ActivityEnvironment, WorkflowEnvironment
from temporalio.worker import Worker


def _envelope(*, requires_confirmation: bool = True) -> dict[str, Any]:
    return {
        "run_id": "run-temporal-1",
        "idempotency_key": "idem-temporal-1",
        "plan": {
            "definition_id": "order-review",
            "version": "1.0",
            "tenant_id": "tenant-acme",
            "steps": [
                {
                    "id": "review",
                    "action_type": "order.review",
                    "input": {"order_id": "order-1"},
                    "requires_confirmation": requires_confirmation,
                }
            ],
            "input": {},
            "trace_id": "trace-1",
            "correlation_id": "corr-1",
        },
    }


class _ActionExecutor:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    async def execute(self, payload: dict[str, Any]) -> dict[str, str]:
        self.calls.append(payload)
        return {"action": payload["step"]["action_type"], "status": "applied"}


@pytest.mark.asyncio
async def test_temporal_workflow_waits_for_approval_then_executes_action() -> None:
    environment = await WorkflowEnvironment.start_time_skipping()
    action_executor = _ActionExecutor()
    task_queue = "mate-workflow-test"
    try:
        async with Worker(
            environment.client,
            task_queue=task_queue,
            workflows=[PlanWorkflow],
            activities=[make_action_activity(action_executor)],
        ):
            handle = await environment.client.start_workflow(
                "mate.workflow.execute",
                _envelope(),
                id="mate-workflow-run-temporal-1",
                task_queue=task_queue,
            )
            state = await _wait_for_status(handle, "waiting_approval")
            assert state["pending_step_id"] == "review"

            await handle.signal("mate.workflow.confirm", "review")
            result = await handle.result()

        assert result["status"] == "completed"
        assert result["results"] == [
            {"action": "order.review", "status": "applied"}
        ]
        assert action_executor.calls[0]["tenant_id"] == "tenant-acme"
    finally:
        await environment.shutdown()


@pytest.mark.asyncio
async def test_reject_signal_cancels_before_any_action() -> None:
    environment = await WorkflowEnvironment.start_time_skipping()
    action_executor = _ActionExecutor()
    task_queue = "mate-workflow-reject-test"
    try:
        async with Worker(
            environment.client,
            task_queue=task_queue,
            workflows=[PlanWorkflow],
            activities=[make_action_activity(action_executor)],
        ):
            handle = await environment.client.start_workflow(
                "mate.workflow.execute",
                _envelope(),
                id="mate-workflow-run-temporal-reject",
                task_queue=task_queue,
            )
            await _wait_for_status(handle, "waiting_approval")
            await handle.signal("mate.workflow.reject", "review")
            result = await handle.result()

        assert result["status"] == "canceled"
        assert result["error"] == "rejected by operator"
        assert action_executor.calls == []
    finally:
        await environment.shutdown()


@pytest.mark.asyncio
async def test_action_activity_fails_closed_without_dispatcher() -> None:
    environment = ActivityEnvironment()

    with pytest.raises(RuntimeError, match="not configured"):
        await environment.run(
            make_action_activity(None),
            {"tenant_id": "tenant-acme", "step": {"action_type": "order.review"}},
        )


async def _wait_for_status(handle: Any, expected: str) -> dict[str, Any]:
    for _ in range(40):
        state = await handle.query("mate.workflow.run_state")
        if state.get("status") == expected:
            return state
        await asyncio.sleep(0.05)
    raise AssertionError(f"workflow did not reach {expected!r}")
