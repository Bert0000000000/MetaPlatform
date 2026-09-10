"""mate_tech_orchestrator.temporal_translation — PlanRunner DSL → Temporal.

ADR-0061 Sprint 1A Milestone 1: translate the orchestrator plan DSL
(``SubmitPlanRequest`` shape) into plain-dict workflow input that is
safe for Temporal serialization, and back. The workflow/activities in
:mod:`mate_tech_orchestrator.temporal_worker` consume this input and
delegate execution to :class:`~...scheduler.plan_runner.PlanRunner`
(HITL 合一 semantics preserved untouched).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

StepKindLiteral = Literal[
    "call_agent",
    "apply_action",
    "propose",
    "run_function",
    "evaluate_object_set",
]

TASK_QUEUE = "plan-orchestration"
TEMPORAL_HOST = (
    "127.0.0.1:7233"  # NOT localhost: IPv6 resolution breaks gRPC h2 on some Windows hosts
)


class WorkflowStep(BaseModel):
    """Temporal-serializable plan step (mirrors PlanStepRequest)."""

    model_config = ConfigDict(extra="forbid")

    step_id: str = Field(min_length=1)
    kind: StepKindLiteral = "call_agent"
    target: str = Field(min_length=1)
    payload: dict[str, Any] = Field(default_factory=dict)
    requires_hitl: bool = False


class PlanWorkflowInput(BaseModel):
    """Single payload handed to ``PlanWorkflow`` at start."""

    model_config = ConfigDict(extra="forbid")

    plan_id: str = ""  # empty → PlanRunner.submit mints one
    author_user_id: str = "system"
    tenant_id: str = Field(min_length=1)
    token: str = ""
    steps: list[WorkflowStep] = Field(min_length=1)


@dataclass(frozen=True, slots=True)
class ReviewSignal:
    """HITL decision delivered to the running workflow via signal."""

    step_id: str
    approved: bool
    feedback: str = ""
    reviewer: str = "reviewer"
    metadata: dict[str, str] = field(default_factory=dict)


def workflow_input_from_steps(
    *,
    tenant_id: str,
    steps: list[WorkflowStep],
    author_user_id: str = "system",
    token: str = "",
) -> PlanWorkflowInput:
    """Build workflow input from already-validated workflow steps."""
    return PlanWorkflowInput(
        author_user_id=author_user_id,
        tenant_id=tenant_id,
        token=token,
        steps=steps,
    )


def steps_from_dicts(raw_steps: list[dict[str, Any]]) -> list[WorkflowStep]:
    """Validate raw step dicts (e.g. from REST body) into workflow steps."""
    return [WorkflowStep.model_validate(s) for s in raw_steps]


def workflow_input_to_plan_steps(inp: PlanWorkflowInput) -> list[dict[str, Any]]:
    """Workflow input → plain-dict steps for PlanRunner reconstruction."""
    return [
        {
            "step_id": s.step_id,
            "kind": s.kind,
            "target": s.target,
            "payload": dict(s.payload),
            "requires_hitl": s.requires_hitl,
        }
        for s in inp.steps
    ]


def plan_steps_from_dicts(raw_steps: list[dict[str, Any]]):
    """Plain-dict steps → kernel ``PlanStep`` objects (worker-side)."""
    from mate_kernel.agent.orchestrator import PlanStep, StepKind

    out: list = []
    for s in raw_steps:
        out.append(
            PlanStep(
                step_id=str(s["step_id"]),
                kind=StepKind(str(s.get("kind", "call_agent"))),
                target=str(s["target"]),
                payload=tuple((dict(s.get("payload") or {})).items()),
                requires_hitl=bool(s.get("requires_hitl", False)),
            )
        )
    return out
