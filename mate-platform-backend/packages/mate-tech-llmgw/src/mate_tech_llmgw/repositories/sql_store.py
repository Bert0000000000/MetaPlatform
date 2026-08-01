"""SQL-backed repository for the llmgw domain (P3-W4 TD-5) — SQLAlchemy 2.0.

Provides read + write for ``LlmProvider``, ``LlmModel``, and ``LlmRouteRule``.
Dict fields (``config``) are JSON-serialised to TEXT.
"""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from mate_tech_db.base import Base, get_session  # noqa: F401

from . import sql_models as models
from .in_memory import LlmModel, LlmProvider, LlmRouteRule


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _session() -> Session:
    return get_session()


def _json_dumps(value: dict[str, Any] | None) -> str:
    return json.dumps(value or {}, ensure_ascii=False, sort_keys=True)


def _json_loads(text: str) -> dict[str, Any]:
    if not text:
        return {}
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return {}


# ---------------------------------------------------------------------------
# ORM -> dataclass helpers
# ---------------------------------------------------------------------------
def _orm_to_provider(row: models.LlmProviderORM) -> LlmProvider:
    return LlmProvider(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name or "",
        provider_type=row.provider_type or "",
        base_url=row.base_url or "",
        enabled=row.enabled if row.enabled is not None else True,
        config=_json_loads(row.config),
        created_at=row.created_at or "",
        updated_at=row.updated_at or "",
    )


def _orm_to_model(row: models.LlmModelORM) -> LlmModel:
    return LlmModel(
        id=row.id,
        tenant_id=row.tenant_id,
        model_id=row.model_id or "",
        display_name=row.display_name or "",
        provider=row.provider or "",
        modality=row.modality or "text",
        max_tokens=row.max_tokens or 4096,
        enabled=row.enabled if row.enabled is not None else True,
        config=_json_loads(row.config),
        created_at=row.created_at or "",
        updated_at=row.updated_at or "",
    )


def _orm_to_route_rule(row: models.LlmRouteRuleORM) -> LlmRouteRule:
    return LlmRouteRule(
        id=row.id,
        tenant_id=row.tenant_id,
        model_pattern=row.model_pattern or "",
        provider=row.provider or "",
        priority=row.priority or 0,
        enabled=row.enabled if row.enabled is not None else True,
        created_at=row.created_at or "",
        updated_at=row.updated_at or "",
    )


# ---------------------------------------------------------------------------
# Read API — providers
# ---------------------------------------------------------------------------
def list_providers(tenant_id: str) -> list[LlmProvider]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.LlmProviderORM)
        .where(models.LlmProviderORM.tenant_id == tenant_id)
        .order_by(models.LlmProviderORM.id)
    ).scalars().all()
    return [_orm_to_provider(r) for r in rows]


def get_provider(tenant_id: str, pid: str) -> LlmProvider | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.LlmProviderORM).where(
            models.LlmProviderORM.tenant_id == tenant_id,
            models.LlmProviderORM.id == pid,
        )
    ).scalar_one_or_none()
    return _orm_to_provider(row) if row else None


# ---------------------------------------------------------------------------
# Read API — models
# ---------------------------------------------------------------------------
def list_models(tenant_id: str) -> list[LlmModel]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.LlmModelORM)
        .where(models.LlmModelORM.tenant_id == tenant_id)
        .order_by(models.LlmModelORM.id)
    ).scalars().all()
    return [_orm_to_model(r) for r in rows]


def get_model(tenant_id: str, mid: str) -> LlmModel | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.LlmModelORM).where(
            models.LlmModelORM.tenant_id == tenant_id,
            models.LlmModelORM.id == mid,
        )
    ).scalar_one_or_none()
    return _orm_to_model(row) if row else None


# ---------------------------------------------------------------------------
# Read API — route rules
# ---------------------------------------------------------------------------
def list_route_rules(tenant_id: str) -> list[LlmRouteRule]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.LlmRouteRuleORM)
        .where(models.LlmRouteRuleORM.tenant_id == tenant_id)
        .order_by(models.LlmRouteRuleORM.id)
    ).scalars().all()
    return [_orm_to_route_rule(r) for r in rows]


def get_route_rule(tenant_id: str, rid: str) -> LlmRouteRule | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.LlmRouteRuleORM).where(
            models.LlmRouteRuleORM.tenant_id == tenant_id,
            models.LlmRouteRuleORM.id == rid,
        )
    ).scalar_one_or_none()
    return _orm_to_route_rule(row) if row else None


# ---------------------------------------------------------------------------
# Write API — providers
# ---------------------------------------------------------------------------
def put_provider(tenant_id: str, prov: LlmProvider) -> LlmProvider:
    if not tenant_id:
        return prov
    s = _session()
    config_str = _json_dumps(prov.config)
    existing = s.get(models.LlmProviderORM, prov.id)
    if existing:
        existing.name = prov.name
        existing.provider_type = prov.provider_type
        existing.base_url = prov.base_url
        existing.enabled = prov.enabled
        existing.config = config_str
        existing.updated_at = prov.updated_at
    else:
        s.add(models.LlmProviderORM(
            id=prov.id, tenant_id=tenant_id, name=prov.name,
            provider_type=prov.provider_type, base_url=prov.base_url,
            enabled=prov.enabled, config=config_str,
            created_at=prov.created_at, updated_at=prov.updated_at,
        ))
    s.commit()
    return prov


def delete_provider(tenant_id: str, pid: str) -> bool:
    if not tenant_id:
        return False
    s = _session()
    row = s.execute(
        select(models.LlmProviderORM).where(
            models.LlmProviderORM.tenant_id == tenant_id,
            models.LlmProviderORM.id == pid,
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    s.delete(row)
    s.commit()
    return True


# ---------------------------------------------------------------------------
# Write API — models
# ---------------------------------------------------------------------------
def put_model(tenant_id: str, model: LlmModel) -> LlmModel:
    if not tenant_id:
        return model
    s = _session()
    config_str = _json_dumps(model.config)
    existing = s.get(models.LlmModelORM, model.id)
    if existing:
        existing.model_id = model.model_id
        existing.display_name = model.display_name
        existing.provider = model.provider
        existing.modality = model.modality
        existing.max_tokens = model.max_tokens
        existing.enabled = model.enabled
        existing.config = config_str
        existing.updated_at = model.updated_at
    else:
        s.add(models.LlmModelORM(
            id=model.id, tenant_id=tenant_id, model_id=model.model_id,
            display_name=model.display_name, provider=model.provider,
            modality=model.modality, max_tokens=model.max_tokens,
            enabled=model.enabled, config=config_str,
            created_at=model.created_at, updated_at=model.updated_at,
        ))
    s.commit()
    return model


def delete_model(tenant_id: str, mid: str) -> bool:
    if not tenant_id:
        return False
    s = _session()
    row = s.execute(
        select(models.LlmModelORM).where(
            models.LlmModelORM.tenant_id == tenant_id,
            models.LlmModelORM.id == mid,
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    s.delete(row)
    s.commit()
    return True


# ---------------------------------------------------------------------------
# Write API — route rules
# ---------------------------------------------------------------------------
def put_route_rule(tenant_id: str, rule: LlmRouteRule) -> LlmRouteRule:
    if not tenant_id:
        return rule
    s = _session()
    existing = s.get(models.LlmRouteRuleORM, rule.id)
    if existing:
        existing.model_pattern = rule.model_pattern
        existing.provider = rule.provider
        existing.priority = rule.priority
        existing.enabled = rule.enabled
        existing.updated_at = rule.updated_at
    else:
        s.add(models.LlmRouteRuleORM(
            id=rule.id, tenant_id=tenant_id, model_pattern=rule.model_pattern,
            provider=rule.provider, priority=rule.priority,
            enabled=rule.enabled, created_at=rule.created_at,
            updated_at=rule.updated_at,
        ))
    s.commit()
    return rule


def delete_route_rule(tenant_id: str, rid: str) -> bool:
    if not tenant_id:
        return False
    s = _session()
    row = s.execute(
        select(models.LlmRouteRuleORM).where(
            models.LlmRouteRuleORM.tenant_id == tenant_id,
            models.LlmRouteRuleORM.id == rid,
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
    counts["providers"] = len(
        [put_provider(tenant_id, p) for p in mem.list_providers(tenant_id)]
    )
    counts["models"] = len(
        [put_model(tenant_id, m) for m in mem.list_models(tenant_id)]
    )
    counts["route_rules"] = len(
        [put_route_rule(tenant_id, r) for r in mem.list_route_rules(tenant_id)]
    )
    return counts
