"""SQL-backed repository for the data platform control plane (P3-W2 TD-5).

Provides read + write for ``CdcTask``, ``DataSource`` and the
``DataProduct`` Iceberg ADS domain (v3.1). Dict / list fields
(``config`` / ``connection_config`` / ``tags`` / ``history``) are
JSON-serialised to TEXT on write and re-hydrated on read.

Schema discovery (``get_source_schema``) and connection probing
(``test_source_connection``) stay in ``in_memory`` because they are
dynamic and not part of the persistence contract.
"""

from __future__ import annotations

import json
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from mate_tech_db.base import get_session

from . import sql_models as models
from .in_memory import CdcTask, DataProduct, DataSource, _now


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


def _json_loads_list(text: str) -> list[Any]:
    """Re-hydrate a JSON list of strings (or list of dicts) from TEXT."""
    if not text:
        return []
    try:
        value = json.loads(text)
        if isinstance(value, list):
            return list(value)
    except (json.JSONDecodeError, TypeError):
        return []
    return []


def _orm_to_cdc_task(row: models.CdcTaskORM) -> CdcTask:
    return CdcTask(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        source_id=row.source_id,
        target_table=row.target_table,
        status=row.status or "running",
        config=_json_loads(row.config),
        created_at=row.created_at or "",
        updated_at=row.updated_at or "",
    )


def _orm_to_source(row: models.DataSourceORM) -> DataSource:
    return DataSource(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        type=row.type,
        connection_config=_json_loads(row.connection_config),
        status=row.status or "connected",
        created_at=row.created_at or "",
        updated_at=row.updated_at or "",
    )


def _orm_to_data_product(row: models.DataProductORM) -> DataProduct:
    tags: list[str] = []
    raw_tags = _json_loads_list(row.tags)
    for entry in raw_tags:
        if isinstance(entry, str):
            tags.append(entry)
    history_raw = _json_loads_list(row.description) if False else _json_loads_list("")
    history: list[dict[str, Any]] = []
    for entry in history_raw:
        if isinstance(entry, dict):
            history.append(dict(entry))
    # NOTE: history is not currently persisted on the ORM (TEXT slot would be
    # reserved for a future column). The in-memory store retains history;
    # SQL store simply yields an empty list to keep the dataclass shape stable.
    return DataProduct(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        source_paimon_table=row.source_paimon_table,
        target_iceberg_table=row.target_iceberg_table,
        version=row.version or 1,
        modality=row.modality or "structured",
        status=row.status or "draft",
        owner=row.owner or "",
        description=row.description or "",
        tags=tags,
        history=history,
        created_at=row.created_at or "",
        updated_at=row.updated_at or "",
    )


# ---------------------------------------------------------------------------
# Read API — CDC tasks
# ---------------------------------------------------------------------------
def list_cdc_tasks(
    tenant_id: str,
    status: str | None = None,
) -> list[CdcTask]:
    if not tenant_id:
        return []
    s = _session()
    stmt = select(models.CdcTaskORM).where(models.CdcTaskORM.tenant_id == tenant_id)
    if status:
        stmt = stmt.where(models.CdcTaskORM.status == status)
    rows = s.execute(stmt.order_by(models.CdcTaskORM.id)).scalars().all()
    return [_orm_to_cdc_task(r) for r in rows]


def get_cdc_task(tenant_id: str, task_id: str) -> CdcTask | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.CdcTaskORM).where(
            models.CdcTaskORM.tenant_id == tenant_id,
            models.CdcTaskORM.id == task_id,
        )
    ).scalar_one_or_none()
    return _orm_to_cdc_task(row) if row else None


# ---------------------------------------------------------------------------
# Read API — data sources
# ---------------------------------------------------------------------------
def list_sources(
    tenant_id: str,
    type_filter: str | None = None,
) -> list[DataSource]:
    if not tenant_id:
        return []
    s = _session()
    stmt = select(models.DataSourceORM).where(models.DataSourceORM.tenant_id == tenant_id)
    if type_filter:
        stmt = stmt.where(models.DataSourceORM.type == type_filter)
    rows = s.execute(stmt.order_by(models.DataSourceORM.id)).scalars().all()
    return [_orm_to_source(r) for r in rows]


def get_source(tenant_id: str, source_id: str) -> DataSource | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.DataSourceORM).where(
            models.DataSourceORM.tenant_id == tenant_id,
            models.DataSourceORM.id == source_id,
        )
    ).scalar_one_or_none()
    return _orm_to_source(row) if row else None


# ---------------------------------------------------------------------------
# Write API — CDC tasks
# ---------------------------------------------------------------------------
def put_cdc_task(tenant_id: str, task: CdcTask) -> CdcTask:
    if not tenant_id:
        return task
    s = _session()
    config_str = _json_dumps(task.config)
    existing = s.get(models.CdcTaskORM, task.id)
    if existing:
        existing.name = task.name
        existing.source_id = task.source_id
        existing.target_table = task.target_table
        existing.status = task.status
        existing.config = config_str
        existing.updated_at = task.updated_at
    else:
        s.add(
            models.CdcTaskORM(
                id=task.id,
                tenant_id=tenant_id,
                name=task.name,
                source_id=task.source_id,
                target_table=task.target_table,
                status=task.status,
                config=config_str,
                created_at=task.created_at,
                updated_at=task.updated_at,
            )
        )
    s.commit()
    return task


def delete_cdc_task(tenant_id: str, task_id: str) -> bool:
    if not tenant_id:
        return False
    s = _session()
    row = s.execute(
        select(models.CdcTaskORM).where(
            models.CdcTaskORM.tenant_id == tenant_id,
            models.CdcTaskORM.id == task_id,
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    s.delete(row)
    s.commit()
    return True


def set_cdc_task_status(
    tenant_id: str,
    task_id: str,
    status: str,
) -> CdcTask | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.CdcTaskORM).where(
            models.CdcTaskORM.tenant_id == tenant_id,
            models.CdcTaskORM.id == task_id,
        )
    ).scalar_one_or_none()
    if row is None:
        return None
    row.status = status
    s.commit()
    return _orm_to_cdc_task(row)


# ---------------------------------------------------------------------------
# Write API — data sources
# ---------------------------------------------------------------------------
def put_source(tenant_id: str, source: DataSource) -> DataSource:
    if not tenant_id:
        return source
    s = _session()
    config_str = _json_dumps(source.connection_config)
    existing = s.get(models.DataSourceORM, source.id)
    if existing:
        existing.name = source.name
        existing.type = source.type
        existing.connection_config = config_str
        existing.status = source.status
        existing.updated_at = source.updated_at
    else:
        s.add(
            models.DataSourceORM(
                id=source.id,
                tenant_id=tenant_id,
                name=source.name,
                type=source.type,
                connection_config=config_str,
                status=source.status,
                created_at=source.created_at,
                updated_at=source.updated_at,
            )
        )
    s.commit()
    return source


def delete_source(tenant_id: str, source_id: str) -> bool:
    if not tenant_id:
        return False
    s = _session()
    row = s.execute(
        select(models.DataSourceORM).where(
            models.DataSourceORM.tenant_id == tenant_id,
            models.DataSourceORM.id == source_id,
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    s.delete(row)
    s.commit()
    return True


# ---------------------------------------------------------------------------
# Read API — Data Products (Iceberg ADS)
# ---------------------------------------------------------------------------
def list_data_products(
    tenant_id: str,
    status: str | None = None,
    modality: str | None = None,
) -> list[DataProduct]:
    if not tenant_id:
        return []
    s = _session()
    stmt = select(models.DataProductORM).where(models.DataProductORM.tenant_id == tenant_id)
    if status:
        stmt = stmt.where(models.DataProductORM.status == status)
    if modality:
        stmt = stmt.where(models.DataProductORM.modality == modality)
    rows = s.execute(stmt.order_by(models.DataProductORM.id)).scalars().all()
    return [_orm_to_data_product(r) for r in rows]


def get_data_product(tenant_id: str, product_id: str) -> DataProduct | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.DataProductORM).where(
            models.DataProductORM.tenant_id == tenant_id,
            models.DataProductORM.id == product_id,
        )
    ).scalar_one_or_none()
    return _orm_to_data_product(row) if row else None


# ---------------------------------------------------------------------------
# Write API — Data Products (Iceberg ADS)
# ---------------------------------------------------------------------------
def put_data_product(tenant_id: str, product: DataProduct) -> DataProduct:
    if not tenant_id:
        return product
    s = _session()
    tags_str = json.dumps(list(product.tags or []), ensure_ascii=False)
    existing = s.get(models.DataProductORM, product.id)
    if existing:
        existing.name = product.name
        existing.version = product.version
        existing.source_paimon_table = product.source_paimon_table
        existing.target_iceberg_table = product.target_iceberg_table
        existing.modality = product.modality
        existing.status = product.status
        existing.owner = product.owner
        existing.description = product.description
        existing.tags = tags_str
        existing.updated_at = product.updated_at
    else:
        s.add(
            models.DataProductORM(
                id=product.id,
                tenant_id=tenant_id,
                name=product.name,
                version=product.version,
                source_paimon_table=product.source_paimon_table,
                target_iceberg_table=product.target_iceberg_table,
                modality=product.modality,
                status=product.status,
                owner=product.owner,
                description=product.description,
                tags=tags_str,
                created_at=product.created_at,
                updated_at=product.updated_at,
            )
        )
    s.commit()
    return product


def delete_data_product(tenant_id: str, product_id: str) -> bool:
    if not tenant_id:
        return False
    s = _session()
    row = s.execute(
        select(models.DataProductORM).where(
            models.DataProductORM.tenant_id == tenant_id,
            models.DataProductORM.id == product_id,
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    s.delete(row)
    s.commit()
    return True


def set_data_product_status(
    tenant_id: str,
    product_id: str,
    status: str,
    *,
    bump_version: bool = False,
    require_owner: bool = False,
) -> DataProduct | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.DataProductORM).where(
            models.DataProductORM.tenant_id == tenant_id,
            models.DataProductORM.id == product_id,
        )
    ).scalar_one_or_none()
    if row is None:
        return None
    if require_owner and not row.owner:
        return None
    if bump_version:
        row.version = row.version + 1
    row.status = status
    s.commit()
    return _orm_to_data_product(row)


# ---------------------------------------------------------------------------
# Bootstrap — seed SQL store from in_memory seed data (one-time)
# ---------------------------------------------------------------------------
def seed_from_inmemory(tenant_id: str) -> dict[str, int]:
    """Seed the SQL store from in_memory seed data.

    Returns counts of rows inserted per table.
    """
    from . import in_memory as mem

    counts: dict[str, int] = {}
    counts["cdc_tasks"] = len([put_cdc_task(tenant_id, t) for t in mem.list_cdc_tasks(tenant_id)])
    counts["sources"] = len([put_source(tenant_id, s) for s in mem.list_sources(tenant_id)])
    counts["data_products"] = len(
        [put_data_product(tenant_id, p) for p in mem.list_data_products(tenant_id)]
    )
    return counts


# ---------------------------------------------------------------------------
# create_*/update_* aliases（与 in_memory 同签名，底层走 put_*）
# 让 API 层在 SQL 模式下能以完全相同的接口调用。
# ---------------------------------------------------------------------------
def create_cdc_task(
    tenant_id: str,
    name: str,
    source_id: str,
    target_table: str,
    config: dict[str, Any] | None = None,
) -> CdcTask:
    """Create a new CDC task and persist it via put_cdc_task."""
    now = _now()
    task = CdcTask(
        id=f"cdc-{uuid.uuid4().hex[:8]}",
        tenant_id=tenant_id,
        name=name,
        source_id=source_id,
        target_table=target_table,
        status="running",
        config=dict(config or {}),
        created_at=now,
        updated_at=now,
    )
    return put_cdc_task(tenant_id, task)


def update_cdc_task(
    tenant_id: str,
    task_id: str,
    *,
    name: str | None = None,
    source_id: str | None = None,
    target_table: str | None = None,
    config: dict[str, Any] | None = None,
) -> CdcTask | None:
    """Patch mutable fields of an existing CDC task. Returns None if missing."""
    task = get_cdc_task(tenant_id, task_id)
    if task is None:
        return None
    if name is not None:
        task.name = name
    if source_id is not None:
        task.source_id = source_id
    if target_table is not None:
        task.target_table = target_table
    if config is not None:
        task.config = dict(config)
    task.updated_at = _now()
    return put_cdc_task(tenant_id, task)


def create_source(
    tenant_id: str,
    name: str,
    type: str,
    connection_config: dict[str, Any] | None = None,
) -> DataSource:
    """Create a new data source and persist it via put_source."""
    now = _now()
    source = DataSource(
        id=f"src-{uuid.uuid4().hex[:8]}",
        tenant_id=tenant_id,
        name=name,
        type=type,
        connection_config=dict(connection_config or {}),
        status="connected",
        created_at=now,
        updated_at=now,
    )
    return put_source(tenant_id, source)


def update_source(
    tenant_id: str,
    source_id: str,
    *,
    name: str | None = None,
    type: str | None = None,
    connection_config: dict[str, Any] | None = None,
) -> DataSource | None:
    """Patch mutable fields of an existing data source. Returns None if missing."""
    source = get_source(tenant_id, source_id)
    if source is None:
        return None
    if name is not None:
        source.name = name
    if type is not None:
        source.type = type
    if connection_config is not None:
        source.connection_config = dict(connection_config)
    source.updated_at = _now()
    return put_source(tenant_id, source)


def create_data_product(
    tenant_id: str,
    name: str,
    source_paimon_table: str,
    target_iceberg_table: str,
    *,
    modality: str = "structured",
    owner: str = "",
    description: str = "",
    tags: list[str] | None = None,
) -> DataProduct:
    """Create a new DataProduct and persist it via put_data_product."""
    from .in_memory import DATA_PRODUCT_MODALITIES

    now = _now()
    normalised = modality if modality in DATA_PRODUCT_MODALITIES else "structured"
    product = DataProduct(
        id=f"dp-{uuid.uuid4().hex[:8]}",
        tenant_id=tenant_id,
        name=name,
        source_paimon_table=source_paimon_table,
        target_iceberg_table=target_iceberg_table,
        version=1,
        modality=normalised,
        status="draft",
        owner=owner,
        description=description,
        tags=list(tags or []),
        history=[{"version": 1, "status": "draft", "at": now}],
        created_at=now,
        updated_at=now,
    )
    return put_data_product(tenant_id, product)


def update_data_product(
    tenant_id: str,
    product_id: str,
    **fields: Any,
) -> DataProduct | None:
    """Patch mutable fields of an existing DataProduct. Returns None if missing."""
    from .in_memory import DATA_PRODUCT_MODALITIES

    product = get_data_product(tenant_id, product_id)
    if product is None:
        return None
    mutable_fields = {
        "name",
        "source_paimon_table",
        "target_iceberg_table",
        "modality",
        "owner",
        "description",
        "tags",
    }
    for key, value in fields.items():
        if key not in mutable_fields:
            continue
        if key == "modality" and value not in DATA_PRODUCT_MODALITIES:
            continue
        if key == "tags" and value is not None:
            product.tags = list(value)
            continue
        setattr(product, key, value)
    product.updated_at = _now()
    return put_data_product(tenant_id, product)


# ---------------------------------------------------------------------------
# DATA-D6/D7 — lineage / quality / catalog（治理面，SQL 持久化）
# ---------------------------------------------------------------------------
from .in_memory import (
    LineageEdge,
    QualityResult,
    QualityRule,
)
from .sql_models import (
    DataLineageEdgeORM,
    DataQualityResultORM,
    DataQualityRuleORM,
)


def create_lineage_edge(
    tenant_id: str,
    source_entity: str,
    target_entity: str,
    edge_type: str = "derived_from",
) -> LineageEdge:
    edge = LineageEdge(
        id=f"lnge-{uuid.uuid4().hex[:8]}",
        tenant_id=tenant_id,
        source_entity=source_entity,
        target_entity=target_entity,
        edge_type=edge_type,
        created_at=_now(),
    )
    with _session() as session:
        session.add(
            DataLineageEdgeORM(
                id=edge.id,
                tenant_id=tenant_id,
                source_entity=source_entity,
                target_entity=target_entity,
                edge_type=edge_type,
                created_at=edge.created_at,
            )
        )
        session.commit()
    return edge


def list_lineage_edges(tenant_id: str) -> list[LineageEdge]:
    with _session() as session:
        rows = session.query(DataLineageEdgeORM).filter_by(tenant_id=tenant_id).all()
        return [
            LineageEdge(
                id=r.id,
                tenant_id=r.tenant_id,
                source_entity=r.source_entity,
                target_entity=r.target_entity,
                edge_type=r.edge_type,
                created_at=r.created_at,
            )
            for r in rows
        ]


def create_quality_rule(
    tenant_id: str,
    entity_id: str,
    field: str,
    rule_type: str,
    params: dict[str, Any] | None = None,
) -> QualityRule:
    rule = QualityRule(
        id=f"dqr-{uuid.uuid4().hex[:8]}",
        tenant_id=tenant_id,
        entity_id=entity_id,
        field=field,
        rule_type=rule_type,
        params=dict(params or {}),
        created_at=_now(),
    )
    with _session() as session:
        session.add(
            DataQualityRuleORM(
                id=rule.id,
                tenant_id=tenant_id,
                entity_id=entity_id,
                field=field,
                rule_type=rule_type,
                params=_json_dumps(rule.params),
                enabled=True,
                created_at=rule.created_at,
            )
        )
        session.commit()
    return rule


def list_quality_rules(
    tenant_id: str,
    entity_id: str | None = None,
    enabled_only: bool = False,
) -> list[QualityRule]:
    with _session() as session:
        q = session.query(DataQualityRuleORM).filter_by(tenant_id=tenant_id)
        if entity_id:
            q = q.filter_by(entity_id=entity_id)
        if enabled_only:
            q = q.filter_by(enabled=True)
        rows = q.all()
        return [
            QualityRule(
                id=r.id,
                tenant_id=r.tenant_id,
                entity_id=r.entity_id,
                field=r.field,
                rule_type=r.rule_type,
                params=_json_loads(r.params),
                enabled=bool(r.enabled),
                created_at=r.created_at,
            )
            for r in rows
        ]


def save_quality_results(tenant_id: str, results: list[QualityResult]) -> None:
    with _session() as session:
        for r in results:
            session.add(
                DataQualityResultORM(
                    id=r.id,
                    tenant_id=r.tenant_id,
                    rule_id=r.rule_id,
                    entity_id=r.entity_id,
                    field=r.field,
                    rule_type=r.rule_type,
                    passed=r.passed,
                    detail=r.detail,
                    ran_at=r.ran_at,
                )
            )
        session.commit()


def list_quality_results(tenant_id: str, limit: int = 50) -> list[QualityResult]:
    with _session() as session:
        rows = (
            session.query(DataQualityResultORM)
            .filter_by(tenant_id=tenant_id)
            .order_by(DataQualityResultORM.ran_at.desc())
            .limit(limit)
            .all()
        )
        return [
            QualityResult(
                id=r.id,
                tenant_id=r.tenant_id,
                rule_id=r.rule_id,
                entity_id=r.entity_id,
                field=r.field,
                rule_type=r.rule_type,
                passed=bool(r.passed),
                detail=r.detail,
                ran_at=r.ran_at,
            )
            for r in rows
        ]


def run_quality_rules(tenant_id: str) -> dict[str, Any]:
    """执行本租户全部 enabled 规则（对 source schema），结果落 PG。"""
    from .in_memory import _quality_check, get_source_schema

    rules = list_quality_rules(tenant_id, enabled_only=True)
    results: list[QualityResult] = []
    for rule in rules:
        schema = get_source_schema(tenant_id, rule.entity_id)
        results.append(_quality_check(rule, schema))
    save_quality_results(tenant_id, results)
    return {
        "rules_executed": len(rules),
        "passed": sum(1 for r in results if r.passed),
        "failed": sum(1 for r in results if not r.passed),
        "results": results,
    }


def lineage_graph(tenant_id: str, entity: str | None = None) -> dict[str, Any]:
    """返回 {nodes, edges} 依赖图；entity 给定时只保留相连子图。"""
    edges = list_lineage_edges(tenant_id)
    if entity:
        edges = [e for e in edges if entity in (e.source_entity, e.target_entity)]
    nodes: dict[str, None] = {}
    for e in edges:
        nodes[e.source_entity] = None
        nodes[e.target_entity] = None
    return {
        "nodes": [{"id": n} for n in sorted(nodes)],
        "edges": [
            {
                "source": e.source_entity,
                "target": e.target_entity,
                "edge_type": e.edge_type,
                "id": e.id,
            }
            for e in edges
        ],
    }


def catalog_search(tenant_id: str, q: str) -> list[dict[str, Any]]:
    """跨 sources + data products 的名称/描述检索（catalog 面）。"""
    q_lower = (q or "").lower()
    items: list[dict[str, Any]] = []
    for s in list_sources(tenant_id):
        hay = f"{s.name} {s.type}".lower()
        if q_lower in hay:
            items.append({"kind": "source", "id": s.id, "name": s.name, "detail": s.type})
    for p in list_data_products(tenant_id):
        hay = f"{p.name} {p.description} {p.modality}".lower()
        if q_lower in hay:
            items.append(
                {
                    "kind": "product",
                    "id": p.id,
                    "name": p.name,
                    "detail": p.modality,
                    "status": p.status,
                }
            )
    return items
