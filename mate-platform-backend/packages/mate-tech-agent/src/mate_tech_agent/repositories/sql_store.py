"""SQL-backed repository for the agent domain (P3-W4 TD-5) — SQLAlchemy 2.0.

Provides read + write for ``Agent``, ``AgentSession``, and ``AgentMessage``.
Dict fields (``Agent.config``) and list fields (``AgentMessage.tool_calls``)
are JSON-serialised to TEXT.
"""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from mate_tech_db.base import Base, get_session as _get_db_session  # noqa: F401

from . import sql_models as models
from .in_memory import Agent, AgentMessage, AgentSession


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _session() -> Session:
    return _get_db_session()


def _json_dumps(value: Any) -> str:
    return json.dumps(value or {}, ensure_ascii=False, sort_keys=True)


def _json_loads(text: str) -> Any:
    if not text:
        return {}
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return {}


def _json_loads_list(text: str) -> list[dict[str, Any]]:
    if not text:
        return []
    try:
        result = json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return []
    return result if isinstance(result, list) else []


# ---------------------------------------------------------------------------
# ORM -> dataclass helpers
# ---------------------------------------------------------------------------
def _orm_to_agent(row: models.AgentORM) -> Agent:
    return Agent(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name or "",
        scenario=row.scenario or "S1",
        model_id=row.model_id or "",
        status=row.status or "active",
        config=_json_loads(row.config),
        created_at=row.created_at or "",
        updated_at=row.updated_at or "",
    )


def _orm_to_session(row: models.AgentSessionORM) -> AgentSession:
    return AgentSession(
        id=row.id,
        tenant_id=row.tenant_id,
        agent_id=row.agent_id or "",
        thread_id=row.thread_id or "",
        scenario=row.scenario or "S1",
        status=row.status or "active",
        created_at=row.created_at or "",
        updated_at=row.updated_at or "",
    )


def _orm_to_message(row: models.AgentMessageORM) -> AgentMessage:
    return AgentMessage(
        id=row.id,
        tenant_id=row.tenant_id,
        thread_id=row.thread_id or "",
        role=row.role or "user",
        content=row.content or "",
        tool_calls=_json_loads_list(row.tool_calls),
        created_at=row.created_at or "",
    )


# ---------------------------------------------------------------------------
# Read API — agents
# ---------------------------------------------------------------------------
def list_agents(tenant_id: str) -> list[Agent]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.AgentORM)
        .where(models.AgentORM.tenant_id == tenant_id)
        .order_by(models.AgentORM.id)
    ).scalars().all()
    return [_orm_to_agent(r) for r in rows]


def get_agent(tenant_id: str, aid: str) -> Agent | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.AgentORM).where(
            models.AgentORM.tenant_id == tenant_id,
            models.AgentORM.id == aid,
        )
    ).scalar_one_or_none()
    return _orm_to_agent(row) if row else None


# ---------------------------------------------------------------------------
# Read API — sessions
# ---------------------------------------------------------------------------
def list_sessions(tenant_id: str) -> list[AgentSession]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.AgentSessionORM)
        .where(models.AgentSessionORM.tenant_id == tenant_id)
        .order_by(models.AgentSessionORM.id)
    ).scalars().all()
    return [_orm_to_session(r) for r in rows]


def get_session(tenant_id: str, sid: str) -> AgentSession | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.AgentSessionORM).where(
            models.AgentSessionORM.tenant_id == tenant_id,
            models.AgentSessionORM.id == sid,
        )
    ).scalar_one_or_none()
    return _orm_to_session(row) if row else None


# ---------------------------------------------------------------------------
# Read API — messages
# ---------------------------------------------------------------------------
def list_messages(tenant_id: str) -> list[AgentMessage]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.AgentMessageORM)
        .where(models.AgentMessageORM.tenant_id == tenant_id)
        .order_by(models.AgentMessageORM.id)
    ).scalars().all()
    return [_orm_to_message(r) for r in rows]


def get_message(tenant_id: str, mid: str) -> AgentMessage | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.AgentMessageORM).where(
            models.AgentMessageORM.tenant_id == tenant_id,
            models.AgentMessageORM.id == mid,
        )
    ).scalar_one_or_none()
    return _orm_to_message(row) if row else None


# ---------------------------------------------------------------------------
# Write API — agents
# ---------------------------------------------------------------------------
def put_agent(tenant_id: str, agent: Agent) -> Agent:
    if not tenant_id:
        return agent
    s = _session()
    config_str = _json_dumps(agent.config)
    existing = s.get(models.AgentORM, agent.id)
    if existing:
        existing.name = agent.name
        existing.scenario = agent.scenario
        existing.model_id = agent.model_id
        existing.status = agent.status
        existing.config = config_str
        existing.updated_at = agent.updated_at
    else:
        s.add(models.AgentORM(
            id=agent.id, tenant_id=tenant_id, name=agent.name,
            scenario=agent.scenario, model_id=agent.model_id,
            status=agent.status, config=config_str,
            created_at=agent.created_at, updated_at=agent.updated_at,
        ))
    s.commit()
    return agent


def delete_agent(tenant_id: str, aid: str) -> bool:
    if not tenant_id:
        return False
    s = _session()
    row = s.execute(
        select(models.AgentORM).where(
            models.AgentORM.tenant_id == tenant_id,
            models.AgentORM.id == aid,
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    s.delete(row)
    s.commit()
    return True


# ---------------------------------------------------------------------------
# Write API — sessions
# ---------------------------------------------------------------------------
def put_session(tenant_id: str, ses: AgentSession) -> AgentSession:
    if not tenant_id:
        return ses
    s = _session()
    existing = s.get(models.AgentSessionORM, ses.id)
    if existing:
        existing.agent_id = ses.agent_id
        existing.thread_id = ses.thread_id
        existing.scenario = ses.scenario
        existing.status = ses.status
        existing.updated_at = ses.updated_at
    else:
        s.add(models.AgentSessionORM(
            id=ses.id, tenant_id=tenant_id, agent_id=ses.agent_id,
            thread_id=ses.thread_id, scenario=ses.scenario,
            status=ses.status, created_at=ses.created_at,
            updated_at=ses.updated_at,
        ))
    s.commit()
    return ses


def delete_session(tenant_id: str, sid: str) -> bool:
    if not tenant_id:
        return False
    s = _session()
    row = s.execute(
        select(models.AgentSessionORM).where(
            models.AgentSessionORM.tenant_id == tenant_id,
            models.AgentSessionORM.id == sid,
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    s.delete(row)
    s.commit()
    return True


# ---------------------------------------------------------------------------
# Write API — messages
# ---------------------------------------------------------------------------
def put_message(tenant_id: str, msg: AgentMessage) -> AgentMessage:
    if not tenant_id:
        return msg
    s = _session()
    tc_str = _json_dumps(msg.tool_calls)
    existing = s.get(models.AgentMessageORM, msg.id)
    if existing:
        existing.thread_id = msg.thread_id
        existing.role = msg.role
        existing.content = msg.content
        existing.tool_calls = tc_str
        existing.created_at = msg.created_at
    else:
        s.add(models.AgentMessageORM(
            id=msg.id, tenant_id=tenant_id, thread_id=msg.thread_id,
            role=msg.role, content=msg.content, tool_calls=tc_str,
            created_at=msg.created_at,
        ))
    s.commit()
    return msg


def delete_message(tenant_id: str, mid: str) -> bool:
    if not tenant_id:
        return False
    s = _session()
    row = s.execute(
        select(models.AgentMessageORM).where(
            models.AgentMessageORM.tenant_id == tenant_id,
            models.AgentMessageORM.id == mid,
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    s.delete(row)
    s.commit()
    return True


# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------
def seed_from_inmemory(tenant_id: str) -> dict[str, int]:
    from . import in_memory as mem  # noqa: PLC0415

    counts: dict[str, int] = {}
    counts["agents"] = len(
        [put_agent(tenant_id, a) for a in mem.list_agents(tenant_id)]
    )
    counts["sessions"] = len(
        [put_session(tenant_id, s) for s in mem.list_sessions(tenant_id)]
    )
    counts["messages"] = len(
        [put_message(tenant_id, m) for m in mem.list_messages(tenant_id)]
    )
    return counts
