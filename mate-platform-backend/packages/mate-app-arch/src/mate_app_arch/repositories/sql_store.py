"""SQL-backed repository for the architecture center — SQLAlchemy 2.0.

Provides read + write for the most important entity types
(Application, Capability, DataEntity, DataFlow, DataAsset). Other
entities fall through to in_memory.

Tuple fields (e.g. ``DataEntity.fields``) are serialised as
newline-separated TEXT on write and re-hydrated to tuples on read.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from mate_tech_db.base import get_session

from . import sql_models as models
from .in_memory import (
    Application,
    Capability,
    DataAsset,
    DataEntity,
    DataFlow,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _session() -> Session:
    return get_session()


def _split_lines(text: str) -> tuple[str, ...]:
    """Split a newline-separated TEXT column back into a tuple."""
    if not text:
        return ()
    return tuple(s for s in text.split("\n") if s.strip())


def _join_lines(items: tuple[str, ...]) -> str:
    """Join a tuple into a newline-separated TEXT value."""
    return "\n".join(items) if items else ""


def _orm_to_application(row: models.ApplicationORM) -> Application:
    return Application(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        code=row.code,
        category=row.category or "",
        owner=row.owner or "",
        status=row.status or "active",
        description=row.description or "",
    )


def _orm_to_capability(row: models.CapabilityORM) -> Capability:
    return Capability(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        code=row.code,
        parent_id=row.parent_id or "",
        level=row.level,
        description=row.description or "",
    )


def _orm_to_data_asset(row: models.DataAssetORM) -> DataAsset:
    return DataAsset(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        code=row.code,
        layer=row.layer or "",
        domain=row.domain or "",
        owner=row.owner or "",
        status=row.status or "accepted",
    )


def _orm_to_data_entity(row: models.DataEntityORM) -> DataEntity:
    return DataEntity(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        code=row.code,
        data_asset_id=row.data_asset_id or "",
        fields=_split_lines(row.fields or ""),
    )


def _orm_to_data_flow(row: models.DataFlowORM) -> DataFlow:
    return DataFlow(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        code=row.code,
        source_entity_id=row.source_entity_id or "",
        target_entity_id=row.target_entity_id or "",
        pipeline_spec=row.pipeline_spec or "",
    )


# ---------------------------------------------------------------------------
# Read API — mirrors in_memory function names
# ---------------------------------------------------------------------------
def list_applications(tenant_id: str) -> list[Application]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.ApplicationORM)
        .where(models.ApplicationORM.tenant_id == tenant_id)
        .order_by(models.ApplicationORM.code)
    ).scalars().all()
    return [_orm_to_application(r) for r in rows]


def list_capabilities(tenant_id: str) -> list[Capability]:
    """Return flat list of capabilities (sorted by code)."""
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.CapabilityORM)
        .where(models.CapabilityORM.tenant_id == tenant_id)
        .order_by(models.CapabilityORM.code)
    ).scalars().all()
    return [_orm_to_capability(r) for r in rows]


def list_capability_tree(tenant_id: str) -> list[dict[str, Any]]:
    """Return capabilities as a nested tree structure."""
    caps = list_capabilities(tenant_id)
    nodes: dict[str, dict[str, Any]] = {
        c.code: {
            "id": c.id,
            "code": c.code,
            "name": c.name,
            "level": c.level,
            "children": [],
        }
        for c in caps
    }
    roots: list[dict[str, Any]] = []
    for c in caps:
        node = nodes[c.code]
        if c.parent_id and c.parent_id in nodes:
            nodes[c.parent_id]["children"].append(node)
        else:
            roots.append(node)
    return roots


def list_data_assets(tenant_id: str) -> list[DataAsset]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.DataAssetORM)
        .where(models.DataAssetORM.tenant_id == tenant_id)
        .order_by(models.DataAssetORM.code)
    ).scalars().all()
    return [_orm_to_data_asset(r) for r in rows]


def list_data_entities(tenant_id: str) -> list[DataEntity]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.DataEntityORM)
        .where(models.DataEntityORM.tenant_id == tenant_id)
        .order_by(models.DataEntityORM.code)
    ).scalars().all()
    return [_orm_to_data_entity(r) for r in rows]


def list_data_flows(tenant_id: str) -> list[DataFlow]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.DataFlowORM)
        .where(models.DataFlowORM.tenant_id == tenant_id)
        .order_by(models.DataFlowORM.code)
    ).scalars().all()
    return [_orm_to_data_flow(r) for r in rows]


# ---------------------------------------------------------------------------
# Write API
# ---------------------------------------------------------------------------
def put_application(tenant_id: str, app: Application) -> Application:
    if not tenant_id:
        return app
    s = _session()
    existing = s.get(models.ApplicationORM, app.id)
    if existing:
        existing.name = app.name
        existing.category = app.category
        existing.owner = app.owner
        existing.status = app.status
        existing.description = app.description
    else:
        s.add(models.ApplicationORM(
            id=app.id, tenant_id=tenant_id, name=app.name, code=app.code,
            category=app.category, owner=app.owner, status=app.status,
            description=app.description,
        ))
    s.commit()
    return app


def put_capability(tenant_id: str, cap: Capability) -> Capability:
    if not tenant_id:
        return cap
    s = _session()
    existing = s.get(models.CapabilityORM, cap.id)
    if existing:
        existing.name = cap.name
        existing.parent_id = cap.parent_id
        existing.level = cap.level
        existing.description = cap.description
    else:
        s.add(models.CapabilityORM(
            id=cap.id, tenant_id=tenant_id, name=cap.name, code=cap.code,
            parent_id=cap.parent_id, level=cap.level, description=cap.description,
        ))
    s.commit()
    return cap


def put_data_asset(tenant_id: str, asset: DataAsset) -> DataAsset:
    if not tenant_id:
        return asset
    s = _session()
    existing = s.get(models.DataAssetORM, asset.id)
    if existing:
        existing.name = asset.name
        existing.layer = asset.layer
        existing.domain = asset.domain
        existing.owner = asset.owner
        existing.status = asset.status
    else:
        s.add(models.DataAssetORM(
            id=asset.id, tenant_id=tenant_id, name=asset.name, code=asset.code,
            layer=asset.layer, domain=asset.domain, owner=asset.owner,
            status=asset.status,
        ))
    s.commit()
    return asset


def put_data_entity(tenant_id: str, entity: DataEntity) -> DataEntity:
    if not tenant_id:
        return entity
    s = _session()
    fields_str = _join_lines(entity.fields)
    existing = s.get(models.DataEntityORM, entity.id)
    if existing:
        existing.name = entity.name
        existing.data_asset_id = entity.data_asset_id
        existing.fields = fields_str
    else:
        s.add(models.DataEntityORM(
            id=entity.id, tenant_id=tenant_id, name=entity.name, code=entity.code,
            data_asset_id=entity.data_asset_id, fields=fields_str,
        ))
    s.commit()
    return entity


def put_data_flow(tenant_id: str, flow: DataFlow) -> DataFlow:
    if not tenant_id:
        return flow
    s = _session()
    existing = s.get(models.DataFlowORM, flow.id)
    if existing:
        existing.name = flow.name
        existing.source_entity_id = flow.source_entity_id
        existing.target_entity_id = flow.target_entity_id
        existing.pipeline_spec = flow.pipeline_spec
    else:
        s.add(models.DataFlowORM(
            id=flow.id, tenant_id=tenant_id, name=flow.name, code=flow.code,
            source_entity_id=flow.source_entity_id,
            target_entity_id=flow.target_entity_id,
            pipeline_spec=flow.pipeline_spec,
        ))
    s.commit()
    return flow


# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------
def seed_from_inmemory(tenant_id: str) -> dict[str, int]:
    """Seed the SQL store from in_memory seed data (one-time bootstrap).

    Returns counts of rows inserted per table.
    """
    from . import in_memory as mem  # noqa: PLC0415

    counts: dict[str, int] = {}
    counts["applications"] = len(
        [put_application(tenant_id, a) for a in mem.list_applications(tenant_id)]
    )
    counts["capabilities"] = len(
        [put_capability(tenant_id, c) for c in _mem_capabilities(tenant_id)]
    )
    counts["data_assets"] = len(
        [put_data_asset(tenant_id, a) for a in mem.list_data_assets(tenant_id)]
    )
    counts["data_entities"] = len(
        [put_data_entity(tenant_id, e) for e in mem.list_data_entities(tenant_id)]
    )
    counts["data_flows"] = len(
        [put_data_flow(tenant_id, f) for f in mem.list_data_flows(tenant_id)]
    )
    return counts


def _mem_capabilities(tenant_id: str) -> list[Capability]:
    """Flatten the capability tree from in_memory into a flat list.

    in_memory exposes list_capability_tree (nested) but not a flat
    list_capabilities, so we walk the tree to collect all nodes and
    reconstruct parent_id from the nesting structure.
    """
    from . import in_memory as mem  # noqa: PLC0415

    result: list[Capability] = []

    def _walk(nodes: list[dict[str, Any]], parent_code: str = "") -> None:
        for node in nodes:
            result.append(Capability(
                id=node["id"],
                tenant_id=tenant_id,
                name=node["name"],
                code=node["code"],
                parent_id=parent_code,
                level=node.get("level", 1),
            ))
            _walk(node.get("children", []), node["code"])

    _walk(mem.list_capability_tree(tenant_id))
    return result
