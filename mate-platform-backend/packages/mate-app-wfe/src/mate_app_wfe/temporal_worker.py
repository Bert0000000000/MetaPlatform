"""Temporal workflow and worker definitions for the WFE application."""
from __future__ import annotations

from datetime import timedelta
from typing import Any, Protocol

from temporalio import activity, workflow
from temporalio.client import Client
from temporalio.common import RetryPolicy
from temporalio.worker import Worker

with workflow.unsafe.imports_passed_through():
    from mate_platform.workflow import WorkflowBackend, WorkflowSettings

ACTION_ACTIVITY_NAME = "mate.workflow.execute_action"
RUN_STATE_QUERY = "mate.workflow.run_state"
CONFIRM_SIGNAL = "mate.workflow.confirm"
REJECT_SIGNAL = "mate.workflow.reject"


class ActionExecutor(Protocol):
    """Application action port used by the Temporal activity."""

    async def execute(self, payload: dict[str, Any]) -> dict[str, Any]:
        ...


def make_action_activity(
    action_executor: ActionExecutor | None,
) -> Any:
    """Build the activity closure used by a configured worker.

    No dispatcher means a hard failure. There is intentionally no synthetic
    action result in this function.
    """

    @activity.defn(name=ACTION_ACTIVITY_NAME)
    async def execute_action(payload: dict[str, Any]) -> dict[str, Any]:
        if action_executor is None:
            raise RuntimeError("workflow action executor is not configured")
        return await action_executor.execute(payload)

    return execute_action


@workflow.defn(name="mate.workflow.execute")
class PlanWorkflow:
    """Deterministic Plan runner with explicit human approval gates."""

    def __init__(self) -> None:
        self._state: dict[str, Any] = {}
        self._approved_steps: set[str] = set()
        self._rejected_steps: set[str] = set()

    @workflow.run
    async def run(self, envelope: dict[str, Any]) -> dict[str, Any]:
        plan = envelope.get("plan")
        if not isinstance(plan, dict):
            return self._failed_state(envelope, "workflow plan is missing")

        steps = plan.get("steps")
        if not isinstance(steps, list) or not steps:
            return self._failed_state(envelope, "workflow plan has no steps")

        self._state = self._initial_state(envelope, plan)
        failure: str | None = None
        canceled = False
        for raw_step in steps:
            if not isinstance(raw_step, dict):
                failure = "workflow plan contains an invalid step"
                break
            step_id = str(raw_step.get("id", ""))
            if not step_id:
                failure = "workflow step id is missing"
                break

            if raw_step.get("requires_confirmation", False):
                self._state["status"] = "waiting_approval"
                self._state["pending_step_id"] = step_id
                self._touch()
                await workflow.wait_condition(
                    lambda step_id=step_id: step_id in self._approved_steps
                    or step_id in self._rejected_steps
                )
                if step_id in self._rejected_steps:
                    failure = "rejected by operator"
                    canceled = True
                    break

            self._state["status"] = "running"
            self._state["pending_step_id"] = None
            self._touch()
            try:
                result = await workflow.execute_activity(
                    ACTION_ACTIVITY_NAME,
                    {
                        "run_id": self._state["run_id"],
                        "tenant_id": self._state["tenant_id"],
                        "step": raw_step,
                    },
                    start_to_close_timeout=timedelta(minutes=5),
                    retry_policy=RetryPolicy(maximum_attempts=1),
                )
            except Exception as exc:
                failure = f"action execution failed: {exc}"
                break
            self._state["results"].append(result)

        if failure is not None:
            if canceled:
                self._canceled(failure)
            else:
                self._failed(failure)
        else:
            self._state["status"] = "completed"
            self._touch()
        return dict(self._state)

    @workflow.query(name=RUN_STATE_QUERY)
    def run_state(self) -> dict[str, Any]:
        """Return the stable public state consumed by the API adapter."""
        return dict(self._state)

    @workflow.signal(name=CONFIRM_SIGNAL)
    def confirm(self, step_id: str) -> None:
        self._approved_steps.add(step_id)

    @workflow.signal(name=REJECT_SIGNAL)
    def reject(self, step_id: str) -> None:
        self._rejected_steps.add(step_id)

    def _initial_state(
        self, envelope: dict[str, Any], plan: dict[str, Any],
    ) -> dict[str, Any]:
        now = workflow.now().isoformat()
        return {
            "run_id": str(envelope.get("run_id", "")),
            "definition_id": str(plan.get("definition_id", "")),
            "version": str(plan.get("version", "")),
            "tenant_id": str(plan.get("tenant_id", "")),
            "status": "running",
            "idempotency_key": str(envelope.get("idempotency_key", "")),
            "created_at": now,
            "updated_at": now,
            "error": None,
            "pending_step_id": None,
            "results": [],
        }

    def _failed_state(
        self, envelope: dict[str, Any], error: str,
    ) -> dict[str, Any]:
        self._state = {
            "run_id": str(envelope.get("run_id", "")),
            "definition_id": "",
            "version": "",
            "tenant_id": "",
            "status": "failed",
            "idempotency_key": str(envelope.get("idempotency_key", "")),
            "created_at": workflow.now().isoformat(),
            "updated_at": workflow.now().isoformat(),
            "error": error,
            "pending_step_id": None,
            "results": [],
        }
        return dict(self._state)

    def _failed(self, error: str) -> dict[str, Any]:
        self._state["status"] = "failed"
        self._state["error"] = error
        self._state["pending_step_id"] = None
        self._touch()
        return dict(self._state)

    def _canceled(self, error: str) -> dict[str, Any]:
        self._state["status"] = "canceled"
        self._state["error"] = error
        self._state["pending_step_id"] = None
        self._touch()
        return dict(self._state)

    def _touch(self) -> None:
        self._state["updated_at"] = workflow.now().isoformat()


def build_temporal_worker(
    client: Client,
    settings: WorkflowSettings,
    *,
    action_executor: ActionExecutor | None,
) -> Worker:
    """Build a worker only for the Temporal backend with a real dispatcher."""
    if settings.backend is not WorkflowBackend.TEMPORAL:
        raise RuntimeError("Temporal worker requires the Temporal backend")
    if action_executor is None:
        raise RuntimeError("workflow action executor is required for the worker")
    return Worker(
        client,
        task_queue=settings.task_queue,
        workflows=[PlanWorkflow],
        activities=[make_action_activity(action_executor)],
    )


async def connect_temporal_worker(
    settings: WorkflowSettings,
    *,
    action_executor: ActionExecutor | None,
) -> Worker:
    """Connect to Temporal and return the configured worker."""
    if settings.backend is not WorkflowBackend.TEMPORAL:
        raise RuntimeError("Temporal worker requires the Temporal backend")
    client = await Client.connect(
        settings.temporal_address,
        namespace=settings.namespace,
    )
    return build_temporal_worker(
        client,
        settings,
        action_executor=action_executor,
    )
