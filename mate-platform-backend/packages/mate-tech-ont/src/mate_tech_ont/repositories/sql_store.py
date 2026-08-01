"""SQL-backed repository for the ont domain (P3-W4 TD-5) — SQLAlchemy 2.0.

Provides read + write for Ontology, OntologyClass, OntologyInstance,
OntologyRelation, and OntologyVersion. Dict fields (``properties``,
``metadata``) are JSON-serialised to TEXT.
"""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from mate_tech_db.base import Base, get_session  # noqa: F401

from . import sql_models as models
from .in_memory import (
    Ontology,
    OntologyClass,
    OntologyInstance,
    OntologyRelation,
    OntologyVersion,
)


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
def _orm_to_ontology(row: models.OntologyORM) -> Ontology:
    return Ontology(
        id=row.id,
        tenant_id=row.tenant_id,
        namespace=row.namespace or "default",
        description=row.description or "",
        created_at=row.created_at or "",
        updated_at=row.updated_at or "",
    )


def _orm_to_class(row: models.OntologyClassORM) -> OntologyClass:
    return OntologyClass(
        id=row.id,
        tenant_id=row.tenant_id,
        ontology_id=row.ontology_id or "",
        namespace=row.namespace or "default",
        label=row.label or "",
        parent=row.parent,
        properties=_json_loads(row.properties),
        created_at=row.created_at or "",
    )


def _orm_to_instance(row: models.OntologyInstanceORM) -> OntologyInstance:
    return OntologyInstance(
        id=row.id,
        tenant_id=row.tenant_id,
        class_id=row.class_id or "",
        namespace=row.namespace or "default",
        properties=_json_loads(row.properties),
        created_at=row.created_at or "",
    )


def _orm_to_relation(row: models.OntologyRelationORM) -> OntologyRelation:
    return OntologyRelation(
        id=row.id,
        tenant_id=row.tenant_id,
        type=row.type or "",
        src_id=row.src_id or "",
        dst_id=row.dst_id or "",
        properties=_json_loads(row.properties),
        created_at=row.created_at or "",
    )


def _orm_to_version(row: models.OntologyVersionORM) -> OntologyVersion:
    return OntologyVersion(
        id=row.id,
        tenant_id=row.tenant_id,
        ontology_id=row.ontology_id or "",
        version=row.version or "",
        parent=row.parent,
        metadata=_json_loads(row.ver_meta),
        created_at=row.created_at or "",
    )


# ---------------------------------------------------------------------------
# Read API
# ---------------------------------------------------------------------------
def list_ontologies(tenant_id: str) -> list[Ontology]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.OntologyORM)
        .where(models.OntologyORM.tenant_id == tenant_id)
        .order_by(models.OntologyORM.id)
    ).scalars().all()
    return [_orm_to_ontology(r) for r in rows]


def get_ontology(tenant_id: str, oid: str) -> Ontology | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.OntologyORM).where(
            models.OntologyORM.tenant_id == tenant_id,
            models.OntologyORM.id == oid,
        )
    ).scalar_one_or_none()
    return _orm_to_ontology(row) if row else None


def list_classes(tenant_id: str) -> list[OntologyClass]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.OntologyClassORM)
        .where(models.OntologyClassORM.tenant_id == tenant_id)
        .order_by(models.OntologyClassORM.id)
    ).scalars().all()
    return [_orm_to_class(r) for r in rows]


def get_class(tenant_id: str, cid: str) -> OntologyClass | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.OntologyClassORM).where(
            models.OntologyClassORM.tenant_id == tenant_id,
            models.OntologyClassORM.id == cid,
        )
    ).scalar_one_or_none()
    return _orm_to_class(row) if row else None


def list_instances(tenant_id: str) -> list[OntologyInstance]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.OntologyInstanceORM)
        .where(models.OntologyInstanceORM.tenant_id == tenant_id)
        .order_by(models.OntologyInstanceORM.id)
    ).scalars().all()
    return [_orm_to_instance(r) for r in rows]


def get_instance(tenant_id: str, iid: str) -> OntologyInstance | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.OntologyInstanceORM).where(
            models.OntologyInstanceORM.tenant_id == tenant_id,
            models.OntologyInstanceORM.id == iid,
        )
    ).scalar_one_or_none()
    return _orm_to_instance(row) if row else None


def list_relations(tenant_id: str) -> list[OntologyRelation]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.OntologyRelationORM)
        .where(models.OntologyRelationORM.tenant_id == tenant_id)
        .order_by(models.OntologyRelationORM.id)
    ).scalars().all()
    return [_orm_to_relation(r) for r in rows]


def get_relation(tenant_id: str, rid: str) -> OntologyRelation | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.OntologyRelationORM).where(
            models.OntologyRelationORM.tenant_id == tenant_id,
            models.OntologyRelationORM.id == rid,
        )
    ).scalar_one_or_none()
    return _orm_to_relation(row) if row else None


def list_versions(tenant_id: str) -> list[OntologyVersion]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.OntologyVersionORM)
        .where(models.OntologyVersionORM.tenant_id == tenant_id)
        .order_by(models.OntologyVersionORM.id)
    ).scalars().all()
    return [_orm_to_version(r) for r in rows]


def get_version(tenant_id: str, vid: str) -> OntologyVersion | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.OntologyVersionORM).where(
            models.OntologyVersionORM.tenant_id == tenant_id,
            models.OntologyVersionORM.id == vid,
        )
    ).scalar_one_or_none()
    return _orm_to_version(row) if row else None


# ---------------------------------------------------------------------------
# Write API — ontologies
# ---------------------------------------------------------------------------
def put_ontology(tenant_id: str, ont: Ontology) -> Ontology:
    if not tenant_id:
        return ont
    s = _session()
    existing = s.get(models.OntologyORM, ont.id)
    if existing:
        existing.namespace = ont.namespace
        existing.description = ont.description
        existing.updated_at = ont.updated_at
    else:
        s.add(models.OntologyORM(
            id=ont.id, tenant_id=tenant_id, namespace=ont.namespace,
            description=ont.description, created_at=ont.created_at,
            updated_at=ont.updated_at,
        ))
    s.commit()
    return ont


def delete_ontology(tenant_id: str, oid: str) -> bool:
    if not tenant_id:
        return False
    s = _session()
    row = s.execute(
        select(models.OntologyORM).where(
            models.OntologyORM.tenant_id == tenant_id,
            models.OntologyORM.id == oid,
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    s.delete(row)
    s.commit()
    return True


# ---------------------------------------------------------------------------
# Write API — classes
# ---------------------------------------------------------------------------
def put_class(tenant_id: str, cls: OntologyClass) -> OntologyClass:
    if not tenant_id:
        return cls
    s = _session()
    props_str = _json_dumps(cls.properties)
    existing = s.get(models.OntologyClassORM, cls.id)
    if existing:
        existing.ontology_id = cls.ontology_id
        existing.namespace = cls.namespace
        existing.label = cls.label
        existing.parent = cls.parent
        existing.properties = props_str
        existing.created_at = cls.created_at
    else:
        s.add(models.OntologyClassORM(
            id=cls.id, tenant_id=tenant_id, ontology_id=cls.ontology_id,
            namespace=cls.namespace, label=cls.label, parent=cls.parent,
            properties=props_str, created_at=cls.created_at,
        ))
    s.commit()
    return cls


def delete_class(tenant_id: str, cid: str) -> bool:
    if not tenant_id:
        return False
    s = _session()
    row = s.execute(
        select(models.OntologyClassORM).where(
            models.OntologyClassORM.tenant_id == tenant_id,
            models.OntologyClassORM.id == cid,
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    s.delete(row)
    s.commit()
    return True


# ---------------------------------------------------------------------------
# Write API — instances
# ---------------------------------------------------------------------------
def put_instance(tenant_id: str, inst: OntologyInstance) -> OntologyInstance:
    if not tenant_id:
        return inst
    s = _session()
    props_str = _json_dumps(inst.properties)
    existing = s.get(models.OntologyInstanceORM, inst.id)
    if existing:
        existing.class_id = inst.class_id
        existing.namespace = inst.namespace
        existing.properties = props_str
        existing.created_at = inst.created_at
    else:
        s.add(models.OntologyInstanceORM(
            id=inst.id, tenant_id=tenant_id, class_id=inst.class_id,
            namespace=inst.namespace, properties=props_str,
            created_at=inst.created_at,
        ))
    s.commit()
    return inst


def delete_instance(tenant_id: str, iid: str) -> bool:
    if not tenant_id:
        return False
    s = _session()
    row = s.execute(
        select(models.OntologyInstanceORM).where(
            models.OntologyInstanceORM.tenant_id == tenant_id,
            models.OntologyInstanceORM.id == iid,
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    s.delete(row)
    s.commit()
    return True


# ---------------------------------------------------------------------------
# Write API — versions
# ---------------------------------------------------------------------------
def put_version(tenant_id: str, ver: OntologyVersion) -> OntologyVersion:
    if not tenant_id:
        return ver
    s = _session()
    meta_str = _json_dumps(ver.metadata)
    existing = s.get(models.OntologyVersionORM, ver.id)
    if existing:
        existing.ontology_id = ver.ontology_id
        existing.version = ver.version
        existing.parent = ver.parent
        existing.ver_meta = meta_str
        existing.created_at = ver.created_at
    else:
        s.add(models.OntologyVersionORM(
            id=ver.id, tenant_id=tenant_id, ontology_id=ver.ontology_id,
            version=ver.version, parent=ver.parent, ver_meta=meta_str,
            created_at=ver.created_at,
        ))
    s.commit()
    return ver


def delete_version(tenant_id: str, vid: str) -> bool:
    if not tenant_id:
        return False
    s = _session()
    row = s.execute(
        select(models.OntologyVersionORM).where(
            models.OntologyVersionORM.tenant_id == tenant_id,
            models.OntologyVersionORM.id == vid,
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
    counts["ontologies"] = len(
        [put_ontology(tenant_id, o) for o in mem.list_ontologies(tenant_id)]
    )
    counts["classes"] = len(
        [put_class(tenant_id, c) for c in mem.list_classes(tenant_id)]
    )
    counts["instances"] = len(
        [put_instance(tenant_id, i) for i in mem.list_instances(tenant_id)]
    )
    counts["versions"] = len(
        [put_version(tenant_id, v) for v in mem.list_versions(tenant_id)]
    )
    return counts
