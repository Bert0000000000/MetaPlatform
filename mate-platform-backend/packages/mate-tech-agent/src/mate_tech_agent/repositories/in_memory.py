"""In-memory repository for the agent domain (P3-W4 TD-5).

Entities: Agent, AgentSession, AgentMessage.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class Agent:
    id: str
    tenant_id: str
    name: str = ""
    scenario: str = "S1"
    model_id: str = ""
    status: str = "active"
    config: dict[str, Any] = field(default_factory=dict)
    created_at: str = ""
    updated_at: str = ""


@dataclass(frozen=True)
class AgentSession:
    id: str
    tenant_id: str
    agent_id: str = ""
    thread_id: str = ""
    scenario: str = "S1"
    status: str = "active"
    created_at: str = ""
    updated_at: str = ""


@dataclass(frozen=True)
class AgentMessage:
    id: str
    tenant_id: str
    thread_id: str = ""
    role: str = "user"
    content: str = ""
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    created_at: str = ""


@dataclass(frozen=True)
class PlanExecution:
    """Cross-agent plan execution record (P3-W8).

    A plan is a sequence of steps, each routed to a target agent. The
    orchestrator records the plan_id, the resolved steps + their per-step
    results, and a terminal status (``completed`` on success).
    """

    id: str
    tenant_id: str
    plan_id: str
    steps: list[dict[str, Any]] = field(default_factory=list)
    results: list[dict[str, Any]] = field(default_factory=list)
    status: str = "completed"
    created_at: str = ""


# ---------------------------------------------------------------------------
# Seed builders
# ---------------------------------------------------------------------------
def _seed_agents(tenant_id: str) -> dict[str, Agent]:
    catalog = [
        ("agent-s1", "Sales Assistant", "S1", "gpt-4o", "active"),
        ("agent-s2", "Research Bot", "S2", "claude-3-5-sonnet-20241022", "active"),
        ("agent-s3", "Review Agent", "S3", "gpt-4o", "draft"),
    ]
    return {
        aid: Agent(
            id=aid, tenant_id=tenant_id, name=name, scenario=sc,
            model_id=mid, status=st, config={"temperature": 0.7},
            created_at="2026-08-01T00:00:00Z", updated_at="2026-08-01T00:00:00Z",
        )
        for aid, name, sc, mid, st in catalog
    }


def _seed_sessions(tenant_id: str) -> dict[str, AgentSession]:
    catalog = [
        ("ses-1", "agent-s1", "thread-1", "S1", "active"),
        ("ses-2", "agent-s2", "thread-2", "S2", "active"),
    ]
    return {
        sid: AgentSession(
            id=sid, tenant_id=tenant_id, agent_id=aid,
            thread_id=tid, scenario=sc, status=st,
            created_at="2026-08-01T00:00:00Z", updated_at="2026-08-01T00:00:00Z",
        )
        for sid, aid, tid, sc, st in catalog
    }


def _seed_messages(tenant_id: str) -> dict[str, AgentMessage]:
    catalog = [
        ("msg-1", "thread-1", "user", "What is the sales trend?", []),
        ("msg-2", "thread-1", "assistant", "Sales are up 15%.", []),
        ("msg-3", "thread-2", "user", "Research AI trends.", []),
    ]
    return {
        mid: AgentMessage(
            id=mid, tenant_id=tenant_id, thread_id=tid,
            role=role, content=content, tool_calls=tc,
            created_at="2026-08-01T00:00:00Z",
        )
        for mid, tid, role, content, tc in catalog
    }


def _seed_plan_executions(tenant_id: str) -> dict[str, PlanExecution]:
    catalog = [
        (
            "plan-exec-seed-1",
            "plan-seed-1",
            [
                {"agent_id": "agent-s1", "action": "summarize", "input": {"topic": "sales"}},
                {"agent_id": "agent-s2", "action": "research", "input": {"query": "ai trends"}},
            ],
            [
                {"agent_id": "agent-s1", "status": "completed", "output": "sales up"},
                {"agent_id": "agent-s2", "status": "completed", "output": "ai rising"},
            ],
        ),
    ]
    return {
        pid: PlanExecution(
            id=pid, tenant_id=tenant_id, plan_id=plid,
            steps=[dict(s) for s in steps],
            results=[dict(r) for r in results],
            status="completed",
            created_at="2026-08-01T00:00:00Z",
        )
        for pid, plid, steps, results in catalog
    }


# ---------------------------------------------------------------------------
# Stores
# ---------------------------------------------------------------------------
_AGENTS: dict[str, dict[str, Agent]] = {}
_SESSIONS: dict[str, dict[str, AgentSession]] = {}
_MESSAGES: dict[str, dict[str, AgentMessage]] = {}
_PLAN_EXECUTIONS: dict[str, dict[str, PlanExecution]] = {}


def _ensure_tenant(tenant_id: str) -> None:
    if not tenant_id:
        return
    if tenant_id not in _AGENTS:
        _AGENTS[tenant_id] = _seed_agents(tenant_id)
    if tenant_id not in _SESSIONS:
        _SESSIONS[tenant_id] = _seed_sessions(tenant_id)
    if tenant_id not in _MESSAGES:
        _MESSAGES[tenant_id] = _seed_messages(tenant_id)
    if tenant_id not in _PLAN_EXECUTIONS:
        _PLAN_EXECUTIONS[tenant_id] = _seed_plan_executions(tenant_id)


def list_agents(tenant_id: str) -> list[Agent]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_AGENTS[tenant_id].values(), key=lambda x: x.id)


def get_agent(tenant_id: str, aid: str) -> Agent | None:
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _AGENTS[tenant_id].get(aid)


def list_sessions(tenant_id: str) -> list[AgentSession]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_SESSIONS[tenant_id].values(), key=lambda x: x.id)


def get_session(tenant_id: str, sid: str) -> AgentSession | None:
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _SESSIONS[tenant_id].get(sid)


def list_messages(tenant_id: str) -> list[AgentMessage]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_MESSAGES[tenant_id].values(), key=lambda x: x.id)


def get_message(tenant_id: str, mid: str) -> AgentMessage | None:
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _MESSAGES[tenant_id].get(mid)


def put_agent(tenant_id: str, agent: Agent) -> Agent:
    if not tenant_id:
        return agent
    _ensure_tenant(tenant_id)
    _AGENTS[tenant_id][agent.id] = agent
    return agent


def delete_agent(tenant_id: str, aid: str) -> bool:
    if not tenant_id:
        return False
    _ensure_tenant(tenant_id)
    if aid not in _AGENTS[tenant_id]:
        return False
    del _AGENTS[tenant_id][aid]
    return True


def put_session(tenant_id: str, ses: AgentSession) -> AgentSession:
    if not tenant_id:
        return ses
    _ensure_tenant(tenant_id)
    _SESSIONS[tenant_id][ses.id] = ses
    return ses


def delete_session(tenant_id: str, sid: str) -> bool:
    if not tenant_id:
        return False
    _ensure_tenant(tenant_id)
    if sid not in _SESSIONS[tenant_id]:
        return False
    del _SESSIONS[tenant_id][sid]
    return True


def put_message(tenant_id: str, msg: AgentMessage) -> AgentMessage:
    if not tenant_id:
        return msg
    _ensure_tenant(tenant_id)
    _MESSAGES[tenant_id][msg.id] = msg
    return msg


def delete_message(tenant_id: str, mid: str) -> bool:
    if not tenant_id:
        return False
    _ensure_tenant(tenant_id)
    if mid not in _MESSAGES[tenant_id]:
        return False
    del _MESSAGES[tenant_id][mid]
    return True


def list_plan_executions(tenant_id: str) -> list[PlanExecution]:
    """List cross-agent plan execution records for a tenant (P3-W8)."""
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_PLAN_EXECUTIONS[tenant_id].values(), key=lambda x: x.id)


def get_plan_execution(tenant_id: str, exec_id: str) -> PlanExecution | None:
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _PLAN_EXECUTIONS[tenant_id].get(exec_id)


def create_plan_execution(
    tenant_id: str,
    plan_id: str,
    steps: list[dict[str, Any]],
    results: list[dict[str, Any]] | None = None,
    *,
    status: str = "completed",
) -> PlanExecution:
    """Persist a cross-agent plan execution record.

    Orchestrates the plan by recording each step + its per-step result.
    The execution id is generated; the caller is responsible for emitting
    the outbox event (ADR-0014 step 3).
    """
    import time as _time
    import uuid as _uuid

    if not tenant_id:
        raise ValueError("tenant_id is required")
    if not plan_id:
        raise ValueError("plan_id is required")
    _ensure_tenant(tenant_id)
    eid = f"plan-exec-{_uuid.uuid4().hex[:8]}"
    rec = PlanExecution(
        id=eid,
        tenant_id=tenant_id,
        plan_id=plan_id,
        steps=[dict(s) for s in steps],
        results=[dict(r) for r in (results or [])],
        status=status,
        created_at=_time.strftime("%Y-%m-%dT%H:%M:%SZ", _time.gmtime()),
    )
    _PLAN_EXECUTIONS[tenant_id][eid] = rec
    return rec


def reset_store() -> None:
    _AGENTS.clear()
    _SESSIONS.clear()
    _MESSAGES.clear()
    _PLAN_EXECUTIONS.clear()
