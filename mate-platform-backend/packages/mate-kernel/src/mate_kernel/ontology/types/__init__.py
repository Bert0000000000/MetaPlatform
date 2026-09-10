"""Ontology Kernel —— 12 基元中的类型层（5 个：Property / ObjectType / LinkType / ActionType / Interface）。

按 ADR-0021 冻结；EXP-02（2026-09-10）扩展 Property 体系与值类型注册表。
"""

from . import value_types
from .action_type import ActionType
from .interface import Interface
from .link_type import Cardinality, Directionality, LinkType
from .object_type import ObjectType
from .property_ import DerivedSpec, Property, PropertyFormat, ai_metadata_struct, reduce_array_value
from .value_types import (
    ValueType,
    get_value_type,
    list_value_types,
    register_value_type,
    validate_property,
)

__all__ = [
    "ActionType",
    "Cardinality",
    "DerivedSpec",
    "Directionality",
    "Interface",
    "LinkType",
    "ObjectType",
    "Property",
    "PropertyFormat",
    "ValueType",
    "ai_metadata_struct",
    "get_value_type",
    "list_value_types",
    "reduce_array_value",
    "register_value_type",
    "validate_property",
    "value_types",
]
