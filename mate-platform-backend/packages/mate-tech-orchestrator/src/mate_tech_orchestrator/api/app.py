"""mate_tech_orchestrator.api.app — orchestrator HTTP surface.

Endpoints (``contracts/openapi/services/orchestrator.yaml``):

  - POST   /api/v1/orchestrator/roles                — register a digital-employee role
  - GET    /api/v1/orchestrator/roles                — list registered roles
  - DELETE /api/v1/orchestrator/roles/{role}         — unregister a role
  - POST   /api/v1/orchestrator/dispatch             — single-task multi-role dispatch
  - POST   /api/v1/orchestrator/plans                — submit a plan (≥1 HITL, B3)
  - GET    /api/v1/orchestrator/plans/{plan_id}      — plan status
  - POST   /api/v1/orchestrator/plans/{plan_id}/execute — run the plan
  - POST   /api/v1/orchestrator/plans/{plan_id}/steps/{step_id}/review — HITL resolve

Every handler enforces ``require_tenant`` (ADR-0014 step 2) before
touching a repository, and write handlers emit
``orchestrator.<aggregate>.<verb>`` outbox events (step 3).
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request

from mate_kernel.agent.orchestrator import PlanStep, StepKind
from mate_platform.messaging.events import Event
from mate_platform.messaging.outbox import InMemoryOutboxWriter
from mate_platform.tenancy.context import TenantId
from mate_platform.tenancy.guards import require_tenant

from ..scheduler.dispatcher import (
    DispatcherError,
    NoRoleForTaskError,
    get_dispatcher,
)
from ..scheduler.plan_runner import (
    NoHitlStepError,
    PlanNotFoundError,
    get_plan_runner,
)
from ..scheduler.role_registry import (
    CapabilityBinding,
    RoleRegistryError,
    binding_to_dict,
    get_role_registry,
)
from .schemas import (
    DispatchRequest,
    PlanStatus,
    PlanStepStatus,
    RegisterRoleRequest,
    ReviewRequest,
    SubmitPlanRequest,
)

router = APIRouter(prefix="/api/v1/orchestrator", tags=["orchestrator"])


def _tid(request: Request) -> str:
    ctx = request.state.ctx
    return str(require_tenant(ctx))


def _emit(
    request: Request,
    event_type: str,
    aggregate_id: str,
    payload: dict[str, Any],
    tenant_id: str,
) -> None:
    writer: InMemoryOutboxWriter | None = getattr(request.app.state, "outbox_writer", None)
    if writer is None:
        return
    ctx = getattr(request.state, "ctx", None)
    trace_id = getattr(ctx, "trace_id", "") if ctx is not None else ""
    writer.append(
        Event.create(
            type=event_type,
            tenant_id=TenantId(tenant_id),
            aggregate_id=aggregate_id,
            payload=payload,
            trace_id=trace_id,
        )
    )


# --- Roles ------------------------------------------------------------------
@router.post("/roles", status_code=201)
async def register_role(request: Request, body: RegisterRoleRequest) -> dict[str, Any]:
    tid = _tid(request)
    try:
        role = get_role_registry().register(
            tenant_id=tid,
            role=body.role,
            name=body.name,
            capabilities=[
                CapabilityBinding(name=c.name, worker_kind=c.worker_kind, ref=c.ref)
                for c in body.capabilities
            ],
        )
    except (RoleRegistryError, ValueError) as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    _emit(
        request,
        "orchestrator.role.registered",
        role.role,
        {"role": role.role, "capabilities": [c.name for c in role.capabilities]},
        tid,
    )
    return {
        "role": role.role,
        "name": role.name,
        "capabilities": [binding_to_dict(c) for c in role.capabilities],
    }


@router.get("/roles")
async def list_roles(request: Request) -> dict[str, Any]:
    tid = _tid(request)
    roles = [
        {
            "role": r.role,
            "name": r.name,
            "capabilities": [binding_to_dict(c) for c in r.capabilities],
            "enabled": r.enabled,
        }
        for r in get_role_registry().list(tid)
    ]
    return {"items": roles, "total": len(roles)}


@router.delete("/roles/{role}")
async def unregister_role(role: str, request: Request) -> dict[str, str]:
    tid = _tid(request)
    ok = get_role_registry().unregister(tid, role)
    if not ok:
        raise HTTPException(status_code=404, detail=f"role not registered: {role}")
    _emit(request, "orchestrator.role.unregistered", role, {"role": role}, tid)
    return {"deleted": role}


# --- Dispatch ---------------------------------------------------------------
@router.post("/dispatch")
async def dispatch(request: Request, body: DispatchRequest) -> dict[str, Any]:
    tid = _tid(request)
    try:
        result = await get_dispatcher().dispatch(
            tenant_id=tid,
            target_rid=body.target_rid,
            capability=body.capability,
            action=body.action,
            arguments=body.arguments,
        )
    except NoRoleForTaskError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except DispatcherError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    _emit(
        request,
        "orchestrator.dispatch.completed",
        result["task_id"],
        {
            "task_id": result["task_id"],
            "role": result["role"],
            "capability": result["capability"],
            "worker_kind": result["worker_kind"],
        },
        tid,
    )
    return result


# --- Plans ------------------------------------------------------------------
@router.post("/plans", status_code=201)
async def submit_plan(request: Request, body: SubmitPlanRequest) -> dict[str, Any]:
    tid = _tid(request)
    steps = [
        PlanStep(
            step_id=s.step_id,
            kind=StepKind(s.kind),
            target=s.target,
            payload=tuple(s.payload.items()),
            requires_hitl=s.requires_hitl,
        )
        for s in body.steps
    ]
    try:
        spec = get_plan_runner().submit(author_user_id=body.author_user_id, steps=steps)
    except NoHitlStepError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    _emit(
        request,
        "orchestrator.plan.submitted",
        spec.plan_id,
        {"plan_id": spec.plan_id, "step_count": len(spec.steps)},
        tid,
    )
    return {"plan_id": spec.plan_id, "status": "submitted", "step_count": len(spec.steps)}


@router.get("/plans/{plan_id}", response_model=PlanStatus)
async def plan_status(plan_id: str, request: Request) -> PlanStatus:
    _tid(request)  # tenant guard (plan state is in-memory; guarded here)
    try:
        state = get_plan_runner().get(plan_id)
    except PlanNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return PlanStatus(
        plan_id=state.plan.plan_id,
        author_user_id=state.plan.author_user_id,
        current_step_id=state.current_step.step_id if state.current_step else None,
        aborted=state.aborted,
        history=[
            PlanStepStatus(step_id=h.step_id, status=h.status.value, output=h.output, error=h.error)
            for h in state.history
        ],
    )


@router.post("/plans/{plan_id}/execute")
async def plan_execute(plan_id: str, request: Request) -> dict[str, Any]:
    tid = _tid(request)
    try:
        return await get_plan_runner().execute(plan_id=plan_id, tenant_id=tid)
    except PlanNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.post("/plans/{plan_id}/steps/{step_id}/review")
async def plan_review(
    plan_id: str, step_id: str, request: Request, body: ReviewRequest,
) -> dict[str, Any]:
    tid = _tid(request)
    try:
        return await get_plan_runner().review(
            plan_id=plan_id,
            step_id=step_id,
            approved=body.approved,
            feedback=body.feedback,
            tenant_id=tid,
        )
    except PlanNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
