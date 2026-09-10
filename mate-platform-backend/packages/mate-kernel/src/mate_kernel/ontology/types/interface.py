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


def interface_source_rids(
    interface_rid: "str | ClassRef",
    object_types: "tuple[ObjectType, ...] | list[ObjectType]",
) -> list[str]:
    """EXP-01：Interface 多态查询源展开 —— Interface rid → 实现它的全部 ObjectType rid。

    查询源接受 Interface 时（如「查全部 Facility 对象」），repo 层先调本函数
    把源类集合展开为实现类型列表，再走既有 ObjectSet / ObjectSetQuery 路径。
    返回顺序稳定（按 object_types 输入序）。
    """
    target = interface_rid.rid if hasattr(interface_rid, "rid") else str(interface_rid)
    return [
        ot.rid.rid
        for ot in object_types
        if any(
            (i.rid.rid if hasattr(i.rid, "rid") else str(i)) == target
            for i in ot.interfaces
        )
    ]


def validate_interface_constraints(
    ot: "ObjectType",
    ifc: Interface,
    link_type_endpoint_pairs: "list[tuple[str, frozenset[str]]] | None" = None,
) -> list[str]:
    """EXP-01：Interface 约束校验（占位串 → 结构化校验）。

    返回违规清单（空 = 通过）。repo 层 upsert_object_type 时对已注册 Interface
    逐条调用；违规默认 ValueError 拒绝（fail-fast），管理面可先调本函数预检。

    检查项：
    1. 属性签名 —— implements_interface 的属性维度；
    2. required_links —— link_type_endpoint_pairs 形如 [(link_rid, {src,dst})]，
       ot 必须作为端点出现在每个 required link 上（None = 跳过 link 检查，
       LinkType 尚未注册时允许先声明后补）。
    """
    violations: list[str] = []
    ot_prop_rids = {p.rid.rid for p in ot.properties}
    for p in ifc.properties:
        if p.rid.rid not in ot_prop_rids:
            violations.append(
                f"interface {ifc.rid.rid} requires property {p.rid.rid} "
                f"missing on {ot.rid.rid}"
            )
    if link_type_endpoint_pairs is not None:
        for lr in ifc.required_links:
            lrid = lr.rid if hasattr(lr, "rid") else str(lr)
            endpoints = [pair for pair in link_type_endpoint_pairs if pair[0] == lrid]
            if not endpoints:
                violations.append(
                    f"interface {ifc.rid.rid} requires link {lrid} "
                    f"but no such LinkType registered"
                )
                continue
            if not any(ot.rid.rid in pair[1] for pair in endpoints):
                violations.append(
                    f"interface {ifc.rid.rid} requires link {lrid} "
                    f"to touch {ot.rid.rid}"
                )
    return violations
