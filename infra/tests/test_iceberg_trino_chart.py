"""Iceberg + Trino sub-chart static smoke (v3.2-γ W1).

Mirrors the G4 pattern (``test_g4_kind_workflow.py``): the actual
staging-cluster run executes via ``scripts/ci/d1_staging_smoke.sh``
on a runner with kind + helm; this module is the *pure static*
guard that proves the Iceberg + Trino sub-charts exist, are
shaped correctly, and that the umbrella ``infra/helm/Chart.yaml``
declares them as conditional dependencies.

The check is intentionally lightweight so it runs on every CI
machine (Linux / macOS / Windows) without a real cluster.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest
import yaml

from conftest import REPO_ROOT

ICEBERG_CHART = REPO_ROOT / "infra" / "helm" / "charts" / "iceberg"
TRINO_CHART = REPO_ROOT / "infra" / "helm" / "charts" / "trino"
UMBRELLA_CHART = REPO_ROOT / "infra" / "helm" / "Chart.yaml"


def _load_yaml(path: Path) -> dict:
    with path.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh)


class TestIcebergChart:
    def test_chart_yaml_exists(self) -> None:
        assert (ICEBERG_CHART / "Chart.yaml").is_file(), (
            f"missing iceberg chart: {ICEBERG_CHART / 'Chart.yaml'}"
        )

    def test_chart_api_version(self) -> None:
        chart = _load_yaml(ICEBERG_CHART / "Chart.yaml")
        assert chart["apiVersion"] == "v2"

    def test_chart_name(self) -> None:
        chart = _load_yaml(ICEBERG_CHART / "Chart.yaml")
        assert chart["name"] == "iceberg"

    def test_values_have_tenant_isolation(self) -> None:
        values = _load_yaml(ICEBERG_CHART / "values.yaml")
        assert values["tenantIsolation"]["enabled"] is True
        assert values["tenantIsolation"]["tablePrefix"] == "tenant_"

    def test_values_have_network_policy(self) -> None:
        values = _load_yaml(ICEBERG_CHART / "values.yaml")
        assert values["networkPolicy"]["enabled"] is True
        assert "metaplatform" in values["networkPolicy"]["allowedIngressNamespaces"]

    def test_statefulset_uses_configmap_probes(self) -> None:
        ss = (ICEBERG_CHART / "templates" / "statefulset.yaml").read_text(
            encoding="utf-8"
        )
        assert "configMapKeyRef" in ss, "StatefulSet must wire catalog mode via CM"
        assert "readinessProbe" in ss
        assert "livenessProbe" in ss

    def test_networkpolicy_default_deny(self) -> None:
        np = (ICEBERG_CHART / "templates" / "networkpolicy.yaml").read_text(
            encoding="utf-8"
        )
        assert "policyTypes" in np
        assert "Ingress" in np and "Egress" in np
        # hard rule 13 — DNS egress only
        assert "kube-system" in np
        assert "port: 53" in np


class TestTrinoChart:
    def test_chart_yaml_exists(self) -> None:
        assert (TRINO_CHART / "Chart.yaml").is_file(), (
            f"missing trino chart: {TRINO_CHART / 'Chart.yaml'}"
        )

    def test_chart_api_version(self) -> None:
        chart = _load_yaml(TRINO_CHART / "Chart.yaml")
        assert chart["apiVersion"] == "v2"

    def test_chart_name(self) -> None:
        chart = _load_yaml(TRINO_CHART / "Chart.yaml")
        assert chart["name"] == "trino"

    def test_values_have_federation_catalogs(self) -> None:
        values = _load_yaml(TRINO_CHART / "values.yaml")
        assert values["catalogs"]["iceberg"]["enabled"] is True
        assert values["catalogs"]["paimon"]["enabled"] is True
        assert values["catalogs"]["system"]["enabled"] is True
        # Endpoints point at the sibling sub-chart REST services.
        assert "iceberg:8181" in values["catalogs"]["iceberg"]["endpoint"]
        assert "paimon:8081" in values["catalogs"]["paimon"]["endpoint"]

    def test_values_have_tenant_isolation(self) -> None:
        values = _load_yaml(TRINO_CHART / "values.yaml")
        assert values["tenantIsolation"]["enabled"] is True
        assert values["tenantIsolation"]["tablePrefix"] == "tenant_"

    def test_values_split_coordinator_and_worker(self) -> None:
        values = _load_yaml(TRINO_CHART / "values.yaml")
        assert "coordinator" in values["resources"]
        assert "worker" in values["resources"]
        assert values["worker"]["replicaCount"] >= 1

    def test_coordinator_deployment_renders_configmap(self) -> None:
        coord = (TRINO_CHART / "templates" / "coordinator.yaml").read_text(
            encoding="utf-8"
        )
        assert "configMapKeyRef" in coord
        # The init command writes per-catalog properties files.
        assert "connector.name=iceberg" in coord
        assert "connector.name=paimon" in coord
        assert "connector.name=system" in coord

    def test_worker_deployment_uses_coordinator_discovery(self) -> None:
        worker = (TRINO_CHART / "templates" / "worker.yaml").read_text(
            encoding="utf-8"
        )
        assert "discovery.uri" in worker
        assert "coordinator" in worker.lower()
        assert "coordinator=false" in worker

    def test_service_exposes_http_and_thrift(self) -> None:
        svc = (TRINO_CHART / "templates" / "service.yaml").read_text(
            encoding="utf-8"
        )
        assert "http" in svc
        assert "thrift" in svc
        # Port values are templated against values.yaml.
        assert "service.httpPort" in svc
        assert "port: 8081" in svc  # Thrift is hardcoded
        # The values.yaml default is 8080 (HTTP).
        values = _load_yaml(TRINO_CHART / "values.yaml")
        assert values["service"]["httpPort"] == 8080

    def test_networkpolicy_default_deny(self) -> None:
        np = (TRINO_CHART / "templates" / "networkpolicy.yaml").read_text(
            encoding="utf-8"
        )
        assert "policyTypes" in np
        assert "Ingress" in np and "Egress" in np
        assert "kube-system" in np
        assert "port: 53" in np


class TestUmbrellaChartDeclaresIcebergTrino:
    def test_umbrella_chart_lists_iceberg(self) -> None:
        chart = _load_yaml(UMBRELLA_CHART)
        names = [d["name"] for d in chart["dependencies"]]
        assert "iceberg" in names, "umbrella must declare iceberg dependency"

    def test_umbrella_chart_lists_trino(self) -> None:
        chart = _load_yaml(UMBRELLA_CHART)
        names = [d["name"] for d in chart["dependencies"]]
        assert "trino" in names, "umbrella must declare trino dependency"

    def test_umbrella_iceberg_has_condition(self) -> None:
        chart = _load_yaml(UMBRELLA_CHART)
        for d in chart["dependencies"]:
            if d["name"] == "iceberg":
                assert d.get("condition") == "iceberg.enabled"
                return
        pytest.fail("iceberg dependency not found")

    def test_umbrella_trino_has_condition(self) -> None:
        chart = _load_yaml(UMBRELLA_CHART)
        for d in chart["dependencies"]:
            if d["name"] == "trino":
                assert d.get("condition") == "trino.enabled"
                return
        pytest.fail("trino dependency not found")

    def test_all_dependencies_have_condition(self) -> None:
        chart = _load_yaml(UMBRELLA_CHART)
        for d in chart["dependencies"]:
            assert "condition" in d, (
                f"umbrella dep {d['name']!r} must declare a condition toggle"
            )