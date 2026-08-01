"""In-memory repository for the ont domain (P3-W4 TD-5).

Entities: Ontology, OntologyClass, OntologyInstance,
OntologyRelation, OntologyVersion.

All stores are tenant-scoped.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class Ontology:
    id: str
    tenant_id: str
    namespace: str = "default"
    description: str = ""
    created_at: str = ""
    updated_at: str = ""


@dataclass(frozen=True)
class OntologyClass:
    id: str
    tenant_id: str
    ontology_id: str = ""
    namespace: str = "default"
    label: str = ""
    parent: str | None = None
    properties: dict[str, Any] = field(default_factory=dict)
    created_at: str = ""


@dataclass(frozen=True)
class OntologyInstance:
    id: str
    tenant_id: str
    class_id: str = ""
    namespace: str = "default"
    properties: dict[str, Any] = field(default_factory=dict)
    created_at: str = ""


@dataclass(frozen=True)
class OntologyRelation:
    id: str
    tenant_id: str
    type: str = ""
    src_id: str = ""
    dst_id: str = ""
    properties: dict[str, Any] = field(default_factory=dict)
    created_at: str = ""


@dataclass(frozen=True)
class OntologyVersion:
    id: str
    tenant_id: str
    ontology_id: str = ""
    version: str = ""
    parent: str | None = None
    metadata: dict[str, str] = field(default_factory=dict)
    created_at: str = ""


# ---------------------------------------------------------------------------
# Seed builders
# ---------------------------------------------------------------------------
def _seed_ontologies(tenant_id: str) -> dict[str, Ontology]:
    catalog = [
        ("ont-sales", "sales", "Sales domain ontology"),
        ("ont-hr", "hr", "HR domain ontology"),
        ("ont-finance", "finance", "Finance domain ontology"),
    ]
    return {
        oid: Ontology(
            id=oid, tenant_id=tenant_id, namespace=ns, description=desc,
            created_at="2026-08-01T00:00:00Z", updated_at="2026-08-01T00:00:00Z",
        )
        for oid, ns, desc in catalog
    }


def _seed_classes(tenant_id: str) -> dict[str, OntologyClass]:
    catalog = [
        ("cls-customer", "ont-sales", "Customer", None, {"fields": "name,code"}),
        ("cls-product", "ont-sales", "Product", None, {"fields": "sku,price"}),
        ("cls-order", "ont-sales", "Order", "cls-customer", {"fields": "id,total"}),
    ]
    return {
        cid: OntologyClass(
            id=cid, tenant_id=tenant_id, ontology_id=oid, label=label,
            parent=parent, properties=props,
            created_at="2026-08-01T00:00:00Z",
        )
        for cid, oid, label, parent, props in catalog
    }


def _seed_instances(tenant_id: str) -> dict[str, OntologyInstance]:
    catalog = [
        ("inst-c1", "cls-customer", {"name": "Acme Corp"}),
        ("inst-c2", "cls-customer", {"name": "Globex"}),
        ("inst-p1", "cls-product", {"sku": "W-001", "price": "99"}),
    ]
    return {
        iid: OntologyInstance(
            id=iid, tenant_id=tenant_id, class_id=cid, properties=props,
            created_at="2026-08-01T00:00:00Z",
        )
        for iid, cid, props in catalog
    }


def _seed_relations(tenant_id: str) -> dict[str, OntologyRelation]:
    catalog = [
        ("rel-1", "places", "inst-c1", "inst-p1", {"count": "5"}),
        ("rel-2", "places", "inst-c2", "inst-p1", {"count": "3"}),
    ]
    return {
        rid: OntologyRelation(
            id=rid, tenant_id=tenant_id, type=t, src_id=s, dst_id=d,
            properties=props, created_at="2026-08-01T00:00:00Z",
        )
        for rid, t, s, d, props in catalog
    }


def _seed_versions(tenant_id: str) -> dict[str, OntologyVersion]:
    catalog = [
        ("ver-1", "ont-sales", "v1.0.0", None, {"author": "seed"}),
        ("ver-2", "ont-sales", "v1.1.0", "v1.0.0", {"author": "seed"}),
    ]
    return {
        vid: OntologyVersion(
            id=vid, tenant_id=tenant_id, ontology_id=oid, version=ver,
            parent=parent, metadata=meta,
            created_at="2026-08-01T00:00:00Z",
        )
        for vid, oid, ver, parent, meta in catalog
    }


# ---------------------------------------------------------------------------
# Stores
# ---------------------------------------------------------------------------
_ONTOLOGIES: dict[str, dict[str, Ontology]] = {}
_CLASSES: dict[str, dict[str, OntologyClass]] = {}
_INSTANCES: dict[str, dict[str, OntologyInstance]] = {}
_RELATIONS: dict[str, dict[str, OntologyRelation]] = {}
_VERSIONS: dict[str, dict[str, OntologyVersion]] = {}


def _ensure_tenant(tenant_id: str) -> None:
    if not tenant_id:
        return
    if tenant_id not in _ONTOLOGIES:
        _ONTOLOGIES[tenant_id] = _seed_ontologies(tenant_id)
    if tenant_id not in _CLASSES:
        _CLASSES[tenant_id] = _seed_classes(tenant_id)
    if tenant_id not in _INSTANCES:
        _INSTANCES[tenant_id] = _seed_instances(tenant_id)
    if tenant_id not in _RELATIONS:
        _RELATIONS[tenant_id] = _seed_relations(tenant_id)
    if tenant_id not in _VERSIONS:
        _VERSIONS[tenant_id] = _seed_versions(tenant_id)


# ---------------------------------------------------------------------------
# Public read API
# ---------------------------------------------------------------------------
def list_ontologies(tenant_id: str) -> list[Ontology]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_ONTOLOGIES[tenant_id].values(), key=lambda x: x.id)


def get_ontology(tenant_id: str, oid: str) -> Ontology | None:
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _ONTOLOGIES[tenant_id].get(oid)


def list_classes(tenant_id: str) -> list[OntologyClass]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_CLASSES[tenant_id].values(), key=lambda x: x.id)


def get_class(tenant_id: str, cid: str) -> OntologyClass | None:
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _CLASSES[tenant_id].get(cid)


def list_instances(tenant_id: str) -> list[OntologyInstance]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_INSTANCES[tenant_id].values(), key=lambda x: x.id)


def get_instance(tenant_id: str, iid: str) -> OntologyInstance | None:
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _INSTANCES[tenant_id].get(iid)


def list_relations(tenant_id: str) -> list[OntologyRelation]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_RELATIONS[tenant_id].values(), key=lambda x: x.id)


def get_relation(tenant_id: str, rid: str) -> OntologyRelation | None:
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _RELATIONS[tenant_id].get(rid)


def list_versions(tenant_id: str) -> list[OntologyVersion]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_VERSIONS[tenant_id].values(), key=lambda x: x.id)


def get_version(tenant_id: str, vid: str) -> OntologyVersion | None:
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _VERSIONS[tenant_id].get(vid)


# ---------------------------------------------------------------------------
# Public write API — ontologies
# ---------------------------------------------------------------------------
def put_ontology(tenant_id: str, ont: Ontology) -> Ontology:
    if not tenant_id:
        return ont
    _ensure_tenant(tenant_id)
    _ONTOLOGIES[tenant_id][ont.id] = ont
    return ont


def delete_ontology(tenant_id: str, oid: str) -> bool:
    if not tenant_id:
        return False
    _ensure_tenant(tenant_id)
    if oid not in _ONTOLOGIES[tenant_id]:
        return False
    del _ONTOLOGIES[tenant_id][oid]
    return True


# ---------------------------------------------------------------------------
# Public write API — classes
# ---------------------------------------------------------------------------
def put_class(tenant_id: str, cls: OntologyClass) -> OntologyClass:
    if not tenant_id:
        return cls
    _ensure_tenant(tenant_id)
    _CLASSES[tenant_id][cls.id] = cls
    return cls


def delete_class(tenant_id: str, cid: str) -> bool:
    if not tenant_id:
        return False
    _ensure_tenant(tenant_id)
    if cid not in _CLASSES[tenant_id]:
        return False
    del _CLASSES[tenant_id][cid]
    return True


# ---------------------------------------------------------------------------
# Public write API — instances
# ---------------------------------------------------------------------------
def put_instance(tenant_id: str, inst: OntologyInstance) -> OntologyInstance:
    if not tenant_id:
        return inst
    _ensure_tenant(tenant_id)
    _INSTANCES[tenant_id][inst.id] = inst
    return inst


def delete_instance(tenant_id: str, iid: str) -> bool:
    if not tenant_id:
        return False
    _ensure_tenant(tenant_id)
    if iid not in _INSTANCES[tenant_id]:
        return False
    del _INSTANCES[tenant_id][iid]
    return True


# ---------------------------------------------------------------------------
# Public write API — versions
# ---------------------------------------------------------------------------
def put_version(tenant_id: str, ver: OntologyVersion) -> OntologyVersion:
    if not tenant_id:
        return ver
    _ensure_tenant(tenant_id)
    _VERSIONS[tenant_id][ver.id] = ver
    return ver


def delete_version(tenant_id: str, vid: str) -> bool:
    if not tenant_id:
        return False
    _ensure_tenant(tenant_id)
    if vid not in _VERSIONS[tenant_id]:
        return False
    del _VERSIONS[tenant_id][vid]
    return True


# ---------------------------------------------------------------------------
# Test helpers
# ---------------------------------------------------------------------------
def reset_store() -> None:
    _ONTOLOGIES.clear()
    _CLASSES.clear()
    _INSTANCES.clear()
    _RELATIONS.clear()
    _VERSIONS.clear()
