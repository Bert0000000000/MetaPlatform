"""ADR-0063 S1：`GitFunctionResolver` —— 按 commit SHA 从仓库取 Function 源码。

覆盖：正常解析（含进程内缓存）、未注册 rid、非法 source_ref（非完整 SHA）、
不存在的 SHA/路径 —— 后三者必须 **fail-fast**（FunctionNotFoundError / ValueError），
不得静默回落（这是 ADR-0063 删除静默兜底的前提）。
"""

from __future__ import annotations

import subprocess
from pathlib import Path
from shutil import which

import pytest

from mate_kernel.ontology.function_resolver import (
    FunctionNotFoundError,
    GitFunctionResolver,
)
from mate_kernel.ontology.identity import ClassRef
from mate_kernel.ontology.reasoning import FunctionLanguage

_GIT = which("git") or "git"  # S607：绝对路径


def _git(repo: Path, *args: str) -> str:
    proc = subprocess.run(
        [_GIT, *args], cwd=repo, capture_output=True, text=True, check=False
    )
    assert proc.returncode == 0, f"git {' '.join(args)} failed: {proc.stderr}"
    return proc.stdout.strip()


@pytest.fixture()
def git_repo(tmp_path: Path) -> tuple[Path, str]:
    """建一个临时 git 仓库，含一个函数文件；返回 (repo_root, commit_sha)。"""
    repo = tmp_path / "fnrepo"
    repo.mkdir()
    _git(repo, "init")
    _git(repo, "config", "user.email", "t@example.com")
    _git(repo, "config", "user.name", "tester")
    fn = repo / "fns" / "flag.py"
    fn.parent.mkdir()
    fn.write_text(
        "def handler(target_iid, params):\n    return {'status': 'flagged'}\n",
        encoding="utf-8",
    )
    _git(repo, "add", ".")
    _git(repo, "commit", "-m", "add flag fn")
    sha = _git(repo, "rev-parse", "HEAD")
    return repo, sha


RID = "ont.acme.fn.flag.v1"


class TestGitFunctionResolver:
    def test_resolves_source_by_sha(self, git_repo) -> None:
        repo, sha = git_repo
        r = GitFunctionResolver(repo)
        r.register_ref(RID, FunctionLanguage.PYTHON, f"git:{sha}:fns/flag.py")
        lang, src = r.resolve(ClassRef(RID))
        assert lang is FunctionLanguage.PYTHON
        assert "def handler" in src and "flagged" in src

    def test_caches_by_sha_and_path(self, git_repo) -> None:
        repo, sha = git_repo
        r = GitFunctionResolver(repo)
        r.register_ref(RID, FunctionLanguage.PYTHON, f"git:{sha}:fns/flag.py")
        r.resolve(ClassRef(RID))
        cached = dict(r._cache)
        assert list(cached.keys()) == [f"{sha}:fns/flag.py"]
        r.resolve(ClassRef(RID))  # 二次解析命中缓存，不再拉取
        assert r._cache == cached

    def test_unregistered_rid_fails_fast(self, git_repo) -> None:
        repo, _sha = git_repo
        r = GitFunctionResolver(repo)
        with pytest.raises(FunctionNotFoundError):
            r.resolve(ClassRef("ont.acme.fn.nope.v1"))

    def test_short_sha_rejected(self, git_repo) -> None:
        """branch/tag/短 SHA 一律拒绝 —— 必须是完整 40 位 commit SHA。"""
        repo, _sha = git_repo
        r = GitFunctionResolver(repo)
        for bad in (
            "git:main:fns/flag.py",
            "git:abc123:fns/flag.py",
            "inline://ont.acme.fn.flag.v1",
        ):
            with pytest.raises(ValueError):
                r.register_ref(RID, FunctionLanguage.PYTHON, bad)

    def test_missing_path_fails_fast(self, git_repo) -> None:
        repo, sha = git_repo
        r = GitFunctionResolver(repo)
        r.register_ref(RID, FunctionLanguage.PYTHON, f"git:{sha}:fns/nope.py")
        with pytest.raises(FunctionNotFoundError):
            r.resolve(ClassRef(RID))

    def test_unknown_sha_fails_fast(self, git_repo) -> None:
        repo, _sha = git_repo
        r = GitFunctionResolver(repo)
        r.register_ref(RID, FunctionLanguage.PYTHON, f"git:{'0' * 40}:fns/flag.py")
        with pytest.raises(FunctionNotFoundError):
            r.resolve(ClassRef(RID))
