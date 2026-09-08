"""reasoning/engine — Axiom 执行引擎最小闭环（ONT-G16+G13，2026-09-08）。

无状态推理服务：输入类型层级 + 实例断言 + 公理集，输出推导事实。
规则集（第一批）：
  R1 subclass 传递闭包 —— A⊑B ∧ B⊑C ⟹ A⊑C；实例继承全部祖先类
  R2 same_as 合并      —— 对称闭包（a≈b ∧ b≈c ⟹ a≈b≈c）
  R3 transitive_property —— xRy ∧ yRz ⟹ xRz
"""
from __future__ import annotations

from typing import Any


def _subclass_closure(subclass_axioms: list[tuple[str, str]]) -> dict[str, set[str]]:
    """直接子类边 → 全祖先映射（含传递闭包）。"""
    direct: dict[str, set[str]] = {}
    for sub, sup in subclass_axioms:
        direct.setdefault(sub, set()).add(sup)
    closed: dict[str, set[str]] = {}

    def ancestors(c: str, seen: frozenset[str] = frozenset()) -> set[str]:
        if c in closed:
            return closed[c]
        if c in seen:  # 环保护
            return set()
        out: set[str] = set()
        for parent in direct.get(c, ()):
            out.add(parent)
            out |= ancestors(parent, seen | {c})
        closed[c] = out
        return out

    for c in list(direct):
        ancestors(c)
    return closed


def _same_as_clusters(pairs: list[tuple[str, str]]) -> dict[str, str]:
    """并查集：个体 → 规范代表元。"""
    parent: dict[str, str] = {}

    def find(x: str) -> str:
        parent.setdefault(x, x)
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for a, b in pairs:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra
    return {x: find(x) for x in parent}


def run_inference(
    *,
    subclass_axioms: list[tuple[str, str]],
    individuals: dict[str, list[str]],
    same_as_pairs: list[tuple[str, str]],
    transitive_axioms: list[str],  # property names marked transitive
    property_edges: list[tuple[str, str, str]],  # (property, src, dst)
) -> dict[str, Any]:
    """执行三规则，返回可断言的推导事实。"""
    ancestors = _subclass_closure(subclass_axioms)

    # R1: 实例继承祖先类
    classification: dict[str, set[str]] = {}
    for ind, classes in individuals.items():
        asserted = set(classes)
        inferred = set()
        for c in classes:
            inferred |= ancestors.get(c, set())
        classification[ind] = {"asserted": sorted(asserted),
                               "inferred": sorted(inferred - asserted)}

    # R2: same_as 合并
    clusters = _same_as_clusters(same_as_pairs)
    merged: dict[str, list[str]] = {}
    for ind, rep in clusters.items():
        merged.setdefault(rep, []).append(ind)
    same_as_clusters = {rep: sorted(members)
                        for rep, members in merged.items() if len(members) > 1}

    # R3: 传递属性闭包
    transitive_set = set(transitive_axioms)
    by_prop: dict[str, list[tuple[str, str]]] = {}
    for prop, src, dst in property_edges:
        if prop in transitive_set:
            by_prop.setdefault(prop, []).append((src, dst))
    transitive_inferred: list[dict[str, str]] = []
    for prop, edges in by_prop.items():
        adj: dict[str, set[str]] = {}
        for src, dst in edges:
            adj.setdefault(src, set()).add(dst)
        # BFS：每个起点可达的非直接后继
        for src in list(adj):
            seen: dict[str, int] = {}

            def dfs(node: str, depth: int) -> None:
                for nxt in adj.get(node, ()):
                    if nxt not in seen:
                        seen[nxt] = depth
                        dfs(nxt, depth + 1)

            dfs(src, 0)
            direct = adj[src]
            for dst, depth in seen.items():
                if depth >= 1 and dst not in direct:
                    transitive_inferred.append(
                        {"property": prop, "src": src, "dst": dst})

    inferred_by_rule = (
        sum(1 for v in classification.values() for _ in v["inferred"])
        + sum(len(c) - 1 for c in same_as_clusters.values())
        + len(transitive_inferred)
    )
    return {
        "classification": classification,
        "same_as_clusters": same_as_clusters,
        "transitive_inferred": transitive_inferred,
        "stats": {
            "rules_applied": 3,
            "facts_inferred": inferred_by_rule,
        },
    }
