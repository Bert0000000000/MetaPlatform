"""composition/policy + topology 最小闭环单测（INTERCEPT/POLICY + HUB）。"""
from __future__ import annotations

import pytest

from mate_platform.composition.policy import (
    PolicyDenied,
    PolicyEffect,
    PolicyEngine,
    PolicyRule,
    intercept,
)
from mate_platform.composition.topology import (
    CapabilityNode,
    CapabilityTopology,
    TopologyCycleError,
)


def rule(name, effect=PolicyEffect.DENY):
    return PolicyRule(name=name, predicate=lambda ctx: bool(ctx.get(name)),
                      effect=effect)


class TestPolicyEngine:
    def test_allow_when_no_rule_matches(self):
        engine = PolicyEngine()
        engine.register(rule("bad_tenant"))
        v = engine.check({"bad_tenant": False})
        assert v.allowed and v.matched == []

    def test_deny_short_circuits_with_reason(self):
        engine = PolicyEngine()
        engine.register(rule("denied_flag"))
        v = engine.check({"denied_flag": True})
        assert not v.allowed and v.matched == ["denied_flag"]
        assert "denied_flag" in v.reason

    def test_fail_closed_on_predicate_error(self):
        def boom(ctx):
            raise RuntimeError("boom")
        engine = PolicyEngine()
        engine.register(PolicyRule(name="boom", predicate=boom))
        v = engine.check({})
        assert not v.allowed and v.matched == ["boom"]

    def test_allow_rule_recorded_but_not_fatal(self):
        engine = PolicyEngine()
        engine.register(rule("signed_in", effect=PolicyEffect.ALLOW))
        v = engine.check({"signed_in": True})
        assert v.allowed and v.matched == ["signed_in"]


@pytest.mark.asyncio()
async def test_intercept_blocks_and_passes():
    engine = PolicyEngine()
    engine.register(rule("blocked"))
    called = {"n": 0}

    async def fn(x):
        called["n"] += 1
        return x * 2

    with pytest.raises(PolicyDenied):
        await intercept(fn, engine, {"blocked": True}, 21)
    assert called["n"] == 0
    assert await intercept(fn, engine, {"blocked": False}, 21) == 42
    assert called["n"] == 1


class TestCapabilityTopology:
    def _topology(self) -> CapabilityTopology:
        t = CapabilityTopology()
        t.register(CapabilityNode("copilot", "chat", frozenset({"llm.invoke"})))
        t.register(CapabilityNode("llmgw", "llm.invoke"))
        t.register(CapabilityNode("ont", "object.query", frozenset({"llm.invoke"})))
        return t

    def test_topological_order_and_snapshot(self):
        t = self._topology()
        snap = t.snapshot()
        assert snap["total"] == 3
        assert snap["order"].index("llm.invoke") < snap["order"].index("chat")
        assert snap["order"].index("llm.invoke") < snap["order"].index("object.query")
        assert snap["missing_dependencies"] == {}

    def test_cycle_detected(self):
        t = CapabilityTopology()
        t.register(CapabilityNode("a", "cap.a", frozenset({"cap.b"})))
        t.register(CapabilityNode("b", "cap.b", frozenset({"cap.a"})))
        with pytest.raises(TopologyCycleError):
            t.snapshot()

    def test_missing_dependencies_reported(self):
        t = CapabilityTopology()
        t.register(CapabilityNode("x", "cap.x", frozenset({"cap.ghost"})))
        assert t.missing_dependencies() == {"cap.x": ["cap.ghost"]}

    def test_dependents_impact_query(self):
        t = self._topology()
        impact = t.dependents_of("llm.invoke")
        assert impact == ["chat", "object.query"]
