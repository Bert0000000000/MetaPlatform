"""SQL-backed repository for mate-app-a2a — SQLAlchemy 2.0 implementation.

Provides the same function signatures as in_memory.py but persists
to Postgres / SQLite via SQLAlchemy ORM. Selected by the factory
when MATE_DB_URL is set.

Dict fields are JSON-encoded into Text columns; the `capabilities`
tuple is stored comma-separated, matching the copilot sql_store
convention.
"""
from __future__ import annotations

import json
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from mate_tech_db.base import get_session

from . import sql_models as models
from .in_memory import (
    Agent,
    AgentCapability,
    DelegationTask,
    ExternalAgent,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _session() -> Session:
    return get_session()


def _dump(value: dict[str, Any]) -> str:
    return json.dumps(value, sort_keys=True) if value else ""


def _load(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        loaded = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return {}
    return loaded if isinstance(loaded, dict) else {}


def _dump_tuple(value: tuple[str, ...]) -> str:
    return ",".join(value) if value else ""


def _load_tuple(raw: str | None) -> tuple[str, ...]:
    if not raw:
        return ()
    return tuple(s.strip() for s in raw.split(",") if s.strip())


def _orm_to_agent(row: models.AgentORM) -> Agent:
    return Agent(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        description=row.description or "",
        endpoint=row.endpoint or "",
        status=row.status or "active",
    )


def _orm_to_capability(row: models.AgentCapabilityORM) -> AgentCapability:
    return AgentCapability(
        id=row.id,
        tenant_id=row.tenant_id,
        agent_id=row.agent_id,
        name=row.name,
        description=row.description or "",
        input_schema=_load(row.input_schema),
        output_schema=_load(row.output_schema),
    )


def _orm_to_delegation(row: models.DelegationTaskORM) -> DelegationTask:
    return DelegationTask(
        id=row.id,
        tenant_id=row.tenant_id,
        target_agent_id=row.target_agent_id,
        message=row.message,
        context=_load(row.context),
        status=row.status or "pending",
        result=_load(row.result),
        created_at=row.created_at or "",
    )


def _orm_to_external(row: models.ExternalAgentORM) -> ExternalAgent:
    return ExternalAgent(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        endpoint=row.endpoint,
        capabilities=_load_tuple(row.capabilities),
        status=row.status or "registered",
    )


# ---------------------------------------------------------------------------
# Read API — mirrors in_memory function names
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


def get_agent(tenant_id: str, agent_id: str) -> Agent | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.get(models.AgentORM, agent_id)
    if row is None or row.tenant_id != tenant_id:
        return None
    return _orm_to_agent(row)


def list_capabilities(
    tenant_id: str, agent_id: str | None = None
) -> list[AgentCapability]:
    if not tenant_id:
        return []
    s = _session()
    stmt = (
        select(models.AgentCapabilityORM)
        .where(models.AgentCapabilityORM.tenant_id == tenant_id)
        .order_by(models.AgentCapabilityORM.id)
    )
    if agent_id:
        stmt = stmt.where(models.AgentCapabilityORM.agent_id == agent_id)
    rows = s.execute(stmt).scalars().all()
    return [_orm_to_capability(r) for r in rows]


def list_external_agents(tenant_id: str) -> list[ExternalAgent]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.ExternalAgentORM)
        .where(models.ExternalAgentORM.tenant_id == tenant_id)
        .order_by(models.ExternalAgentORM.id)
    ).scalars().all()
    return [_orm_to_external(r) for r in rows]


def list_delegations(tenant_id: str) -> list[DelegationTask]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.DelegationTaskORM)
        .where(models.DelegationTaskORM.tenant_id == tenant_id)
        .order_by(models.DelegationTaskORM.id)
    ).scalars().all()
    return [_orm_to_delegation(r) for r in rows]


def get_delegation(tenant_id: str, task_id: str) -> DelegationTask | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.get(models.DelegationTaskORM, task_id)
    if row is None or row.tenant_id != tenant_id:
        return None
    return _orm_to_delegation(row)


# ---------------------------------------------------------------------------
# Write API — upsert primitives
# ---------------------------------------------------------------------------
def put_agent(tenant_id: str, agent: Agent) -> Agent:
    if not tenant_id:
        return agent
    s = _session()
    existing = s.get(models.AgentORM, agent.id)
    if existing:
        existing.name = agent.name
        existing.description = agent.description
        existing.endpoint = agent.endpoint
        existing.status = agent.status
    else:
        s.add(models.AgentORM(
            id=agent.id, tenant_id=tenant_id, name=agent.name,
            description=agent.description, endpoint=agent.endpoint,
            status=agent.status,
        ))
    s.commit()
    return agent


def put_capability(tenant_id: str, cap: AgentCapability) -> AgentCapability:
    if not tenant_id:
        return cap
    s = _session()
    existing = s.get(models.AgentCapabilityORM, cap.id)
    if existing:
        existing.agent_id = cap.agent_id
        existing.name = cap.name
        existing.description = cap.description
        existing.input_schema = _dump(cap.input_schema)
        existing.output_schema = _dump(cap.output_schema)
    else:
        s.add(models.AgentCapabilityORM(
            id=cap.id, tenant_id=tenant_id, agent_id=cap.agent_id,
            name=cap.name, description=cap.description,
            input_schema=_dump(cap.input_schema),
            output_schema=_dump(cap.output_schema),
        ))
    s.commit()
    return cap


def put_delegation(tenant_id: str, task: DelegationTask) -> DelegationTask:
    if not tenant_id:
        return task
    s = _session()
    existing = s.get(models.DelegationTaskORM, task.id)
    if existing:
        existing.target_agent_id = task.target_agent_id
        existing.message = task.message
        existing.context = _dump(task.context)
        existing.status = task.status
        existing.result = _dump(task.result)
        existing.created_at = task.created_at
    else:
        s.add(models.DelegationTaskORM(
            id=task.id, tenant_id=tenant_id,
            target_agent_id=task.target_agent_id, message=task.message,
            context=_dump(task.context), status=task.status,
            result=_dump(task.result), created_at=task.created_at,
        ))
    s.commit()
    return task


def put_external_agent(tenant_id: str, agent: ExternalAgent) -> ExternalAgent:
    if not tenant_id:
        return agent
    s = _session()
    existing = s.get(models.ExternalAgentORM, agent.id)
    if existing:
        existing.name = agent.name
        existing.endpoint = agent.endpoint
        existing.capabilities = _dump_tuple(agent.capabilities)
        existing.status = agent.status
    else:
        s.add(models.ExternalAgentORM(
            id=agent.id, tenant_id=tenant_id, name=agent.name,
            endpoint=agent.endpoint, capabilities=_dump_tuple(agent.capabilities),
            status=agent.status,
        ))
    s.commit()
    return agent


def put_task_result(
    tenant_id: str, task_id: str, result: dict[str, Any], status: str
) -> None:
    if not tenant_id:
        return
    s = _session()
    existing = s.get(models.TaskResultORM, task_id)
    if existing:
        existing.result = _dump(result)
        existing.status = status
    else:
        s.add(models.TaskResultORM(
            task_id=task_id, tenant_id=tenant_id,
            result=_dump(result), status=status,
        ))
    s.commit()


# ---------------------------------------------------------------------------
# Write API — mirrors in_memory public functions
# ---------------------------------------------------------------------------
def create_delegation(
    tenant_id: str,
    target_agent_id: str,
    message: str,
    context: dict[str, Any],
) -> DelegationTask:
    task_id = f"task-{uuid.uuid4().hex[:8]}"
    task = DelegationTask(
        id=task_id,
        tenant_id=tenant_id,
        target_agent_id=target_agent_id,
        message=message,
        context=dict(context),
        status="pending",
    )
    return put_delegation(tenant_id, task)


def update_delegation_result(
    tenant_id: str,
    task_id: str,
    result: dict[str, Any],
    status: str,
) -> DelegationTask | None:
    existing = get_delegation(tenant_id, task_id)
    if existing is None:
        return None
    existing.result = dict(result)
    existing.status = status
    return put_delegation(tenant_id, existing)


def register_external_agent(
    tenant_id: str,
    name: str,
    endpoint: str,
    capabilities: list[str],
) -> ExternalAgent:
    agent_id = f"ext-{uuid.uuid4().hex[:8]}"
    agent = ExternalAgent(
        id=agent_id,
        tenant_id=tenant_id,
        name=name,
        endpoint=endpoint,
        capabilities=tuple(capabilities),
    )
    return put_external_agent(tenant_id, agent)


# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------
def seed_from_inmemory(tenant_id: str) -> dict[str, int]:
    """Seed the SQL store from in_memory seed data (one-time bootstrap).

    Returns counts of rows inserted per table.
    """
    from . import in_memory as mem  # noqa: PLC0415

    counts: dict[str, int] = {}
    counts["agents"] = len([put_agent(tenant_id, a) for a in mem.list_agents(tenant_id)])
    counts["capabilities"] = len(
        [put_capability(tenant_id, c) for c in mem.list_capabilities(tenant_id)]
    )
    counts["external_agents"] = len(
        [put_external_agent(tenant_id, e) for e in mem.list_external_agents(tenant_id)]
    )
    counts["delegations"] = len(
        [put_delegation(tenant_id, t) for t in mem.list_delegations(tenant_id)]
    )
    return counts
