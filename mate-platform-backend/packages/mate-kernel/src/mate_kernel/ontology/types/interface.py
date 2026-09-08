"""Interface —— 12 基元之 7。

跨类型共享的"形状+能力"（多态载体）。
不可变。
"""

from __future__ import annotations

from dataclasses import dataclass, field

from ..identity.class_ref import ClassRef
from .property_ import Property


@dataclass(frozen=True, slots=True)
class Interface:
    rid: ClassRef
    properties: tuple[Property, ...]
    required_links: tuple[ClassRef, ...] = field(default_factory=tuple)
    polymorphic_action_constraints: tuple[str, ...] = field(default_factory=tuple)


def implements_interface(ot: "ObjectType", ifc: Interface) -> bool:
    """SAL-07：ObjectType 是否实现 Interface（多态契约，G9 骨干）。

    规则（蓝图 §3 Interface 基元）：
    1. ifc.properties 的每个 rid 必须 ∈ ot.properties（同名同 rid 即签名匹配）；
    2. ifc.required_links 的每个 link rid 必须被 ot 声明实现（ot.interfaces 中
       引用该 Interface 即视为承诺，link 明细校验在 LinkType 注册时执行）。
    """
    ot_prop_rids = {p.rid.rid for p in ot.properties}
    for p in ifc.properties:
        if p.rid.rid not in ot_prop_rids:
            return False
    if ifc.required_links:
        declared = {
            i.rid.rid if hasattr(i.rid, "rid") else str(i)
            for i in ot.interfaces
        }
        for lr in ifc.required_links:
            lrid = lr.rid if hasattr(lr, "rid") else str(lr)
            if lrid not in declared and lrid not in ot_prop_rids:
                return False
    return True
