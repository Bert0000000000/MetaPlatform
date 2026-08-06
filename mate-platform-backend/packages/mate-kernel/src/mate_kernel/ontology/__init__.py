"""Ontology Kernel —— 12 基元聚合入口（按 ADR-0021 冻结）。"""

from .api import OntologyRepository
from .identity import ClassRef, Version
from .in_memory import InMemoryOntologyRepository
from .types import (
    Property,
    PropertyFormat,
    ObjectType,
    LinkType,
    Cardinality,
    Directionality,
    ActionType,
    Interface,
)
from .instances import Individual, LinkInstance
from .reasoning import Axiom, AxiomKind, Function, FunctionLanguage
from .query import ObjectSet

__all__ = [
    # identity
    "ClassRef",
    "Version",
    # types
    "Property",
    "PropertyFormat",
    "ObjectType",
    "LinkType",
    "Cardinality",
    "Directionality",
    "ActionType",
    "Interface",
    # instances
    "Individual",
    "LinkInstance",
    # reasoning
    "Axiom",
    "AxiomKind",
    "Function",
    "FunctionLanguage",
    # query
    "ObjectSet",
    # service layer
    "OntologyRepository",
    "InMemoryOntologyRepository",
]
