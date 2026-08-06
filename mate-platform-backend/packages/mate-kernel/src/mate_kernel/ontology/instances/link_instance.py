"""LinkInstance —— 12 基元之 9。

LinkType 的一个具体关系（"订单#10086 → 客户#42"）。
**可变**。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from ..identity.class_ref import ClassRef


@dataclass(frozen=True, slots=True)
class LinkInstance:
    rid: str  # ont.<tenant>.lnk.<link>.<sid>.<did>
    link_type_rid: ClassRef
    src: str  # Individual.rid
    dst: str  # Individual.rid
    props: tuple[tuple[ClassRef, object], ...]
    created_at: datetime
    tenant_id: str
    marking: tuple[str, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        if not self.rid.startswith(f"ont.{self.tenant_id}.lnk."):
            raise ValueError(
                f"LinkInstance.rid must start with ont.{self.tenant_id}.lnk."
            )
        if self.src == self.dst:
            raise ValueError("LinkInstance.src and dst must differ")
