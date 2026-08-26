"""Stable workflow run API backed by the configured workflow executor."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header, HTTPException, Path, Request
from pydantic import BaseModel, Field

from mate_platform.tenancy.guards import require_tenant
from mate_platform.workflow import Plan, PlanStep, WorkflowExecutor

router = APIRouter(prefix="/api/v1", tags=["workflows"])


class PlanStepPayload(BaseModel):
    """API representation of one backend-neutral Plan step."""

    id: str = Field(min_length=1)
    action_type: str = Field(min_length=1)
    input: dict[str, Any] = Field(default_factory=dict)
    requires_confirmation: bool = False


class WorkflowStartRequest(BaseModel):
    """Request body for starting a durable workflow run."""

    version: str = Field(default="1.0", min_length=1)
    steps: list[PlanStepPayload] = Field(min_length=1)
    input: dict[str, Any] = Field(default_factory=dict)
    trace_id: str = ""
    correlation_id: str = ""


def _tenant_id(request: Request) -> str:
    return str(require_tenant(request.state.ctx))


def _executor(request: Request) -> WorkflowExecutor:
    executor = getattr(request.app.state, "workflow_executor", None)
    if executor is None:
        raise HTTPException(status_code=503, detail="workflow backend unavailable")
    return executor


def _status_url(run_id: str) -> str:
    return f"/api/v1/workflow-runs/{run_id}"


def _build_plan(
    definition_id: str, tenant_id: str, body: WorkflowStartRequest,
) -> Plan:
    return Plan(
        definition_id=definition_id,
        version=body.version,
        tenant_id=tenant_id,
        steps=tuple(
            PlanStep(
                id=step.id,
                action_type=step.action_type,
                input=step.input,
                requires_confirmation=step.requires_confirmation,
            )
            for step in body.steps
        ),
        input=body.input,
        trace_id=body.trace_id,
        correlation_id=body.correlation_id,
    )


@router.post("/workflows/{definition_id}/runs", status_code=202)
async def start_workflow(
    request: Request,
    body: WorkflowStartRequest,
    definition_id: str = Path(min_length=1),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict[str, Any]:
    """Start a workflow and return its stable status URL."""
    if not idempotency_key or not idempotency_key.strip():
        raise HTTPException(status_code=400, detail="Idempotency-Key is required")

    try:
        plan = _build_plan(definition_id, _tenant_id(request), body)
        run = await _executor(request).start(
            plan,
            idempotency_key=idempotency_key.strip(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except (OSError, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="workflow backend unavailable") from exc

    return {
        "run_id": run.run_id,
        "status": run.status.value,
        "status_url": _status_url(run.run_id),
    }


@router.get("/workflow-runs/{run_id}")
async def get_workflow_run(
    request: Request,
    run_id: str = Path(min_length=1),
) -> dict[str, Any]:
    """Read one workflow run after enforcing tenant ownership."""
    tenant_id = _tenant_id(request)
    try:
        run = await _executor(request).get(run_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workflow run not found") from exc
    except (OSError, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="workflow backend unavailable") from exc
    if run.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="workflow run not found")
    return run.to_dict()
