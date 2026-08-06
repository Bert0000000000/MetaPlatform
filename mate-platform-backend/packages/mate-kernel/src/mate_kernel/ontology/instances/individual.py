"""Individual —— 12 基元之 8。

ObjectType 的一个具体实例（"订单#10086"）。
**可变**：每次写都生成 outbox 事件 + ADS 审计。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from ..identity.class_ref import ClassRef
from ..types.property_ import PropertyFormat


@dataclass(frozen=True, slots=True)
class Individual:
    rid: str  # ont.<tenant>.ind.<type>.<pk>
    class_rid: ClassRef
    props: tuple[tuple[ClassRef, object], ...]
    primary_key: str
    created_at: datetime
    updated_at: datetime
    tenant_id: str
    marking: tuple[str, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        if not self.rid.startswith(f"ont.{self.tenant_id}.ind."):
            raise ValueError(
                f"Individual.rid must start with ont.{self.tenant_id}.ind."
            )
        if not self.primary_key:
            raise ValueError("Individual.primary_key must be non-empty")

    def get(self, prop: ClassRef) -> object | None:
        for k, v in self.props:
            if k == prop:
                return v
        return None
