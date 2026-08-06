"""Ontology Kernel —— 12 基元中的类型层（5 个：Property / ObjectType / LinkType / ActionType / Interface）。

按 ADR-0021 冻结。
"""

from .property_ import Property, PropertyFormat
from .object_type import ObjectType
from .link_type import LinkType, Cardinality, Directionality
from .action_type import ActionType
from .interface import Interface

__all__ = [
    "Property",
    "PropertyFormat",
    "ObjectType",
    "LinkType",
    "Cardinality",
    "Directionality",
    "ActionType",
    "Interface",
]
