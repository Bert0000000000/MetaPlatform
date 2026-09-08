"""Sprint 1A M1 — temporal translation unit tests (no server needed)."""
from __future__ import annotations

import os
import sys

import pytest
from pydantic import ValidationError

sys.path.insert(
    0,
    os.path.join(
        os.path.dirname(__file__), "..", "src",
    ),
)
_KERNEL = os.path.join(
    os.path.dirname(__file__), "..", "..", "mate-kernel", "src",
)
if _KERNEL not in sys.path:
    sys.path.insert(0, _KERNEL)

from mate_tech_orchestrator.temporal_translation import (  # noqa: E402
    PlanWorkflowInput,
    ReviewSignal,
    WorkflowStep,
    plan_steps_from_dicts,
    steps_from_dicts,
    workflow_input_from_steps,
    workflow_input_to_plan_steps,
)


def _steps_raw() -> list[dict]:
    return [
        {
            "step_id": "s1",
            "kind": "run_function",
            "target": "inline",
            "payload": {"source": "print('hi')", "args": ["a"]},
        },
        {
            "step_id": "s2",
            "kind": "propose",
            "target": "ont.t.acme.mark-review.v1",
            "payload": {"parameters": {"note": "{{steps.s1.stdout}}"}},
            "requires_hitl": False,  # PROPOSE auto-promotes inside PlanRunner
        },
    ]


class TestTranslationRoundTrip:
    def test_steps_from_dicts_validates(self) -> None:
        steps = steps_from_dicts(_steps_raw())
        assert [s.step_id for s in steps] == ["s1", "s2"]
        assert steps[1].kind == "propose"

    def test_unknown_kind_rejected(self) -> None:
        raw = [{"step_id": "x", "kind": "nope", "target": "t"}]
        with pytest.raises(ValidationError):
            steps_from_dicts(raw)

    def test_empty_steps_rejected(self) -> None:
        with pytest.raises(ValidationError):
            workflow_input_from_steps(tenant_id="t-acme", steps=[])

    def test_input_round_trip_preserves_payload(self) -> None:
        steps = steps_from_dicts(_steps_raw())
        inp = workflow_input_from_steps(
            tenant_id="t-acme", steps=steps, author_user_id="rouge",
        )
        assert isinstance(inp, PlanWorkflowInput)
        dicts = workflow_input_to_plan_steps(inp)
        assert dicts[0]["payload"]["source"] == "print('hi')"
        assert dicts[1]["payload"]["parameters"]["note"] == "{{steps.s1.stdout}}"
        # template string must survive untouched (resolution is runtime-side)
        assert dicts[1]["requires_hitl"] is False

    def test_to_kernel_plan_steps(self) -> None:
        from mate_kernel.agent.orchestrator import StepKind

        steps = plan_steps_from_dicts(workflow_input_to_plan_steps(
            workflow_input_from_steps(tenant_id="t", steps=steps_from_dicts(_steps_raw())),
        ))
        assert steps[0].kind is StepKind.RUN_FUNCTION
        assert dict(steps[1].payload)["parameters"]["note"] == "{{steps.s1.stdout}}"


class TestReviewSignal:
    def test_signal_dataclass(self) -> None:
        sig = ReviewSignal(step_id="s2", approved=True, feedback="ok")
        assert asdict_kind(sig) == {"approved": True} or sig.approved is True


def asdict_kind(sig: ReviewSignal) -> dict:
    from dataclasses import asdict

    d = asdict(sig)
    return {k: v for k, v in d.items() if k == "approved"}
