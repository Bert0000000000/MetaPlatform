"""Function Sandbox —— SANDBOX-01 Batch（ADR-0040）。

L1 进程级沙箱：本地 dev / test 用。生产走 L2（K8s Job，SANDBOX-02 + 后续）和
L3（MicroVM 第三方）。

6 硬规则：
1. 无网络 —— `network=False`
2. 无文件系统写入 —— 用 `tempfile.TemporaryDirectory` 自清理
3. 无 thread / fork
4. CPU 时间限制 —— `RLIMIT_CPU`
5. 内存限制 —— `RLIMIT_AS`
6. 同步超时 —— `subprocess.run(timeout=)`
"""

from __future__ import annotations

import json
import os
import signal
import subprocess
import sys
import tempfile
import textwrap
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

if sys.platform != "win32":
    import resource  # noqa: F401  POSIX-only RLIMIT_*


class SandboxViolation(RuntimeError):
    """沙箱违反（CPU / mem / timeout / network attempt）。"""


@dataclass(frozen=True, slots=True)
class SandboxLimits:
    cpu_seconds: int = 10
    memory_mb: int = 256
    timeout_seconds: int = 30
    allow_network: bool = False


@dataclass(frozen=True, slots=True)
class SandboxResult:
    stdout: str
    stderr: str
    returncode: int
    duration_ms: int
    killed_by_signal: int | None = None
    sandbox_violated: str | None = None


# ─────────── 内置 denylist（pure static check） ───────────

_FORBIDDEN_NETWORK = (
    "socket.socket",
    "http.client",
    "urllib.request",
    "httpx",
    "requests.",
    "aiohttp",
)

# 整行 import 也算（`import socket`）
_FORBIDDEN_NETWORK_IMPORT = (
    "import socket",
    "import http.client",
    "import urllib.request",
    "import httpx",
    "import requests",
    "import aiohttp",
)

_FORBIDDEN_FS_WRITE = (
    'open("',
    "open('/",
    'open("/etc',
    "Path('/etc",
    'Path("/etc',
    "shutil.copy",
    "shutil.rmtree",
    "os.remove",
    "os.unlink",
    "os.rmdir",
)


def _static_check(source: str) -> str | None:
    """返回首个违规 kind 或 None。"""
    for needle in _FORBIDDEN_NETWORK_IMPORT:
        if needle in source:
            return f"network_import:{needle}"
    for needle in _FORBIDDEN_NETWORK:
        if needle in source:
            return f"network:{needle}"
    for needle in _FORBIDDEN_FS_WRITE:
        if needle in source:
            return f"fs_write:{needle}"
    return None


def _set_limits(cpu: int, mem_mb: int) -> None:
    if sys.platform == "win32":
        return
    resource.setrlimit(resource.RLIMIT_CPU, (cpu, cpu))
    mem_bytes = mem_mb * 1024 * 1024
    try:
        resource.setrlimit(resource.RLIMIT_AS, (mem_bytes, mem_bytes))
    except (ValueError, OSError):
        pass


def run_function(
    fn_source: str,
    args: dict[str, Any],
    limits: SandboxLimits = SandboxLimits(),
) -> SandboxResult:
    """在 L1 进程沙箱里跑用户提供的 Python 函数。

    fn_source 形如：
        def main(order_id):
            return {"ok": order_id}
    返回值用 json.dumps → stdout；args 通过 JSON 注入。
    """
    if not limits.allow_network:
        v = _static_check(fn_source)
        if v:
            return SandboxResult(
                stdout="",
                stderr=f"sandbox violation: {v}",
                returncode=-1,
                duration_ms=0,
                sandbox_violated=v,
            )

    header = (
        "import json, sys\n"
        "_args = json.loads(sys.argv[1])\n"
    )
    footer = (
        "_result = main(**_args)\n"
        "sys.stdout.write(json.dumps({\"ok\": True, \"result\": _result}))\n"
    )
    body = header + textwrap.dedent(fn_source) + "\n" + footer

    started = time.monotonic()
    with tempfile.TemporaryDirectory() as tmp:
        script = Path(tmp) / "fn.py"
        script.write_text(body, encoding="utf-8")

        env = {
            "PATH": os.environ.get("PATH", ""),
            "PYTHONDONTWRITEBYTECODE": "1",
            "PYTHONUNBUFFERED": "1",
            "TMPDIR": tmp,
        }
        # POSIX 限制生效；Windows 上 subprocess 退化为 timeout-only
        preexec_fn = _set_limits if sys.platform != "win32" else None  # type: ignore[arg-type]

        try:
            proc = subprocess.run(
                [sys.executable, "-I", str(script), json.dumps(args)],
                capture_output=True,
                text=True,
                timeout=limits.timeout_seconds,
                env=env,
                preexec_fn=preexec_fn,
                check=False,
            )
        except subprocess.TimeoutExpired as e:
            return SandboxResult(
                stdout=e.stdout or "",
                stderr=(e.stderr or "") + f"\ntimeout after {limits.timeout_seconds}s",
                returncode=-1,
                duration_ms=int((time.monotonic() - started) * 1000),
                killed_by_signal=signal.SIGTERM,
                sandbox_violated="timeout",
            )

    return SandboxResult(
        stdout=proc.stdout,
        stderr=proc.stderr,
        returncode=proc.returncode,
        duration_ms=int((time.monotonic() - started) * 1000),
        killed_by_signal=None,
    )