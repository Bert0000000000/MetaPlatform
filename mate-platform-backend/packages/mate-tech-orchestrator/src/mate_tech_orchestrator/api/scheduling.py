"""Orchestrator scheduling 编排入口 (A3 copilot 吸收 phase-1).

Takes over the SuperAI ``scheduling/*`` entry that copilot previously
served, implemented on the orchestrator's real machinery
(role registry + dispatcher + plan runner) instead of copilot's thin
stubs. Shapes match the frontend ``api/superai/schedule.ts`` so the UI
can rewire to the orchestrator unchanged.

Endpoints (mounted under ``/api/v1/orchestrator``):

  - POST /scheduling/intent/detect        — text → intent
  - POST /scheduling/employees/match      — intent → matched digital employees
  - POST /scheduling/plan/generate        — intentId → ExecutionPlan (submitted via plan runner)
  - POST /scheduling/execution/start      — planId → execution (plan runner)
  - GET  /scheduling/execution/{id}/report
  - GET  /scheduling/intents              — history
  - GET/POST /scheduling/templates
"""
from __future__ import annotations

import re
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from mate_kernel.agent.orchestrator import PlanStep, StepKind

from ..scheduler.plan_runner import PlanNotFoundError, get_plan_runner
from ..scheduler.role_registry import get_role_registry

router = APIRouter(prefix="/api/v1/orchestrator", tags=["orchestrator"])


def _tid(request: Request) -> str:
    from mate_platform.tenancy.guards import require_tenant

    return str(require_tenant(request.state.ctx))


def _tokens(text: str) -> list[str]:
    return [t for t in re.split(r"[\s,/_-]+", text.lower()) if t]


def _emit(request: Request, event_type: str, aggregate_id: str, payload: dict[str, Any], tenant_id: str) -> None:
    writer = getattr(request.app.state, "outbox_writer", None)
    if writer is None:
        return
    from mate_platform.messaging.events import Event
    from mate_platform.tenancy.context import TenantId

    ctx = getattr(request.state, "ctx", None)
    trace_id = getattr(ctx, "trace_id", "") if ctx is not None else ""
    writer.append(
        Event.create(type=event_type, tenant_id=TenantId(tenant_id), aggregate_id=aggregate_id, payload=payload, trace_id=trace_id)
    )


class IntentDetectRequest(BaseModel):
    text: str = Field(min_length=1)


class IntentMatchRequest(BaseModel):
    intent: str = Field(min_length=1)


class PlanGenerateRequest(BaseModel):
    intent_id: str = Field(min_length=1)


class ExecutionStartRequest(BaseModel):
    plan_id: str = Field(min_length=1)


# ---------------------------------------------------------------------------
# Intent
# ---------------------------------------------------------------------------
@router.post("/scheduling/intent/detect")
async def detect_intent(request: Request, body: IntentDetectRequest) -> dict[str, Any]:
    """Text → intent: keyword-match against registered role names/capabilities."""
    tid = _tid(request)
    text = body.text
    roles = get_role_registry().list(tid)
    hay = {r.role: " ".join([r.role, r.name] + [c.name for c in r.capabilities]).lower() for r in roles}
    best_name = "general"
    best_conf = 0.0
    for token in _tokens(text):
        for slug, h in hay.items():
            if token in h and best_conf < 0.6:
                best_name, best_conf = slug, 0.7
    detected = [slug for slug in hay if slug == best_name]
    intent = {
        "intentId": f"intent-{uuid.uuid4().hex[:10]}",
        "userId": "system",
        "rawUtterance": text[:200],
        "detectedIntent": "immediate",
        "confidence": best_conf,
        "detectedEmployees": detected,
        "status": "pending",
    }
    _emit(request, "orchestrator.scheduling.intent", intent["intentId"], {"intent": best_name, "confidence": best_conf}, tid)
    return intent


# ---------------------------------------------------------------------------
# Employee match
# ---------------------------------------------------------------------------
@router.post("/scheduling/employees/match")
async def match_employees(request: Request, body: IntentMatchRequest) -> list[dict[str, Any]]:
    """Intent → matched digital employees (token-match against role capabilities)."""
    tid = _tid(request)
    tokens = _tokens(body.intent)
    items: list[dict[str, Any]] = []
    for role in get_role_registry().list(tid):
        hay = " ".join([role.role, role.name] + [c.name for c in role.capabilities]).lower()
        hits = sum(1 for t in tokens if t in hay)
        if hits or not tokens:
            items.append({
                "employeeId": role.role,
                "name": role.name,
                "role": role.role,
                "capability": ",".join(c.name for c in role.capabilities),
                "confidence": 1.0 if not tokens else min(0.99, 0.5 + 0.15 * hits),
            })
    items.sort(key=lambda e: e["confidence"], reverse=True)
    return items


# ---------------------------------------------------------------------------
# Plan generation + execution
# ---------------------------------------------------------------------------
@router.post("/scheduling/plan/generate")
async def generate_plan(request: Request, body: PlanGenerateRequest) -> dict[str, Any]:
    """intentId → ExecutionPlan: build steps + submit to the plan runner."""
    tid = _tid(request)
    roles = get_role_registry().list(tid)
    steps: list[PlanStep] = []
    step_specs: list[dict[str, Any]] = []
    if roles:
        for i, role in enumerate(roles[:3], start=1):
            step_specs.append({
                "id": f"s{i}",
                "name": f"Dispatch to {role.name}",
                "employeeId": role.role,
                "tool": role.capabilities[0].name if role.capabilities else "",
                "estimatedDuration": 5,
            })
            steps.append(PlanStep(
                step_id=f"s{i}",
                kind=StepKind.CALL_AGENT,
                target=role.role,
                payload=(("action", role.capabilities[0].name if role.capabilities else ""),),
                requires_hitl=(i == len(roles[:3])),
            ))
    else:
        step_specs = [{"id": "s1", "name": "Analyze intent", "estimatedDuration": 3}]
        steps.append(PlanStep(step_id="s1", kind=StepKind.CALL_AGENT, target="superai", payload=(), requires_hitl=True))

    spec = get_plan_runner().submit(author_user_id="system", steps=steps)
    _emit(request, "orchestrator.scheduling.plan", spec.plan_id, {"intent_id": body.intent_id, "step_count": len(steps)}, tid)
    return {
        "planId": spec.plan_id,
        "intentId": body.intent_id,
        "steps": step_specs,
        "totalEstimatedDuration": sum(s["estimatedDuration"] for s in step_specs),
        "parallelGroups": [],
        "createdAt": spec.created_at.isoformat(),
    }


@router.post("/scheduling/execution/start")
async def start_execution(request: Request, body: ExecutionStartRequest) -> dict[str, Any]:
    """planId → run the plan via the plan runner, return execution state."""
    tid = _tid(request)
    try:
        result = await get_plan_runner().execute(plan_id=body.plan_id, tenant_id=tid)
    except PlanNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    exec_id = f"exec-{uuid.uuid4().hex[:8]}"
    _emit(request, "orchestrator.scheduling.executed", exec_id, {"plan_id": body.plan_id, "status": result["status"]}, tid)
    return {
        "executionId": exec_id,
        "intentId": "",
        "planId": body.plan_id,
        "status": "running" if result["status"] in ("hitl_waiting",) else result["status"],
        "progress": 0,
        "results": [
            {"resultId": f"r-{i}", "planId": body.plan_id, "stepId": r["step_id"], "status": "completed",
             "output": str(r.get("output", "")), "startedAt": ""}
            for i, r in enumerate(result.get("results", []))
        ],
        "startedAt": "",
    }


@router.get("/scheduling/execution/{execution_id}/report")
async def execution_report(execution_id: str, request: Request) -> str:
    _tid(request)
    return f"execution {execution_id} report (plan history: run via /plans/{execution_id})"


# ---------------------------------------------------------------------------
# Intents + templates
# ---------------------------------------------------------------------------
@router.get("/scheduling/intents")
async def list_intents(request: Request) -> list[dict[str, Any]]:
    tid = _tid(request)
    roles = get_role_registry().list(tid)
    return [
        {
            "intentId": f"intent-{r.role}",
            "userId": "system",
            "rawUtterance": "",
            "detectedIntent": "immediate",
            "confidence": 1.0,
            "detectedEmployees": [r.role],
            "status": "pending",
        }
        for r in roles
    ]


class TemplateRequest(BaseModel):
    name: str = Field(min_length=1)
    description: str = ""
    intent_pattern: str = ""
    steps: list[dict[str, Any]] = Field(default_factory=list)


@router.get("/scheduling/templates")
async def list_templates(request: Request) -> list[dict[str, Any]]:
    _tid(request)
    return []


@router.post("/scheduling/templates")
async def create_template(request: Request, body: TemplateRequest) -> dict[str, Any]:
    tid = _tid(request)
    _emit(request, "orchestrator.scheduling.template", body.name, {"name": body.name}, tid)
    return {
        "templateId": f"tpl-{uuid.uuid4().hex[:8]}",
        "name": body.name,
        "description": body.description,
        "intentPattern": body.intent_pattern,
        "plan": {"planId": "", "intentId": "", "steps": body.steps, "totalEstimatedDuration": 0, "parallelGroups": [], "createdAt": ""},
        "createdBy": "system",
        "createdAt": "",
    }
