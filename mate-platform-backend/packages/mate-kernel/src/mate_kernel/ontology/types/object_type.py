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

    def __post_init__(self) -> None:
        if not self.primary_key:
            raise ValueError("ObjectType.primary_key must be non-empty")
        prop_rids = {p.rid for p in self.properties}
        for pk in self.primary_key:
            if pk not in prop_rids:
                raise ValueError(
                    f"ObjectType.primary_key {pk} not in properties"
                )
