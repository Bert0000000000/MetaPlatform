"""EXP-02：派生属性查询时计算（D4：v1 声明式聚合三算子）。

Palantir derived-properties 语义：运行时基于其他属性或 **links** 计算，
结果可在同一请求内继续过滤/排序/聚合；安全上继承计算涉及对象的权限。

v1 算子集（DerivedSpec）：
- count  —— 对端实例数（over_link 遍历）
- sum    —— 对端某数值属性求和
- avg    —— 对端某数值属性均值

执行点：repo 层 ObjectSetQuery（IR 路径）取回基础行后追加派生列
（InMemory 全内存计算；PG 按结果集批量聚合，避免逐行子查询）。
evaluate_object_set（legacy DSL 路径）不追加派生列 —— 派生是 IR 查询特性。
"""

from __future__ import annotations

from typing import Any

from .property_ import DerivedSpec, Property


def _slug(rid: str) -> str:
    """与 compiler.individual_to_row 同规则的 slug 提取。"""
    parts = rid.split(".")
    return parts[3] if len(parts) >= 5 else parts[-1]


def derived_properties(props: tuple[Property, ...]) -> list[Property]:
    return [p for p in props if p.derived is not None]


def compute_derived_for_row(
    row_rid: str,
    spec: DerivedSpec,
    class_rid: str,
    link_src: str,
    link_dst: str,
    link_pairs: list[tuple[str, str]],
    value_of: Any,
) -> Any:
    """单行派生值。

    link_src/link_dst：LinkType 两端 ObjectType rid —— 决定遍历方向
    （本类是 src 端 → 取 li.dst 为对端；dst 端 → 取 li.src）。
    link_pairs：该 LinkType 下 (src_rid, dst_rid) 全量实例对。
    value_of：callable(peer_rid, field_rid) -> float | None（sum/avg 用）。
    """
    if class_rid == link_src:
        peers = [dst for s, dst in link_pairs if s == row_rid]
    elif class_rid == link_dst:
        peers = [s for s, _d in link_pairs if _d == row_rid]
    else:
        return None
    if spec.fn == "count":
        return len(peers)
    values = [v for v in (value_of(p, spec.field) for p in peers) if v is not None]
    if not values:
        return None
    if spec.fn == "sum":
        return sum(values)
    return sum(values) / len(values)  # avg


def attach_derived_values(
    rows: list[dict[str, Any]] | tuple[dict[str, Any], ...],
    class_rid: str,
    props: tuple[Property, ...],
    link_meta: dict[str, tuple[str, str]],
    link_pairs_by_link: dict[str, list[tuple[str, str]]],
    value_of: Any,
) -> None:
    """就地给结果行追加派生列（键 = Property slug）。

    link_meta：link_rid → (src_class, dst_class)；
    link_pairs_by_link：link_rid → [(src_ind_rid, dst_ind_rid)]；
    value_of：callable(peer_rid, field_rid) -> float | None。
    无派生属性 / 缺 LinkType 元数据时静默跳过（派生列缺席，不报错）。
    """
    dprops = derived_properties(props)
    if not dprops:
        return
    row_list = rows if isinstance(rows, list) else list(rows)
    for p in dprops:
        spec = p.derived
        assert spec is not None
        meta = link_meta.get(spec.over_link)
        if meta is None:
            continue
        link_src, link_dst = meta
        pairs = link_pairs_by_link.get(spec.over_link, [])
        key = _slug(p.rid.rid)
        for row in row_list:
            row_rid = row.get("__rid__")
            if row_rid is None:
                continue
            row[key] = compute_derived_for_row(
                row_rid,
                spec,
                class_rid,
                link_src,
                link_dst,
                pairs,
                value_of,
            )
