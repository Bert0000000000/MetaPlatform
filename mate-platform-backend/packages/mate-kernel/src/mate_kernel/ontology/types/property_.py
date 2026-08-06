"""Property —— 12 基元之 3。

一个类型的字段定义（主键/标题/显示/格式化/required/derived 都挂在它身上）。
不可变。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from ..identity.class_ref import ClassRef


class PropertyFormat(str, Enum):
    STRING = "string"
    INTEGER = "integer"
    DOUBLE = "double"
    BOOLEAN = "boolean"
    DATE = "date"
    TIMESTAMP = "timestamp"
    MARKING = "marking"  # 安全标记


@dataclass(frozen=True, slots=True)
class Property:
    rid: ClassRef
    type_id: str  # 值类型 rid，引用 value-type
    nullable: bool
    primary_key: bool
    title: str
    format: PropertyFormat
