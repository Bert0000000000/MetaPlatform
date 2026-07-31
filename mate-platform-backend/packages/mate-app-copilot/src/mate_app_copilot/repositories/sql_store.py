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
    AssetRecord,
    Conversation,
    Datasource,
    Intent,
    KnowledgeBase,
    ModelInfo,
    Plan,
    QueryLog,
    Template,
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


def _orm_to_datasource(row: models.DatasourceORM) -> Datasource:
    return Datasource(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        type=row.type,
        description=row.description or "",
        status=row.status or "active",
    )


def _orm_to_knowledge_base(row: models.KnowledgeBaseORM) -> KnowledgeBase:
    return KnowledgeBase(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        description=row.description,
        doc_count=row.doc_count,
    )


def _orm_to_model(row: models.ModelInfoORM) -> ModelInfo:
    return ModelInfo(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        provider=row.provider,
        modality=row.modality or "multimodal",
        status=row.status or "available",
    )


def _orm_to_template(row: models.TemplateORM) -> Template:
    return Template(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        category=row.category,
        description=row.description or "",
    )


def _orm_to_asset(row: models.AssetORM) -> AssetRecord:
    return AssetRecord(
        id=row.id,
        tenant_id=row.tenant_id,
        filename=row.filename,
        content_type=row.content_type,
        embedding_dim=row.embedding_dim,
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


def list_datasources(tenant_id: str) -> list[Datasource]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.DatasourceORM)
        .where(models.DatasourceORM.tenant_id == tenant_id)
        .order_by(models.DatasourceORM.id)
    ).scalars().all()
    return [_orm_to_datasource(r) for r in rows]


def list_knowledge_bases(tenant_id: str) -> list[KnowledgeBase]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.KnowledgeBaseORM)
        .where(models.KnowledgeBaseORM.tenant_id == tenant_id)
        .order_by(models.KnowledgeBaseORM.id)
    ).scalars().all()
    return [_orm_to_knowledge_base(r) for r in rows]


def list_models(tenant_id: str) -> list[ModelInfo]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.ModelInfoORM)
        .where(models.ModelInfoORM.tenant_id == tenant_id)
        .order_by(models.ModelInfoORM.id)
    ).scalars().all()
    return [_orm_to_model(r) for r in rows]


def list_templates(tenant_id: str) -> list[Template]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.TemplateORM)
        .where(models.TemplateORM.tenant_id == tenant_id)
        .order_by(models.TemplateORM.id)
    ).scalars().all()
    return [_orm_to_template(r) for r in rows]


def list_assets(tenant_id: str) -> list[AssetRecord]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.AssetORM)
        .where(models.AssetORM.tenant_id == tenant_id)
        .order_by(models.AssetORM.id)
    ).scalars().all()
    return [_orm_to_asset(r) for r in rows]


def get_asset(tenant_id: str, asset_id: str) -> AssetRecord | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.get(models.AssetORM, asset_id)
    if row is None or row.tenant_id != tenant_id:
        return None
    return _orm_to_asset(row)


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


def put_intent(tenant_id: str, intent: Intent) -> Intent:
    if not tenant_id:
        return intent
    s = _session()
    kw_str = ",".join(intent.keywords) if intent.keywords else ""
    existing = s.get(models.IntentORM, intent.id)
    if existing:
        existing.name = intent.name
        existing.keywords = kw_str
        existing.confidence = intent.confidence
    else:
        s.add(models.IntentORM(
            id=intent.id, tenant_id=tenant_id, name=intent.name,
            keywords=kw_str, confidence=intent.confidence,
        ))
    s.commit()
    return intent


def put_action(tenant_id: str, action: Action) -> Action:
    if not tenant_id:
        return action
    s = _session()
    kw_str = ",".join(action.keywords) if action.keywords else ""
    existing = s.get(models.ActionORM, action.id)
    if existing:
        existing.name = action.name
        existing.description = action.description
        existing.category = action.category
        existing.keywords = kw_str
    else:
        s.add(models.ActionORM(
            id=action.id, tenant_id=tenant_id, name=action.name,
            description=action.description, category=action.category,
            keywords=kw_str,
        ))
    s.commit()
    return action


def put_datasource(tenant_id: str, ds: Datasource) -> Datasource:
    if not tenant_id:
        return ds
    s = _session()
    existing = s.get(models.DatasourceORM, ds.id)
    if existing:
        existing.name = ds.name
        existing.type = ds.type
        existing.description = ds.description
        existing.status = ds.status
    else:
        s.add(models.DatasourceORM(
            id=ds.id, tenant_id=tenant_id, name=ds.name,
            type=ds.type, description=ds.description, status=ds.status,
        ))
    s.commit()
    return ds


def put_knowledge_base(tenant_id: str, kb: KnowledgeBase) -> KnowledgeBase:
    if not tenant_id:
        return kb
    s = _session()
    existing = s.get(models.KnowledgeBaseORM, kb.id)
    if existing:
        existing.name = kb.name
        existing.description = kb.description
        existing.doc_count = kb.doc_count
    else:
        s.add(models.KnowledgeBaseORM(
            id=kb.id, tenant_id=tenant_id, name=kb.name,
            description=kb.description, doc_count=kb.doc_count,
        ))
    s.commit()
    return kb


def put_model(tenant_id: str, model: ModelInfo) -> ModelInfo:
    if not tenant_id:
        return model
    s = _session()
    existing = s.get(models.ModelInfoORM, model.id)
    if existing:
        existing.name = model.name
        existing.provider = model.provider
        existing.modality = model.modality
        existing.status = model.status
    else:
        s.add(models.ModelInfoORM(
            id=model.id, tenant_id=tenant_id, name=model.name,
            provider=model.provider, modality=model.modality,
            status=model.status,
        ))
    s.commit()
    return model


def put_template(tenant_id: str, tpl: Template) -> Template:
    if not tenant_id:
        return tpl
    s = _session()
    existing = s.get(models.TemplateORM, tpl.id)
    if existing:
        existing.name = tpl.name
        existing.category = tpl.category
        existing.description = tpl.description
    else:
        s.add(models.TemplateORM(
            id=tpl.id, tenant_id=tenant_id, name=tpl.name,
            category=tpl.category, description=tpl.description,
        ))
    s.commit()
    return tpl


def put_asset(tenant_id: str, asset: AssetRecord) -> AssetRecord:
    if not tenant_id:
        return asset
    s = _session()
    existing = s.get(models.AssetORM, asset.id)
    if existing:
        existing.filename = asset.filename
        existing.content_type = asset.content_type
        existing.embedding_dim = asset.embedding_dim
    else:
        s.add(models.AssetORM(
            id=asset.id, tenant_id=tenant_id, filename=asset.filename,
            content_type=asset.content_type, embedding_dim=asset.embedding_dim,
        ))
    s.commit()
    return asset


def seed_from_inmemory(tenant_id: str) -> dict[str, int]:
    """Seed the SQL store from in_memory seed data (one-time bootstrap).

    Returns counts of rows inserted per table.
    """
    from . import in_memory as mem  # noqa: PLC0415

    counts: dict[str, int] = {}
    counts["conversations"] = len([put_conversation(tenant_id, c) for c in mem.list_conversations(tenant_id)])
    counts["queries"] = len([put_query(tenant_id, q) for q in mem.list_queries(tenant_id)])
    counts["plans"] = len([put_plan(tenant_id, p) for p in mem.list_plans(tenant_id)])
    counts["intents"] = len([put_intent(tenant_id, i) for i in mem.list_intents(tenant_id)])
    counts["actions"] = len([put_action(tenant_id, a) for a in mem.list_actions(tenant_id)])
    counts["datasources"] = len([put_datasource(tenant_id, d) for d in mem.list_datasources(tenant_id)])
    counts["knowledge_bases"] = len([put_knowledge_base(tenant_id, k) for k in mem.list_knowledge_bases(tenant_id)])
    counts["models"] = len([put_model(tenant_id, m) for m in mem.list_models(tenant_id)])
    counts["templates"] = len([put_template(tenant_id, t) for t in mem.list_templates(tenant_id)])
    counts["assets"] = len([put_asset(tenant_id, a) for a in mem.list_assets(tenant_id)])
    return counts
