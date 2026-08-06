"""SANDBOX-02 K8s Job Sandbox 测试。"""

from __future__ import annotations

import pytest

from mate_kernel.sandbox.k8s import (
    JobPhase,
    K8sSandboxRunner,
    K8sSandboxSpec,
    NetworkPolicy,
    ResourceLimits,
    SandboxTier,
)


def _spec(
    source: str = "def handler(x):\n    return x * 2\n",
    args: tuple = (5,),
    limits: ResourceLimits | None = None,
) -> K8sSandboxSpec:
    return K8sSandboxSpec(
        function_ref="ont.acme.fn.double.v1",
        function_source=source,
        arguments=args,
        resource_limits=limits or ResourceLimits(),
        network_policy=NetworkPolicy(),
    )


class TestK8sSandboxSpec:
    def test_default_resource_limits(self) -> None:
        s = _spec()
        assert s.resource_limits.cpu_millicores == 500
        assert s.image == "python:3.12-slim"

    def test_cpu_positive(self) -> None:
        with pytest.raises(ValueError, match="cpu_millicores"):
            _spec(limits=ResourceLimits(cpu_millicores=0))

    def test_memory_positive(self) -> None:
        with pytest.raises(ValueError, match="memory_mb"):
            _spec(limits=ResourceLimits(memory_mb=0))

    def test_timeout_positive(self) -> None:
        with pytest.raises(ValueError, match="timeout_seconds"):
            _spec(limits=ResourceLimits(timeout_seconds=0))

    def test_default_network_deny_egress(self) -> None:
        s = _spec()
        assert s.network_policy.egress_allow_cidrs == ()
        assert s.network_policy.ingress_allowed is False


class TestK8sSandboxRunner:
    def _r(self) -> K8sSandboxRunner:
        return K8sSandboxRunner()

    def test_submit_ok(self) -> None:
        r = self._r().submit(_spec())
        assert r.phase == JobPhase.SUCCEEDED
        assert r.exit_code == 0
        assert "10" in r.stdout

    def test_submit_failed(self) -> None:
        r = self._r().submit(_spec(source="def handler(x):\n    return x / 0\n"))
        assert r.phase == JobPhase.FAILED
        assert "ZeroDivisionError" in r.stderr

    def test_submit_no_callable(self) -> None:
        r = self._r().submit(_spec(source="x = 1\n"))
        assert r.phase == JobPhase.FAILED
        assert "no callable" in r.stderr

    def test_get_unknown_raises(self) -> None:
        r = self._r()
        with pytest.raises(KeyError):
            r.get("missing")

    def test_submit_multiple_distinct_job_names(self) -> None:
        runner = self._r()
        r1 = runner.submit(_spec())
        r2 = runner.submit(_spec(args=(7,)))
        assert r1.job_name != r2.job_name
        assert "14" in r2.stdout


class TestSandboxTierEnum:
    def test_tiers(self) -> None:
        assert SandboxTier.L1_PROCESS.value == "l1_process"
        assert SandboxTier.L2_CONTAINER.value == "l2_container"
        assert SandboxTier.L3_MICROVM.value == "l3_microvm"


class TestResourceLimitsBounds:
    """Bug C 回归：ResourceLimits 必须有上下限校验。"""

    def test_default_valid(self) -> None:
        ResourceLimits()  # 不 raise

    def test_cpu_too_high(self) -> None:
        with pytest.raises(ValueError, match="cpu_millicores"):
            ResourceLimits(cpu_millicores=200_000)

    def test_memory_too_high(self) -> None:
        with pytest.raises(ValueError, match="memory_mb"):
            ResourceLimits(memory_mb=999_999)

    def test_timeout_too_high(self) -> None:
        with pytest.raises(ValueError, match="timeout_seconds"):
            ResourceLimits(timeout_seconds=86_400)

    def test_cpu_too_low(self) -> None:
        with pytest.raises(ValueError, match="cpu_millicores"):
            ResourceLimits(cpu_millicores=0)

    def test_max_boundary_ok(self) -> None:
        ResourceLimits(cpu_millicores=16_000, memory_mb=65_536, timeout_seconds=3600)
