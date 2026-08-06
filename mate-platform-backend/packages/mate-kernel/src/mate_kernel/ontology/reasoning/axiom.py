"""Axiom —— 12 基元之 10。

推理规则（子类闭包、传递性、属性约束、SameAs…）。
所有规则引擎都基于它；现有 mate-tech-ont/inference/engine.py:25-49 的
SubclassRule/TransitivityRule 是其雏形。不可变。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

from ..identity.class_ref import ClassRef


class AxiomKind(str, Enum):
    SUBCLASS = "subclass"  # SubclassRule
    TRANSITIVITY = "transitivity"  # TransitivityRule
    PROPERTY = "property"  # 属性约束
    SAME_AS = "same_as"  # SameAs 推理
    DISJOINT = "disjoint"  # 不相交


@dataclass(frozen=True, slots=True)
class Axiom:
    rid: ClassRef
    kind: AxiomKind
    operands: tuple[ClassRef, ...]
    rule_ref: str  # 规则实现标识，可指向 Function 或内置
    metadata: tuple[tuple[str, str], ...] = field(default_factory=tuple)
