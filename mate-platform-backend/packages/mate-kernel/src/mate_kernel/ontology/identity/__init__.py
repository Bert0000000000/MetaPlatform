"""Ontology Kernel —— 12 基元中的标识层。

按 ADR-0021 冻结：基元 API 签名变更需新 ADR。
"""

from .class_ref import ClassRef
from .version import Version

__all__ = ["ClassRef", "Version"]
