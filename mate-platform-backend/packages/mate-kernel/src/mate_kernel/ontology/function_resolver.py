"""FunctionResolver —— GOVERN-05。

把 ``Function.rid`` 解析为可执行源码 + 语言。ActionService 在
``apply`` 时按 ``function_ref`` 查 invoker，再按 resolver 拿源码交给
``FunctionExecutor.execute`` 执行；结果回写到 ``target.props``。

dev 默认 ``InMemoryFunctionResolver``（registry in-process）。生产可替换为
``GitFunctionResolver`` / ``OCIImageResolver``（SANDBOX-02 / AGENT-EXT-01
后续，本批仅留接口）。
"""
from __future__ import annotations

from typing import Protocol

from .identity.class_ref import ClassRef
from .reasoning.function import FunctionLanguage


class FunctionNotFoundError(KeyError):
    """Function 解析失败（rid 未注册 / source_ref 拉取失败）。"""


class FunctionResolver(Protocol):
    def resolve(self, function_ref: ClassRef) -> tuple[FunctionLanguage, str]:
        """返回 (language, source_code)。"""


class InMemoryFunctionResolver:
    """GOVERN-05 默认实现：进程内 registry。

    registry 键：``(language, source_ref)`` —— ``source_ref`` 形如
    ``inline://<rid>``（手动注入）或 ``git:sha-abc123``（GOVERN-05+1 拉）。
    """

    def __init__(self) -> None:
        self._registry: dict[tuple[FunctionLanguage, str], str] = {}

    def register(
        self,
        language: FunctionLanguage,
        source_ref: str,
        source: str,
    ) -> None:
        self._registry[(language, source_ref)] = source

    def resolve(self, function_ref: ClassRef) -> tuple[FunctionLanguage, str]:
        for (lang, ref), src in self._registry.items():
            if ref.endswith(function_ref.rid) or ref == function_ref.rid:
                return lang, src
        raise FunctionNotFound(f"function not registered: {function_ref.rid}")
