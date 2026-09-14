"""reasoning/engine — Axiom 执行引擎最小闭环（ONT-G16+G13，2026-09-08）。

无状态推理服务：输入类型层级 + 实例断言 + 公理集，输出推导事实。
规则集（第一批）：
  R1 subclass 传递闭包 —— A⊑B ∧ B⊑C ⟹ A⊑C；实例继承全部祖先类
  R2 same_as 合并      —— 对称闭包（a≈b ∧ b≈c ⟹ a≈b≈c）
  R3 transitive_property —— xRy ∧ yRz ⟹ xRz

冲突检测（detect_axiom_conflicts，SHACL×Axiom 联动闸门配套，2026-09-14）：
  C1 subclass_cycle —— 子类公理成环（环上类互为祖先）
  C2 disjoint       —— 主体经闭包同时落入互斥对两侧；互斥对与子类层级矛盾
  C3 domain / range —— 属性断言主体/对象不 ⊑ 声明的 domain/range
  C4 equivalence    —— 等价类跨越互斥对（等价 ∧ 互斥矛盾）
"""

from __future__ import annotations

from dataclasses import dataclass
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


def descendant_closure(subclass_axioms: list[tuple[str, str]]) -> dict[str, set[str]]:
    """ONT-G21：类 → 全部传递后代类（直接 + 间接子类）。

    ``descendant_closure``[B] = {A, …}（A ⊑ B 的全部 A）。ObjectSet 按类
    求值时据此把「查询类」扩展为「类 + 后代类」集合——推断层级对查询
    可见（实例按断言类存储，祖先查询需要沿公理下钻）。
    """
    closed = _subclass_closure(subclass_axioms)  # sub → ancestors
    out: dict[str, set[str]] = {}
    for sub, supers in closed.items():
        for sup in supers:
            if sup != sub:  # 环场景 _subclass_closure 会产生自环伪影，丢弃
                out.setdefault(sup, set()).add(sub)
    return out


def _reach_closure(edges: list[tuple[str, str]]) -> dict[str, set[str]]:
    """直接边 → 可达闭包（每起点一次图遍历；环安全且完整）。

    与 ``_subclass_closure`` 的递归 seen 保护互补：遍历式求闭包不因环上
    节点提前记忆化而丢失边，闭包始终完整 —— 冲突检测（下方
    ``detect_axiom_conflicts``）要求闭包完整，环本身单独报告。起点仅当
    经 ≥1 条边回到自身时才出现在自身闭包里（成环 ⟺ ``c in closed[c]``）。
    """
    adj: dict[str, set[str]] = {}
    nodes: set[str] = set()
    for a, b in edges:
        adj.setdefault(a, set()).add(b)
        nodes.update((a, b))
    closed: dict[str, set[str]] = {}
    for start in nodes:
        seen: set[str] = set()
        stack: list[str] = [start]
        while stack:
            for nxt in adj.get(stack.pop(), ()):
                if nxt not in seen:
                    seen.add(nxt)
                    stack.append(nxt)
        closed[start] = seen
    return closed


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
        classification[ind] = {
            "asserted": sorted(asserted),
            "inferred": sorted(inferred - asserted),
        }

    # R2: same_as 合并
    clusters = _same_as_clusters(same_as_pairs)
    merged: dict[str, list[str]] = {}
    for ind, rep in clusters.items():
        merged.setdefault(rep, []).append(ind)
    same_as_clusters = {rep: sorted(members) for rep, members in merged.items() if len(members) > 1}

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

            # B023：dfs 同步立即调用、不逃逸出循环迭代 —— 显式绑定当前
            # 迭代的 adj/seen（默认参快照）以消除误报并防未来误用
            def dfs(node: str, depth: int, *, adj=adj, seen=seen) -> None:
                for nxt in adj.get(node, ()):
                    if nxt not in seen:
                        seen[nxt] = depth
                        dfs(nxt, depth + 1)

            dfs(src, 0)
            direct = adj[src]
            for dst, depth in seen.items():
                if depth >= 1 and dst not in direct:
                    transitive_inferred.append({"property": prop, "src": src, "dst": dst})

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


# ---------------------------------------------------------------------------
# Axiom 冲突检测（SHACL×Axiom 联动闸门配套，2026-09-14）
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class AxiomConflict:
    """公理冲突报告（分级语义与 shacl.py 的 Violation/Warning 对齐，小写）。"""

    rule: str  # "subclass_cycle" | "disjoint" | "domain" | "range" | "equivalence"
    severity: str  # "violation" | "warning"
    message: str  # 中文描述，含涉事 rid
    subjects: tuple[str, ...]


def detect_axiom_conflicts(
    *,
    subclass_axioms: list[tuple[str, str]],
    equivalent_axioms: list[tuple[str, str]],
    disjoint_axioms: list[tuple[str, str]],
    type_assertions: list[tuple[str, str]],
    property_assertions: list[dict],
    domain_range: list[dict],
) -> list[AxiomConflict]:
    """统一公理冲突检测入口（proposal 闸门按本签名调用）。

    纯函数、无 IO、不打日志；全部闭包计算环安全（``_reach_closure``
    遍历式求闭包不因环丢边，环本身作为 subclass_cycle 单独报告）。
    等价闭包：equivalent 对称 + 传递（并查集，复用 ``_same_as_clusters``），
    并与子类闭包联动（A≡B ∧ B⊑C ⟹ A⊑C，实现为等价类坍缩到代表元后求闭包）。

    规则与分级（均为 violation；severity 字段保留 warning 供闸门分级扩展）：

      subclass_cycle  子类公理成环（环上类互为祖先；等价蕴含的互逆子类边
                      已先行坍缩，不计入环）
      disjoint        主体（类型或实例）经「子类+等价」闭包同时落入互斥对
                      两侧 —— 互斥对经后代继承扩张（A 与 B 互斥 ⟹ 双方
                      后代互斥）；以及互斥对与子类层级自身矛盾
      domain / range  断言 (subject, P, object) 的 subject/object 不 ⊑
                      P.domain / P.range（经子类+等价闭包判定；端点无类型
                      断言时跳过 —— 无法判定不视为违例）
      equivalence     等价类跨越互斥对（disjoint 两端经等价闭包坍缩为同一
                      类 ⟹ 等价 ∧ 互斥矛盾）

    返回列表按 (rule, subjects, message) 排序，同输入结果确定性一致。
    """
    conflicts: list[AxiomConflict] = []

    # -- 等价闭包：对称 + 传递（并查集；排序输入保证代表元确定性）--
    rep = _same_as_clusters(sorted(set(equivalent_axioms)))

    def canon(x: str) -> str:
        return rep.get(x, x)

    # -- C1 subclass_cycle：原始子类边成环（互为祖先即违例）--
    raw_reach = _reach_closure(sorted(set(subclass_axioms)))
    cycle_nodes = [c for c, sups in raw_reach.items() if c in sups]
    grouped: set[str] = set()
    for c in sorted(cycle_nodes):
        if c in grouped:
            continue
        # 环上节点按互相可达（= 同一强连通分量）归并为一条冲突
        scc = {c}
        for x in cycle_nodes:
            if x != c and x not in grouped and x in raw_reach[c] and c in raw_reach[x]:
                scc.add(x)
        grouped |= scc
        conflicts.append(
            AxiomConflict(
                rule="subclass_cycle",
                severity="violation",
                message=f"子类层级存在环：{' ⊑ '.join(sorted(scc))}（环上类互为祖先）",
                subjects=tuple(sorted(scc)),
            )
        )

    # -- 有效子类闭包：等价类坍缩到代表元后求闭包（联动 A≡B ∧ B⊑C ⟹ A⊑C）--
    canon_edges: set[tuple[str, str]] = set()
    for sub, sup in set(subclass_axioms):
        cs, cp = canon(sub), canon(sup)
        if cs != cp:  # 等价蕴含的互逆子类边坍缩为自环，跳过
            canon_edges.add((cs, cp))
    supers = _reach_closure(sorted(canon_edges))

    def sup_or_self(c: str) -> set[str]:
        out = {c}
        out |= supers.get(c, set())
        return out

    # -- 互斥对规范化（经等价闭包；排序去重使 (a,b) 与 (b,a) 合一）--
    canon_pairs: set[tuple[str, str]] = set()
    for a, b in set(disjoint_axioms):
        ca, cb = canon(a), canon(b)
        canon_pairs.add((ca, cb) if ca <= cb else (cb, ca))

    # -- C4 equivalence：等价类跨越互斥对（disjoint 两端坍缩为同一类）--
    seen_straddles: set[frozenset[str]] = set()
    for a, b in sorted(set(disjoint_axioms)):
        ca = canon(a)
        if ca != canon(b):
            continue
        members = frozenset(m for m, r in rep.items() if r == ca)
        key = frozenset(members | {a, b})
        if key in seen_straddles:
            continue
        seen_straddles.add(key)
        subj = tuple(sorted(key))
        conflicts.append(
            AxiomConflict(
                rule="equivalence",
                severity="violation",
                message=f"等价类 {' ≡ '.join(subj)} 跨越互斥对：disjoint({a}, {b}) 与等价断言矛盾",
                subjects=subj,
            )
        )

    # -- C2a 互斥对与子类层级矛盾（p ⊑ q ∧ disjoint(p, q) 类几何矛盾）--
    bad_hierarchy_pairs: set[tuple[str, str]] = set()
    for p, q in sorted(canon_pairs):
        if p == q:
            continue  # 等价跨越已按 C4 报告
        if q in supers.get(p, set()) or p in supers.get(q, set()):
            bad_hierarchy_pairs.add((p, q))
            conflicts.append(
                AxiomConflict(
                    rule="disjoint",
                    severity="violation",
                    message=f"互斥对与子类层级矛盾：disjoint({p}, {q}) 但二者存在子类关系",
                    subjects=(p, q),
                )
            )

    # -- 主体全类集：断言类 + 子类/等价闭包（主体可为类型或实例）--
    asserted: dict[str, set[str]] = {}
    for s, c in set(type_assertions):
        asserted.setdefault(s, set()).add(canon(c))
    full: dict[str, set[str]] = {}
    for s, cs in asserted.items():
        fset: set[str] = set()
        for c in cs:
            fset |= sup_or_self(c)
        full[s] = fset

    # -- C2b 同一主体经闭包同时落入互斥对两侧（含后代继承扩张）--
    for s in sorted(full):
        fs = full[s]
        for p, q in sorted(canon_pairs):
            if p == q or (p, q) in bad_hierarchy_pairs:
                continue  # 已按等价跨越 / 层级矛盾在类层面报告，避免逐实例重复
            if p in fs and q in fs:
                conflicts.append(
                    AxiomConflict(
                        rule="disjoint",
                        severity="violation",
                        message=f"主体 {s} 同时属于互斥类 {p} 与 {q}（disjoint({p}, {q})）",
                        subjects=(s, p, q),
                    )
                )

    # -- C3 domain / range：属性断言端点经闭包不 ⊑ 声明约束 --
    dr: dict[str, list[tuple[str | None, str | None]]] = {}
    for entry in domain_range:
        p = entry.get("property", "")
        if p:
            dr.setdefault(p, []).append((entry.get("domain"), entry.get("range")))
    seen_pa: set[tuple[str, str, str]] = set()
    for pa in property_assertions:
        p = pa.get("property", "")
        s = pa.get("subject", "")
        o = pa.get("object", "")
        if not p or not s or not o or (p, s, o) in seen_pa:
            continue
        seen_pa.add((p, s, o))
        for dom, rng in dr.get(p, ()):
            if dom is not None and s in full and canon(dom) not in full[s]:
                conflicts.append(
                    AxiomConflict(
                        rule="domain",
                        severity="violation",
                        message=f"domain 违例：断言 ({s}, {p}, {o}) 的主体 {s} 经闭包不 ⊑ {dom}",
                        subjects=(p, s, dom),
                    )
                )
            if rng is not None and o in full and canon(rng) not in full[o]:
                conflicts.append(
                    AxiomConflict(
                        rule="range",
                        severity="violation",
                        message=f"range 违例：断言 ({s}, {p}, {o}) 的对象 {o} 经闭包不 ⊑ {rng}",
                        subjects=(p, o, rng),
                    )
                )

    conflicts.sort(key=lambda cf: (cf.rule, cf.subjects, cf.message))
    return conflicts
