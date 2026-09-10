"""Ontology Kernel —— 12 基元聚合入口（按 ADR-0021 冻结）。"""

from .api import OntologyRepository
from .identity import ClassRef, Version
from .in_memory import InMemoryOntologyRepository
from .instances import Individual, LinkInstance
from .query import ObjectSet
from .reasoning import Axiom, AxiomKind, Function, FunctionLanguage
from .types import (
    ActionType,
    Cardinality,
    Directionality,
    Interface,
    LinkType,
    ObjectType,
    Property,
    PropertyFormat,
)

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
