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

<p>ONT-QUERY-SEMANTICS §5（性能）：**批量加载模型与实例 + 版本化缓存**。
此前每条规则、每个实例都回查 `get_object_type`（类链逐级一次）—— N 实例 × 深度 D
= O(N·D) 次查询。现在：

1. 模型（类型表）与实例各**加载一次**，所有公理共用；
2. 类链一次建成 `class → 祖先链` 映射（记忆化，实例侧 O(1) 查表）；
3. 映射按 **(租户, 模型内容指纹)** 缓存 —— 类型/公理一变指纹即变 → **自动失效**。
"""

from __future__ import annotations

import hashlib
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Any

from mate_kernel.ontology.reasoning.axiom import Axiom, AxiomKind

__all__ = ["validate_axioms"]


@dataclass(frozen=True, slots=True)
class _ModelIndex:
    """一次校验所需的模型投影：类 → 祖先链（含自身）。"""

    chain_of: dict[str, frozenset[str]]
    version: str

    def chain(self, class_rid: str) -> frozenset[str]:
        """类链（含自身）。未注册的类退化为 `{自身}` —— 与旧 `_class_chain` 一致。"""
        return self.chain_of.get(class_rid, frozenset({class_rid}))


# 租户 → 最近一次的模型投影（按内容指纹失效）
_CACHE: dict[str, _ModelIndex] = {}


def _model_version(object_types: Sequence[Any], axioms: Sequence[Axiom]) -> str:
    """**模型内容指纹**：类型(rid,parent) + 启用公理(kind,operands) 的哈希。

    内容变则指纹变 —— 缓存随之失效（不依赖时钟，也不怕同秒内多次修改）。
    """
    type_parts = sorted(
        f"{t.rid.rid}|{t.parent_class.rid if getattr(t, 'parent_class', None) else ''}"
        for t in object_types
    )
    axiom_parts = sorted(
        f"{a.kind.value}|{','.join(o.rid for o in a.operands)}"
        for a in axioms
        if dict(a.metadata).get("enabled") != "false"
    )
    blob = "\n".join(type_parts) + "\n--\n" + "\n".join(axiom_parts)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:16]


def _build_chain_map(object_types: Sequence[Any]) -> dict[str, frozenset[str]]:
    """类 → 祖先链（含自身）；沿 `parent_class` 上溯，带环保护。"""
    parents: dict[str, str] = {}
    for t in object_types:
        parent = getattr(t, "parent_class", None)
        parents[t.rid.rid] = parent.rid if parent is not None else ""
    out: dict[str, frozenset[str]] = {}
    for rid in parents:
        chain: list[str] = []
        seen: set[str] = set()
        cur = rid
        while cur and cur not in seen:
            seen.add(cur)
            chain.append(cur)
            cur = parents.get(cur, "")
        out[rid] = frozenset(chain)
    return out


def _model_index(repo: Any, tenant_id: str, axioms: Sequence[Axiom]) -> _ModelIndex:
    """批量取模型 → 内容指纹 → 命中缓存则复用，否则重建（**随模型版本失效**）。"""
    types = repo.list_object_types(limit=10000, offset=0)
    version = _model_version(types, axioms)
    cached = _CACHE.get(tenant_id)
    if cached is not None and cached.version == version:
        return cached
    index = _ModelIndex(chain_of=_build_chain_map(types), version=version)
    _CACHE[tenant_id] = index
    return index


def _scoped_individuals(
    individuals: Sequence[Any], index: _ModelIndex, class_rid: str | None
) -> list[Any]:
    """租户内实例；给定 class_rid 时收窄到「该类及其子类」的实例（查表，无回源）。"""
    if not class_rid:
        return list(individuals)
    return [i for i in individuals if class_rid in index.chain(i.class_rid.rid)]


def _check_disjoint(
    individuals: Sequence[Any], index: _ModelIndex, ax: Axiom, target_class: str | None
) -> list[dict[str, Any]]:
    if len(ax.operands) < 2:
        return []
    left, right = ax.operands[0].rid, ax.operands[1].rid
    out: list[dict[str, Any]] = []
    for ind in _scoped_individuals(individuals, index, target_class):
        chain = index.chain(ind.class_rid.rid)
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
    individuals: Sequence[Any], index: _ModelIndex, ax: Axiom, target_class: str | None
) -> list[dict[str, Any]]:
    if not ax.operands:
        return []
    klass = ax.operands[0].rid
    if target_class and target_class not in index.chain(klass):
        # target_class 收窄到这个类域之外 → 本公理不适用
        if klass not in index.chain(target_class):
            return []
    by_key: dict[str, list[Any]] = {}
    for ind in _scoped_individuals(individuals, index, klass):
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
    individuals: Sequence[Any], index: _ModelIndex, ax: Axiom, target_class: str | None
) -> list[dict[str, Any]]:
    del individuals, target_class  # 结构检查，与实例无关
    if len(ax.operands) < 2:
        return []
    sub, sup = ax.operands[0].rid, ax.operands[1].rid
    sub_chain = index.chain(sub)
    sup_chain = index.chain(sup)
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
    all_axioms: list[Axiom] = list(repo.list_axioms())
    tenant_axioms = [a for a in all_axioms if a.rid.rid.startswith(prefix)]
    scoped = [a for a in tenant_axioms if a.rid.rid == axiom_rid] if axiom_rid else tenant_axioms

    # 批量加载（每轮各一次）+ 版本化缓存：类链查表，不再逐实例回源
    index = _model_index(repo, tenant_id, tenant_axioms)
    individuals: list[Any] = repo.list_individuals(None, tenant_id)

    violations: list[dict[str, Any]] = []
    checked = violated = skipped = 0
    for ax in scoped:
        rule = _RULES.get(ax.kind)
        if rule is None:
            skipped += 1
            continue
        checked += 1
        found = rule(individuals, index, ax, target_class)
        if found:
            violated += 1
            violations.extend(found)

    return {
        "conforms": not violations,
        "violations": violations,
        "stats": {"checked": checked, "violated": violated, "skipped": skipped},
    }
