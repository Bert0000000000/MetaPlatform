"""C1 — Apache Paimon sub-chart structural tests.

Per the v3.2 W1 C1 task: verify the paimon sub-chart exists, runs
a REST catalog server (filesystem mode + S3 warehouse), has
persistence, NetworkPolicy, CDC integration, tenant isolation,
and is wired into the umbrella chart dependencies.

Static text checks (no helm / kubectl required) — mirrors the pattern
in test_g1_kafka_chart.py. The real helm lint / kubeconform runs in CI.
"""
from __future__ import annotations

from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[2]
CHARTS = REPO / "infra" / "helm" / "charts"
PAIMON = CHARTS / "paimon"
HELM = REPO / "infra" / "helm"


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _load_values() -> dict:
    return yaml.safe_load(_read(PAIMON / "values.yaml"))


class TestC1PaimonChart:
    def test_paimon_chart_exists(self) -> None:
        """Chart.yaml must exist and declare the paimon application."""
        chart_yaml = PAIMON / "Chart.yaml"
        assert chart_yaml.is_file(), "paimon/Chart.yaml missing"
        data = yaml.safe_load(_read(chart_yaml))
        assert data["apiVersion"] == "v2"
        assert data["name"] == "paimon"
        assert data["type"] == "application"
        assert data["appVersion"] == "0.8"

    def test_paimon_chart_has_catalog(self) -> None:
        """values.yaml must declare catalog.mode (filesystem default)."""
        values = _load_values()
        assert "catalog" in values, "values.yaml must have catalog section"
        assert values["catalog"]["mode"] == "filesystem", (
            "default catalog mode must be filesystem"
        )
        assert values["catalog"]["warehouse"].startswith("s3://"), (
            "warehouse must be S3-backed"
        )

    def test_paimon_chart_has_persistence(self) -> None:
        """values.yaml must declare persistence (enabled by default)."""
        values = _load_values()
        assert "persistence" in values, (
            "values.yaml must have persistence section"
        )
        assert values["persistence"]["enabled"] is True, (
            "default persistence must be enabled"
        )

    def test_paimon_chart_has_cdc_integration(self) -> None:
        """values.yaml must declare cdc.enabled (Debezium → Paimon)."""
        values = _load_values()
        assert "cdc" in values, "values.yaml must have cdc section"
        assert values["cdc"]["enabled"] is True, (
            "default CDC integration must be enabled"
        )

    def test_paimon_chart_has_tenant_isolation(self) -> None:
        """values.yaml must declare tenantIsolation (per-tenant table prefix)."""
        values = _load_values()
        assert "tenantIsolation" in values, (
            "values.yaml must have tenantIsolation section"
        )
        assert values["tenantIsolation"]["enabled"] is True, (
            "tenantIsolation.enabled must be true"
        )

    def test_paimon_chart_has_networkpolicy(self) -> None:
        """networkpolicy.yaml must exist with default-deny (hard rule 13)."""
        np = PAIMON / "templates" / "networkpolicy.yaml"
        assert np.is_file(), "paimon/templates/networkpolicy.yaml missing"
        text = _read(np)
        assert "kind: NetworkPolicy" in text
        assert "policyTypes:" in text
        assert "Ingress" in text
        assert "Egress" in text

    def test_umbrella_includes_paimon(self) -> None:
        """The umbrella Chart.yaml must list paimon as a dependency."""
        data = yaml.safe_load(_read(HELM / "Chart.yaml"))
        deps = data.get("dependencies", [])
        names = {d["name"] for d in deps}
        assert "paimon" in names, "umbrella Chart.yaml missing paimon dependency"
        paimon_dep = next(d for d in deps if d["name"] == "paimon")
        assert paimon_dep.get("condition") == "paimon.enabled"
        assert "version" in paimon_dep
