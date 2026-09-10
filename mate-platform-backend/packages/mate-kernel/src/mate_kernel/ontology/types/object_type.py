"""ObjectType —— 12 基元之 4。

业务对象类（"订单"、"设备"、"员工"），可挂 Property + Interface。
不可变。
"""

from __future__ import annotations

from dataclasses import dataclass, field

from ..identity.class_ref import ClassRef
from .property_ import Property


@dataclass(frozen=True, slots=True)
class ObjectType:
    rid: ClassRef
    primary_key: tuple[ClassRef, ...]  # 至少 1 个 Property.rid
    properties: tuple[Property, ...]
    interfaces: tuple[ClassRef, ...] = field(default_factory=tuple)
    display_name: str = ""
    marking: tuple[str, ...] = ()  # 类型级安全标记（ADR-0043 §2.6，工具可见性）
    # EXP-01（D2 拍板 2026-09-10）：浅层级声明（限 1 层 parent）。
    # repo 层 upsert 时自动生成 subclass 公理（单一事实源），并做环检测；
    # 深层级按 Palantir "组合优于深层次级" 原则不建模，用 Interface 组合。
    parent_class: ClassRef | None = None
    # EXP-04（2026-09-10）：治理/展示元数据（G16 —— AI 可导航性 + 管理面分组）
    description: str = ""            # 类型描述（喂 agent 工具与 OAG 检索）
    status: str = "active"           # active / draft / deprecated（Cleanup 生命周期）
    type_group: str = ""             # 管理面分组（type groups）
    render_hints: tuple[tuple[str, str], ...] = ()  # 展示提示 kv（icon/color/单位）

    def __post_init__(self) -> None:
        if self.status not in ("active", "draft", "deprecated"):
            raise ValueError(
                f"ObjectType.status must be active/draft/deprecated, got {self.status!r}"
            )
        if not self.primary_key:
            raise ValueError("ObjectType.primary_key must be non-empty")
        prop_rids = {p.rid for p in self.properties}
        for pk in self.primary_key:
            if pk not in prop_rids:
                raise ValueError(
                    f"ObjectType.primary_key {pk} not in properties"
                )
        if self.parent_class is not None and self.parent_class == self.rid:
            raise ValueError("ObjectType.parent_class must not equal rid (self-parent)")


def detect_destructive_changes(old: ObjectType, new: ObjectType) -> list[str]:
    """G33：破坏性 schema 变更检测（返回清单，空 = 安全）。

    破坏性（数据兼容性破坏）：
    - 属性 rid 集合缩（删除属性 → 存量实例数据悬空）
    - 主键变更（primary_key 集合不同）
    - 属性 format 变化（存储/查询语义破坏）
    - parent_class 变化（层级重挂 —— 谨慎项，计入）
    不计入：display_name/description/marking/render_hints 等元数据变更，
    新增属性（集合扩）。
    """
    changes: list[str] = []
    old_props = {p.rid.rid: p for p in old.properties}
    new_props = {p.rid.rid: p for p in new.properties}
    removed = sorted(set(old_props) - set(new_props))
    if removed:
        changes.append(f"properties removed: {', '.join(removed)}")
    for rid in sorted(set(old_props) & set(new_props)):
        if old_props[rid].format is not new_props[rid].format:
            changes.append(
                f"property format changed: {rid} "
                f"{old_props[rid].format.value} -> {new_props[rid].format.value}")
    if {pk.rid for pk in old.primary_key} != {pk.rid for pk in new.primary_key}:
        changes.append("primary_key changed")
    old_parent = old.parent_class.rid if old.parent_class is not None else ""
    new_parent = new.parent_class.rid if new.parent_class is not None else ""
    if old_parent != new_parent:
        changes.append(f"parent_class changed: {old_parent or 'None'} -> {new_parent or 'None'}")
    return changes
