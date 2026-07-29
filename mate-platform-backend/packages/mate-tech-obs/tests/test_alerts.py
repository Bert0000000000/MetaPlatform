"""Move/refactor of src/.../alerts/test_rules.py -> tests/test_alerts.py
originally lived inside src/ which made pytest collect it twice; now it's
the canonical location with full coverage of mate_tech_obs.alerts.rules.
"""
from __future__ import annotations

from dataclasses import FrozenInstanceError

import pytest

from mate_tech_obs.alerts.rules import (
    ALERT_RULES,
    AlertRule,
    get_alert_count,
    to_prometheus_yaml,
)


class TestAlertRuleDataclass:
    def test_dataclass_is_frozen(self) -> None:
        r = AlertRule(
            alert="X",
            expr="x > 0",
            for_duration="1m",
            severity="warning",
            description="",
            annotations={},
        )
        # Frozen instance: attribute set must raise
        with pytest.raises((FrozenInstanceError, AttributeError)):
            r.alert = "Y"  # type: ignore[misc]

    def test_minimum_valid_rule(self) -> None:
        r = AlertRule(
            alert="Test",
            expr="up == 1",
            for_duration="1m",
            severity="critical",
            description="desc",
            annotations={"k": "v"},
        )
        assert r.alert == "Test"
        assert r.expr == "up == 1"
        assert r.severity == "critical"


class TestAlertRulesList:
    def test_alert_count_is_documented_dod(self) -> None:
        # ST-5.2.8 DoD: 10 alert rules total
        assert get_alert_count() == 10
        assert len(ALERT_RULES) == 10

    def test_critical_alerts_present(self) -> None:
        names = {r.alert for r in ALERT_RULES}
        assert "Http5xxRate" in names
        assert "HttpP95Latency" in names
        assert "AppDown" in names
        assert "DiskSpaceLow" in names
        assert "MemoryHigh" in names

    def test_severity_distribution(self) -> None:
        # 5 critical + 5 warning (current DoD)
        critical = [r for r in ALERT_RULES if r.severity == "critical"]
        warning = [r for r in ALERT_RULES if r.severity == "warning"]
        assert len(critical) == 3  # Http5xxRate, PgConnectionPoolFull, AppDown
        assert len(warning) == 7

    def test_all_alerts_have_required_fields(self) -> None:
        for r in ALERT_RULES:
            assert r.alert.strip(), f"alert name must be non-empty: {r!r}"
            assert r.expr.strip(), f"expr must be non-empty: {r!r}"
            assert r.for_duration.strip(), f"for_duration must be non-empty: {r!r}"
            assert r.severity in ("critical", "warning"), f"severity invalid: {r!r}"
            assert r.description.strip(), f"description must be non-empty: {r!r}"


class TestPrometheusYamlExport:
    def test_yaml_starts_with_groups(self) -> None:
        yaml = to_prometheus_yaml()
        assert "groups:" in yaml

    def test_yaml_names_group(self) -> None:
        yaml = to_prometheus_yaml()
        assert "- name: mate-platform" in yaml

    def test_yaml_lists_alerts(self) -> None:
        yaml = to_prometheus_yaml()
        assert "alert: Http5xxRate" in yaml

    def test_yaml_uses_critical_string(self) -> None:
        yaml = to_prometheus_yaml()
        # YAML labels use the literal "critical" string
        assert 'severity: "critical"' in yaml

    def test_yaml_handles_annotations(self) -> None:
        yaml = to_prometheus_yaml()
        assert "annotations:" in yaml
        # Each annotation key/value pair should appear
        for r in ALERT_RULES:
            for k in r.annotations:
                assert f"{k}:" in yaml, f"missing annotation {k!r} for {r.alert}"
