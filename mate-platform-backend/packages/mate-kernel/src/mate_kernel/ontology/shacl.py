"""shacl — W3C SHACL Core 约束验证（ONT-G14）。

Shapes 与本体 12 基元的映射：
  NodeShape.target_class ↔ ObjectType rid（按 class_rid 聚焦实例）
  PropertyShape.path     ↔ Property rid（实例 props 键）
  datatype               ↔ Property.type_id（string/integer/number/boolean）

约束集（Core 关键 + W3C 全集增量）：
  minCount / maxCount            —— 基数
  datatype                       —— 值类型
  pattern                        —— 字符串正则（W3C 语义：非字符串值不适用）
  class（sh:class）              —— 值节点须为指定类的实例
  closed                         —— 实例不得携带 shape 未声明的属性
  severity（sh:severity）        —— Violation / Warning / Info 分级
  not（sh:not）                  —— 值节点不得满足内嵌 shape（取反）
  languageIn（sh:languageIn）    —— 值节点语言标签受限（"@lang" 后缀或
                                    {"@value","@language"} 载体；无标签 = 违例）
  qualifiedValueShape            —— 满足内嵌 shape 的值数量受
                                    qualifiedMinCount / qualifiedMaxCount 约束

报告：W3C 验证报告结构 {conforms, violations[{focus_node, path, constraint,
message, severity}], severity_counts, stats}。W3C 语义：仅 severity=Violation
的结果使 conforms=false；Warning/Info 不影响 conforms。
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

_DATATYPES = {
    "string": str,
    "integer": int,
    "number": (int, float),
    "boolean": bool,
}

SEVERITIES = ("Violation", "Warning", "Info")


@dataclass(frozen=True)
class PropertyShape:
    """sh:PropertyShape —— path 上的约束集。"""

    path: str
    min_count: int | None = None
    max_count: int | None = None
    datatype: str | None = None
    pattern: str | None = None
    node_class: str | None = None
    severity: str = "Violation"
    language_in: tuple[str, ...] = ()
    not_shape: PropertyShape | None = None
    qualified_value_shape: PropertyShape | None = None
    qualified_min_count: int | None = None
    qualified_max_count: int | None = None
    name: str = ""


@dataclass(frozen=True)
class NodeShape:
    """sh:NodeShape —— target_class 聚焦 + 属性形状集 + closed。"""

    target_class: str
    property_shapes: tuple[PropertyShape, ...] = field(default_factory=tuple)
    closed: bool = False
    ignored_properties: tuple[str, ...] = ()
    severity: str = "Violation"


def shape_from_object_type(ot: Any) -> NodeShape:
    """ObjectType → NodeShape（与 ontValidateV2 的类型定义语义对齐）。

    primary_key → minCount 1；type_id → datatype；nullable 为 False 的属性
    同样 minCount 1。pattern/class 等 W3C 特有约束需在 ObjectType 之外显式给。
    """
    props = []
    for p in ot.properties:
        rid = p.rid.rid if hasattr(p.rid, "rid") else str(p.rid)
        props.append(PropertyShape(
            path=rid,
            min_count=1 if (p.primary_key or not p.nullable) else None,
            datatype=p.type_id if p.type_id in _DATATYPES else None,
        ))
    return NodeShape(target_class=rid_of(ot), property_shapes=tuple(props))


def rid_of(obj: Any) -> str:
    r = getattr(obj, "rid", obj)
    return r.rid if hasattr(r, "rid") else str(r)


def _values(individual: dict[str, Any], path: str) -> list[Any]:
    """实例 props 取值 —— 标量与列表两种载体统一为列表（缺失 = 空表）。"""
    props = individual.get("props")
    if isinstance(props, dict):
        v = props.get(path)
        if v is None:
            return []
        return v if isinstance(v, list) else [v]
    if isinstance(props, list):  # [{rid, value}] 载体
        return [p.get("value") for p in props
                if isinstance(p, dict) and p.get("rid") == path and p.get("value") is not None]
    return []


def _lang_of(v: Any) -> str | None:
    """值节点的语言标签：{"@language": …} 载体或 "text@lang" 后缀；无 = None。"""
    if isinstance(v, dict):
        tag = v.get("@language")
        return str(tag) if tag else None
    if isinstance(v, str):
        _, sep, tag = v.rpartition("@")
        if sep and tag:
            return tag
    return None


def _node_violations(
    v: Any, ps: PropertyShape, by_rid: dict[str, dict[str, Any]],
) -> list[tuple[str, str]]:
    """节点级约束评估（sh:not / qualifiedValueShape 的内嵌 shape 语义）：

    值节点自身作为焦点，datatype / pattern / class / languageIn 直接作用于它。
    返回 (constraint, message) 列表。
    """
    out: list[tuple[str, str]] = []
    if ps.datatype is not None:
        py_type = _DATATYPES.get(ps.datatype)
        if py_type is not None and not isinstance(v, py_type):
            out.append(("datatype",
                        f"expects {ps.datatype}, got {type(v).__name__}"))
    if ps.pattern is not None and isinstance(v, str) and re.search(ps.pattern, v) is None:
        out.append(("pattern", f"value {v!r} does not match {ps.pattern!r}"))
    if ps.node_class is not None:
        ref = by_rid.get(str(v))
        ref_class = (ref or {}).get("class_rid", "")
        if ref is None or ref_class != ps.node_class:
            out.append(("class",
                        f"value {v!r} must be an instance of {ps.node_class}"))
    if ps.language_in:
        lang = _lang_of(v)
        if lang is None or lang not in ps.language_in:
            out.append(("languageIn",
                        f"language tag {lang!r} not in {list(ps.language_in)}"))
    return out


def _eval_property_shape(  # noqa: PLR0912 —— 单形状多约束组件的线性判定
    ind: dict[str, Any], focus: str, ps: PropertyShape,
    by_rid: dict[str, dict[str, Any]],
) -> tuple[list[dict[str, str]], int]:
    """单 PropertyShape 对单实例求值。返回 (违例, 检查数)。"""
    violations: list[dict[str, str]] = []
    checked = 0

    def emit(constraint: str, message: str) -> None:
        violations.append({
            "focus_node": focus, "path": ps.path,
            "constraint": constraint, "message": message,
            "severity": ps.severity if ps.severity in SEVERITIES else "Violation",
        })

    values = _values(ind, ps.path)
    count = len(values)
    if ps.min_count is not None and count < ps.min_count:
        checked += 1
        emit("minCount", f"expects {ps.min_count}+ values, found {count}")
        return violations, checked
    if ps.max_count is not None and count > ps.max_count:
        checked += 1
        emit("maxCount", f"expects at most {ps.max_count} values, found {count}")
    for v in values:
        if ps.datatype is not None:
            checked += 1
            py_type = _DATATYPES.get(ps.datatype)
            if py_type is not None and not isinstance(v, py_type):
                emit("datatype", f"expects {ps.datatype}, got {type(v).__name__}")
                continue
        if ps.pattern is not None and isinstance(v, str):
            checked += 1
            if re.search(ps.pattern, v) is None:
                emit("pattern", f"value {v!r} does not match {ps.pattern!r}")
        if ps.node_class is not None:
            checked += 1
            ref = by_rid.get(str(v))
            ref_class = (ref or {}).get("class_rid", "")
            if ref is None or ref_class != ps.node_class:
                emit("class",
                     f"value {v!r} must be an instance of {ps.node_class}")
        if ps.language_in:
            checked += 1
            lang = _lang_of(v)
            if lang is None or lang not in ps.language_in:
                emit("languageIn",
                     f"language tag {lang!r} not in {list(ps.language_in)}")
        if ps.not_shape is not None:
            # sh:not：值节点满足内嵌 shape ⟹ 违例；不满足 ⟹ 通过
            checked += 1
            if not _node_violations(v, ps.not_shape, by_rid):
                emit("not", f"value {v!r} conforms to the negated shape")
    if ps.qualified_value_shape is not None:
        # qualifiedValueShape：统计满足内嵌 shape 的值数量
        checked += 1
        qualifying = sum(
            1 for v in values
            if not _node_violations(v, ps.qualified_value_shape, by_rid))
        low, high = ps.qualified_min_count, ps.qualified_max_count
        if low is not None and qualifying < low:
            emit("qualifiedMinCount",
                 f"expects {low}+ values matching the qualified shape, "
                 f"found {qualifying}")
        if high is not None and qualifying > high:
            emit("qualifiedMaxCount",
                 f"expects at most {high} values matching the qualified "
                 f"shape, found {qualifying}")
    return violations, checked


def _closed_extra_paths(
    ind: dict[str, Any], allowed: set[str],
) -> list[str]:
    """closed 语义：未声明的属性路径列表。"""
    props = ind.get("props") or {}
    if isinstance(props, dict):
        return sorted(set(props) - allowed)
    if isinstance(props, list):
        extra = {p.get("rid", "") for p in props if isinstance(p, dict)} - allowed
        return sorted(extra)
    return []


def validate_shacl(
    individuals: list[dict[str, Any]],
    shapes: list[NodeShape],
) -> dict[str, Any]:
    """对 individuals 执行 shapes，返回 W3C 验证报告。"""
    violations: list[dict[str, str]] = []
    checked = 0
    by_rid: dict[str, dict[str, Any]] = {}
    for ind in individuals:
        key = rid_of(ind) if not isinstance(ind, dict) else ind.get("rid", "")
        by_rid[key] = ind

    def class_of(ind: dict[str, Any]) -> str:
        return ind.get("class_rid") if isinstance(ind, dict) else rid_of(ind)

    for shape in shapes:
        targets = [ind for ind in individuals
                   if class_of(ind) == shape.target_class]
        for ind in targets:
            focus = ind.get("rid", "") if isinstance(ind, dict) else rid_of(ind)
            known_paths: set[str] = set()
            for ps in shape.property_shapes:
                known_paths.add(ps.path)
                new_violations, new_checked = _eval_property_shape(
                    ind, focus, ps, by_rid)
                violations.extend(new_violations)
                checked += new_checked
            if shape.closed:
                checked += 1
                allowed = known_paths | set(shape.ignored_properties)
                for path in _closed_extra_paths(ind, allowed):
                    violations.append({
                        "focus_node": focus, "path": path,
                        "constraint": "closed",
                        "message": f"property {path!r} not allowed in closed shape",
                        "severity": (shape.severity
                                     if shape.severity in SEVERITIES
                                     else "Violation"),
                    })

    severity_counts = dict.fromkeys(SEVERITIES, 0)
    for v in violations:
        severity_counts[v["severity"]] = severity_counts.get(v["severity"], 0) + 1

    return {
        "conforms": severity_counts["Violation"] == 0,
        "violations": violations,
        "severity_counts": severity_counts,
        "stats": {
            "nodes_validated": sum(
                1 for ind in individuals
                if any(class_of(ind) == s.target_class for s in shapes)
            ),
            "constraints_checked": checked,
            "shapes": len(shapes),
        },
    }
