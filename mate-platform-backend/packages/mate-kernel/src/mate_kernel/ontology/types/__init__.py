"""Ontology Kernel —— 12 基元中的类型层（5 个：Property / ObjectType / LinkType / ActionType / Interface）。

按 ADR-0021 冻结；EXP-02（2026-09-10）扩展 Property 体系与值类型注册表。
"""

from .property_ import DerivedSpec, Property, PropertyFormat, ai_metadata_struct, reduce_array_value
from .object_type import ObjectType
from .link_type import LinkType, Cardinality, Directionality
from .action_type import ActionType
from .interface import Interface
from . import value_types
from .value_types import (
    ValueType,
    get_value_type,
    list_value_types,
    register_value_type,
    validate_property,
)

__all__ = [
    "Property",
    "PropertyFormat",
    "DerivedSpec",
    "ai_metadata_struct",
    "reduce_array_value",
    "ObjectType",
    "LinkType",
    "Cardinality",
    "Directionality",
    "ActionType",
    "Interface",
    "value_types",
    "ValueType",
    "get_value_type",
    "list_value_types",
    "register_value_type",
    "validate_property",
]
