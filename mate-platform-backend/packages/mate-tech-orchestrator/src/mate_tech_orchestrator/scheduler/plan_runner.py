"""mate_tech_orchestrator.scheduler.plan_runner — plan orchestration + HITL.

Wraps the kernel ``SuperAIOrchestrator`` (plan state machine) with a
real step runner: each ``call_agent`` step is dispatched to the right
digital-employee role via the Dispatcher. HITL steps (decision B3:
≥1 per plan) pause execution and wait for review to resume.
"""
from __future__ import annotations

import uuid
from typing import Any

from mate_kernel.agent.orchestrator import (
    PlanSpec,
    PlanState,
    PlanStep,
    StepKind,
    StepResult,
    StepStatus,
    SuperAIOrchestrator,
)

from .dispatcher import Dispatcher, NoRoleForTaskError, get_dispatcher


class PlanRunnerError(Exception):
    """Base error for the plan runner."""


class NoHitlStepError(PlanRunnerError):
    """Raised when a plan has no HITL step (decision B3)."""


class PlanNotFoundError(PlanRunnerError):
    """Raised when a plan_id is unknown."""


class PlanRunner:
    """Submit / execute / review multi-role plans over the dispatcher."""

    def __init__(
        self,
        orchestrator: SuperAIOrchestrator | None = None,
        dispatcher: Dispatcher | None = None,
    ) -> None:
        self._orch = orchestrator or SuperAIOrchestrator()
        self._dispatcher = dispatcher or get_dispatcher()

    def submit(
        self,
        *,
        author_user_id: str,
        steps: list[PlanStep],
    ) -> PlanSpec:
        """Build + submit a PlanSpec (validates ≥1 HITL per decision B3)."""
        if not any(s.requires_hitl for s in steps):
            raise NoHitlStepError(
                "plan must include at least one HITL step (decision B3)"
            )
        spec = PlanSpec(
            plan_id=uuid.uuid4().hex,
            author_user_id=author_user_id,
            steps=tuple(steps),
        )
        self._orch.submit(spec)
        return spec

    def get(self, plan_id: str) -> PlanState:
        try:
            return self._orch.get(plan_id)
        except KeyError as e:
            raise PlanNotFoundError(f"plan not found: {plan_id}") from e

    async def execute(self, *, plan_id: str, tenant_id: str) -> dict[str, Any]:
        """Run the plan step-by-step, dispatching non-HITL steps to workers.

        Stops at the first HITL step (records HITL_WAITING); the caller
        resumes via ``review``.
        """
        state = self.get(plan_id)
        results: list[dict[str, Any]] = []
        while True:
            step = state.current_step
            if step is None:
                return {
                    "plan_id": plan_id,
                    "status": "completed" if not state.aborted else "aborted",
                    "current_step_id": None,
                    "results": results,
                }
            if step.requires_hitl:
                self._orch.record(
                    plan_id,
                    StepResult(step_id=step.step_id, status=StepStatus.HITL_WAITING),
                )
                return {
                    "plan_id": plan_id,
                    "status": "hitl_waiting",
                    "current_step_id": step.step_id,
                    "results": results,
                }
            try:
                out = await self._dispatch_step(tenant_id, step)
                self._orch.record(
                    plan_id,
                    StepResult(step_id=step.step_id, status=StepStatus.COMPLETED, output=out),
                )
                results.append({"step_id": step.step_id, "status": "completed", "output": out})
            except NoRoleForTaskError as e:
                self._orch.record(
                    plan_id,
                    StepResult(step_id=step.step_id, status=StepStatus.FAILED, error=str(e)),
                )
                return {
                    "plan_id": plan_id,
                    "status": "failed",
                    "current_step_id": step.step_id,
                    "error": str(e),
                    "results": results,
                }
        # pragma: no cover - unreachable
        return {"plan_id": plan_id, "status": "unknown", "results": results}

    async def review(
        self,
        *,
        plan_id: str,
        step_id: str,
        approved: bool,
        feedback: str = "",
        tenant_id: str,
    ) -> dict[str, Any]:
        """Resolve a HITL step and resume the plan (approve → continue)."""
        self.get(plan_id)
        if approved:
            self._orch.record(
                plan_id,
                StepResult(step_id=step_id, status=StepStatus.COMPLETED, output={"feedback": feedback}),
            )
            return await self.execute(plan_id=plan_id, tenant_id=tenant_id)
        self._orch.abort(plan_id, feedback or "rejected by reviewer")
        return {
            "plan_id": plan_id,
            "status": "aborted",
            "current_step_id": None,
            "results": [],
        }

    async def _dispatch_step(self, tenant_id: str, step: PlanStep) -> Any:
        if step.kind not in (StepKind.CALL_AGENT,):
            raise NoRoleForTaskError(
                f"step kind {step.kind.value!r} not runnable by the dispatcher yet"
            )
        payload = dict(step.payload)
        # Resolve the dispatcher at call time so DI (set_dispatcher) and the
        # module singleton stay consistent across tests / restart.
        return await get_dispatcher().dispatch(
            tenant_id=tenant_id,
            target_rid=step.target,
            action=payload.pop("action", ""),
            arguments=payload,
        )


_default_runner: PlanRunner | None = None


def get_plan_runner() -> PlanRunner:
    global _default_runner
    if _default_runner is None:
        _default_runner = PlanRunner()
    return _default_runner


def set_plan_runner(runner: PlanRunner | None) -> None:
    global _default_runner
    _default_runner = runner
