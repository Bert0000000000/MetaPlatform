"""AGENT-EXT-01 External Agent 测试。"""

from __future__ import annotations

import pytest

from mate_kernel.agent.external import (
    Capability,
    ExtAgentManifest,
    ExtAgentRegistry,
    ExtProtocol,
    MockMicroVMRunner,
    SandboxTier,
)


def _manifest(
    rid: str = "ext.acme.agent.translator.v1",
    caps: tuple[Capability, ...] = (Capability(name="translate", description="EN↔ZH"),),
    sandbox: SandboxTier = SandboxTier.L3_MICROVM,
    enabled: bool = True,
) -> ExtAgentManifest:
    return ExtAgentManifest(
        agent_rid=rid,
        name="Translator",
        vendor="acme-mkt",
        protocol=ExtProtocol.HTTP,
        endpoint="http://mkt.example.com/translator",
        capabilities=caps,
        sandbox=sandbox,
        enabled=enabled,
    )


class TestExtAgentManifest:
    def test_l3_required(self) -> None:
        with pytest.raises(ValueError, match="L3_MICROVM"):
            _manifest(sandbox=SandboxTier.L2_CONTAINER)

    def test_capabilities_required(self) -> None:
        with pytest.raises(ValueError, match="non-empty"):
            _manifest(caps=())

    def test_basic(self) -> None:
        m = _manifest()
        assert m.protocol == ExtProtocol.HTTP
        assert m.sandbox == SandboxTier.L3_MICROVM


class TestMockMicroVMRunner:
    def test_register_and_run(self) -> None:
        r = MockMicroVMRunner()
        r.register("translate", lambda p: f"translated: {p['text']}")
        sid, out = r.run(_manifest(), "translate", {"text": "hello"})
        assert sid.startswith("microvm-")
        assert "hello" in out

    def test_missing_capability_raises(self) -> None:
        r = MockMicroVMRunner()
        with pytest.raises(KeyError):
            r.run(_manifest(), "nope", {})


class TestExtAgentRegistry:
    def _reg(self) -> ExtAgentRegistry:
        reg = ExtAgentRegistry()
        runner = MockMicroVMRunner()
        runner.register("translate", lambda p: f"translated: {p['text']}")
        runner.register("ocr", lambda p: f"ocr: {p['image_url']}")
        reg.runner = runner
        reg.register(_manifest(
            rid="ext.acme.agent.translator.v1",
            caps=(Capability(name="translate", description="EN↔ZH"),),
        ))
        reg.register(_manifest(
            rid="ext.acme.agent.ocr.v1",
            caps=(Capability(name="ocr", description="image to text"),),
        ))
        return reg

    def test_register_and_get(self) -> None:
        reg = self._reg()
        assert reg.get("ext.acme.agent.translator.v1").name == "Translator"

    def test_register_duplicate_raises(self) -> None:
        reg = self._reg()
        with pytest.raises(ValueError, match="already registered"):
            reg.register(_manifest())

    def test_find_by_capability(self) -> None:
        reg = self._reg()
        translators = reg.find_by_capability("translate")
        assert len(translators) == 1
        assert translators[0].agent_rid == "ext.acme.agent.translator.v1"

    def test_invoke_ok(self) -> None:
        reg = self._reg()
        inv = reg.invoke("ext.acme.agent.translator.v1", "translate", {"text": "hi"})
        assert inv.status == "ok"
        assert "hi" in inv.output
        assert inv.sandbox_id.startswith("microvm-")

    def test_invoke_unknown_capability(self) -> None:
        reg = self._reg()
        with pytest.raises(ValueError, match="not declared"):
            reg.invoke("ext.acme.agent.translator.v1", "nope", {})

    def test_invoke_disabled(self) -> None:
        reg = ExtAgentRegistry()
        runner = MockMicroVMRunner()
        runner.register("translate", lambda p: "ok")
        reg.runner = runner
        reg.register(_manifest(enabled=False))
        with pytest.raises(RuntimeError, match="disabled"):
            reg.invoke("ext.acme.agent.translator.v1", "translate", {"text": "x"})

    def test_invoke_failure_captured(self) -> None:
        reg = ExtAgentRegistry()
        # No runner registered for capability → runner.run raises
        reg.register(_manifest())
        inv = reg.invoke("ext.acme.agent.translator.v1", "translate", {})
        assert inv.status == "failed"
        assert "no mock impl" in (inv.error or "")
