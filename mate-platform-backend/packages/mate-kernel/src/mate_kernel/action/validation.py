"""ACT-06：Action 校验体系 —— 参数 schema + 结构化 submission rules。

Palantir 语义：参数校验（必填/类型/范围）+ entry validation + submission
criteria（结构化）。v1 落地：

1. ``validate_parameters`` —— 按 ActionType.parameters（Property 携带
   nullable/format）校验参数 dict：必填缺失 / 类型不符 → 违规清单；
2. ``RuleGroup`` —— 结构化规则（AND/OR 嵌套 + Condition），替换 legacy
   4 表达式 mini-DSL 的升级位（legacy 字符串表达式继续兼容）；
3. ``validate_submission_rules`` —— 规则结构自检（未知算子 / 空 any_of 等）。

接线点：propose / apply-edit-set 入口 fail-fast；管理面可先调校验预检。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

__all__ = [
    "validate_parameters",
    "RuleGroup",
    "Condition",
    "RuleOps",
    "evaluate_rule_group",
    "validate_submission_rules",
]

_VALID_OPS = {
    "eq", "ne", "gt", "gte", "lt", "lte",
    "startswith", "contains", "in", "truthy",
}


def _slug(rid: str) -> str:
    parts = rid.split(".")
    return parts[3] if len(parts) >= 5 else parts[-1]


def validate_parameters(
    parameter_defs: tuple[Any, ...],
    parameters: dict[str, Any],
) -> list[str]:
    """参数 schema 校验 —— 返回违规清单（空 = 通过）。

    键可用完整 Property rid 或 slug；required（nullable=False）缺失即违规；
    format 类型粗校验（integer/double 数值性、boolean 布尔性）。
    """
    violations: list[str] = []
    by_key: dict[str, Any] = {}
    for p in parameter_defs:
        by_key[p.rid.rid] = p
        by_key.setdefault(_slug(p.rid.rid), p)
    # 必填校验
    for key, p in by_key.items():
        if p.nullable:
            continue
        v = parameters.get(key)
        if v is None or (isinstance(v, str) and not v.strip()):
            # slug 与完整 rid 双键登记时只报一次（同一 p.rid）
            if key == p.rid.rid:
                violations.append(f"required parameter {_slug(p.rid.rid)!r} missing")
    # 类型校验（仅对显式提供的值；bool 不算数值）
    for key, value in parameters.items():
        p = by_key.get(key)
        if p is None or value is None:
            continue
        fmt = getattr(p.format, "value", str(p.format))
        is_num = isinstance(value, (int, float)) and not isinstance(value, bool)
        if fmt in ("integer", "double") and not is_num:
            violations.append(
                f"parameter {_slug(p.rid.rid)!r} expects number, got {type(value).__name__}")
        elif fmt == "boolean" and not isinstance(value, bool):
            violations.append(
                f"parameter {_slug(p.rid.rid)!r} expects boolean, got {type(value).__name__}")
    return violations


# ─────────────────── 结构化规则（AND/OR 嵌套）───────────────────


@dataclass(frozen=True, slots=True)
class Condition:
    field: str
    op: str
    value: Any = None

    def __post_init__(self) -> None:
        if self.op not in _VALID_OPS:
            raise ValueError(f"unknown rule op {self.op!r}")


@dataclass(frozen=True, slots=True)
class RuleGroup:
    """all_of / any_of 嵌套组；叶节点是 Condition。空组 = 恒真。"""

    all_of: tuple["Condition | RuleGroup", ...] = field(default_factory=tuple)
    any_of: tuple["Condition | RuleGroup", ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        if not self.all_of and not self.any_of:
            raise ValueError("RuleGroup requires all_of or any_of (non-empty)")


def evaluate_rule_group(
    group: "Condition | RuleGroup",
    resolve: Any,  # callable(field) -> value
) -> bool:
    """规则求值：resolve(field) 取值（参数或目标属性，调用方决定合并视图）。"""
    if isinstance(group, Condition):
        v = resolve(group.field)
        op, target = group.op, group.value
        if op == "truthy":
            return bool(v)
        if v is None:
            return False
        if op in ("eq", "ne"):
            eq = str(v) == str(target)
            return eq if op == "eq" else not eq
        if op == "startswith":
            return str(v).startswith(str(target))
        if op == "contains":
            return str(target) in str(v)
        if op == "in":
            allowed = target if isinstance(target, (list, tuple, set)) else [target]
            return str(v) in {str(a) for a in allowed}
        try:
            fv, ft = float(v), float(target)
        except (TypeError, ValueError):
            return False
        return {"gt": fv > ft, "gte": fv >= ft, "lt": fv < ft, "lte": fv <= ft}[op]
    if group.all_of and not all(
        evaluate_rule_group(g, resolve) for g in group.all_of
    ):
        return False
    if group.any_of and not any(
        evaluate_rule_group(g, resolve) for g in group.any_of
    ):
        return False
    return True


def validate_submission_rules(rules: Any) -> list[str]:
    """规则结构自检（dict 形态输入：{all_of:[...], any_of:[...], cond:{...}}）。"""
    violations: list[str] = []

    def _walk(node: Any, path: str) -> None:
        if not isinstance(node, dict):
            violations.append(f"{path}: rule node must be an object")
            return
        if "cond" in node:
            cond = node["cond"]
            if not isinstance(cond, dict) or "field" not in cond or "op" not in cond:
                violations.append(f"{path}.cond: requires field + op")
            elif cond["op"] not in _VALID_OPS:
                violations.append(f"{path}.cond: unknown op {cond['op']!r}")
            return
        has_any = False
        for k in ("all_of", "any_of"):
            if k in node:
                has_any = True
                children = node[k]
                if not isinstance(children, list) or not children:
                    violations.append(f"{path}.{k}: must be a non-empty array")
                    continue
                for i, child in enumerate(children):
                    _walk(child, f"{path}.{k}[{i}]")
        if not has_any:
            violations.append(f"{path}: requires cond / all_of / any_of")

    if isinstance(rules, (list, tuple)):
        for i, r in enumerate(rules):
            _walk(r, f"rules[{i}]")
    else:
        _walk(rules, "rules")
    return violations
