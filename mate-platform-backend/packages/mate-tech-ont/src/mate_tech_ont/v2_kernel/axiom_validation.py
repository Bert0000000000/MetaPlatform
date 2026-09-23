"""ADR-0070：Axiom 运行时违规检查（Core 三条规则）。

<p>12 基元之 Axiom 的运行时可消费面：不检查「公理定义是否合法」（那是 upsert 侧
的事），而是检查**当前数据实例是否违反已声明的公理**。与 SHACL
（`POST /v2/shacl/validate`，验证 ObjectType 合成 shapes）并列但为独立通道——
SHACL 不消费 Axiom。

<p>Core 第一批（其余 kind 计入 skipped，不影响 conforms）：

| kind | 检查 |
| --- | --- |
| `disjoint` | 个体的类链同时含两个不相交类 → violation |
| `has_key` | 同类实例 primary_key 重复 → violation |
| `subclass` | sub/super 成环（含自环）→ violation |

返回结构与 SHACL 报告一致：`{conforms, violations, stats}`，前端可复用同一渲染。
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from mate_kernel.ontology.identity import ClassRef
from mate_kernel.ontology.reasoning.axiom import Axiom, AxiomKind

__all__ = ["validate_axioms"]


def _class_chain(repo: Any, rid: str) -> tuple[str, ...]:
    """类链（含自身）。parent_class 是浅层级声明，但按闭包走更稳；带环保护。"""
    out: list[str] = []
    seen: set[str] = set()
    cur = rid
    while cur and cur not in seen:
        seen.add(cur)
        out.append(cur)
        try:
            ot = repo.get_object_type(ClassRef(cur))
        except Exception:
            break
        parent = getattr(ot, "parent_class", None)
        cur = parent.rid if parent is not None else ""
    return tuple(out)


def _scoped_individuals(repo: Any, tenant_id: str, class_rid: str | None) -> list[Any]:
    """租户内实例；给定 class_rid 时收窄到「该类及其子类」的实例。"""
    items = repo.list_individuals(None, tenant_id)
    if not class_rid:
        return items
    return [i for i in items if class_rid in _class_chain(repo, i.class_rid.rid)]


def _check_disjoint(
    repo: Any, tenant_id: str, ax: Axiom, target_class: str | None
) -> list[dict[str, Any]]:
    if len(ax.operands) < 2:
        return []
    left, right = ax.operands[0].rid, ax.operands[1].rid
    out: list[dict[str, Any]] = []
    for ind in _scoped_individuals(repo, tenant_id, target_class):
        chain = _class_chain(repo, ind.class_rid.rid)
        if left in chain and right in chain:
            out.append(
                {
                    "axiom_rid": ax.rid.rid,
                    "kind": ax.kind.value,
                    "severity": "Violation",
                    "focus_node": ind.rid,
                    "message": (f"实例所属类同时落在不相交类 {left} 与 {right} 之下"),
                }
            )
    return out


def _check_has_key(
    repo: Any, tenant_id: str, ax: Axiom, target_class: str | None
) -> list[dict[str, Any]]:
    if not ax.operands:
        return []
    klass = ax.operands[0].rid
    if target_class and target_class not in _class_chain(repo, klass):
        # target_class 收窄到这个类域之外 → 本公理不适用
        if klass not in _class_chain(repo, target_class):
            return []
    by_key: dict[str, list[Any]] = {}
    for ind in _scoped_individuals(repo, tenant_id, klass):
        by_key.setdefault(ind.primary_key, []).append(ind)
    out: list[dict[str, Any]] = []
    for key, group in by_key.items():
        if len(group) < 2:
            continue
        out.append(
            {
                "axiom_rid": ax.rid.rid,
                "kind": ax.kind.value,
                "severity": "Violation",
                "focus_node": group[0].rid,
                "message": (
                    f"{klass} 下主键 {key!r} 重复 {len(group)} 次："
                    + ", ".join(i.rid for i in group)
                ),
            }
        )
    return out


def _check_subclass(
    repo: Any, tenant_id: str, ax: Axiom, target_class: str | None
) -> list[dict[str, Any]]:
    del tenant_id, target_class  # 结构检查，与实例无关
    if len(ax.operands) < 2:
        return []
    sub, sup = ax.operands[0].rid, ax.operands[1].rid
    sub_chain = _class_chain(repo, sub)
    sup_chain = _class_chain(repo, sup)
    if sub in sup_chain and sup in sub_chain:
        return [
            {
                "axiom_rid": ax.rid.rid,
                "kind": ax.kind.value,
                "severity": "Violation",
                "focus_node": sub,
                "message": f"subclass 成环：{sub} 与 {sup} 互为祖先（自环或二级环）",
            }
        ]
    return []


_RULES: dict[AxiomKind, Callable[..., list[dict[str, Any]]]] = {
    AxiomKind.DISJOINT: _check_disjoint,
    AxiomKind.HAS_KEY: _check_has_key,
    AxiomKind.SUBCLASS: _check_subclass,
}


def validate_axioms(
    repo: Any,
    tenant_id: str,
    *,
    axiom_rid: str | None = None,
    target_class: str | None = None,
) -> dict[str, Any]:
    """校验租户内的公理在当前数据上是否被违反。

    Args:
        repo: ``PgOntologyRepository`` / ``InMemoryOntologyRepository``。
        tenant_id: 限定租户（公理 rid 形如 ``ont.<tenant>.axm...``）。
        axiom_rid: 只校验该公理；缺省全部。
        target_class: 限定实例范围（须为本租户类）。

    Returns:
        ``{conforms, violations, stats:{checked, violated, skipped}}``。
    """
    prefix = f"ont.{tenant_id}."
    axioms: list[Axiom] = list(repo.list_axioms())
    axioms = [a for a in axioms if a.rid.rid.startswith(prefix)]
    if axiom_rid:
        axioms = [a for a in axioms if a.rid.rid == axiom_rid]

    violations: list[dict[str, Any]] = []
    checked = violated = skipped = 0
    for ax in axioms:
        rule = _RULES.get(ax.kind)
        if rule is None:
            skipped += 1
            continue
        checked += 1
        found = rule(repo, tenant_id, ax, target_class)
        if found:
            violated += 1
            violations.extend(found)

    return {
        "conforms": not violations,
        "violations": violations,
        "stats": {"checked": checked, "violated": violated, "skipped": skipped},
    }
