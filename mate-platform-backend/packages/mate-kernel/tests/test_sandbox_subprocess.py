"""RUNTIME-K8S-02: SubprocessExecutor 测试。"""

from __future__ import annotations

import os
import sys

from mate_kernel.sandbox.k8s import SubprocessExecutor


def test_subprocess_executes_user_handler() -> None:
    exe = SubprocessExecutor(timeout_seconds=10)
    source = "def handler(a, b):\n    return {'sum': a + b}\n"
    code, out, err = exe.execute(source, (2, 3))
    assert code == 0, f"stderr={err}"
    assert '"sum": 5' in out or '"sum":5' in out


def test_subprocess_no_handler_returns_2() -> None:
    exe = SubprocessExecutor(timeout_seconds=10)
    code, _, err = exe.execute("x = 1\n", ())
    assert code == 2
    assert "NO_HANDLER" in err or "no callable" in err.lower()


def test_subprocess_exception_caught() -> None:
    exe = SubprocessExecutor(timeout_seconds=10)
    source = "def handler():\n    raise RuntimeError('boom')\n"
    code, _, err = exe.execute(source, ())
    assert code != 0
    assert "boom" in err


def test_subprocess_timeout() -> None:
    exe = SubprocessExecutor(timeout_seconds=1)
    source = (
        "import time\n"
        "def handler():\n"
        "    time.sleep(5)\n"
        "    return 'should not reach'\n"
    )
    code, _, err = exe.execute(source, ())
    # POSIX 下 subprocess.TimeoutExpired → returncode=124；Windows 下 Popen 被强杀 → 1
    assert code in (124, 1)  # noqa: PLR2004
    assert "timeout" in err.lower() or code == 1  # Windows: 进程被杀，err 无 timeout 字样


def test_k8s_runner_uses_subprocess_by_default() -> None:
    from mate_kernel.sandbox.k8s import K8sSandboxRunner
    runner = K8sSandboxRunner()
    # 显式不传 SANDBOX_BACKEND 时用 subprocess
    assert runner.backend in ("subprocess", os.getenv("SANDBOX_BACKEND", "subprocess").lower())


def test_k8s_runner_explicit_memory_uses_simple_executor() -> None:
    from mate_kernel.sandbox.k8s import K8sSandboxRunner, _SimplePythonExecutor
    runner = K8sSandboxRunner(backend="memory")
    assert isinstance(runner.executor, _SimplePythonExecutor)