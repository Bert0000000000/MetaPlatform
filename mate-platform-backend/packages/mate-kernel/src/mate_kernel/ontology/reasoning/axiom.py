"""Axiom —— 12 基元之 10。

推理规则（子类闭包、传递性、属性约束、SameAs…）。
所有规则引擎都基于它；现有 mate-tech-ont/inference/engine.py:25-49 的
SubclassRule/TransitivityRule 是其雏形。不可变。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum

from ..identity.class_ref import ClassRef


class AxiomKind(StrEnum):
    SUBCLASS = "subclass"  # SubclassRule
    TRANSITIVITY = "transitivity"  # TransitivityRule
    PROPERTY = "property"  # 属性约束
    SAME_AS = "same_as"  # SameAs 推理
    DISJOINT = "disjoint"  # 不相交
    # ONT-G12 扩展（2026-09-08，Sprint 1）：OWL 2 常用公理类型第一批
    EQUIVALENT_CLASS = "equivalent_class"  # EquivalentClasses
    PROPERTY_DOMAIN = "property_domain"  # 属性定义域约束
    PROPERTY_RANGE = "property_range"  # 属性值域约束
    FUNCTIONAL = "functional"  # 函数性（单值）
    INVERSE_FUNCTIONAL = "inverse_functional"  # 逆函数性
    TRANSITIVE_PROPERTY = "transitive_property"
    SYMMETRIC_PROPERTY = "symmetric_property"
    PROPERTY_CHAIN = "property_chain"  # R1∘R2 ⊑ R3
    HAS_KEY = "has_key"  # 唯一键约束


@dataclass(frozen=True, slots=True)
class Axiom:
    rid: ClassRef
    kind: AxiomKind
    operands: tuple[ClassRef, ...]
    rule_ref: str  # 规则实现标识，可指向 Function 或内置
    metadata: tuple[tuple[str, str], ...] = field(default_factory=tuple)
