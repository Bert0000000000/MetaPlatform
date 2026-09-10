"""composition/topology —— 跨服务能力拓扑（MP-INTEGRATION-HUB-01 最小闭环）。

服务→能力→依赖的注册与静态拓扑分析：拓扑排序、环检测、缺失依赖报告、
影响面（反向依赖）查询。为后续 live 拓扑面（从 gateway 路由/服务注册
自动发现）提供内核。
"""

from __future__ import annotations

from dataclasses import dataclass


class TopologyCycleError(ValueError):
    pass


@dataclass(frozen=True)
class CapabilityNode:
    service: str
    capability: str
    depends_on: frozenset[str] = frozenset()  # 依赖的 capability 名


class CapabilityTopology:
    def __init__(self) -> None:
        self._nodes: dict[str, CapabilityNode] = {}

    def register(self, node: CapabilityNode) -> None:
        self._nodes[node.capability] = node

    def missing_dependencies(self) -> dict[str, list[str]]:
        out: dict[str, list[str]] = {}
        for node in self._nodes.values():
            missing = sorted(set(node.depends_on) - set(self._nodes))
            if missing:
                out[node.capability] = missing
        return out

    def dependents_of(self, capability: str) -> list[str]:
        """影响面：直接依赖 capability 的能力名（含传递）。"""
        direct = {n.capability for n in self._nodes.values() if capability in n.depends_on}
        seen: set[str] = set()
        frontier = direct
        while frontier:
            new: set[str] = set()
            for cap in frontier:
                if cap in seen:
                    continue
                seen.add(cap)
                new |= {n.capability for n in self._nodes.values() if cap in n.depends_on} - seen
            frontier = new
        return sorted(seen)

    def topological_order(self) -> list[str]:
        """Kahn 拓扑排序；环抛 TopologyCycleError。"""
        indegree = dict.fromkeys(self._nodes, 0)
        edges: dict[str, list[str]] = {cap: [] for cap in self._nodes}
        for node in self._nodes.values():
            for dep in node.depends_on:
                if dep in self._nodes:
                    edges[dep].append(node.capability)
                    indegree[node.capability] += 1
        queue = sorted(c for c, d in indegree.items() if d == 0)
        order: list[str] = []
        while queue:
            cap = queue.pop(0)
            order.append(cap)
            for nxt in edges[cap]:
                indegree[nxt] -= 1
                if indegree[nxt] == 0:
                    queue.append(nxt)
            queue.sort()
        if len(order) != len(self._nodes):
            cyclic = sorted(c for c, d in indegree.items() if d > 0)
            raise TopologyCycleError(f"cyclic capabilities: {cyclic}")
        return order

    def snapshot(self) -> dict:
        return {
            "capabilities": [
                {
                    "service": n.service,
                    "capability": n.capability,
                    "depends_on": sorted(n.depends_on),
                }
                for n in sorted(self._nodes.values(), key=lambda x: x.capability)
            ],
            "missing_dependencies": self.missing_dependencies(),
            "order": self.topological_order(),
            "total": len(self._nodes),
        }
