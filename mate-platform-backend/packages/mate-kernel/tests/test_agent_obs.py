"""AGENT-OBS-01 OBS 数字员工测试。"""

from __future__ import annotations

import pytest

from mate_kernel.action.engine import ActionService
from mate_kernel.agent.obs import (
    AlertEvent,
    AlertRule,
    AlertSeverity,
    AlertState,
    Comparator,
    DashboardSpec,
    ObservabilityAgent,
)
from mate_kernel.manager.protocol import Manager, ManagerContext


def _ctx() -> ManagerContext:
    return ManagerContext(user_id="alice", tenant_id="acme", session_id="s-1")


def _rule(
    metric: str = "k8s.pod.restarts",
    op: Comparator = Comparator.GT,
    threshold: float = 5.0,
    severity: AlertSeverity = AlertSeverity.WARNING,
    action_rid: str | None = None,
) -> AlertRule:
    return AlertRule(
        rule_rid=f"obs.acme.alert.{metric.replace('.', '-')}.v1",
        name=f"{metric} alert",
        metric_name=metric,
        comparator=op,
        threshold=threshold,
        severity=severity,
        action_rid=action_rid,
    )


class TestAlertRule:
    def test_basic(self) -> None:
        r = _rule()
        assert r.metric_name == "k8s.pod.restarts"
        assert r.comparator == Comparator.GT


class TestObservabilityAgent:
    def _a(self, with_action: bool = False) -> ObservabilityAgent:
        svc = ActionService()
        if with_action:
            svc.register_function("ont.acme.act.scale_up", lambda t, p: "scaled")
        return ObservabilityAgent(svc)

    def test_register_rule(self) -> None:
        a = self._a()
        a.register_rule(_rule(), Manager(_ctx()))
        with pytest.raises(ValueError, match="already registered"):
            a.register_rule(_rule(), Manager(_ctx()))

    def test_register_tracks_change(self) -> None:
        a = self._a()
        mgr = Manager(_ctx())
        a.register_rule(_rule(), mgr)
        changes = mgr.drain_changes()
        assert len(changes) == 1
        assert changes[0].target_rid.startswith("obs.acme.alert.")

    def test_evaluate_gt_fires(self) -> None:
        a = self._a()
        a.register_rule(_rule(threshold=5.0), Manager(_ctx()))
        events = a.evaluate("k8s.pod.restarts", 10.0)
        assert len(events) == 1
        assert events[0].state == AlertState.FIRING
        assert events[0].severity == AlertSeverity.WARNING

    def test_evaluate_below_threshold_no_fire(self) -> None:
        a = self._a()
        a.register_rule(_rule(threshold=5.0), Manager(_ctx()))
        events = a.evaluate("k8s.pod.restarts", 1.0)
        assert events == ()

    def test_disabled_rule_ignored(self) -> None:
        a = self._a()
        rule = _rule(threshold=5.0)
        object.__setattr__(rule, "enabled", False)
        # rule is frozen; can't mutate. Build via constructor with enabled=False.
        rule = AlertRule(
            rule_rid="obs.acme.alert.disabled.v1",
            name="disabled",
            metric_name="k8s.pod.restarts",
            comparator=Comparator.GT,
            threshold=5.0,
            severity=AlertSeverity.WARNING,
            enabled=False,
        )
        a.register_rule(rule, Manager(_ctx()))
        events = a.evaluate("k8s.pod.restarts", 100.0)
        assert events == ()

    def test_multiple_comparators(self) -> None:
        a = self._a()
        a.register_rule(_rule(metric="http.latency", op=Comparator.LT, threshold=0.5), Manager(_ctx()))
        a.register_rule(_rule(metric="http.errors", op=Comparator.GTE, threshold=10.0), Manager(_ctx()))
        ev1 = a.evaluate("http.latency", 0.1)
        ev2 = a.evaluate("http.errors", 10.0)
        assert len(ev1) == 1 and ev1[0].observed_value == 0.1
        assert len(ev2) == 1 and ev2[0].observed_value == 10.0

    def test_resolve_all(self) -> None:
        a = self._a()
        a.register_rule(_rule(), Manager(_ctx()))
        a.evaluate("k8s.pod.restarts", 100.0)
        n = a.resolve_all("k8s.pod.restarts")
        assert n == 1

    def test_trigger_action(self) -> None:
        a = self._a(with_action=True)
        rule = _rule(action_rid="ont.acme.act.scale_up")
        a.register_rule(rule, Manager(_ctx()))
        events = a.evaluate("k8s.pod.restarts", 100.0)
        assert len(events) == 1
        audit = a.trigger_action(events[0], _ctx())
        assert audit is not None
        assert audit.startswith("audit-")

    def test_trigger_action_no_rule_returns_none(self) -> None:
        a = self._a()
        events = a.evaluate("nonexistent", 100.0)
        # 找不到规则不会 evaluate 到 events → 用伪造 event 测试
        ev = AlertEvent(
            event_id="x",
            rule_rid="obs.acme.alert.nope.v1",
            state=AlertState.FIRING,
            severity=AlertSeverity.INFO,
            observed_value=0.0,
            fired_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        )
        assert a.trigger_action(ev, _ctx()) is None


class TestDashboardSpec:
    def test_basic(self) -> None:
        d = DashboardSpec(
            dashboard_rid="obs.acme.dashboard.ops.v1",
            name="Ops",
            panels=("http.latency", "k8s.pod.restarts"),
        )
        assert len(d.panels) == 2


class TestSelectorRoutedToObs:
    def test_obs_rid_routes_to_obs(self) -> None:
        from mate_kernel.agent.orchestrator import AgentRole, AgentSelector
        assert AgentSelector().select("obs.acme.alert.cpu-high.v1") == AgentRole.OBS
