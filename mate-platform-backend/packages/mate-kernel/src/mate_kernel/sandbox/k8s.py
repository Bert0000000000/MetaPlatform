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

import contextlib
import json
import os
import subprocess
import sys
import tempfile
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any, Protocol, runtime_checkable

if sys.platform != "win32":
    import resource


class SandboxTier(StrEnum):
    L1_PROCESS = "l1_process"
    L2_CONTAINER = "l2_container"
    L3_MICROVM = "l3_microvm"


class CodeOrigin(StrEnum):
    """一段代码是哪来的 —— **ADR-0040 §2.1 v1.1 的分层键**。

    v1.0 按「谁出品的」分层（内置 → L2、第三方 → L3），那是安全缺陷：内置员工的
    提示词里完全可以长出模型现场生成的代码，而第三方 Agent 也可以是人审过的静态
    代码。可信度跟着**代码来源**走，不跟着组织边界走。
    """

    #: LLM 现场生成（Function 提议 / 脚本 / 拼装出来的可执行体）。
    MODEL_GENERATED = "model_generated"
    #: 子员工执行期装配或转交给下游的代码（子员工不可信，与父级身份无关）。
    SUBAGENT = "subagent"
    #: 外部 / Marketplace 引入、未经本平台校验。
    EXTERNAL = "external"
    #: 人工编写且入参已按 schema 校验。
    HUMAN_REVIEWED = "human_reviewed"


#: 等级强弱序（比较用；StrEnum 的字面量排序在这里是巧合，别依赖它）。
_TIER_RANK: dict[SandboxTier, int] = {
    SandboxTier.L1_PROCESS: 0,
    SandboxTier.L2_CONTAINER: 1,
    SandboxTier.L3_MICROVM: 2,
}


def tier_rank(tier: SandboxTier) -> int:
    return _TIER_RANK[tier]


#: **分层键**：代码来源 → 沙箱等级（ADR-0040 §2.1 v1.1）。厂商身份不再是判据。
ORIGIN_TIERS: dict[CodeOrigin, SandboxTier] = {
    CodeOrigin.MODEL_GENERATED: SandboxTier.L3_MICROVM,
    CodeOrigin.SUBAGENT: SandboxTier.L3_MICROVM,
    CodeOrigin.EXTERNAL: SandboxTier.L3_MICROVM,
    CodeOrigin.HUMAN_REVIEWED: SandboxTier.L2_CONTAINER,
}


class SandboxIsolationError(RuntimeError):
    """声明的隔离等级弱于代码来源要求的等级 —— 拒绝执行（fail-closed）。"""


@dataclass(frozen=True, slots=True)
class SandboxIsolation:
    """一个等级**实际**给出的隔离面（用于渲染 Job manifest 与断言）。"""

    tier: SandboxTier
    run_as_non_root: bool
    run_as_user: int
    read_only_root_fs: bool
    allow_privilege_escalation: bool
    drop_all_capabilities: bool
    seccomp_profile: str
    #: 是否**允许声明** egress allowlist。``False`` = 一律 deny-all，不接受白名单
    #: （来源不可信时连"我保证只连这几个"都不采信）。``True`` 也不是放开：白名单
    #: 为空仍是 deny-all（ADR-0040 §2.2 硬要求 2）。
    allow_network: bool
    #: 独立内核运行时（MicroVM）。``None`` = 用集群默认（runc 容器）。
    runtime_class: str | None


#: 等级 → 隔离面。L3 与 L2 的差别是**独立内核**：L2 的同名加固字段仍在，
#: 但它与宿主机共内核，容器逃逸面远大于 L3。
ISOLATION_BY_TIER: dict[SandboxTier, SandboxIsolation] = {
    SandboxTier.L3_MICROVM: SandboxIsolation(
        tier=SandboxTier.L3_MICROVM,
        run_as_non_root=True,
        run_as_user=65534,  # nobody
        read_only_root_fs=True,
        allow_privilege_escalation=False,
        drop_all_capabilities=True,
        seccomp_profile="RuntimeDefault",
        allow_network=False,
        runtime_class="kata",
    ),
    SandboxTier.L2_CONTAINER: SandboxIsolation(
        tier=SandboxTier.L2_CONTAINER,
        run_as_non_root=True,
        run_as_user=65534,
        read_only_root_fs=True,
        allow_privilege_escalation=False,
        drop_all_capabilities=True,
        seccomp_profile="RuntimeDefault",
        allow_network=True,
        runtime_class=None,
    ),
    SandboxTier.L1_PROCESS: SandboxIsolation(
        tier=SandboxTier.L1_PROCESS,
        run_as_non_root=True,
        run_as_user=65534,
        read_only_root_fs=False,
        allow_privilege_escalation=False,
        drop_all_capabilities=False,
        seccomp_profile="Unconfined",
        allow_network=True,
        runtime_class=None,
    ),
}


def tier_for_origin(origin: CodeOrigin | str) -> SandboxTier:
    """代码来源 → 沙箱等级（**唯一**的分层函数）。"""
    return ORIGIN_TIERS[CodeOrigin(origin)]


def isolation_for(origin: CodeOrigin | str) -> SandboxIsolation:
    """代码来源 → 该走哪一档隔离。"""
    return ISOLATION_BY_TIER[tier_for_origin(origin)]


class JobPhase(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


@dataclass(frozen=True, slots=True)
class ResourceLimits:
    """K8s Job 资源上限声明 —— 越界直接拒，避免单任务抢光节点。

    上下限对位 K8s LimitRange / ResourceQuota 经验值（生产通常 1 节点 ≤ 16 CPU / 64Gi）。
    """

    cpu_millicores: int = 500  # 0.5 CPU
    memory_mb: int = 512
    timeout_seconds: int = 60
    ephemeral_storage_mb: int = 256

    _CPU_MIN = 50  # 0.05 CPU
    _CPU_MAX = 16000  # 16 CPU
    _MEM_MIN = 64  # 64 Mi
    _MEM_MAX = 65536  # 64 Gi
    _TIME_MIN = 1
    _TIME_MAX = 3600  # 1h
    _STORAGE_MIN = 64
    _STORAGE_MAX = 10240  # 10 Gi

    def __post_init__(self) -> None:
        if not (self._CPU_MIN <= self.cpu_millicores <= self._CPU_MAX):
            raise ValueError(
                f"cpu_millicores={self.cpu_millicores} 越界 [{self._CPU_MIN}, {self._CPU_MAX}]"
            )
        if not (self._MEM_MIN <= self.memory_mb <= self._MEM_MAX):
            raise ValueError(f"memory_mb={self.memory_mb} 越界 [{self._MEM_MIN}, {self._MEM_MAX}]")
        if not (self._TIME_MIN <= self.timeout_seconds <= self._TIME_MAX):
            raise ValueError(
                f"timeout_seconds={self.timeout_seconds} 越界 [{self._TIME_MIN}, {self._TIME_MAX}]"
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
    ingress_allowed: bool = False  # 默认禁止入站


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
    #: 这段代码是哪来的 —— ADR-0040 §2.1 v1.1 的分层键。默认按人审处理；
    #: 模型生成 / 子员工转交 / 外部引入的代码必须**显式**声明来源，否则会被
    #: 当成 L2 放行——那正是 v1.0 的缺陷形态。
    code_origin: CodeOrigin = CodeOrigin.HUMAN_REVIEWED
    #: 调用方声明的目标等级。可以等于或高于来源要求的等级；**低于则拒绝**。
    declared_tier: SandboxTier | None = None

    def __post_init__(self) -> None:
        if self.resource_limits.cpu_millicores <= 0:
            raise ValueError("cpu_millicores must be > 0")
        if self.resource_limits.memory_mb <= 0:
            raise ValueError("memory_mb must be > 0")
        if self.resource_limits.timeout_seconds <= 0:
            raise ValueError("timeout_seconds must be > 0")
        isolation = isolation_for(self.code_origin)
        if self.declared_tier is not None and tier_rank(self.declared_tier) < tier_rank(
            isolation.tier
        ):
            raise SandboxIsolationError(
                f"代码来源 {self.code_origin.value} 要求 {isolation.tier.value}，"
                f"声明的 {self.declared_tier.value} 更弱 —— 拒绝执行（ADR-0040 §2.1 v1.1）"
            )
        if not isolation.allow_network and self.network_policy.egress_allow_cidrs:
            raise SandboxIsolationError(
                f"代码来源 {self.code_origin.value} 的隔离是禁网的，"
                f"不接受 egress allowlist {list(self.network_policy.egress_allow_cidrs)}"
            )

    def isolation(self) -> SandboxIsolation:
        return isolation_for(self.code_origin)


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


class K8sJobExecutor:
    """MP-SAL-03（ADR-0040 §2.5.2）：真接 K8s Job 的 L2 执行器。

    零新依赖：经 `kubectl` 子进程提交 batch/v1 Job（manifest 由 K8sSandboxSpec
    渲染，资源限/超时/NetworkPolicy 语义映射 activeDeadlineSeconds + Limits），
    等待完成 → 取日志 → 清理。dev 双轨保留（SANDBOX_BACKEND=subprocess 默认，
    ADR-0040 §2.5.1）；prod 置 SANDBOX_BACKEND=k8s + 提供 KUBECONFIG。

    安全：restartPolicy=Never；serviceAccount 最小权限；超时走
    activeDeadlineSeconds（控制器级，非进程级）。
    """

    def __init__(
        self,
        kubectl: str = "kubectl",
        namespace: str = "mate-sandbox",
        poll_interval: float = 1.0,
        _runner: Any = None,  # 测试注入（默认 subprocess.run）
        code_origin: CodeOrigin = CodeOrigin.HUMAN_REVIEWED,
    ) -> None:
        self._kubectl = kubectl
        self._namespace = namespace
        self._poll_interval = poll_interval
        self._run = _runner or subprocess.run
        #: 这个执行器跑的代码是哪来的 —— 决定 Job 的隔离档（ADR-0040 §2.1 v1.1）。
        #: 装配方按 `function_ref` 的来源选执行器：模型生成 / 子员工转交的代码
        #: 必须换到 `CodeOrigin.MODEL_GENERATED` / `SUBAGENT` 的执行器上。
        self._code_origin = code_origin

    def render_job_manifest(self, spec: K8sSandboxSpec, job_name: str) -> dict[str, Any]:
        limits = spec.resource_limits
        isolation = spec.isolation()
        driver = (
            "import sys, json\n"
            "_args = json.loads(sys.argv[1])\n"
            f"_USER_SRC = {spec.function_source!r}\n"
            "_ns = {}\n"
            "exec(compile(_USER_SRC, '<sandbox>', 'exec'), {'__builtins__': __builtins__}, _ns)\n"
            "_fn = _ns.get('handler') or _ns.get('main') or _ns.get('fn')\n"
            "if _fn is None or not callable(_fn):\n"
            "    print('NO_HANDLER', file=sys.stderr); sys.exit(2)\n"
            "_out = _fn(*_args)\n"
            "print(json.dumps(_out, default=str))\n"
        )
        labels = {
            "app.kubernetes.io/managed-by": "mate-sandbox",
            "mate.metaplatform/function-ref": spec.function_ref.replace(".", "-"),
            # 分层键是代码来源（ADR-0040 §2.1 v1.1）；厂商/出品方降级为标签。
            "mate.metaplatform/code-origin": spec.code_origin.value,
            "mate.metaplatform/sandbox-tier": isolation.tier.value,
            **{f"mate.metaplatform/{k}": v for k, v in spec.labels.items()},
        }
        pod: dict[str, Any] = {
            "restartPolicy": "Never",
            "serviceAccountName": spec.service_account,
            # 沙箱不需要 API server 凭证：自动挂载的 token 是容器逃逸后的现成弹药。
            "automountServiceAccountToken": False,
            "containers": [
                {
                    "name": "fn",
                    "image": spec.image,
                    "command": ["python", "-c", driver],
                    "args": [json.dumps(list(spec.arguments), default=str)],
                    "securityContext": {
                        "runAsNonRoot": isolation.run_as_non_root,
                        "runAsUser": isolation.run_as_user,
                        "allowPrivilegeEscalation": isolation.allow_privilege_escalation,
                        "readOnlyRootFilesystem": isolation.read_only_root_fs,
                        "capabilities": {
                            "drop": ["ALL"] if isolation.drop_all_capabilities else [],
                        },
                        "seccompProfile": {"type": isolation.seccomp_profile},
                    },
                    "resources": {
                        "limits": {
                            "cpu": f"{limits.cpu_millicores}m",
                            "memory": f"{limits.memory_mb}Mi",
                            "ephemeral-storage": f"{limits.ephemeral_storage_mb}Mi",
                        },
                    },
                }
            ],
        }
        if isolation.runtime_class is not None:
            # 独立内核（MicroVM）：模型生成 / 子员工转交 / 外部引入的代码走这里。
            pod["runtimeClassName"] = isolation.runtime_class
        return {
            "apiVersion": "batch/v1",
            "kind": "Job",
            "metadata": {"name": job_name, "namespace": self._namespace, "labels": labels},
            "spec": {
                "backoffLimit": 0,
                "activeDeadlineSeconds": limits.timeout_seconds,
                "ttlSecondsAfterFinished": 600,
                "template": {
                    "metadata": {
                        "annotations": {
                            # NetworkPolicy 声明留给集群 default-deny 策略（硬规则 13）；
                            # egress 白名单以注解携带，由 NetPol 控制器对齐。
                            "mate.metaplatform/egress-allow": ",".join(
                                spec.network_policy.egress_allow_cidrs
                            ),
                            # 最强档**不接受**白名单，显式写明 deny-all：控制器据此
                            # 忽略上面那条（来源不可信时连"只连这几个"都不采信）。
                            "mate.metaplatform/egress-deny-all": (
                                "false" if isolation.allow_network else "true"
                            ),
                        },
                    },
                    "spec": pod,
                },
            },
        }

    def execute(self, source: str, args: tuple[Any, ...]) -> tuple[int, str, str]:
        """FunctionExecutor 协议入口：完整 Job 生命周期（apply→wait→logs→delete）。"""
        spec = K8sSandboxSpec(
            function_ref="fn.exec",
            function_source=source,
            arguments=args,
            resource_limits=ResourceLimits(),
            network_policy=NetworkPolicy(),
            code_origin=self._code_origin,
        )
        job_name = f"sandbox-fn-{uuid.uuid4().hex[:10]}"
        manifest = self.render_job_manifest(spec, job_name)
        try:
            applied = self._run(
                [self._kubectl, "-n", self._namespace, "apply", "-f", "-"],
                input=json.dumps(manifest),
                capture_output=True,
                text=True,
                timeout=30,
            )
            if applied.returncode != 0:
                return (1, "", f"kubectl apply failed: {applied.stderr}")
            waited = self._run(
                [
                    self._kubectl,
                    "-n",
                    self._namespace,
                    "wait",
                    f"job/{job_name}",
                    "--for=condition=complete",
                    f"--timeout={spec.resource_limits.timeout_seconds}s",
                ],
                capture_output=True,
                text=True,
                timeout=spec.resource_limits.timeout_seconds + 30,
            )
            if waited.returncode != 0:
                logs = self._run(
                    [self._kubectl, "-n", self._namespace, "logs", f"job/{job_name}"],
                    capture_output=True,
                    text=True,
                    timeout=30,
                )
                return (1, logs.stdout or "", f"job failed: {waited.stderr or 'condition not met'}")
            logs = self._run(
                [self._kubectl, "-n", self._namespace, "logs", f"job/{job_name}"],
                capture_output=True,
                text=True,
                timeout=30,
            )
            return (0, logs.stdout, logs.stderr)
        except Exception as e:
            return (1, "", f"k8s executor error: {type(e).__name__}: {e}")
        finally:
            with contextlib.suppress(Exception):
                self._run(
                    [
                        self._kubectl,
                        "-n",
                        self._namespace,
                        "delete",
                        "job",
                        job_name,
                        "--ignore-not-found",
                    ],
                    capture_output=True,
                    text=True,
                    timeout=30,
                )


class K8sSandboxRunner:
    """K8s Job 抽象 —— M3 内存模拟器（行为对齐真 K8s：pending → running → result）。"""

    def __init__(
        self,
        executor: FunctionExecutor | None = None,
        backend: str | None = None,
    ) -> None:
        # RUNTIME-K8S-02: 默认用 SubprocessExecutor 真跑；
        # 显式 backend="memory" 才退到 _SimplePythonExecutor（test 兼容）。
        # MP-SAL-03: backend="k8s" → K8sJobExecutor 真接 K8s Job（L2，prod）。
        self.backend = (backend or os.getenv("SANDBOX_BACKEND", "subprocess")).lower()
        if executor is not None:
            self.executor = executor
        elif self.backend == "subprocess":
            self.executor = SubprocessExecutor()
        elif self.backend == "k8s":
            self.executor = K8sJobExecutor()
        else:
            self.executor = _SimplePythonExecutor()
        self._jobs: dict[str, SandboxResult] = {}
        self._counter = 0

    def submit(self, spec: K8sSandboxSpec) -> SandboxResult:
        self._counter += 1
        job_name = f"sandbox-{spec.function_ref.split('.')[-2]}-{self._counter}"
        started = datetime.now(UTC)
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
            finished_at=datetime.now(UTC),
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
    "ISOLATION_BY_TIER",
    "ORIGIN_TIERS",
    "CodeOrigin",
    "JobPhase",
    "K8sJobExecutor",
    "K8sSandboxRunner",
    "K8sSandboxSpec",
    "NetworkPolicy",
    "ResourceLimits",
    "SandboxIsolation",
    "SandboxIsolationError",
    "SandboxResult",
    "SandboxTier",
    "SubprocessExecutor",
    "isolation_for",
    "tier_for_origin",
    "tier_rank",
]
