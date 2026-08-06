"""Ontology Kernel —— 12 基元中的实例层（2 个：Individual / LinkInstance）。

按 ADR-0021 冻结。
"""

from .individual import Individual
from .link_instance import LinkInstance

__all__ = ["Individual", "LinkInstance"]
