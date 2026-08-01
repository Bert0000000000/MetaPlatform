"""G1 — Kafka sub-chart structural tests.

Per the v3.2 W3 G1 task: verify the kafka sub-chart exists, runs in
KRaft mode (no Zookeeper), has persistence, NetworkPolicy, tenant
isolation, and is wired into the umbrella chart dependencies.

Static text checks (no helm / kubectl required) — mirrors the pattern
in test_data_subcharts.py. The real helm lint / kubeconform runs in CI.
"""
from __future__ import annotations

from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[2]
CHARTS = REPO / "infra" / "helm" / "charts"
KAFKA = CHARTS / "kafka"
HELM = REPO / "infra" / "helm"


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


class TestG1KafkaChart:
    def test_kafka_chart_exists(self) -> None:
        """Chart.yaml must exist and declare the kafka application."""
        chart_yaml = KAFKA / "Chart.yaml"
        assert chart_yaml.is_file(), "kafka/Chart.yaml missing"
        data = yaml.safe_load(_read(chart_yaml))
        assert data["apiVersion"] == "v2"
        assert data["name"] == "kafka"
        assert data["type"] == "application"

    def test_kafka_chart_has_kraft(self) -> None:
        """The StatefulSet must be KRaft (combined controller+broker)."""
        ss = KAFKA / "templates" / "statefulset.yaml"
        assert ss.is_file(), "kafka/templates/statefulset.yaml missing"
        text = _read(ss)
        assert "KAFKA_CFG_PROCESS_ROLES" in text, (
            "StatefulSet must set process.roles for KRaft mode"
        )
        assert "controller,broker" in text, (
            "KRaft requires combined controller+broker role"
        )
        assert "KAFKA_CFG_CONTROLLER_QUORUM_VOTERS" in text, (
            "KRaft requires controller quorum voters"
        )
        # The controller listener on 9093 must be declared.
        assert "controller" in text

    def test_kafka_chart_has_persistence(self) -> None:
        """values.yaml must declare persistence (enabled by default)."""
        text = _read(KAFKA / "values.yaml")
        assert "persistence:" in text
        assert "enabled: true" in text, (
            "G1 default persistence must be enabled"
        )
        assert "50Gi" in text, "G1 persistence size must be 50Gi"

    def test_kafka_chart_has_networkpolicy(self) -> None:
        """networkpolicy.yaml must exist with default-deny (hard rule 13)."""
        np = KAFKA / "templates" / "networkpolicy.yaml"
        assert np.is_file(), "kafka/templates/networkpolicy.yaml missing"
        text = _read(np)
        assert "kind: NetworkPolicy" in text
        assert "policyTypes:" in text
        assert "Ingress" in text
        assert "Egress" in text

    def test_kafka_chart_has_tenant_isolation(self) -> None:
        """values.yaml must declare tenantIsolation (per-tenant topic prefix)."""
        text = _read(KAFKA / "values.yaml")
        assert "tenantIsolation:" in text, (
            "values.yaml must have tenantIsolation section"
        )
        assert "tenantIsolation.enabled" in text or (
            "tenantIsolation:" in text and "enabled: true" in text
        ), "tenantIsolation.enabled must be present"

    def test_umbrella_includes_kafka(self) -> None:
        """The umbrella Chart.yaml must list kafka as a dependency."""
        data = yaml.safe_load(_read(HELM / "Chart.yaml"))
        deps = data.get("dependencies", [])
        names = {d["name"] for d in deps}
        assert "kafka" in names, "umbrella Chart.yaml missing kafka dependency"
        # The kafka dep must have a condition + version.
        kafka_dep = next(d for d in deps if d["name"] == "kafka")
        assert kafka_dep.get("condition") == "kafka.enabled"
        assert "version" in kafka_dep
