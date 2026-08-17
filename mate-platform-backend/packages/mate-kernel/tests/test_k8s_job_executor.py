"""MP-SAL-03: K8sJobExecutor —— L2 沙箱真接（ADR-0040 §2.5.2 收口）。

manifest 渲染正确性 + fake-kubectl 全生命周期（apply→wait→logs→delete）
+ 失败路径 + dev 双轨开关。真集群执行门控用例（SANDBOX_K8S_TEST=1 且
kubectl 可用时才跑）。
"""

from __future__ import annotations

import json
from typing import Any

from mate_kernel.sandbox.k8s import (
    K8sJobExecutor,
    K8sSandboxRunner,
    K8sSandboxSpec,
    NetworkPolicy,
    ResourceLimits,
)


class _FakeProc:
    def __init__(self, returncode: int = 0, stdout: str = "", stderr: str = "") -> None:
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr


class _FakeKubectl:
    """按序记录调用；可编排每步返回。"""

    def __init__(self, steps: list[_FakeProc] | None = None) -> None:
        self.calls: list[tuple[str, ...]] = []
        self._steps = steps or []

    def __call__(self, cmd: list[str], **kw: Any) -> _FakeProc:
        self.calls.append(tuple(cmd))
        if self._steps:
            return self._steps.pop(0)
        return _FakeProc(stdout="{}")


def _spec() -> K8sSandboxSpec:
    return K8sSandboxSpec(
        function_ref="ont.t.fn.flag.v1",
        function_source="def main(t, p):\n    return p\n",
        arguments=("target", {"a": 1}),
        resource_limits=ResourceLimits(cpu_millicores=250, memory_mb=128, timeout_seconds=30),
        network_policy=NetworkPolicy(egress_allow_cidrs=("10.0.0.0/8",)),
    )


class TestManifest:
    def test_resources_and_deadline_mapped(self) -> None:
        ex = K8sJobExecutor()
        m = ex.render_job_manifest(_spec(), "job-x")
        tpl = m["spec"]["template"]["spec"]
        c = tpl["containers"][0]
        assert m["spec"]["activeDeadlineSeconds"] == 30
        assert m["spec"]["backoffLimit"] == 0
        assert tpl["restartPolicy"] == "Never"
        assert tpl["serviceAccountName"] == "sandbox-runner"
        assert c["resources"]["limits"]["cpu"] == "250m"
        assert c["resources"]["limits"]["memory"] == "128Mi"
        assert c["resources"]["limits"]["ephemeral-storage"] == "256Mi"
        assert m["metadata"]["namespace"] == "mate-sandbox"

    def test_egress_annotation_carries_network_policy(self) -> None:
        ex = K8sJobExecutor()
        m = ex.render_job_manifest(_spec(), "job-x")
        ann = m["spec"]["template"]["metadata"]["annotations"]
        assert ann["mate.metaplatform/egress-allow"] == "10.0.0.0/8"

    def test_source_inlined_in_driver(self) -> None:
        ex = K8sJobExecutor()
        m = ex.render_job_manifest(_spec(), "job-x")
        driver = m["spec"]["template"]["spec"]["containers"][0]["command"][2]
        assert "def main(t, p):" in driver


class TestLifecycle:
    def test_success_path_apply_wait_logs_delete(self) -> None:
        k = _FakeKubectl([
            _FakeProc(stdout="job.apps/sandbox-fn-x created"),
            _FakeProc(stdout="job.batch/sandbox-fn-x condition met"),
            _FakeProc(stdout='{"ok": 1}', stderr=""),
            _FakeProc(stdout="job.batch sandbox-fn-x deleted"),
        ])
        ex = K8sJobExecutor(_runner=k)
        rc, out, _err = ex.execute(_spec().function_source, _spec().arguments)
        assert rc == 0
        assert out == '{"ok": 1}'
        # 调用序列：apply → wait → logs → delete
        flat = [" ".join(c) for c in k.calls]
        assert any("apply" in f for f in flat)
        assert any("wait" in f for f in flat)
        assert any("logs" in f for f in flat)
        assert any("delete" in f for f in flat)
        assert flat.index(next(f for f in flat if "wait" in f)) < flat.index(
            next(f for f in flat if "logs" in f),
        )

    def test_apply_failure_returns_error_without_wait(self) -> None:
        k = _FakeKubectl([
            _FakeProc(returncode=1, stderr="namespace not found"),
        ])
        ex = K8sJobExecutor(_runner=k)
        rc, out, err = ex.execute("def main():\n    return 1", ())
        assert rc == 1
        assert "kubectl apply failed" in err

    def test_job_failed_path_returns_logs_and_reason(self) -> None:
        k = _FakeKubectl([
            _FakeProc(stdout="created"),
            _FakeProc(returncode=1, stderr="Error from server: timeout"),
            _FakeProc(stdout="Traceback...", stderr="boom"),
        ])
        ex = K8sJobExecutor(_runner=k)
        rc, out, err = ex.execute("def main():\n    raise RuntimeError()", ())
        assert rc == 1
        assert "job failed" in err
        assert "Traceback" in out


class TestBackendSwitch:
    def test_k8s_backend_selects_k8s_executor(self) -> None:
        runner = K8sSandboxRunner(backend="k8s")
        assert isinstance(runner.executor, K8sJobExecutor)

    def test_default_remains_subprocess_dev_dual_track(self) -> None:
        from mate_kernel.sandbox.k8s import SubprocessExecutor  # noqa: PLC0415
        runner = K8sSandboxRunner(backend=None)
        assert isinstance(runner.executor, SubprocessExecutor)


class TestManifestJsonSerializable:
    def test_manifest_roundtrip(self) -> None:
        ex = K8sJobExecutor()
        m = ex.render_job_manifest(_spec(), "job-x")
        assert json.loads(json.dumps(m))["metadata"]["name"] == "job-x"
