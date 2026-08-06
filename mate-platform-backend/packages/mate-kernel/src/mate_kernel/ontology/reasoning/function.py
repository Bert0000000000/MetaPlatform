"""Function —— 12 基元之 11。

任意复杂度的业务逻辑函数（AIP/LLM/数字员工的"代码宿主"）。
运行时由 Function Sandbox（MP-SANDBOX-01）执行。不可变。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

from ..identity.class_ref import ClassRef


class FunctionLanguage(str, Enum):
    PYTHON = "python"
    TYPESCRIPT = "typescript"
    SQL = "sql"  # 限于 ObjectSet 编译器输出


@dataclass(frozen=True, slots=True)
class Function:
    rid: ClassRef  # ont.<tenant>.fn.<slug>.<ver>
    language: FunctionLanguage
    version: int
    source_ref: str  # Git SHA / OCI image digest / 内部路径
    signatures: tuple[tuple[str, str], ...] = field(default_factory=tuple)
    """(name, type_signature) 元组。"""
