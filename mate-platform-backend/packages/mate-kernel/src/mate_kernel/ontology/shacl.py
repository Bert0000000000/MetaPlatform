"""shacl — W3C SHACL Core 关键约束验证（ONT-G14）。

Shapes 与本体 12 基元的映射：
  NodeShape.target_class ↔ ObjectType rid（按 class_rid 聚焦实例）
  PropertyShape.path     ↔ Property rid（实例 props 键）
  datatype               ↔ Property.type_id（string/integer/number/boolean）

约束集（Core 子集，本批实现）：
  minCount / maxCount   —— 基数
  datatype              —— 值类型
  pattern               —— 字符串正则（W3C 语义：非字符串值不适用）
  class（sh:class）     —— 值节点须为指定类的实例（可在 individuals 图中解析）
  closed                —— 实例不得携带 shape 未声明的属性

报告：W3C 验证报告结构子集 {conforms, violations[{focus_node, path,
constraint, message}], stats}。完整 W3C Core（severity 分级、sh:not、
sh:languageIn 等）留增量。
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


@dataclass(frozen=True)
class PropertyShape:
    """sh:PropertyShape —— path 上的约束集。"""

    path: str
    min_count: int | None = None
    max_count: int | None = None
    datatype: str | None = None
    pattern: str | None = None
    node_class: str | None = None
    name: str = ""


@dataclass(frozen=True)
class NodeShape:
    """sh:NodeShape —— target_class 聚焦 + 属性形状集 + closed。"""

    target_class: str
    property_shapes: tuple[PropertyShape, ...] = field(default_factory=tuple)
    closed: bool = False
    ignored_properties: tuple[str, ...] = ()


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


def validate_shacl(
    individuals: list[dict[str, Any]],
    shapes: list[NodeShape],
) -> dict[str, Any]:
    """对 individuals 执行 shapes，返回 W3C 结构子集的验证报告。"""
    violations: list[dict[str, str]] = []
    checked = 0
    by_rid: dict[str, dict[str, Any]] = {}
    for ind in individuals:
        key = rid_of(ind) if not isinstance(ind, dict) else ind.get("rid", "")
        by_rid[key] = ind

    for shape in shapes:
        targets = [
            ind for ind in individuals
            if (ind.get("class_rid") if isinstance(ind, dict) else rid_of(ind)) == shape.target_class
        ]
        for ind in targets:
            focus = ind.get("rid", "") if isinstance(ind, dict) else rid_of(ind)
            known_paths: set[str] = set()
            for ps in shape.property_shapes:
                known_paths.add(ps.path)
                values = _values(ind, ps.path)
                count = len(values)
                if ps.min_count is not None and count < ps.min_count:
                    checked += 1
                    violations.append({
                        "focus_node": focus, "path": ps.path,
                        "constraint": "minCount",
                        "message": f"expects {ps.min_count}+ values, found {count}",
                    })
                    continue
                if ps.max_count is not None and count > ps.max_count:
                    checked += 1
                    violations.append({
                        "focus_node": focus, "path": ps.path,
                        "constraint": "maxCount",
                        "message": f"expects at most {ps.max_count} values, found {count}",
                    })
                for v in values:
                    if ps.datatype is not None:
                        checked += 1
                        py_type = _DATATYPES.get(ps.datatype)
                        if py_type is not None and not isinstance(v, py_type):
                            violations.append({
                                "focus_node": focus, "path": ps.path,
                                "constraint": "datatype",
                                "message": f"expects {ps.datatype}, got {type(v).__name__}",
                            })
                            continue
                    if ps.pattern is not None and isinstance(v, str):
                        checked += 1
                        if re.search(ps.pattern, v) is None:
                            violations.append({
                                "focus_node": focus, "path": ps.path,
                                "constraint": "pattern",
                                "message": f"value {v!r} does not match {ps.pattern!r}",
                            })
                    if ps.node_class is not None:
                        checked += 1
                        ref = by_rid.get(str(v))
                        ref_class = (ref or {}).get("class_rid", "")
                        if ref is None or ref_class != ps.node_class:
                            violations.append({
                                "focus_node": focus, "path": ps.path,
                                "constraint": "class",
                                "message": (
                                    f"value {v!r} must be an instance of {ps.node_class}"
                                ),
                            })
            if shape.closed:
                checked += 1
                allowed = known_paths | set(shape.ignored_properties)
                props = ind.get("props") or {}
                extra: set[str] = set()
                if isinstance(props, dict):
                    extra = set(props) - allowed
                elif isinstance(props, list):
                    extra = {p.get("rid", "") for p in props
                             if isinstance(p, dict)} - allowed
                for path in sorted(extra):
                    violations.append({
                        "focus_node": focus, "path": path,
                        "constraint": "closed",
                        "message": f"property {path!r} not allowed in closed shape",
                    })

    return {
        "conforms": not violations,
        "violations": violations,
        "stats": {
            "nodes_validated": sum(
                1 for ind in individuals
                if any((ind.get("class_rid") if isinstance(ind, dict) else rid_of(ind))
                       == s.target_class for s in shapes)
            ),
            "constraints_checked": checked,
            "shapes": len(shapes),
        },
    }
