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
  POST /api/v1/a2a/messages                    — W3C A2A message envelope
  POST /api/v1/a2a/delegate                    — create a delegation task (deprecated)
  POST /api/v1/a2a/tasks/{task_id}/result      — submit task result
  POST /api/v1/a2a/register                    — register external agent

Write handlers emit `<domain>.<aggregate>.<verb>` outbox events via
`app.state.outbox_writer` (ADR-0014 step 3).
"""
from __future__ import annotations

from dataclasses import asdict
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field

from mate_platform.messaging.events import Event
from mate_platform.messaging.outbox import InMemoryOutboxWriter
from mate_platform.tenancy.context import TenantId
from mate_platform.tenancy.guards import require_tenant

from ..delegate import AgentNotFoundError, get_default_delegator
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


# ---------------------------------------------------------------------------
# W3C A2A message + Task models (GOVERN-12-03; W1 official-SDK alignment)
#
# `POST /messages` and `GET /tasks/{task_id}` use the canonical W3C A2A
# envelope / Task shapes declared in `contracts/openapi/services/a2a.yaml`
# (the task read previously returned the internal DelegationTask dict —
# contract drift fixed in W1).
# ---------------------------------------------------------------------------
class A2APart(BaseModel):
    """One content part of a W3C A2A message."""

    kind: Literal["text", "file", "data"]
    text: str | None = None
    data: dict[str, Any] | None = None


class A2AMessage(BaseModel):
    """W3C A2A message envelope (the `/messages` request body)."""

    messageId: str = Field(min_length=1)
    role: Literal["user", "agent"]
    parts: list[A2APart]
    contextId: str | None = None
    taskId: str | None = None


def _message_text(msg: A2AMessage) -> str:
    """Flatten the text parts of a message into the delegation message."""
    return "\n".join(p.text for p in msg.parts if p.kind == "text" and p.text)


def _message_data(msg: A2AMessage) -> dict[str, Any]:
    """Merge the data parts of a message into the delegation context."""
    merged: dict[str, Any] = {}
    for part in msg.parts:
        if part.kind == "data" and part.data:
            merged.update(part.data)
    return merged


_A2A_TASK_STATES = ("submitted", "working", "input-required", "completed", "failed", "canceled")


class A2ATaskStatus(BaseModel):
    state: Literal["submitted", "working", "input-required", "completed", "failed", "canceled"]
    message: str | None = None


class A2AArtifact(BaseModel):
    parts: list[A2APart] = Field(default_factory=list)


class A2ATask(BaseModel):
    id: str
    contextId: str
    status: A2ATaskStatus
    artifacts: list[A2AArtifact] = Field(default_factory=list)
    history: list[A2AMessage] = Field(default_factory=list)


def _task_state_name(status: str) -> str:
    """Map an internal DelegationTask status to a W3C TaskState value."""
    mapping = {
        "pending": "submitted",
        "timeout": "failed",
    }
    state = mapping.get(status, status)
    return state if state in _A2A_TASK_STATES else "submitted"


def _task_to_a2a_task(task: Any) -> A2ATask:
    """Map a DelegationTask row into the canonical W3C A2A Task shape."""
    context_id = str(task.context.get("contextId") or task.id)
    return A2ATask(
        id=task.id,
        contextId=context_id,
        status=A2ATaskStatus(
            state=_task_state_name(task.status),
            message=str(task.message) or None,
        ),
    )


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


@router.get("/tasks/{task_id}", response_model=A2ATask, response_model_exclude_none=True)
async def get_task_detail(request: Request, task_id: str) -> A2ATask:
    tid = _tid(request)
    task = get_delegation(tid, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="task not found")
    return _task_to_a2a_task(task)


# --- W3C messages (1 POST) --------------------------------------------------
@router.post("/messages", response_model=A2ATask, response_model_exclude_none=True)
async def post_message(request: Request, message: A2AMessage) -> A2ATask:
    """Accept a W3C A2A message and open a delegation task (GOVERN-12-03).

    The envelope is translated into the existing ``DelegationTask``
    model: text parts become the task message, data parts are merged
    into the task context (alongside the W3C correlation ids). The
    response is a W3C Task object rather than the legacy
    ``{task_id,status}`` shape returned by ``/delegate``.
    """
    tid = _tid(request)
    context = _message_data(message)
    context.update(
        {
            "messageId": message.messageId,
            "role": message.role,
            "contextId": message.contextId,
        }
    )
    target_agent_id = str(context.get("target_agent_id", "") or "")
    task = create_delegation(tid, target_agent_id, _message_text(message), context)
    _emit(
        request,
        "a2a.delegation.created",
        task.id,
        {
            "task_id": task.id,
            "target_agent_id": target_agent_id,
            "message_id": message.messageId,
        },
        tid,
    )
    context_id = message.contextId or task.id
    return A2ATask(
        id=task.id,
        contextId=context_id,
        status=A2ATaskStatus(state="submitted"),
        artifacts=[],
        history=[message],
    )


# --- Delegation (1 POST, deprecated in favour of /messages) -----------------
@router.post("/delegate", deprecated=True)
async def delegate(
    request: Request, body: dict[str, Any], response: Response,
) -> dict[str, Any]:
    tid = _tid(request)
    # Superseded by the W3C `POST /messages` envelope (GOVERN-12-03).
    response.headers["Deprecation"] = "true"
    response.headers["X-Sunset"] = "2026-12-31"
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


# --- External agent call (1 POST, TD-4 real) --------------------------------
@router.post("/external")
async def call_external_agent(
    request: Request, body: dict[str, Any],
) -> dict[str, Any]:
    """Call a registered external (federated) agent synchronously (TD-4).

    Accepts ``{target_agent_id, message, context}`` and dispatches to
    the agent's HTTP endpoint via the ``A2ADelegator``. The response
    carries the agent's reply payload, the delegation status
    (``completed`` / ``failed`` / ``timeout``), and the agent summary.

    Emits ``a2a.external.called`` outbox event regardless of outcome.
    """
    tid = _tid(request)
    target_agent_id = str(body.get("target_agent_id", ""))
    message = str(body.get("message", ""))
    context = body.get("context", {})
    if not isinstance(context, dict):
        context = {}
    trace_id = getattr(request.state.ctx, "trace_id", "")

    delegator = get_default_delegator()
    try:
        outcome = await delegator.delegate_to_external(
            tenant_id=tid,
            external_agent_id=target_agent_id,
            message=message,
            context=context,
            trace_id=trace_id,
        )
    except AgentNotFoundError as e:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "E_AGENT_NOT_FOUND",
                "message": str(e),
                "target_agent_id": target_agent_id,
            },
        ) from e

    _emit(
        request,
        event_type="a2a.external.called",
        aggregate_id=target_agent_id,
        payload={
            "target_agent_id": target_agent_id,
            "status": outcome["status"],
            "message": message,
        },
        tenant_id=tid,
    )
    return outcome


# ---------------------------------------------------------------------------
# Pagination helper (P2-W5: spec-only canonical paths)
# ---------------------------------------------------------------------------
def _paginate(items: list[Any], page: int, size: int) -> dict[str, Any]:
    """Apply cursor-free pagination to a list of serialized dicts."""
    total = len(items)
    pages = (total + size - 1) // size if size > 0 else 0
    start = (page - 1) * size
    end = start + size
    return {
        "items": items[start:end],
        "total": total,
        "page": page,
        "size": size,
        "pages": pages,
    }


def _agent_card(agent: Any, source: str) -> dict[str, Any]:
    """Normalize an Agent / ExternalAgent into an A2A agent-card dict."""
    caps: list[str] = []
    if source == "external":
        caps = list(getattr(agent, "capabilities", ()) or ())
    role = getattr(agent, "role", "") or ""
    # DW 内置员工 code：dw-emp-<alias>-<n> → EMP-<KIND>-<n>（前端按 code 跳详情）
    code = role.upper().replace("_", "-") if role else ""
    return {
        "id": agent.id,
        "tenant_id": agent.tenant_id,
        "name": agent.name,
        "endpoint": getattr(agent, "endpoint", "") or "",
        "status": getattr(agent, "status", "active") or "active",
        "source": source,  # "internal" | "external"
        "capabilities": caps,
        "role": role,
        "code": code,
    }


# --- Spec-only canonical paths (P2-W5) --------------------------------------
@router.get("/agent-cards/search")
async def search_agent_cards(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    """Search A2A agent cards (FR-A2A-A2AGETA2AAGENTCARDSSEARCH).

    Merges internal agents and federated external agents into a
    single card list, then paginates. Cards carry a `source` field
    so callers can tell internal vs federated apart.
    """
    tid = _tid(request)
    cards = [_agent_card(a, "internal") for a in list_agents(tid)]
    cards += [_agent_card(a, "external") for a in list_external_agents(tid)]
    # Stable ordering: by id (deterministic across tenants)
    cards.sort(key=lambda c: c["id"])
    return _paginate(cards, page, size)


@router.get("/delegations")
async def list_delegations_paginated(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    """List delegation tasks, paginated (FR-A2A-A2AGETA2ADELEGATIONS).

    This is the canonical spec path for `GET /api/v1/a2a/delegations`.
    It returns the same DelegationTask rows as `GET /tasks` but in
    the standard `{items,total,page,size,pages}` page envelope.
    """
    tid = _tid(request)
    items = [task_to_dict(t) for t in list_delegations(tid)]
    return _paginate(items, page, size)
