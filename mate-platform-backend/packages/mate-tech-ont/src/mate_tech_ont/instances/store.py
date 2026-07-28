"""实例管理 (ST-5.4.7).

/instances + /relations CRUD（in-memory + Neo4j 适配点）。
"""
from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


@dataclass(frozen=True, slots=True)
class Instance:
    """本体实例."""

    id: str
    class_id: str
    properties: dict[str, Any] = field(default_factory=dict)
    namespace: str = "default"
    created_at: float = field(default_factory=lambda: time.time())


@dataclass(frozen=True, slots=True)
class Relation:
    """实例间关系."""

    id: str
    type: str
    src_id: str
    dst_id: str
    properties: dict[str, Any] = field(default_factory=dict)


class InstanceStore:
    """实例存储（in-memory + Neo4j 适配点）."""

    def __init__(self) -> None:
        self._instances: dict[str, Instance] = {}
        self._relations: dict[str, Relation] = {}

    def create_instance(
        self, class_id: str, properties: dict[str, Any], namespace: str = "default"
    ) -> Instance:
        iid = str(uuid.uuid4())[:12]
        inst = Instance(
            id=iid,
            class_id=class_id,
            properties=properties,
            namespace=namespace,
        )
        self._instances[iid] = inst
        logger.info("instance.created", id=iid, class_id=class_id)
        return inst

    def get_instance(self, iid: str) -> Instance | None:
        return self._instances.get(iid)

    def list_instances(self, class_id: str | None = None) -> list[Instance]:
        all_insts = list(self._instances.values())
        if class_id:
            all_insts = [i for i in all_insts if i.class_id == class_id]
        return all_insts

    def delete_instance(self, iid: str) -> bool:
        if iid not in self._instances:
            return False
        del self._instances[iid]
        # 联动删除相关关系
        rels_to_del = [r for r in self._relations.values() if r.src_id == iid or r.dst_id == iid]
        for r in rels_to_del:
            del self._relations[r.id]
        return True

    def create_relation(
        self, type_: str, src_id: str, dst_id: str, properties: dict[str, Any] | None = None
    ) -> Relation:
        if src_id not in self._instances:
            raise ValueError(f"src instance '{src_id}' not found")
        if dst_id not in self._instances:
            raise ValueError(f"dst instance '{dst_id}' not found")
        rid = str(uuid.uuid4())[:12]
        rel = Relation(
            id=rid, type=type_, src_id=src_id, dst_id=dst_id,
            properties=properties or {},
        )
        self._relations[rid] = rel
        return rel

    def get_relation(self, rid: str) -> Relation | None:
        return self._relations.get(rid)

    def list_relations(self) -> list[Relation]:
        return list(self._relations.values())


# 全局单例
store = InstanceStore()