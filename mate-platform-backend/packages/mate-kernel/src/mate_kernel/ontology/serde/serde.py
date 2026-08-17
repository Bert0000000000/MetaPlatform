"""12 基元的 to_dict / from_dict。

设计：
- to_dict：dataclass → JSON 友好的 dict（含 ISO 字符串 / enum 字符串值 / tuple → list）
- from_dict：dict → 严格 dataclass（缺字段、类型错、rid 不合法都抛 ValueError）
- 命名对齐 OpenAPI：snake_case（与 ADR-0021 字段一致）
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from mate_kernel.ontology.identity import ClassRef, Version
from mate_kernel.ontology.instances import Individual, LinkInstance
from mate_kernel.ontology.query import ObjectSet
from mate_kernel.ontology.reasoning import (
    Axiom,
    AxiomKind,
    Function,
    FunctionLanguage,
)
from mate_kernel.ontology.types import (
    ActionType,
    Cardinality,
    Directionality,
    Interface,
    LinkType,
    ObjectType,
    Property,
    PropertyFormat,
)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _from_iso(s: str) -> datetime:
    return datetime.fromisoformat(s)


# ─────────────────────────── identity ───────────────────────────


def class_ref_to_dict(cr: ClassRef) -> dict[str, str]:
    return {"rid": cr.rid}


def class_ref_from_dict(d: dict[str, Any]) -> ClassRef:
    return ClassRef(d["rid"])


def version_to_dict(v: Version) -> dict[str, Any]:
    return {
        "rid": v.rid,
        "class_ref": v.class_ref.rid,
        "parent_rid": v.parent_rid,
        "created_at": _iso(v.created_at),
        "author": v.author,
        "change_set": list(v.change_set),
    }


def version_from_dict(d: dict[str, Any]) -> Version:
    return Version(
        rid=d["rid"],
        class_ref=ClassRef(d["class_ref"]),
        parent_rid=d.get("parent_rid"),
        created_at=_from_iso(d["created_at"]),
        author=d["author"],
        change_set=tuple(d.get("change_set", [])),
    )


# ─────────────────────────── types ────────────────────────────


def property_to_dict(p: Property) -> dict[str, Any]:
    return {
        "rid": p.rid.rid,
        "type_id": p.type_id,
        "nullable": p.nullable,
        "primary_key": p.primary_key,
        "title": p.title,
        "format": p.format.value,
    }


def property_from_dict(d: dict[str, Any]) -> Property:
    return Property(
        rid=ClassRef(d["rid"]),
        type_id=d["type_id"],
        nullable=d["nullable"],
        primary_key=d["primary_key"],
        title=d["title"],
        format=PropertyFormat(d["format"]),
    )


def object_type_to_dict(ot: ObjectType) -> dict[str, Any]:
    return {
        "rid": ot.rid.rid,
        "primary_key": [pk.rid for pk in ot.primary_key],
        "properties": [property_to_dict(p) for p in ot.properties],
        "interfaces": [i.rid for i in ot.interfaces],
        "display_name": ot.display_name,
    }


def object_type_from_dict(d: dict[str, Any]) -> ObjectType:
    return ObjectType(
        rid=ClassRef(d["rid"]),
        primary_key=tuple(ClassRef(pk) for pk in d["primary_key"]),
        properties=tuple(property_from_dict(p) for p in d["properties"]),
        interfaces=tuple(ClassRef(i) for i in d.get("interfaces", [])),
        display_name=d.get("display_name", ""),
    )


def link_type_to_dict(lt: LinkType) -> dict[str, Any]:
    return {
        "rid": lt.rid.rid,
        "src": lt.src.rid,
        "dst": lt.dst.rid,
        "cardinality": lt.cardinality.value,
        "directionality": lt.directionality.value,
        "link_properties": [property_to_dict(p) for p in lt.link_properties],
    }


def link_type_from_dict(d: dict[str, Any]) -> LinkType:
    return LinkType(
        rid=ClassRef(d["rid"]),
        src=ClassRef(d["src"]),
        dst=ClassRef(d["dst"]),
        cardinality=Cardinality(d["cardinality"]),
        directionality=Directionality(d["directionality"]),
        link_properties=tuple(
            property_from_dict(p) for p in d.get("link_properties", [])
        ),
    )


def action_type_to_dict(at: ActionType) -> dict[str, Any]:
    return {
        "rid": at.rid.rid,
        "parameters": [property_to_dict(p) for p in at.parameters],
        "submission_criteria": list(at.submission_criteria),
        "side_effects": list(at.side_effects),
        "function_ref": at.function_ref.rid,
        "on": [t.rid for t in at.on],
        "title": at.title,
        "description": at.description,
    }


def action_type_from_dict(d: dict[str, Any]) -> ActionType:
    return ActionType(
        rid=ClassRef(d["rid"]),
        parameters=tuple(property_from_dict(p) for p in d["parameters"]),
        submission_criteria=tuple(d["submission_criteria"]),
        side_effects=tuple(d["side_effects"]),
        function_ref=ClassRef(d["function_ref"]),
        on=tuple(ClassRef(t) for t in d["on"]),
        title=d.get("title", ""),
        description=d.get("description", ""),
    )


def interface_to_dict(i: Interface) -> dict[str, Any]:
    return {
        "rid": i.rid.rid,
        "properties": [property_to_dict(p) for p in i.properties],
        "required_links": [rl.rid for rl in i.required_links],
        "polymorphic_action_constraints": list(i.polymorphic_action_constraints),
    }


def interface_from_dict(d: dict[str, Any]) -> Interface:
    return Interface(
        rid=ClassRef(d["rid"]),
        properties=tuple(property_from_dict(p) for p in d.get("properties", [])),
        required_links=tuple(ClassRef(rl) for rl in d.get("required_links", [])),
        polymorphic_action_constraints=tuple(
            d.get("polymorphic_action_constraints", [])
        ),
    )


# ─────────────────────────── instances ──────────────────────────


def individual_to_dict(ind: Individual) -> dict[str, Any]:
    return {
        "rid": ind.rid,
        "class_rid": ind.class_rid.rid,
        "props": [[k.rid, v] for k, v in ind.props],
        "primary_key": ind.primary_key,
        "created_at": _iso(ind.created_at),
        "updated_at": _iso(ind.updated_at),
        "tenant_id": ind.tenant_id,
        "marking": list(ind.marking),
    }


def individual_from_dict(d: dict[str, Any]) -> Individual:
    return Individual(
        rid=d["rid"],
        class_rid=ClassRef(d["class_rid"]),
        props=tuple((ClassRef(k), v) for k, v in d["props"]),
        primary_key=d["primary_key"],
        created_at=_from_iso(d["created_at"]),
        updated_at=_from_iso(d["updated_at"]),
        tenant_id=d["tenant_id"],
        marking=tuple(d.get("marking", [])),
    )


def link_instance_to_dict(li: LinkInstance) -> dict[str, Any]:
    return {
        "rid": li.rid,
        "link_type_rid": li.link_type_rid.rid,
        "src": li.src,
        "dst": li.dst,
        "props": [[k.rid, v] for k, v in li.props],
        "created_at": _iso(li.created_at),
        "tenant_id": li.tenant_id,
        "marking": list(li.marking),
    }


def link_instance_from_dict(d: dict[str, Any]) -> LinkInstance:
    return LinkInstance(
        rid=d["rid"],
        link_type_rid=ClassRef(d["link_type_rid"]),
        src=d["src"],
        dst=d["dst"],
        props=tuple((ClassRef(k), v) for k, v in d["props"]),
        created_at=_from_iso(d["created_at"]),
        tenant_id=d["tenant_id"],
        marking=tuple(d.get("marking", [])),
    )


# ─────────────────────────── reasoning ─────────────────────────


def axiom_to_dict(a: Axiom) -> dict[str, Any]:
    return {
        "rid": a.rid.rid,
        "kind": a.kind.value,
        "operands": [op.rid for op in a.operands],
        "rule_ref": a.rule_ref,
        "metadata": [list(kv) for kv in a.metadata],
    }


def axiom_from_dict(d: dict[str, Any]) -> Axiom:
    return Axiom(
        rid=ClassRef(d["rid"]),
        kind=AxiomKind(d["kind"]),
        operands=tuple(ClassRef(op) for op in d["operands"]),
        rule_ref=d["rule_ref"],
        metadata=tuple(tuple(kv) for kv in d.get("metadata", [])),
    )


def function_to_dict(f: Function) -> dict[str, Any]:
    return {
        "rid": f.rid.rid,
        "language": f.language.value,
        "version": f.version,
        "source_ref": f.source_ref,
        "signatures": [list(s) for s in f.signatures],
    }


def function_from_dict(d: dict[str, Any]) -> Function:
    return Function(
        rid=ClassRef(d["rid"]),
        language=FunctionLanguage(d["language"]),
        version=d["version"],
        source_ref=d["source_ref"],
        signatures=tuple(tuple(s) for s in d.get("signatures", [])),
    )


# ─────────────────────────── query ─────────────────────────────


def object_set_to_dict(os_: ObjectSet) -> dict[str, Any]:
    return {
        "class_rid": os_.class_rid.rid,
        "filter_expr": os_.filter_expr,
        "sort": list(os_.sort),
        "paging_offset": os_.paging_offset,
        "paging_limit": os_.paging_limit,
        "view_config": os_.view_config,
    }


def object_set_from_dict(d: dict[str, Any]) -> ObjectSet:
    return ObjectSet(
        class_rid=ClassRef(d["class_rid"]),
        filter_expr=d["filter_expr"],
        sort=tuple(d.get("sort", [])),
        paging_offset=d.get("paging_offset", 0),
        paging_limit=d.get("paging_limit", 100),
        view_config=d.get("view_config"),
    )


# ─────────────────────────── 聚合入口（按 kind 路由）────────────


_TO_DICT_DISPATCH = {
    "class_ref": class_ref_to_dict,
    "version": version_to_dict,
    "property": property_to_dict,
    "object_type": object_type_to_dict,
    "link_type": link_type_to_dict,
    "action_type": action_type_to_dict,
    "interface": interface_to_dict,
    "individual": individual_to_dict,
    "link_instance": link_instance_to_dict,
    "axiom": axiom_to_dict,
    "function": function_to_dict,
    "object_set": object_set_to_dict,
}

_FROM_DICT_DISPATCH = {
    "class_ref": class_ref_from_dict,
    "version": version_from_dict,
    "property": property_from_dict,
    "object_type": object_type_from_dict,
    "link_type": link_type_from_dict,
    "action_type": action_type_from_dict,
    "interface": interface_from_dict,
    "individual": individual_from_dict,
    "link_instance": link_instance_from_dict,
    "axiom": axiom_from_dict,
    "function": function_from_dict,
    "object_set": object_set_from_dict,
}


def to_dict(obj: Any) -> dict[str, Any]:
    """按 Python 类型自动路由。"""
    cls = type(obj)
    dispatch = {
        ClassRef: class_ref_to_dict,
        Version: version_to_dict,
        Property: property_to_dict,
        ObjectType: object_type_to_dict,
        LinkType: link_type_to_dict,
        ActionType: action_type_to_dict,
        Interface: interface_to_dict,
        Individual: individual_to_dict,
        LinkInstance: link_instance_to_dict,
        Axiom: axiom_to_dict,
        Function: function_to_dict,
        ObjectSet: object_set_to_dict,
    }
    fn = dispatch.get(cls)
    if fn is None:
        raise TypeError(f"unsupported type: {cls.__name__}")
    return fn(obj)


def from_dict(kind: str, d: dict[str, Any]) -> Any:
    """按 kind 字符串路由。"""
    fn = _FROM_DICT_DISPATCH.get(kind)
    if fn is None:
        raise ValueError(f"unknown kind: {kind!r}")
    return fn(d)
