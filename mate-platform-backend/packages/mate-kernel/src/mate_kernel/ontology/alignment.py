"""alignment — 跨本体对齐与类型合并最小闭环（ONT-G33）。

三步能力：
  ① same_as 对齐 —— 显式配对（vocabulary）+ 词汇相似（label 规范化相等）
     + 结构相似（同类 + 属性路径/引用目标签名 Jaccard），证据取最大分；
     复用 reasoning R2 并查集（对称闭包聚类）。
  ② 类型合并 —— 两个 ObjectType 字段并集；同 rid 不同 type_id/nullable/
     format 记冲突标记，按策略（keep_left / keep_right）消解；输出合并审计。
  ③ modularization —— 留增量（PRD-33 FR-ALIGN-003）。
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum
from typing import Any

from .identity.class_ref import ClassRef
from .reasoning.engine import _same_as_clusters as _union_find
from .types.object_type import ObjectType
from .types.property_ import Property


def _rid_str(r: Any) -> str:
    return r.rid if hasattr(r, "rid") else str(r)


def _norm_label(s: str) -> str:
    """词汇规范化：小写、去分隔符（保留字母数字与 CJK）。"""
    return re.sub(r"[^a-z0-9一-鿿]+", "", str(s).lower())


_LABEL_KEYS = ("name", "title", "label", "display")


def _label(ind: dict[str, Any]) -> str:
    """实例 label：优先 name/title/label/display 后缀的属性值。"""
    props = ind.get("props") or {}
    items = (
        props.items()
        if isinstance(props, dict)
        else [(p.get("rid", ""), p.get("value")) for p in props if isinstance(p, dict)]
    )
    best = ""
    for k, v in items:
        key = str(k).rsplit(".", 1)[-1].split(".")[0].lower()
        if any(key.endswith(lk) for lk in _LABEL_KEYS) and isinstance(v, str):
            best = v
            break
        if best == "" and isinstance(v, str):
            best = v
    return best


def _signature(ind: dict[str, Any]) -> frozenset:
    """结构签名：属性 slug（路径末段语义名，跨本体可比）+ 标量值规范化。"""
    props = ind.get("props") or {}
    sig: set = set()
    items = (
        props.items()
        if isinstance(props, dict)
        else [(p.get("rid", ""), p.get("value")) for p in props if isinstance(p, dict)]
    )
    for k, v in items:
        seg = str(k).split(".")
        slug = seg[-2] if len(seg) >= 2 else str(k)  # …prop.email.v1 → email
        sig.add(("path", slug))
        if isinstance(v, str):
            sig.add(("value", _norm_label(v)))
        elif isinstance(v, (int, float, bool)):
            sig.add(("value", str(v).lower()))
    return frozenset(sig)


def _jaccard(a: frozenset, b: frozenset) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def align_individuals(
    left: list[dict[str, Any]],
    right: list[dict[str, Any]],
    *,
    explicit_pairs: list[tuple[str, str]] | None = None,
    lexical_threshold: float = 1.0,
    structural_threshold: float = 0.5,
) -> dict[str, Any]:
    """same_as 词汇 + 结构相似对齐（ONT-G33 FR-ALIGN-001）。

    left/right: [{"rid", "class_rid", "props"}]（props dict 或 [{rid,value}]）。
    explicit_pairs: 已知 same_as（人工/上游 vocabulary 断言）。
    词汇证据：label 规范化相等（score=1.0）。结构证据：签名 Jaccard（属性
    slug 跨本体可比，故不做 class_rid 同一性门槛）。
    匹配判定：explicit 或 max(lexical, structural) ≥ 对应阈值。
    聚类复用 R2 并查集 —— 左右成员进同一簇 ⟺ 可传递对齐。
    """
    explicit_pairs = list(explicit_pairs or [])
    matched: list[dict[str, Any]] = []
    explicit_set = {(a, b) for a, b in explicit_pairs}

    for left_ind in left:
        lrid = str(left_ind.get("rid", ""))
        for right_ind in right:
            rrid = str(right_ind.get("rid", ""))
            evidence: list[str] = []
            score = 0.0
            if (lrid, rrid) in explicit_set:
                evidence.append("explicit")
                score = 1.0
            ll = _norm_label(_label(left_ind))
            rl = _norm_label(_label(right_ind))
            lexical = 1.0 if ll and ll == rl else 0.0
            if lexical >= lexical_threshold and lexical > 0:
                evidence.append("lexical")
                score = max(score, lexical)
            structural = _jaccard(_signature(left_ind), _signature(right_ind))
            if structural >= structural_threshold:
                evidence.append("structural")
                score = max(score, structural)
            if evidence:
                matched.append(
                    {
                        "left": lrid,
                        "right": rrid,
                        "score": round(score, 4),
                        "evidence": evidence,
                    }
                )

    pairs = [(m["left"], m["right"]) for m in matched]
    clusters_map = _union_find(pairs)
    merged: dict[str, list[str]] = {}
    for ind, rep in clusters_map.items():
        merged.setdefault(rep, []).append(ind)
    clusters = {rep: sorted(members) for rep, members in merged.items() if len(members) > 1}
    return {
        "clusters": clusters,
        "matched_pairs": matched,
        "stats": {
            "left": len(left),
            "right": len(right),
            "pairs_evaluated": len(left) * len(right),
            "matched": len(matched),
            "clusters": len(clusters),
        },
    }


@dataclass(frozen=True)
class MergeConflict:
    """合并冲突标记：同 rid 属性在某字段上两侧不一致。"""

    property_rid: str
    field: str
    left: Any
    right: Any
    resolved: Any


def _prop_fields(p: Property) -> dict[str, Any]:
    return {
        "type_id": p.type_id,
        "nullable": p.nullable,
        "format": p.format,
        "primary_key": p.primary_key,
        "title": p.title,
    }


def merge_object_types(
    a: ObjectType,
    b: ObjectType,
    *,
    strategy: str = "keep_left",
) -> dict[str, Any]:
    """类型合并（ONT-G33 FR-ALIGN-002）：字段并集 + 冲突标记 + 合并审计。

    策略只作用于冲突字段；strategy="keep_left"（默认）保留 a 侧定义，
    "keep_right" 保留 b 侧。合并结果的 rid 取 a（into=a），primary_key 取
    两侧并集（去重、须全部存在于合并后 properties —— ObjectType 不变量）。
    interfaces / marking 并集；display_name 偏向 a。
    """
    if strategy not in ("keep_left", "keep_right"):
        raise ValueError(f"unknown merge strategy: {strategy!r}")

    a_by_rid = {_rid_str(p.rid): p for p in a.properties}
    b_by_rid = {_rid_str(p.rid): p for p in b.properties}
    conflicts: list[dict[str, Any]] = []
    added: list[str] = []
    merged_props: list[Property] = []

    for rid_s, pa in a_by_rid.items():
        pb = b_by_rid.get(rid_s)
        if pb is None:
            merged_props.append(pa)
            continue
        fa, fb = _prop_fields(pa), _prop_fields(pb)
        differing = [f for f in fa if fa[f] != fb[f]]
        if not differing:
            merged_props.append(pa)
            continue
        resolved = fb if strategy == "keep_right" else fa
        for f in differing:
            conflicts.append(
                {
                    "property_rid": rid_s,
                    "field": f,
                    "left": _ser(fa[f]),
                    "right": _ser(fb[f]),
                    "resolved": _ser(resolved[f]),
                }
            )
        merged_props.append(
            Property(
                rid=pa.rid,
                type_id=resolved["type_id"],
                nullable=resolved["nullable"],
                primary_key=resolved["primary_key"],
                title=resolved["title"],
                format=resolved["format"],
            )
        )
    for rid_s, pb in b_by_rid.items():
        if rid_s not in a_by_rid:
            merged_props.append(pb)
            added.append(rid_s)

    pk_rids: list[Any] = []
    seen_pk: set[str] = set()
    for p in [*a.primary_key, *b.primary_key]:
        s = _rid_str(p)
        if s not in seen_pk:
            seen_pk.add(s)
            pk_rids.append(p)

    merged = ObjectType(
        rid=a.rid,
        primary_key=tuple(pk_rids),
        properties=tuple(merged_props),
        interfaces=tuple(
            sorted({ClassRef(_rid_str(i)) for i in [*a.interfaces, *b.interfaces]}, key=_rid_str)
        ),
        display_name=a.display_name or b.display_name,
        marking=tuple(sorted({*a.marking, *b.marking})),
    )
    audit = {
        "merged_from": [_rid_str(a.rid), _rid_str(b.rid)],
        "into": _rid_str(a.rid),
        "strategy": strategy,
        "properties_left": len(a.properties),
        "properties_right": len(b.properties),
        "properties_merged": len(merged.properties),
        "added": sorted(added),
        "conflicts": conflicts,
    }
    return {"object_type": merged, "audit": audit}


def _ser(v: Any) -> Any:
    if isinstance(v, Enum):
        return v.value
    return v
