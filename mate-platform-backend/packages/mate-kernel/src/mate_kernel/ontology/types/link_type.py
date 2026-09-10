"""LinkType —— 12 基元之 5。

对象之间的关系（"订单→客户"），带基数与方向。
不可变。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

from ..identity.class_ref import ClassRef
from .property_ import Property


class Cardinality(str, Enum):
    ONE_TO_ONE = "1:1"
    ONE_TO_MANY = "1:N"
    MANY_TO_ONE = "N:1"
    MANY_TO_MANY = "N:N"


class Directionality(str, Enum):
    UNDIRECTED = "undirected"
    DIRECTED = "directed"
    BIDIRECTIONAL = "bidirectional"


@dataclass(frozen=True, slots=True)
class LinkType:
    rid: ClassRef
    src: ClassRef  # 源 ObjectType rid
    dst: ClassRef  # 目标 ObjectType rid
    cardinality: Cardinality
    directionality: Directionality
    link_properties: tuple[Property, ...] = field(default_factory=tuple)
    # EXP-03（2026-09-10）：两端独立命名（Palantir link type 两 side 各自
    # display name，双向可读 —— department.employees / employee.department）。
    src_display_name: str = ""  # 站在 src 视角读向 dst 的名字（复数）
    dst_display_name: str = ""  # 站在 dst 视角读向 src 的名字
    description: str = ""       # EXP-04：关系语义描述（链接应能回答一个领域问题）


def check_cardinality(
    cardinality: "Cardinality",
    src_outgoing: int,
    dst_incoming: int,
) -> str | None:
    """EXP-03：基数校验 —— 返回违规消息（None = 通过）。

    src_outgoing：该 src 实例已存在的同类型出边数（不含本次）；
    dst_incoming：该 dst 实例已存在的同类型入边数（不含本次）。
    规则（创建第 N 条边前检查，violation → 拒绝创建）：
    - 1:1 —— src 出边 + dst 入边都必须 < 1
    - 1:N —— src 出边不限，dst 入边 < 1（一个 dst 只能被一个 src 指向）
    - N:1 —— src 出边 < 1，dst 入边不限
    - N:N —— 不限
    """
    if cardinality is Cardinality.ONE_TO_ONE:
        if src_outgoing >= 1:
            return "cardinality 1:1 violated: src already has a link of this type"
        if dst_incoming >= 1:
            return "cardinality 1:1 violated: dst already has a link of this type"
    elif cardinality is Cardinality.ONE_TO_MANY:
        if dst_incoming >= 1:
            return "cardinality 1:N violated: dst already linked from another src"
    elif cardinality is Cardinality.MANY_TO_ONE:
        if src_outgoing >= 1:
            return "cardinality N:1 violated: src already links to another dst"
    return None
