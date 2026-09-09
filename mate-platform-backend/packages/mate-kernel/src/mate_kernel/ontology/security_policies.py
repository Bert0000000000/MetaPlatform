"""SEC-12：本体行列级安全策略（Palantir object/property security policies 对位）。

Palantir 语义（调研材料 06 §4）：
- **对象级行安全**：策略配在 object type 上（非底层数据集）——行不满足
  可见条件则该对象**完全不可见**（不报错）；
- **属性级列安全**：不过 property policy 的属性值返回 **null**（非报错）；
  行 × 列组合 = 单元格级安全；
- 读时强制（read-time enforcement），与租户 RLS 叠加而非替代。

Mate v1 模型：
- ``RowPolicy``（class_rid + Condition + bypass_markings）—— 行可见性；
  viewer 持有全部 bypass_markings 则豁免；
- ``ColumnPolicy``（property_rid + required_markings）—— viewer 缺任一
  required marking → 值置 None；
- 执行点：repo 查询路径（evaluate_object_set / execute_object_query /
  get_individual / list_individuals / search_objects），API 层传
  viewer_markings（与 /agent-tools 同口径）。

不做（v1 边界）：策略随血缘传播（markings 传播在 G6，依赖数据面）、
scoped sessions（G7 挂起）。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ..action.validation import Condition, evaluate_rule_group

__all__ = [
    "RowPolicy",
    "ColumnPolicy",
    "SecurityPolicySet",
    "filter_visible_individuals",
    "mask_property_values",
    "policy_applies",
]


@dataclass(frozen=True, slots=True)
class RowPolicy:
    """行级策略：class_rid 上的可见条件。

    语义：该类实例**不满足** condition → 不可见；viewer 持有全部
    bypass_markings → 全豁免（管理/审计通道）。
    """

    class_rid: str
    field: str
    op: str
    value: Any = None
    bypass_markings: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True, slots=True)
class ColumnPolicy:
    """列级策略：property_rid 上的可见 markings。

    语义：viewer 缺任一 required_markings → 该属性值置 None（对象仍可见）。
    """

    property_rid: str
    required_markings: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True, slots=True)
class SecurityPolicySet:
    row_policies: tuple[RowPolicy, ...] = field(default_factory=tuple)
    column_policies: tuple[ColumnPolicy, ...] = field(default_factory=tuple)


def _viewer_holds(viewer_markings: tuple[str, ...] | list[str],
                  required: tuple[str, ...]) -> bool:
    return set(required) <= set(viewer_markings)


def policy_applies(
    policy: RowPolicy, class_rid: str,
    include_descendants_of: frozenset[str] = frozenset(),
) -> bool:
    """行策略是否作用于该类（精确类或其祖先类 —— 层级继承可见性约束）。"""
    return class_rid == policy.class_rid or policy.class_rid in include_descendants_of


def _ind_resolve(ind: Any, prop_field: str) -> Any:
    """individual 上按 slug/rid 取属性值（与 individual_to_row 同规则）。"""
    for k, v in ind.props:
        parts = k.rid.split(".")
        slug = parts[3] if len(parts) >= 5 else parts[-1]
        if prop_field in (slug, k.rid):
            return v
    return None


def filter_visible_individuals(
    individuals: list[Any],
    policies: SecurityPolicySet,
    viewer_markings: tuple[str, ...] | list[str],
    ancestor_classes_of: Any = None,  # callable(class_rid) -> frozenset[str]
) -> list[Any]:
    """行策略过滤 —— 不可见个体直接剔除（在分页**之前**调用）。

    viewer 持有策略全部 bypass_markings → 豁免该策略。
    ancestor_classes_of(class_rid) 返回该类的全部祖先（含自身），供
    父类策略约束子类实例（EXP-01 层级 × 安全联动）。
    """
    if not policies.row_policies:
        return list(individuals)
    out: list[Any] = []
    for ind in individuals:
        cls = ind.class_rid.rid
        ancestors = ancestor_classes_of(cls) if ancestor_classes_of else frozenset({cls})
        visible = True
        for p in policies.row_policies:
            if not (p.class_rid == cls or p.class_rid in ancestors):
                continue
            # 非空 bypass_markings 且 viewer 全持 → 豁免（空 = 无人豁免）
            if p.bypass_markings and _viewer_holds(viewer_markings, p.bypass_markings):
                continue
            cond = Condition(field=p.field, op=p.op, value=p.value)
            ok = evaluate_rule_group(
                cond, lambda f, _ind=ind: _ind_resolve(_ind, f))
            # 行语义：满足 condition 才可见
            if not ok:
                visible = False
                break
        if visible:
            out.append(ind)
    return out


def mask_property_values(
    row: dict[str, Any],
    policies: SecurityPolicySet,
    viewer_markings: tuple[str, ...] | list[str],
    rid_to_slug: dict[str, str] | None = None,
) -> dict[str, Any]:
    """列策略脱敏 —— 缺 marking 的属性值置 None（对象行仍返回）。

    row 键为 slug（individual_to_row 形态）或完整 rid（rid_to_slug 提供
    映射时兼容）。就地修改并返回同一 dict。
    """
    if not policies.column_policies:
        return row
    for p in policies.column_policies:
        if _viewer_holds(viewer_markings, p.required_markings):
            continue
        slug = None
        if rid_to_slug and p.property_rid in rid_to_slug:
            slug = rid_to_slug[p.property_rid]
        else:
            parts = p.property_rid.split(".")
            slug = parts[3] if len(parts) >= 5 else parts[-1]
        if slug in row:
            row[slug] = None
    return row
