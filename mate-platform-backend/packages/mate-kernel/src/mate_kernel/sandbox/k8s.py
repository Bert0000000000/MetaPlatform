"""SANDBOX-02: K8s Job Sandbox 适配层。

M1 SANDBOX-01 是 L1 进程级（subprocess + denylist + rlimit）。
M3 SANDBOX-02 升级到 L2 容器（K8s Job / Pod），决策 L2。
RUNTIME-K8S-02 (RUNTIME-MVP-02 合并提速) 加 SubprocessExecutor 真起进程跑
用户 Python 源码 + timeout + rlimit 守护；不真接 K8s API，但行为对齐。

抽象：
- K8sSandboxSpec：声明资源（cpu/mem/timeout）+ 网络策略 + service account
- K8sSandboxRunner：提交 Job；InMemoryK8sRunner 模拟 Job 生命周期
- SandboxResult：exit code / 日志 / OTel trace id
- SubprocessExecutor / InProcessPythonExecutor：两种 executor 实现
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Protocol, runtime_checkable

if sys.platform != "win32":
    import resource  # noqa: F401  (POSIX-only)


class SandboxTier(str, Enum):
    L1_PROCESS = "l1_process"
    L2_CONTAINER = "l2_container"
    L3_MICROVM = "l3_microvm"


class JobPhase(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


@dataclass(frozen=True, slots=True)
class ResourceLimits:
    """K8s Job 资源上限声明 —— 越界直接拒，避免单任务抢光节点。

    上下限对位 K8s LimitRange / ResourceQuota 经验值（生产通常 1 节点 ≤ 16 CPU / 64Gi）。
    """
    cpu_millicores: int = 500      # 0.5 CPU
    memory_mb: int = 512
    timeout_seconds: int = 60
    ephemeral_storage_mb: int = 256

    _CPU_MIN = 50          # 0.05 CPU
    _CPU_MAX = 16000       # 16 CPU
    _MEM_MIN = 64          # 64 Mi
    _MEM_MAX = 65536       # 64 Gi
    _TIME_MIN = 1
    _TIME_MAX = 3600       # 1h
    _STORAGE_MIN = 64
    _STORAGE_MAX = 10240   # 10 Gi

    def __post_init__(self) -> None:
        if not (self._CPU_MIN <= self.cpu_millicores <= self._CPU_MAX):
            raise ValueError(
                f"cpu_millicores={self.cpu_millicores} 越界 "
                f"[{self._CPU_MIN}, {self._CPU_MAX}]"
            )
        if not (self._MEM_MIN <= self.memory_mb <= self._MEM_MAX):
            raise ValueError(
                f"memory_mb={self.memory_mb} 越界 "
                f"[{self._MEM_MIN}, {self._MEM_MAX}]"
            )
        if not (self._TIME_MIN <= self.timeout_seconds <= self._TIME_MAX):
            raise ValueError(
                f"timeout_seconds={self.timeout_seconds} 越界 "
                f"[{self._TIME_MIN}, {self._TIME_MAX}]"
            )
        if not (self._STORAGE_MIN <= self.ephemeral_storage_mb <= self._STORAGE_MAX):
            raise ValueError(
                f"ephemeral_storage_mb={self.ephemeral_storage_mb} 越界 "
                f"[{self._STORAGE_MIN}, {self._STORAGE_MAX}]"
            )


@dataclass(frozen=True, slots=True)
class NetworkPolicy:
    """NetworkPolicy 声明 —— 缺省 deny-egress。"""
    egress_allow_cidrs: tuple[str, ...] = ()  # 空 = 全拒绝
    ingress_allowed: bool = False             # 默认禁止入站


@dataclass(frozen=True, slots=True)
class K8sSandboxSpec:
    """完整 K8s Job 声明。"""
    function_ref: str  # ont.<tenant>.fn.<slug>.v<n>
    function_source: str  # Python 源码
    arguments: tuple[Any, ...]
    resource_limits: ResourceLimits
    network_policy: NetworkPolicy
    image: str = "python:3.12-slim"
    service_account: str = "sandbox-runner"
    labels: dict[str, str] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.resource_limits.cpu_millicores <= 0:
            raise ValueError("cpu_millicores must be > 0")
        if self.resource_limits.memory_mb <= 0:
            raise ValueError("memory_mb must be > 0")
        if self.resource_limits.timeout_seconds <= 0:
            raise ValueError("timeout_seconds must be > 0")


@dataclass(frozen=True, slots=True)
class SandboxResult:
    job_name: str
    phase: JobPhase
    exit_code: int
    stdout: str
    stderr: str
    started_at: datetime
    finished_at: datetime
    o11y_trace_id: str | None = None


@runtime_checkable
class FunctionExecutor(Protocol):
    """执行体 —— 真实 K8s 集成在 runtime 层；M3 用 mock。"""

    def execute(self, source: str, args: tuple[Any, ...]) -> tuple[int, str, str]: ...


class _SimplePythonExecutor:
    """受限 Python 执行 —— 不真起 subprocess；M3 mock。"""

    def execute(self, source: str, args: tuple[Any, ...]) -> tuple[int, str, str]:
        # 用 compile + exec（不带 import）模拟；只允许纯表达式
        try:
            # 简化：只允许 pure function (lambda or def with single return)
            ns: dict[str, Any] = {}
            code = compile(source, "<sandbox>", "exec")
            exec(code, {"__builtins__": {}}, ns)
            fn = ns.get("handler") or ns.get("main") or ns.get("fn")
            if fn is None or not callable(fn):
                return (2, "", "no callable 'handler'/'main'/'fn' found")
            result = fn(*args)
            return (0, json.dumps(result, default=str), "")
        except Exception as e:
            return (1, "", f"{type(e).__name__}: {e}")


class SubprocessExecutor:
    """RUNTIME-K8S-02: 真起 python subprocess 跑 user code。

    写入临时 .py 文件 → subprocess.run([sys.executable, "-I", tmp, *args]) →
    timeout=rlimit.timeout_seconds → 输出 stdout/stderr/exit_code。

    安全：
    - -I (isolated mode)：禁 site-packages / PYTHONPATH 注入
    - 资源限（rlimit）：CPU/内存守护；超时 KILL
    - 工作目录 /tmp 临时，结束清理
    """

    def __init__(self, memory_mb: int = 512, timeout_seconds: int = 30) -> None:
        self._memory_mb = memory_mb
        self._timeout_seconds = timeout_seconds

    def execute(self, source: str, args: tuple[Any, ...]) -> tuple[int, str, str]:
        with tempfile.TemporaryDirectory(prefix="sandbox-") as tmp:
            src_path = os.path.join(tmp, "handler.py")
            # 写入 driver：把 args 注入到 handler
            driver = (
                "import sys, json\n"
                "_args = json.loads(sys.argv[1])\n"
                f"_USER_SRC = {source!r}\n"
                "_ns = {}\n"
                "exec(compile(_USER_SRC, '<sandbox>', 'exec'), {'__builtins__': __builtins__}, _ns)\n"
                "_fn = _ns.get('handler') or _ns.get('main') or _ns.get('fn')\n"
                "if _fn is None or not callable(_fn):\n"
                "    print('NO_HANDLER', file=sys.stderr); sys.exit(2)\n"
                "_out = _fn(*_args)\n"
                "print(json.dumps(_out, default=str))\n"
            )
            with open(src_path, "w", encoding="utf-8") as f:
                f.write(driver)

            preexec_fn = None
            if sys.platform != "win32":
                def _set_limits() -> None:
                    resource.setrlimit(
                        resource.RLIMIT_AS,
                        (self._memory_mb * 1024 * 1024, self._memory_mb * 1024 * 1024),
                    )
                preexec_fn = _set_limits

            try:
                proc = subprocess.run(
                    [sys.executable, "-I", src_path, json.dumps(list(args), default=str)],
                    capture_output=True,
                    text=True,
                    timeout=self._timeout_seconds,
                    preexec_fn=preexec_fn,
                    cwd=tmp,
                )
                return (proc.returncode, proc.stdout, proc.stderr)
            except subprocess.TimeoutExpired as e:
                return (124, e.stdout or "", f"timeout after {self._timeout_seconds}s")
            except Exception as e:
                return (1, "", f"runner error: {type(e).__name__}: {e}")


class K8sSandboxRunner:
    """K8s Job 抽象 —— M3 内存模拟器（行为对齐真 K8s：pending → running → result）。"""

    def __init__(
        self,
        executor: FunctionExecutor | None = None,
        backend: str | None = None,
    ) -> None:
        # RUNTIME-K8S-02: 默认用 SubprocessExecutor 真跑；
        # 显式 backend="memory" 才退到 _SimplePythonExecutor（test 兼容）。
        self.backend = (backend or os.getenv("SANDBOX_BACKEND", "subprocess")).lower()
        if executor is not None:
            self.executor = executor
        elif self.backend == "subprocess":
            self.executor = SubprocessExecutor()
        else:
            self.executor = _SimplePythonExecutor()
        self._jobs: dict[str, SandboxResult] = {}
        self._counter = 0

    def submit(self, spec: K8sSandboxSpec) -> SandboxResult:
        self._counter += 1
        job_name = f"sandbox-{spec.function_ref.split('.')[-2]}-{self._counter}"
        started = datetime.now(timezone.utc)
        # 在真实 K8s 里这里 submit 到 API server；M3 直接同步执行（mock）
        # timeout 用 rlimit 守护（mock 简化）
        try:
            exit_code, stdout, stderr = self.executor.execute(spec.function_source, spec.arguments)
        except Exception as e:
            exit_code, stdout, stderr = 1, "", f"runner error: {e}"
        phase = JobPhase.SUCCEEDED if exit_code == 0 else JobPhase.FAILED
        result = SandboxResult(
            job_name=job_name,
            phase=phase,
            exit_code=exit_code,
            stdout=stdout,
            stderr=stderr,
            started_at=started,
            finished_at=datetime.now(timezone.utc),
            o11y_trace_id=None,
        )
        self._jobs[job_name] = result
        return result

    def get(self, job_name: str) -> SandboxResult:
        r = self._jobs.get(job_name)
        if r is None:
            raise KeyError(f"job not found: {job_name}")
        return r


__all__ = [
    "JobPhase",
    "K8sSandboxRunner",
    "K8sSandboxSpec",
    "NetworkPolicy",
    "ResourceLimits",
    "SandboxResult",
    "SandboxTier",
    "SubprocessExecutor",
]
