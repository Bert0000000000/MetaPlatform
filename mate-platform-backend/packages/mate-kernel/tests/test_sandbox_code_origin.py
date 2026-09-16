"""1.4 任务 2 · 沙箱按**代码来源**分层（ADR-0040 §2.1 v1.1 修订）。

ADR-0040 v1.0 的分层键是「谁出品的」——内置员工 L2、Marketplace 第三方 L3。
那是安全缺陷：内置员工的提示词里完全可以长出**模型现场生成**的代码，而那正是
最不可信的一类；反过来第三方 Agent 也可以是人审过的静态代码。

v1.1 把分层键改成**代码来源**：

| 代码来源            | 等级 | 隔离                                        |
| ------------------- | ---- | ------------------------------------------- |
| ``model_generated`` | L3   | 最强（独立内核 + 非 root + 只读根 + 禁网）  |
| ``subagent``        | L3   | 同上（子员工不可信，与父级身份无关）        |
| ``external``        | L3   | 同上（v1.0 的"第三方强制 L3"由这条承接）    |
| ``human_reviewed``  | L2   | 中（容器 + rlimit + default-deny）          |

判据不是纸面：Job manifest 里必须真的带上强隔离字段，且**断言用非超级用户角色**
（``runAsNonRoot`` 且 ``runAsUser != 0``）。
"""

from __future__ import annotations

from typing import Any

import pytest

from mate_kernel.sandbox.k8s import (
    CodeOrigin,
    K8sJobExecutor,
    NetworkPolicy,
    ResourceLimits,
    SandboxIsolationError,
    SandboxTier,
    isolation_for,
    tier_for_origin,
)


def _spec(
    *,
    origin: CodeOrigin | None = None,
    source: str = "def main():\n    return 1\n",
    declared_tier: SandboxTier | None = None,
    egress: tuple[str, ...] = (),
) -> Any:
    from mate_kernel.sandbox.k8s import K8sSandboxSpec

    kwargs: dict[str, Any] = {
        "function_ref": "ont.acme.fn.x.v1",
        "function_source": source,
        "arguments": (),
        "resource_limits": ResourceLimits(),
        "network_policy": NetworkPolicy(egress_allow_cidrs=egress),
    }
    if origin is not None:
        kwargs["code_origin"] = origin
    if declared_tier is not None:
        kwargs["declared_tier"] = declared_tier
    return K8sSandboxSpec(**kwargs)


# ── 分层键 = 代码来源（不是厂商）────────────────────────────────────────


def test_model_generated_code_gets_the_strongest_tier() -> None:
    assert tier_for_origin(CodeOrigin.MODEL_GENERATED) is SandboxTier.L3_MICROVM


def test_subagent_code_gets_the_strongest_tier() -> None:
    """子员工转交的代码即使来自内置员工也不可信（v1.0 缺陷的核心）。"""
    assert tier_for_origin(CodeOrigin.SUBAGENT) is SandboxTier.L3_MICROVM


def test_external_code_keeps_l3() -> None:
    assert tier_for_origin(CodeOrigin.EXTERNAL) is SandboxTier.L3_MICROVM


def test_human_reviewed_code_gets_the_medium_tier() -> None:
    assert tier_for_origin(CodeOrigin.HUMAN_REVIEWED) is SandboxTier.L2_CONTAINER


def test_origin_decides_even_when_the_vendor_looks_builtin() -> None:
    """分层键与「出品方」无关：内置出品的模型生成代码一样走最强隔离。"""
    assert isolation_for(CodeOrigin.MODEL_GENERATED).tier is SandboxTier.L3_MICROVM
    assert isolation_for(CodeOrigin.HUMAN_REVIEWED).tier is SandboxTier.L2_CONTAINER


# ── 强隔离是**真的**写进 manifest，不是纸面 ──────────────────────────────


def _manifest(spec: Any) -> dict[str, Any]:
    return K8sJobExecutor().render_job_manifest(spec, "job-x")


def test_model_generated_job_runs_with_the_strongest_isolation() -> None:
    manifest = _manifest(_spec(origin=CodeOrigin.MODEL_GENERATED))
    pod = manifest["spec"]["template"]["spec"]
    container = pod["containers"][0]
    security = container["securityContext"]

    # 非超级用户角色：不能以 root 跑，也不能提权
    assert security["runAsNonRoot"] is True
    assert security["runAsUser"] != 0
    assert security["allowPrivilegeEscalation"] is False
    # 只读根 + 能力清零 + seccomp
    assert security["readOnlyRootFilesystem"] is True
    assert security["capabilities"]["drop"] == ["ALL"]
    assert security["seccompProfile"]["type"] == "RuntimeDefault"
    # 独立内核运行时（MicroVM）+ 不自动挂服务账号 token
    assert manifest["spec"]["template"]["spec"]["runtimeClassName"] == "kata"
    assert pod["automountServiceAccountToken"] is False


def test_subagent_job_also_gets_the_strongest_isolation() -> None:
    manifest = _manifest(_spec(origin=CodeOrigin.SUBAGENT))
    assert manifest["spec"]["template"]["spec"]["runtimeClassName"] == "kata"


def test_human_reviewed_job_is_medium_isolation() -> None:
    manifest = _manifest(_spec(origin=CodeOrigin.HUMAN_REVIEWED))
    pod = manifest["spec"]["template"]["spec"]
    security = pod["containers"][0]["securityContext"]
    # 中档也非 root，但**不**上 MicroVM 运行时
    assert security["runAsNonRoot"] is True
    assert security["runAsUser"] != 0
    assert "runtimeClassName" not in manifest["spec"]["template"]["spec"] or (
        manifest["spec"]["template"]["spec"]["runtimeClassName"] is None
    )


def test_default_spec_is_human_reviewed() -> None:
    """默认不静默升级也不静默降级：没声明来源就按人审处理（L2）。"""
    assert tier_for_origin(_spec().code_origin) is SandboxTier.L2_CONTAINER


# ── 调用方不能降级（fail-closed）────────────────────────────────────────


def test_declaring_a_weaker_tier_than_the_origin_requires_is_rejected() -> None:
    """模型生成的代码声明成 L2 → 拒绝执行，而不是静默升级。"""
    with pytest.raises(SandboxIsolationError):
        _spec(origin=CodeOrigin.MODEL_GENERATED, declared_tier=SandboxTier.L2_CONTAINER)


def test_declaring_an_equal_or_stronger_tier_is_allowed() -> None:
    spec = _spec(origin=CodeOrigin.MODEL_GENERATED, declared_tier=SandboxTier.L3_MICROVM)
    assert spec.declared_tier is SandboxTier.L3_MICROVM


def test_generated_code_cannot_declare_network_egress() -> None:
    """最强隔离是禁网的：来源不可信时连 allowlist 都不接受。"""
    with pytest.raises(SandboxIsolationError):
        _spec(origin=CodeOrigin.MODEL_GENERATED, egress=("10.0.0.0/8",))


def test_human_reviewed_code_may_declare_an_egress_allowlist() -> None:
    spec = _spec(origin=CodeOrigin.HUMAN_REVIEWED, egress=("10.0.0.1/32",))
    assert spec.network_policy.egress_allow_cidrs == ("10.0.0.1/32",)


# ── 端到端：执行器真的把强隔离提交给了 K8s ───────────────────────────────


class _FakeProc:
    returncode = 0
    stdout = "{}"
    stderr = ""


class _RecordingKubectl:
    """记录每一条 kubectl 命令，供断言"提交上去的 manifest 长什么样"。"""

    def __init__(self) -> None:
        self.commands: list[list[str]] = []
        self.applied: dict[str, Any] | None = None

    def __call__(self, cmd, **kwargs):
        import json

        self.commands.append(list(cmd))
        if "apply" in cmd:
            self.applied = json.loads(kwargs["input"])
        return _FakeProc()


def test_executor_submits_the_strong_isolation_for_generated_code() -> None:
    """模型生成代码的执行器，提交上去的 Job 必须带 MicroVM 运行时。"""
    kubectl = _RecordingKubectl()
    executor = K8sJobExecutor(_runner=kubectl, code_origin=CodeOrigin.MODEL_GENERATED)

    executor.execute("def main():\n    return 1\n", ())

    assert kubectl.applied is not None, kubectl.commands
    pod = kubectl.applied["spec"]["template"]["spec"]
    assert pod["runtimeClassName"] == "kata"
    assert pod["automountServiceAccountToken"] is False
    assert pod["containers"][0]["securityContext"]["runAsNonRoot"] is True
    assert pod["containers"][0]["securityContext"]["runAsUser"] != 0
    annotations = kubectl.applied["spec"]["template"]["metadata"]["annotations"]
    assert annotations["mate.metaplatform/egress-deny-all"] == "true"


def test_executor_defaults_to_the_medium_tier_for_human_reviewed_code() -> None:
    kubectl = _RecordingKubectl()
    executor = K8sJobExecutor(_runner=kubectl)

    executor.execute("def main():\n    return 1\n", ())

    assert kubectl.applied is not None
    pod = kubectl.applied["spec"]["template"]["spec"]
    assert "runtimeClassName" not in pod
    assert pod["containers"][0]["securityContext"]["runAsNonRoot"] is True
