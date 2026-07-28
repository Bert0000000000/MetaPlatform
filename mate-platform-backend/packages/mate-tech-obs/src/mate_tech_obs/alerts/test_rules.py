"""Alert rules tests (ST-5.2.8)."""
from __future__ import annotations

from mate_tech_obs.alerts.rules import (
    ALERT_RULES,
    get_alert_count,
    to_prometheus_yaml,
)


def test_alert_count_10() -> None:
    """ST-5.2.8 DoD: 10 条告警."""
    assert get_alert_count() == 10
    assert len(ALERT_RULES) == 10


def test_alert_5xx_present() -> None:
    names = {r.alert for r in ALERT_RULES}
    assert "Http5xxRate" in names
    assert "HttpP95Latency" in names
    assert "AppDown" in names
    assert "DiskSpaceLow" in names
    assert "MemoryHigh" in names


def test_alert_severity_levels() -> None:
    """5 critical + 5 warning 分布."""
    critical = [r for r in ALERT_RULES if r.severity == "critical"]
    warning = [r for r in ALERT_RULES if r.severity == "warning"]
    assert len(critical) == 3  # Http5xxRate, PgConnectionPoolFull, AppDown
    assert len(warning) == 7


def test_to_prometheus_yaml_format() -> None:
    yaml = to_prometheus_yaml()
    assert "groups:" in yaml
    assert "- name: mate-platform" in yaml
    assert "alert: Http5xxRate" in yaml
    assert 'severity: "critical"' in yaml


def test_alert_expressions_nonempty() -> None:
    for r in ALERT_RULES:
        assert r.expr.strip()
        assert r.for_duration
        assert r.description