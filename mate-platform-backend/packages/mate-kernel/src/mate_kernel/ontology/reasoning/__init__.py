"""Ontology Kernel —— 12 基元中的推理 + 函数层（2 个：Axiom / Function）。

按 ADR-0021 冻结。
"""

from .axiom import Axiom, AxiomKind
from .function import Function, FunctionLanguage

__all__ = ["Axiom", "AxiomKind", "Function", "FunctionLanguage"]
