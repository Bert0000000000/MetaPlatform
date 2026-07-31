"""FastAPI router exposing the A2A endpoints (FR-APP-A2A-001..010).

Every handler (except `/health`) enforces ADR-0014 step 2
(`require_tenant(ctx)`) before touching the repository. The
repository itself does not double-check the tenant — the guard is
the source of truth.

10 endpoints:

  GET  /api/v1/a2a/health                      — health check (anonymous)
  GET  /api/v1/a2a/agents                      — list registered agents
  GET  /api/v1/a2a/agents/{agent_id}           — get agent details
  GET  /api/v1/a2a/agents/{agent_id}/capabilities — list agent capabilities
  GET  /api/v1/a2a/external                    — list external (federated) agents
  GET  /api/v1/a2a/tasks                       — list delegation tasks
  GET  /api/v1/a2a/tasks/{task_id}             — get delegation task status
  POST /api/v1/a2a/delegate                    — create a delegation task
  POST /api/v1/a2a/tasks/{task_id}/result      — submit task result
  POST /api/v1/a2a/register                    — register external agent

Write handlers emit `<domain>.<aggregate>.<verb>` outbox events via
`app.state.outbox_writer` (ADR-0014 step 3).
"""
from __future__ import annotations

from dataclasses import asdict
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from mate_platform.messaging.events import Event
from mate_platform.messaging.outbox import InMemoryOutboxWriter
from mate_platform.tenancy.context import TenantId
from mate_platform.tenancy.guards import require_tenant

from ..repositories import (
    create_delegation,
    get_agent,
    get_delegation,
    list_agents,
    list_capabilities,
    list_delegations,
    list_external_agents,
    register_external_agent,
    task_to_dict,
    update_delegation_result,
)

router = APIRouter(prefix="/api/v1/a2a", tags=["a2a"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _tid(request: Request) -> str:
    """Return the verified tenant_id for the current request."""
    ctx = request.state.ctx
    return str(require_tenant(ctx))


def _emit(
    request: Request,
    event_type: str,
    aggregate_id: str,
    payload: dict[str, Any],
    tenant_id: str,
) -> None:
    """Append an outbox event if a writer is configured (no-op otherwise)."""
    writer: InMemoryOutboxWriter | None = getattr(
        request.app.state, "outbox_writer", None
    )
    if writer is None:
        return
    writer.append(
        Event.create(
            type=event_type,
            tenant_id=TenantId(tenant_id),
            aggregate_id=aggregate_id,
            payload=payload,
            trace_id=getattr(request.state.ctx, "trace_id", ""),
        )
    )


def _serialize(rows: list[Any]) -> list[dict[str, Any]]:
    """Convert dataclass rows to JSON-friendly dicts."""
    return [asdict(r) for r in rows]


# --- Health (1, anonymous) --------------------------------------------------
@router.get("/health")
async def health() -> dict[str, str]:
    """Anonymous liveness probe — no tenant guard."""
    return {"status": "ok"}


# --- Agents (3 GET) ---------------------------------------------------------
@router.get("/agents")
async def get_agents(request: Request) -> dict[str, Any]:
    tid = _tid(request)
    items = _serialize(list_agents(tid))
    return {"items": items, "total": len(items)}


@router.get("/agents/{agent_id}")
async def get_agent_detail(request: Request, agent_id: str) -> dict[str, Any]:
    tid = _tid(request)
    agent = get_agent(tid, agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="agent not found")
    return asdict(agent)


@router.get("/agents/{agent_id}/capabilities")
async def get_agent_capabilities(request: Request, agent_id: str) -> dict[str, Any]:
    tid = _tid(request)
    # Verify the agent exists so we don't return capabilities for a
    # phantom agent_id.
    agent = get_agent(tid, agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="agent not found")
    items = _serialize(list_capabilities(tid, agent_id))
    return {"items": items, "total": len(items)}


# --- External agents (1 GET) ------------------------------------------------
@router.get("/external")
async def get_external_agents(request: Request) -> dict[str, Any]:
    tid = _tid(request)
    items = _serialize(list_external_agents(tid))
    return {"items": items, "total": len(items)}


# --- Tasks (2 GET) ----------------------------------------------------------
@router.get("/tasks")
async def get_tasks(request: Request) -> dict[str, Any]:
    tid = _tid(request)
    items = [task_to_dict(t) for t in list_delegations(tid)]
    return {"items": items, "total": len(items)}


@router.get("/tasks/{task_id}")
async def get_task_detail(request: Request, task_id: str) -> dict[str, Any]:
    tid = _tid(request)
    task = get_delegation(tid, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="task not found")
    return task_to_dict(task)


# --- Delegation (1 POST) ----------------------------------------------------
@router.post("/delegate")
async def delegate(request: Request, body: dict[str, Any]) -> dict[str, Any]:
    tid = _tid(request)
    target_agent_id = str(body.get("target_agent_id", ""))
    message = str(body.get("message", ""))
    context = body.get("context", {})
    if not isinstance(context, dict):
        context = {}
    task = create_delegation(tid, target_agent_id, message, context)
    _emit(
        request,
        "a2a.delegation.created",
        task.id,
        {
            "task_id": task.id,
            "target_agent_id": target_agent_id,
            "message": message,
        },
        tid,
    )
    return {"task_id": task.id, "status": "pending"}


# --- Task result (1 POST) ---------------------------------------------------
@router.post("/tasks/{task_id}/result")
async def submit_task_result(
    request: Request, task_id: str, body: dict[str, Any],
) -> dict[str, Any]:
    tid = _tid(request)
    result = body.get("result", {})
    if not isinstance(result, dict):
        result = {}
    status = str(body.get("status", "completed"))
    updated = update_delegation_result(tid, task_id, result, status)
    if updated is None:
        raise HTTPException(status_code=404, detail="task not found")
    _emit(
        request,
        "a2a.delegation.completed",
        task_id,
        {"task_id": task_id, "status": status},
        tid,
    )
    return {"task_id": task_id, "status": status}


# --- Register external agent (1 POST) ---------------------------------------
@router.post("/register")
async def register_agent(request: Request, body: dict[str, Any]) -> dict[str, Any]:
    tid = _tid(request)
    name = str(body.get("name", ""))
    endpoint = str(body.get("endpoint", ""))
    capabilities = body.get("capabilities", [])
    if not isinstance(capabilities, list):
        capabilities = []
    caps_str = [str(c) for c in capabilities]
    agent = register_external_agent(tid, name, endpoint, caps_str)
    _emit(
        request,
        "a2a.agent.registered",
        agent.id,
        {"agent_id": agent.id, "name": name, "endpoint": endpoint},
        tid,
    )
    return {"agent_id": agent.id}
