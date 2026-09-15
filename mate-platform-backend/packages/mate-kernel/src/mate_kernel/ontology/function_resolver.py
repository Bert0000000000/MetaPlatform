"""FunctionResolver —— GOVERN-05。

把 ``Function.rid`` 解析为可执行源码 + 语言。ActionService 在
``apply`` 时按 ``function_ref`` 查 invoker，再按 resolver 拿源码交给
``FunctionExecutor.execute`` 执行；结果回写到 ``target.props``。

dev 默认 ``InMemoryFunctionResolver``（registry in-process）。生产可替换为
``GitFunctionResolver`` / ``OCIImageResolver``（SANDBOX-02 / AGENT-EXT-01
后续，本批仅留接口）。
"""

from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path
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
        raise FunctionNotFoundError(f"function not registered: {function_ref.rid}")


# ─────────────────── GOVERN-05+1: Git 来源（ADR-0063）───────────────────

# `git:<40 位 commit SHA>:<仓库相对路径>`。**强制完整 SHA** —— branch/tag
# 可移动，会破坏"当时执行的是哪份代码"的可复现性与审计。
_GIT_REF_RE = re.compile(r"^git:(?P<sha>[0-9a-f]{40}):(?P<path>[^\s][^\s]*)$")


class GitFunctionResolver:
    """ADR-0063 S1：按 ``git:<sha>:<path>`` 从仓库取源码。

    - 只接受**完整 40 位 commit SHA** 锚定的 source_ref；
    - 进程内按 ``<sha>:<path>`` 缓存；Function 新版本 → 新 SHA → 自然失效；
    - 取不到（SHA/路径不存在、git 不可用）→ ``FunctionNotFoundError``，**fail-fast**。

    与 ``InMemoryFunctionResolver`` 的差别：后者登记的是**源码本身**，本实现
    登记的是 **rid → source_ref 映射**，源码按需从 git 拉取。
    """

    def __init__(self, repo_root: str | Path, *, timeout: float = 10.0) -> None:
        self._repo_root = str(repo_root)
        self._timeout = timeout
        self._refs: dict[str, tuple[FunctionLanguage, str]] = {}
        self._cache: dict[str, str] = {}

    def register_ref(self, function_rid: str, language: FunctionLanguage, source_ref: str) -> None:
        if not _GIT_REF_RE.match(source_ref):
            raise ValueError(
                f"invalid git source_ref (need git:<40-hex-sha>:<path>): {source_ref!r}"
            )
        self._refs[function_rid] = (language, source_ref)

    def resolve(self, function_ref: ClassRef) -> tuple[FunctionLanguage, str]:
        entry = self._refs.get(function_ref.rid)
        if entry is None:
            raise FunctionNotFoundError(f"function not registered: {function_ref.rid}")
        lang, ref = entry
        m = _GIT_REF_RE.match(ref)
        if m is None:  # pragma: no cover — register_ref 已挡
            raise FunctionNotFoundError(f"invalid git source_ref: {ref!r}")
        sha, path = m.group("sha"), m.group("path")
        key = f"{sha}:{path}"
        cached = self._cache.get(key)
        if cached is not None:
            return lang, cached
        src = self._git_show(sha, path)
        self._cache[key] = src
        return lang, src

    def _git_show(self, sha: str, path: str) -> str:
        # S607：partial path → which 解析为绝对路径（找不到再裸用，报错路径不变）
        git_exe = shutil.which("git") or "git"
        try:
            proc = subprocess.run(
                [git_exe, "show", f"{sha}:{path}"],
                cwd=self._repo_root,
                capture_output=True,
                text=True,
                timeout=self._timeout,
                check=False,
            )
        except (OSError, subprocess.SubprocessError) as e:
            raise FunctionNotFoundError(f"git unavailable for {sha}:{path}: {e}") from e
        if proc.returncode != 0:
            raise FunctionNotFoundError(
                f"git show failed for {sha}:{path}: {proc.stderr.strip()[:200]}"
            )
        return proc.stdout
