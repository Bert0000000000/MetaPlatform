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

from ..scheduler.capability_runtime import get_capability_runtime
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
from ..workers.a2a import get_a2a_worker
from .schemas import (
    DispatchRequest,
    GraphEdge,
    GraphNode,
    PlanGraph,
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


def _user_token(request: Request) -> str:
    """透传用户 Bearer（ctx 属性缺省时回落原始 Authorization 头）。"""
    token = str(getattr(request.state.ctx, "authorization", "") or "")
    if not token:
        raw = request.headers.get("Authorization", "")
        if raw.lower().startswith("bearer "):
            token = raw[7:].strip()
    return token


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
    runtime = get_capability_runtime()
    if runtime is not None:
        await runtime.attach_role(role)  # MP-COMP-01: bind fate to capability liveness
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
    runtime = get_capability_runtime()
    if runtime is not None:
        await runtime.detach_role(tid, role)  # MP-COMP-01: drop the role fiber
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


# --- Dispatch task status (poll surface for the copilot agent loop) ---------
@router.get("/tasks/{task_id}")
async def task_status(task_id: str, request: Request) -> dict[str, Any]:
    """Read the outcome of a previously dispatched A2A task.

    Wraps ``A2AWorker.get_task`` so the copilot agent loop can poll a
    genuinely-async delegation without opening a second outbound client.
    """
    tid = _tid(request)
    try:
        return await get_a2a_worker().get_task(tenant_id=tid, task_id=task_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"task read failed: {e}") from e


# --- Plans ------------------------------------------------------------------
@router.post("/plans", status_code=201)
async def submit_plan(
    request: Request, body: SubmitPlanRequest, engine: str = "",
) -> dict[str, Any]:
    tid = _tid(request)
    # ADR-0061 双轨开关：?engine=temporal（或 WORKFLOW_ENGINE=temporal）走
    # Temporal 持久路径；缺省 legacy（内存 PlanRunner）语义不变。
    from ..temporal_rest import engine_from, is_available, submit_and_run

    if engine_from(None, engine) == "temporal":
        if not is_available():
            raise HTTPException(
                status_code=503,
                detail="temporal engine unavailable: temporalio not installed "
                       "in this service image",
            )
        return await submit_and_run(
            tenant_id=tid, token=_user_token(request),
            author_user_id=body.author_user_id,
            raw_steps=[s.model_dump() for s in body.steps],
        )
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


@router.get("/plans/{plan_id}")
async def plan_status(plan_id: str, request: Request) -> Any:
    _tid(request)  # tenant guard (plan state is in-memory; guarded here)
    from ..temporal_rest import is_temporal_plan, is_available, status as twf_status

    if is_temporal_plan(plan_id):
        if not is_available():
            raise HTTPException(status_code=503, detail="temporal engine unavailable")
        return await twf_status(plan_id)
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
    token = _user_token(request)
    from ..temporal_rest import is_temporal_plan

    if is_temporal_plan(plan_id):
        raise HTTPException(
            status_code=409,
            detail="temporal-engine plans start on submit; execute is implicit",
        )
    try:
        return await get_plan_runner().execute(plan_id=plan_id, tenant_id=tid, token=token)
    except PlanNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.post("/plans/{plan_id}/steps/{step_id}/review")
async def plan_review(
    plan_id: str, step_id: str, request: Request, body: ReviewRequest,
) -> dict[str, Any]:
    tid = _tid(request)
    token = _user_token(request)
    from ..temporal_rest import is_temporal_plan, is_available
    from .. import temporal_rest

    if is_temporal_plan(plan_id):
        if not is_available():
            raise HTTPException(status_code=503, detail="temporal engine unavailable")
        return await temporal_rest.review(
            plan_id=plan_id, step_id=step_id,
            approved=body.approved, feedback=body.feedback,
        )
    try:
        return await get_plan_runner().review(
            plan_id=plan_id,
            step_id=step_id,
            approved=body.approved,
            feedback=body.feedback,
            tenant_id=tid,
            token=token,
        )
    except PlanNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.get("/plans/{plan_id}/graph", response_model=PlanGraph)
async def plan_graph(plan_id: str, request: Request) -> PlanGraph:
    """MP-SAL-05 可视化：plan → 节点/边图模型（实时状态 + proposal 关联 + 数据流引用）。"""
    _tid(request)
    try:
        state = get_plan_runner().get(plan_id)
    except PlanNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    latest: dict[str, Any] = {}
    for h in state.history:
        latest[h.step_id] = h  # 后写覆盖前写
    cur = state.current_step.step_id if state.current_step else None
    nodes: list[GraphNode] = []
    for s in state.plan.steps:
        h = latest.get(s.step_id)
        if h is not None:
            status = h.status.value
        elif s.step_id == cur and not state.aborted:
            status = "running"
        elif state.aborted:
            status = "skipped"
        else:
            status = "pending"
        out = h.output if isinstance(h.output, dict) else {}
        nodes.append(GraphNode(
            id=s.step_id,
            kind=s.kind.value,
            target=s.target,
            hitl=s.requires_hitl or s.kind.value in ("propose", "apply_action"),
            status=status,
            proposal_id=out.get("proposal_id"),
            expected_diff=out.get("expected_diff"),
            impact_summary=str(out.get("impact_summary") or ""),
        ))

    import re as _re

    edges: list[GraphEdge] = []
    steps = state.plan.steps
    for a, b in zip(steps, steps[1:], strict=False):
        refs = [
            v for _, v in dict(b.payload).items()
            if isinstance(v, str)
            and _re.search(r"\{\{steps\.[A-Za-z0-9_\-]+\.", v)
        ]
        edges.append(GraphEdge(
            from_step=a.step_id, to_step=b.step_id, data_refs=refs,
        ))

    if state.aborted:
        status = "aborted"
    elif cur is None:
        status = "completed"
    elif any(n.status == "hitl_waiting" for n in nodes):
        status = "hitl_waiting"
    else:
        status = "running"
    return PlanGraph(
        plan_id=plan_id, status=status, current_step_id=cur,
        nodes=nodes, edges=edges,
    )


# --- Session Evolution（PRD-01 M1 · MP-EMP-EVOLVE-01 · 会话级能力热进化）------
from pydantic import BaseModel, Field  # noqa: E402


class SessionMountBody(BaseModel):
    name: str
    ref: str
    worker_kind: str = "mcp"


@router.post("/sessions/{session_id}/open", status_code=201)
async def evolve_open(session_id: str, request: Request) -> dict[str, Any]:
    """打开会话进化域（快照挂载当前注册角色）。"""
    from ..scheduler.session_evolution import get_session_evolution

    tid = _tid(request)
    scope = await get_session_evolution().open_session(session_id, tid)
    return {"session_id": session_id, "roles_snapshotted": len(scope.status()["snapshot_roles"])}


@router.post("/sessions/{session_id}/capabilities", status_code=201)
async def evolve_mount(session_id: str, body: SessionMountBody,
                       request: Request) -> dict[str, Any]:
    from ..scheduler.session_evolution import get_session_evolution

    tid = _tid(request)
    scope = get_session_evolution().get(session_id)
    if scope is None:
        raise HTTPException(status_code=404, detail=f"session {session_id!r} not open")
    if scope.tenant_id != tid:
        raise HTTPException(status_code=403, detail="cross-tenant session denied")
    try:
        await scope.mount(body.name, body.ref, worker_kind=body.worker_kind)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    return {"session_id": session_id, "mounted": body.name, "ref": body.ref}


@router.delete("/sessions/{session_id}/capabilities/{name}")
async def evolve_unmount(session_id: str, name: str, request: Request) -> dict[str, Any]:
    from ..scheduler.session_evolution import get_session_evolution

    tid = _tid(request)
    scope = get_session_evolution().get(session_id)
    if scope is None:
        raise HTTPException(status_code=404, detail=f"session {session_id!r} not open")
    if scope.tenant_id != tid:
        raise HTTPException(status_code=403, detail="cross-tenant session denied")
    ok = await scope.unmount(name)
    if not ok:
        raise HTTPException(status_code=404, detail=f"capability {name!r} not mounted")
    return {"session_id": session_id, "unmounted": name}


@router.get("/sessions/{session_id}/evolution")
async def evolve_status(session_id: str, request: Request) -> dict[str, Any]:
    from ..scheduler.session_evolution import get_session_evolution

    _tid(request)
    scope = get_session_evolution().get(session_id)
    if scope is None:
        raise HTTPException(status_code=404, detail=f"session {session_id!r} not open")
    return scope.status()


@router.post("/sessions/{session_id}/close")
async def evolve_close(session_id: str, request: Request) -> dict[str, Any]:
    from ..scheduler.session_evolution import get_session_evolution

    _tid(request)
    stats = await get_session_evolution().close_session(session_id)
    if stats is None:
        raise HTTPException(status_code=404, detail=f"session {session_id!r} not open")
    return {"session_id": session_id, "closed": True, **stats}


@router.post("/sessions/sweep")
async def evolve_sweep(request: Request) -> dict[str, Any]:
    """PRD-01 M2：清扫过期会话进化域（TTL 兜底；幂等可重入）。"""
    from ..scheduler.session_evolution import get_session_evolution

    _tid(request)
    swept = get_session_evolution().sweep_expired()
    return {"swept": swept}


class EvolveProposeBody(BaseModel):
    name: str
    ref: str
    reason: str = ""


@router.post("/sessions/{session_id}/evolve-proposals", status_code=201)
async def evolve_propose(session_id: str, body: EvolveProposeBody,
                         request: Request) -> dict[str, Any]:
    """PRD-01 M3：员工提议新能力（pending，人审前不生效）。"""
    from ..scheduler.session_evolution import get_session_evolution

    scope = get_session_evolution().get(session_id)
    if scope is None:
        raise HTTPException(status_code=404, detail=f"session {session_id!r} not open")
    if scope.tenant_id != _tid(request):
        raise HTTPException(status_code=403, detail="cross-tenant session denied")
    pid = scope.propose_evolution(body.name, body.ref, body.reason)
    return {"proposal_id": pid, "status": "pending", "name": body.name}


@router.post("/sessions/{session_id}/evolve-proposals/{pid}/approve")
async def evolve_approve(session_id: str, pid: str, request: Request) -> dict[str, Any]:
    """人审通过 → 真实挂载（HITL 闸）。"""
    from ..scheduler.session_evolution import get_session_evolution

    scope = get_session_evolution().get(session_id)
    if scope is None:
        raise HTTPException(status_code=404, detail="session not open")
    if scope.tenant_id != _tid(request):
        raise HTTPException(status_code=403, detail="cross-tenant session denied")
    try:
        return await scope.approve_evolution(pid)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.post("/sessions/{session_id}/evolve-proposals/{pid}/reject")
async def evolve_reject(session_id: str, pid: str, request: Request) -> dict[str, Any]:
    from ..scheduler.session_evolution import get_session_evolution

    scope = get_session_evolution().get(session_id)
    if scope is None:
        raise HTTPException(status_code=404, detail="session not open")
    try:
        return scope.reject_evolution(pid)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


# --- Outbox relay（Sprint 2 · SAL-05 P2 常驻化）--------------------------------
class OutboxEventBody(BaseModel):
    type: str
    aggregate_id: str = "agg-1"
    payload: dict[str, Any] = Field(default_factory=dict)


@router.post("/outbox/events", status_code=201)
async def outbox_append(body: OutboxEventBody, request: Request) -> dict[str, Any]:
    """dev/staging：向应用 outbox 追加事件（真实 writer，非 mock）。"""
    from mate_platform.messaging.events import Event

    tid = _tid(request)
    writer = request.app.state.outbox_writer
    event = Event.create(type=body.type, tenant_id=tid,
                         aggregate_id=body.aggregate_id, payload=body.payload)
    writer.append(event)
    return {"event_id": event.id, "type": event.type, "status": "pending"}


@router.post("/outbox/relay")
async def outbox_relay_once(request: Request) -> dict[str, int]:
    """手动触发一轮 relay（常驻循环之外的可观测入口）。"""
    relay = getattr(request.app.state, "outbox_relay", None)
    if relay is None:
        raise HTTPException(status_code=503, detail="relay not available")
    return await relay.relay_once()
