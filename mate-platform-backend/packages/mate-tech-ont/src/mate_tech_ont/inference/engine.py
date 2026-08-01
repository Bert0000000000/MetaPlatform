"""推理引擎 (ST-5.4.9).

支持 subclass 属性继承、transitivity 传递闭包、
BFS 最短路径查询和 K-hop 邻居发现。
"""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from typing import Any

import structlog

from mate_tech_ont.instances.store import InstanceStore, store as default_store

logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Rule types
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class InferenceRule:
    """Base inference rule."""


@dataclass(frozen=True, slots=True)
class SubclassRule(InferenceRule):
    """Subclass → super 属性继承.

    遍历 ``rel_type`` 关系(child → parent),
    将 parent 实例的属性继承到 child 实例。
    """

    rel_type: str = "subclass_of"


@dataclass(frozen=True, slots=True)
class TransitivityRule(InferenceRule):
    """传递闭包: A→B, B→C ⟹ A→C.

    对 ``rel_type`` 类型的有向关系计算传递闭包,
    返回所有可推断的新关系。
    """

    rel_type: str = "related_to"


# ---------------------------------------------------------------------------
# Result types
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class InferredRelation:
    """推理产生的新关系."""

    src_id: str
    dst_id: str
    type: str
    via: list[str] = field(default_factory=list)


@dataclass(frozen=True, slots=True)
class InheritedProperty:
    """推理产生的属性继承."""

    instance_id: str
    from_class: str
    properties: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class InferenceResult:
    """apply_rules 的返回."""

    inherited: list[InheritedProperty] = field(default_factory=list)
    inferred_relations: list[InferredRelation] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------


class InferenceEngine:
    """推理引擎 — 对 InstanceStore 的实例与关系做推理."""

    def __init__(self, instance_store: InstanceStore | None = None) -> None:
        self._store = instance_store or default_store

    # -- public API --

    def apply_rules(
        self,
        tenant_id: str,
        rules: list[InferenceRule],
    ) -> InferenceResult:
        """对租户范围内的实例集应用推理规则."""
        result = InferenceResult()
        for rule in rules:
            if isinstance(rule, SubclassRule):
                result.inherited.extend(self._apply_subclass(tenant_id, rule))
            elif isinstance(rule, TransitivityRule):
                result.inferred_relations.extend(
                    self._apply_transitivity(tenant_id, rule)
                )
            else:
                logger.warning("inference.unknown_rule", rule=type(rule).__name__)
        logger.info(
            "inference.applied",
            tenant=tenant_id,
            inherited=len(result.inherited),
            transitive=len(result.inferred_relations),
        )
        return result

    def find_path(
        self,
        tenant_id: str,
        source: str,
        target: str,
        max_depth: int = 10,
    ) -> list[str] | None:
        """BFS 最短路径查询.

        返回从 source 到 target 的节点 ID 列表;
        无路径时返回 None。
        """
        adj = self._build_adjacency(tenant_id)
        if source not in adj or target not in adj:
            return None
        if source == target:
            return [source]

        queue: deque[tuple[str, list[str]]] = deque([(source, [source])])
        visited: set[str] = {source}
        depth = 0
        while queue and depth < max_depth:
            for _ in range(len(queue)):
                node, path = queue.popleft()
                for neighbor, _rel_type in adj.get(node, []):
                    if neighbor == target:
                        return [*path, neighbor]
                    if neighbor not in visited:
                        visited.add(neighbor)
                        queue.append((neighbor, [*path, neighbor]))
            depth += 1
        return None

    def get_neighbors(
        self,
        tenant_id: str,
        node: str,
        depth: int = 1,
    ) -> list[str]:
        """K-hop 邻居发现.

        返回从 node 出发 depth 跳内可达的所有节点(不含 node 自身)。
        """
        adj = self._build_adjacency(tenant_id)
        if node not in adj:
            return []

        visited: set[str] = {node}
        frontier: set[str] = {node}
        for _ in range(depth):
            next_frontier: set[str] = set()
            for n in frontier:
                for neighbor, _rel_type in adj.get(n, []):
                    if neighbor not in visited:
                        visited.add(neighbor)
                        next_frontier.add(neighbor)
            frontier = next_frontier
            if not frontier:
                break
        visited.discard(node)
        return list(visited)

    # -- internals --

    def _tenant_instance_ids(self, tenant_id: str) -> set[str]:
        return {
            i.id for i in self._store.list_instances() if i.namespace == tenant_id
        }

    def _tenant_relations(self, tenant_id: str) -> list[Any]:
        ids = self._tenant_instance_ids(tenant_id)
        return [
            r for r in self._store.list_relations() if r.src_id in ids and r.dst_id in ids
        ]

    def _build_adjacency(self, tenant_id: str) -> dict[str, list[tuple[str, str]]]:
        """Build undirected adjacency graph scoped to *tenant_id*."""
        adj: dict[str, list[tuple[str, str]]] = {}
        for rel in self._tenant_relations(tenant_id):
            adj.setdefault(rel.src_id, []).append((rel.dst_id, rel.type))
            adj.setdefault(rel.dst_id, []).append((rel.src_id, rel.type))
        return adj

    def _apply_subclass(
        self,
        tenant_id: str,
        rule: SubclassRule,
    ) -> list[InheritedProperty]:
        """Subclass property inheritance.

        For each ``rel_type`` relation (child → parent):
        copy parent instance properties into child.
        """
        rels = [r for r in self._tenant_relations(tenant_id) if r.type == rule.rel_type]
        inherited: list[InheritedProperty] = []
        for rel in rels:
            parent = self._store.get_instance(rel.dst_id)
            child = self._store.get_instance(rel.src_id)
            if parent is None or child is None:
                continue
            new_props = {
                k: v for k, v in parent.properties.items() if k not in child.properties
            }
            if new_props:
                inherited.append(
                    InheritedProperty(
                        instance_id=child.id,
                        from_class=parent.class_id,
                        properties=new_props,
                    )
                )
        return inherited

    def _apply_transitivity(
        self,
        tenant_id: str,
        rule: TransitivityRule,
    ) -> list[InferredRelation]:
        """Transitive closure for *rule.rel_type* relations.

        A→B, B→C ⟹ A→C (if not already a direct relation).
        """
        rels = [r for r in self._tenant_relations(tenant_id) if r.type == rule.rel_type]

        # Build directed adjacency for this relation type
        directed: dict[str, list[str]] = {}
        existing: set[tuple[str, str]] = set()
        for r in rels:
            directed.setdefault(r.src_id, []).append(r.dst_id)
            existing.add((r.src_id, r.dst_id))

        # Floyd-Warshall style transitive closure
        inferred: list[InferredRelation] = []
        for src in directed:
            # BFS to find all reachable nodes
            queue: deque[tuple[str, list[str]]] = deque([(src, [])])
            seen: set[str] = set()
            while queue:
                node, path = queue.popleft()
                for nxt in directed.get(node, []):
                    if nxt in seen:
                        continue
                    seen.add(nxt)
                    new_path = [*path, node]
                    if (src, nxt) not in existing and src != nxt:
                        full_via = [*new_path, nxt]
                        inferred.append(
                            InferredRelation(
                                src_id=src,
                                dst_id=nxt,
                                type=rule.rel_type,
                                via=full_via,
                            )
                        )
                    queue.append((nxt, new_path))
        return inferred
