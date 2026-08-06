"""In-memory OntologyRepository —— KERNEL-01 测试 + dev runtime 默认实现。"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from mate_kernel.ontology.api import OntologyRepository
from mate_kernel.ontology.identity import ClassRef, Version
from mate_kernel.ontology.instances import Individual, LinkInstance
from mate_kernel.ontology.query import ObjectSet
from mate_kernel.ontology.reasoning import Axiom, Function
from mate_kernel.ontology.types import (
    ActionType,
    Interface,
    LinkType,
    ObjectType,
    Property,
)


class InMemoryOntologyRepository(OntologyRepository):
    """线程不安全的 in-memory repo —— 单进程 dev / test 用。"""

    def __init__(self) -> None:
        self._properties: dict[ClassRef, Property] = {}
        self._object_types: dict[ClassRef, ObjectType] = {}
        self._link_types: dict[ClassRef, LinkType] = {}
        self._action_types: dict[ClassRef, ActionType] = {}
        self._interfaces: dict[ClassRef, Interface] = {}
        self._versions: dict[ClassRef, list[Version]] = {}
        self._individuals: dict[str, Individual] = {}
        self._link_instances: dict[str, LinkInstance] = {}
        self._axioms: dict[ClassRef, Axiom] = {}
        self._functions: dict[ClassRef, Function] = {}

    # ───── identity ─────

    def resolve_class_ref(self, rid: str) -> ClassRef:
        return ClassRef(rid)

    def snapshot_version(self, class_rid: ClassRef, author: str, parent: str | None, change_set: tuple[str, ...]) -> Version:
        existing = self._versions.get(class_rid, [])
        n = len(existing) + 1
        rid = f"ont.{class_rid.rid.split('.')[1]}.ver.{class_rid.rid.split('.')[-1]}.v{n}"
        v = Version(
            rid=rid,
            class_ref=class_rid,
            parent_rid=parent or (existing[-1].rid if existing else None),
            created_at=datetime.now(timezone.utc),
            author=author,
            change_set=change_set,
        )
        self._versions.setdefault(class_rid, []).append(v)
        return v

    def list_versions(self, class_rid: ClassRef) -> list[Version]:
        return list(self._versions.get(class_rid, []))

    # ───── types ─────

    def upsert_property(self, p: Property) -> Property:
        self._properties[p.rid] = p
        return p

    def upsert_object_type(self, ot: ObjectType) -> ObjectType:
        for p in ot.properties:
            self._properties[p.rid] = p
        self._object_types[ot.rid] = ot
        return ot

    def upsert_link_type(self, lt: LinkType) -> LinkType:
        for p in lt.link_properties:
            self._properties[p.rid] = p
        self._link_types[lt.rid] = lt
        return lt

    def upsert_action_type(self, at: ActionType) -> ActionType:
        for p in at.parameters:
            self._properties[p.rid] = p
        self._action_types[at.rid] = at
        return at

    def upsert_interface(self, i: Interface) -> Interface:
        for p in i.properties:
            self._properties[p.rid] = p
        self._interfaces[i.rid] = i
        return i

    def list_object_types(self, limit: int, offset: int) -> list[ObjectType]:
        items = list(self._object_types.values())
        return items[offset : offset + limit]

    def list_link_types(self) -> list[LinkType]:
        return list(self._link_types.values())

    def list_action_types(self) -> list[ActionType]:
        return list(self._action_types.values())

    def list_interfaces(self) -> list[Interface]:
        return list(self._interfaces.values())

    def get_object_type(self, rid: ClassRef) -> ObjectType:
        return self._object_types[rid]

    def get_link_type(self, rid: ClassRef) -> LinkType:
        return self._link_types[rid]

    def get_action_type(self, rid: ClassRef) -> ActionType:
        return self._action_types[rid]

    # ───── instances ─────

    def create_individual(self, ind: Individual) -> Individual:
        self._individuals[ind.rid] = ind
        return ind

    def get_individual(self, rid: str) -> Individual:
        return self._individuals[rid]

    def list_individuals(self, class_rid: ClassRef | None) -> list[Individual]:
        items = self._individuals.values()
        if class_rid is not None:
            items = [i for i in items if i.class_rid == class_rid]
        return list(items)

    def create_link_instance(self, li: LinkInstance) -> LinkInstance:
        self._link_instances[li.rid] = li
        return li

    def list_link_instances(self) -> list[LinkInstance]:
        return list(self._link_instances.values())

    # ───── reasoning ─────

    def upsert_axiom(self, ax: Axiom) -> Axiom:
        self._axioms[ax.rid] = ax
        return ax

    def list_axioms(self) -> list[Axiom]:
        return list(self._axioms.values())

    def upsert_function(self, f: Function) -> Function:
        self._functions[f.rid] = f
        return f

    def list_functions(self) -> list[Function]:
        return list(self._functions.values())

    # ───── query / apply ─────

    def evaluate_object_set(self, os_: ObjectSet) -> list[Individual]:
        # dev runtime: 只按 class_rid 过滤；filter_expr / sort 留给 KERNEL-02+
        items = [
            i for i in self._individuals.values() if i.class_rid == os_.class_rid
        ]
        return items[os_.paging_offset : os_.paging_offset + os_.paging_limit]

    def apply_action(self, action_rid: ClassRef, target_iid: str, parameters: dict[str, Any], provenance: dict[str, Any]) -> tuple[datetime, list[str]]:
        # dev runtime: 校验 action 存在并返回审计占位
        if action_rid not in self._action_types:
            raise KeyError(f"action not found: {action_rid}")
        now = datetime.now(timezone.utc)
        side_effects = list(self._action_types[action_rid].side_effects)
        return now, side_effects