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
