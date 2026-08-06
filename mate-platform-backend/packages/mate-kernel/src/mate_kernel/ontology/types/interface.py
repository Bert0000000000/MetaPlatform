"""Interface —— 12 基元之 7。

跨类型共享的"形状+能力"（多态载体）。
不可变。
"""

from __future__ import annotations

from dataclasses import dataclass, field

from ..identity.class_ref import ClassRef
from .property_ import Property


@dataclass(frozen=True, slots=True)
class Interface:
    rid: ClassRef
    properties: tuple[Property, ...]
    required_links: tuple[ClassRef, ...] = field(default_factory=tuple)
    polymorphic_action_constraints: tuple[str, ...] = field(default_factory=tuple)
