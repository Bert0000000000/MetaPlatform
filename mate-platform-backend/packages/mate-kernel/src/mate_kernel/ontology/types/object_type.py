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

    def __post_init__(self) -> None:
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
