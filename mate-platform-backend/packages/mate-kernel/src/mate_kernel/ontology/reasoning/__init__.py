"""Ontology Kernel —— 12 基元中的推理 + 函数层（2 个：Axiom / Function）。

按 ADR-0021 冻结。
"""

from .axiom import Axiom, AxiomKind
from .engine import AxiomConflict, detect_axiom_conflicts
from .function import Function, FunctionLanguage

__all__ = [
    "Axiom",
    "AxiomConflict",
    "AxiomKind",
    "Function",
    "FunctionLanguage",
    "detect_axiom_conflicts",
]
