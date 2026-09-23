"""ONT-QUERY-SEMANTICS：查询源类解析的**唯一实现**（浏览 / ObjectSet / Agent 共用）。

本模块存在的理由：历史上"源类集合"在三条路径各写了一份，语义互不相同
（`pg_repo.list_individuals` / `pg_repo.evaluate_object_set` /
`pg_repo.execute_object_query`，外加 InMemory 的 `_list_source_allowed`）。
同一组语义参数在不同入口给出不同结果 —— 这正是本模块要消灭的分叉。

规则（**一处定义，全部入口消费**）：

1. **Interface 源** → 实现该接口的全部 ObjectType + **各实现类型的后代闭包**；
2. **ObjectType 源** → 自身 + **后代闭包**（沿启用的 subclass 公理）；
3. **未注册源** → 仅自身（精确匹配；legacy 宽容语义，便于"先查后建"）；
4. 后代闭包只认**启用**的 subclass 公理 —— 公理被禁用即自然退回精确匹配
   （G21 语义，见 `test_disabled_axiom_falls_back_to_exact`）；
5. Interface **无任何实现类型** → 返回空元组（调用方据此返回空结果，
   绝不能退化成"不过滤"）。

公理 operand 可能是**完整 rid** 也可能是 **slug**（历史写入两种都有），
统一在 `canonicalize_subclass_pairs` 归一为完整 rid 再求闭包。
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from typing import Any

from ..ontology.reasoning.engine import descendant_closure
from ..ontology.types.interface import interface_source_rids

__all__ = ["canonicalize_subclass_pairs", "interface_slug_rids", "resolve_source_classes"]


def _slug_of_type_rid(rid: str) -> str:
    """ObjectType rid → slug（6 段用第 5 段 domain 后的 slug；5 段 legacy 用第 4 段）。"""
    parts = rid.split(".")
    if len(parts) >= 6:
        return parts[4]
    if len(parts) == 5:
        return parts[3]
    return parts[-1]


def canonicalize_subclass_pairs(
    pairs: Iterable[tuple[str, str]],
    object_types: Sequence[Any],
) -> list[tuple[str, str]]:
    """子类公理对 → 完整 rid 对（slug 归一；一个 slug 命中多类型时展开为笛卡尔积）。

    slug 与 rid 混写是既有数据现实（EXPL-01 修复前会按 domain 误注册），
    归一后传递闭包才能跨写法连通。
    """
    rid_by_slug: dict[str, list[str]] = {}
    for t in object_types:
        rid = t.rid.rid
        rid_by_slug.setdefault(_slug_of_type_rid(rid), []).append(rid)

    def _canon(token: str) -> list[str]:
        if not token:
            return []
        if token.startswith("ont."):
            return [token]
        return rid_by_slug.get(token, [])

    out: list[tuple[str, str]] = []
    for sub, sup in pairs:
        for s in _canon(sub):
            for p in _canon(sup):
                out.append((s, p))
    return out


def interface_slug_rids(interface_rid: str, object_types: Sequence[Any]) -> list[str]:
    """Interface rid → 实现类型 rid 列表（顺序稳定）。"""
    return interface_source_rids(interface_rid, list(object_types))


def resolve_source_classes(
    source_rid: str,
    *,
    object_types: Sequence[Any],
    interface_rids: set[str],
    subclass_pairs: Iterable[tuple[str, str]],
) -> tuple[str, ...]:
    """源类 rid → **参与匹配的类 rid 集合**（规则见模块 docstring）。

    ``subclass_pairs`` 传**原始**公理对（含 slug 形态也可），内部归一。
    返回排序后的元组，保证结果与调用次序无关（稳定、可对账）。
    """
    if source_rid in interface_rids:
        bases = interface_slug_rids(source_rid, object_types)
        if not bases:
            return ()
    else:
        if source_rid not in {t.rid.rid for t in object_types}:
            return (source_rid,)  # 未注册 → 精确
        bases = [source_rid]

    closure = descendant_closure(canonicalize_subclass_pairs(subclass_pairs, object_types))
    allowed: set[str] = set(bases)
    for b in bases:
        allowed |= closure.get(b, set())
    return tuple(sorted(allowed))
