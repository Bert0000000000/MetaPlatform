"""Function Sandbox (SANDBOX-01) 测试。"""

from __future__ import annotations

import sys

import pytest

from mate_kernel.sandbox.function import (
    SandboxLimits,
    SandboxResult,
    SandboxViolation,
    _static_check,
    run_function,
)


class TestStaticCheck:
    def test_clean_source_passes(self) -> None:
        assert _static_check("def main(x): return x + 1") is None

    def test_blocks_socket(self) -> None:
        assert _static_check("import socket; socket.socket()") is not None
        assert "network" in (_static_check("socket.socket()") or "")

    def test_blocks_urllib(self) -> None:
        assert _static_check("import urllib.request") is not None

    def test_blocks_httpx(self) -> None:
        assert _static_check("import httpx") is not None

    def test_blocks_etc_open(self) -> None:
        assert _static_check('open("/etc/passwd")') is not None


class TestRunFunction:
    def test_basic_success(self) -> None:
        src = "def main(x):\n    return x * 2"
        result = run_function(src, {"x": 21})
        assert result.returncode == 0
        assert "42" in result.stdout
        assert result.sandbox_violated is None

    def test_returns_args_as_kwargs(self) -> None:
        src = "def main(a, b):\n    return {'sum': a + b}"
        result = run_function(src, {"a": 2, "b": 3})
        assert result.returncode == 0
        assert '"sum": 5' in result.stdout

    def test_static_violation_blocks(self) -> None:
        src = "import socket\ndef main(): pass"
        result = run_function(src, {})
        assert result.sandbox_violated is not None
        assert "network" in result.sandbox_violated
        assert result.returncode == -1

    def test_timeout_kills(self) -> None:
        src = "import time\ndef main():\n    time.sleep(60)\n    return 1"
        result = run_function(src, {}, SandboxLimits(timeout_seconds=1))
        assert result.sandbox_violated == "timeout"

    def test_exception_propagates_to_stderr(self) -> None:
        src = "def main():\n    raise ValueError('boom')"
        result = run_function(src, {})
        assert result.returncode != 0
        assert "ValueError" in result.stderr or "boom" in result.stderr


class TestLimitsDataclass:
    def test_defaults(self) -> None:
        l = SandboxLimits()
        assert l.cpu_seconds == 10
        assert l.memory_mb == 256
        assert l.timeout_seconds == 30
        assert l.allow_network is False

    def test_immutable(self) -> None:
        l = SandboxLimits()
        with pytest.raises(Exception):
            l.cpu_seconds = 99  # type: ignore[misc]