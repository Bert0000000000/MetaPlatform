"""SQL-backed repository for copilot — SQLAlchemy 2.0 implementation.

Provides the same function signatures as in_memory.py but persists
to Postgres / SQLite via SQLAlchemy ORM. Selected by the factory
when MATE_DB_URL is set.

v3.2 POC: implements read + write for Conversation, QueryLog, Plan,
Intent, Action. Other entities fall through to in_memory.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from mate_tech_db.base import get_session

from ..repositories.in_memory import (
    Action,
    Conversation,
    Intent,
    Plan,
    QueryLog,
)
from . import sql_models as models


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _session() -> Session:
    return get_session()


def _orm_to_conversation(row: models.ConversationORM) -> Conversation:
    return Conversation(
        id=row.id,
        tenant_id=row.tenant_id,
        title=row.title,
        summary=row.summary or "",
        message_count=row.message_count,
        created_at=row.created_at or "",
    )


def _orm_to_query(row: models.QueryLogORM) -> QueryLog:
    return QueryLog(
        id=row.id,
        tenant_id=row.tenant_id,
        sql=row.sql,
        datasource_id=row.datasource_id,
        status=row.status or "ok",
        row_count=row.row_count,
        created_at=row.created_at or "",
    )


def _orm_to_plan(row: models.PlanORM) -> Plan:
    steps: tuple[str, ...] = ()
    if row.steps:
        steps = tuple(s for s in row.steps.split("\n") if s.strip())
    return Plan(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        goal=row.goal,
        steps=steps,
        status=row.status or "draft",
    )


def _orm_to_intent(row: models.IntentORM) -> Intent:
    keywords: tuple[str, ...] = ()
    if row.keywords:
        keywords = tuple(k.strip() for k in row.keywords.split(",") if k.strip())
    return Intent(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        keywords=keywords,
        confidence=row.confidence,
    )


def _orm_to_action(row: models.ActionORM) -> Action:
    keywords: tuple[str, ...] = ()
    if row.keywords:
        keywords = tuple(k.strip() for k in row.keywords.split(",") if k.strip())
    return Action(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        description=row.description,
        category=row.category or "general",
        keywords=keywords,
    )


# ---------------------------------------------------------------------------
# Read API — mirrors in_memory function names
# ---------------------------------------------------------------------------
def list_conversations(tenant_id: str) -> list[Conversation]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.ConversationORM)
        .where(models.ConversationORM.tenant_id == tenant_id)
        .order_by(models.ConversationORM.id)
    ).scalars().all()
    return [_orm_to_conversation(r) for r in rows]


def list_queries(tenant_id: str) -> list[QueryLog]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.QueryLogORM)
        .where(models.QueryLogORM.tenant_id == tenant_id)
        .order_by(models.QueryLogORM.id)
    ).scalars().all()
    return [_orm_to_query(r) for r in rows]


def list_plans(tenant_id: str) -> list[Plan]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.PlanORM)
        .where(models.PlanORM.tenant_id == tenant_id)
        .order_by(models.PlanORM.id)
    ).scalars().all()
    return [_orm_to_plan(r) for r in rows]


def list_intents(tenant_id: str) -> list[Intent]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.IntentORM)
        .where(models.IntentORM.tenant_id == tenant_id)
        .order_by(models.IntentORM.id)
    ).scalars().all()
    return [_orm_to_intent(r) for r in rows]


def list_actions(tenant_id: str) -> list[Action]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.ActionORM)
        .where(models.ActionORM.tenant_id == tenant_id)
        .order_by(models.ActionORM.id)
    ).scalars().all()
    return [_orm_to_action(r) for r in rows]


# ---------------------------------------------------------------------------
# Write API
# ---------------------------------------------------------------------------
def put_conversation(tenant_id: str, conv: Conversation) -> Conversation:
    if not tenant_id:
        return conv
    s = _session()
    existing = s.get(models.ConversationORM, conv.id)
    if existing:
        existing.title = conv.title
        existing.summary = conv.summary
        existing.message_count = conv.message_count
    else:
        s.add(models.ConversationORM(
            id=conv.id, tenant_id=tenant_id, title=conv.title,
            summary=conv.summary, message_count=conv.message_count,
            created_at=conv.created_at,
        ))
    s.commit()
    return conv


def put_query(tenant_id: str, query: QueryLog) -> QueryLog:
    if not tenant_id:
        return query
    s = _session()
    existing = s.get(models.QueryLogORM, query.id)
    if existing:
        existing.sql = query.sql
        existing.datasource_id = query.datasource_id
        existing.status = query.status
    else:
        s.add(models.QueryLogORM(
            id=query.id, tenant_id=tenant_id, sql=query.sql,
            datasource_id=query.datasource_id, status=query.status,
            row_count=query.row_count, created_at=query.created_at,
        ))
    s.commit()
    return query


def put_plan(tenant_id: str, plan: Plan) -> Plan:
    if not tenant_id:
        return plan
    s = _session()
    steps_str = "\n".join(plan.steps) if plan.steps else ""
    existing = s.get(models.PlanORM, plan.id)
    if existing:
        existing.name = plan.name
        existing.goal = plan.goal
        existing.steps = steps_str
        existing.status = plan.status
    else:
        s.add(models.PlanORM(
            id=plan.id, tenant_id=tenant_id, name=plan.name,
            goal=plan.goal, steps=steps_str, status=plan.status,
        ))
    s.commit()
    return plan


def seed_from_inmemory(tenant_id: str) -> dict[str, int]:
    """Seed the SQL store from in_memory seed data (one-time bootstrap).

    Returns counts of rows inserted per table.
    """
    from . import in_memory as mem  # noqa: PLC0415

    counts: dict[str, int] = {}
    counts["conversations"] = len([put_conversation(tenant_id, c) for c in mem.list_conversations(tenant_id)])
    counts["queries"] = len([put_query(tenant_id, q) for q in mem.list_queries(tenant_id)])
    counts["plans"] = len([put_plan(tenant_id, p) for p in mem.list_plans(tenant_id)])
    return counts
