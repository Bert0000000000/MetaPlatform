"""StarRocks sub-chart static smoke (v3.2-γ BI 集成).

Mirrors the Iceberg/Trino pattern (``test_iceberg_trino_chart.py``):
StarRocks is the BI serving layer. The chart deploys FE + BE with
external catalogs pointing at the sibling Iceberg + Paimon REST
catalogs. This module is pure static smoke so it runs on every CI
machine (Linux / macOS / Windows) without a real cluster.
"""
from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from conftest import REPO_ROOT

CHART = REPO_ROOT / "infra" / "helm" / "charts" / "starrocks"
UMBRELLA = REPO_ROOT / "infra" / "helm" / "Chart.yaml"


def _load_yaml(path: Path) -> dict:
    with path.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh)


class TestStarRocksChart:
    def test_chart_yaml_exists(self) -> None:
        assert (CHART / "Chart.yaml").is_file()

    def test_chart_api_version(self) -> None:
        chart = _load_yaml(CHART / "Chart.yaml")
        assert chart["apiVersion"] == "v2"

    def test_chart_name(self) -> None:
        chart = _load_yaml(CHART / "Chart.yaml")
        assert chart["name"] == "starrocks"

    def test_values_have_fe_and_be(self) -> None:
        values = _load_yaml(CHART / "values.yaml")
        assert values["fe"]["replicaCount"] >= 1
        assert values["be"]["replicaCount"] >= 3  # production minimum
        assert values["fe"]["queryPort"] == 9030  # MySQL protocol
        assert values["fe"]["httpPort"] == 8040   # web UI

    def test_values_have_external_catalogs(self) -> None:
        values = _load_yaml(CHART / "values.yaml")
        # External catalogs are the BI integration bridge —
        # StarRocks reads Iceberg / Paimon tables directly.
        assert values["externalCatalogs"]["iceberg"]["enabled"] is True
        assert values["externalCatalogs"]["paimon"]["enabled"] is True
        assert "iceberg:8181" in values["externalCatalogs"]["iceberg"]["catalogEndpoint"]
        assert "paimon:8081" in values["externalCatalogs"]["paimon"]["catalogEndpoint"]

    def test_values_have_tenant_isolation(self) -> None:
        values = _load_yaml(CHART / "values.yaml")
        assert values["tenantIsolation"]["enabled"] is True
        assert values["tenantIsolation"]["databasePrefix"] == "tenant_"

    def test_values_have_network_policy(self) -> None:
        values = _load_yaml(CHART / "values.yaml")
        assert values["networkPolicy"]["enabled"] is True
        assert "metaplatform" in values["networkPolicy"]["allowedIngressNamespaces"]

    def test_values_have_persistence(self) -> None:
        values = _load_yaml(CHART / "values.yaml")
        # Production deployments need durable storage for both FE
        # metadata + BE columnar data.
        assert values["persistence"]["fe"]["enabled"] is True
        assert values["persistence"]["be"]["enabled"] is True
        assert "Gi" in values["persistence"]["fe"]["size"]
        assert "Gi" in values["persistence"]["be"]["size"]

    def test_fe_statefulset_uses_probes(self) -> None:
        ss = (CHART / "templates" / "fe-statefulset.yaml").read_text(encoding="utf-8")
        assert "tcpSocket" in ss, "FE probes must be TCP probes on query port"
        assert "queryPort" in ss
        assert "livenessProbe" in ss
        assert "readinessProbe" in ss

    def test_be_statefulset_uses_probes_and_fe_env(self) -> None:
        ss = (CHART / "templates" / "be-statefulset.yaml").read_text(encoding="utf-8")
        # BE → FE heartbeats use the FE service DNS as the discovery target.
        assert "FE_SERVICE_NAME" in ss
        assert "FE_QUERY_PORT" in ss
        assert "livenessProbe" in ss
        assert "readinessProbe" in ss

    def test_services_expose_query_and_http(self) -> None:
        svc = (CHART / "templates" / "services.yaml").read_text(encoding="utf-8")
        # FE ClusterIP service exposes query (MySQL) + http ports.
        assert "query" in svc
        assert "http" in svc
        # FE ports are templated against values — verify the keys are
        # referenced rather than literal numbers since the values
        # default to 9030 / 8040.
        assert "fe.queryPort" in svc
        assert "fe.httpPort" in svc
        # BE ClusterIP service exposes webserver (templated).
        assert "be.webserverPort" in svc
        assert "webserver" in svc
        # Sanity: the values.yaml defaults match the JDBC / web ports.
        values = _load_yaml(CHART / "values.yaml")
        assert values["fe"]["queryPort"] == 9030
        assert values["fe"]["httpPort"] == 8040

    def test_external_catalog_configmap_has_iceberg_and_paimon(self) -> None:
        cm = (
            CHART / "templates" / "external-catalog-configmap.yaml"
        ).read_text(encoding="utf-8")
        assert "catalog-iceberg" in cm
        assert "catalog-paimon" in cm
        assert "tenant-database-prefix" in cm

    def test_networkpolicy_default_deny(self) -> None:
        np = (CHART / "templates" / "networkpolicy.yaml").read_text(encoding="utf-8")
        assert "policyTypes" in np
        assert "Ingress" in np and "Egress" in np
        # FE netpol
        assert "kube-system" in np
        assert "port: 53" in np
        # hard rule 13 — both FE and BE netpols must exist.
        assert np.count("kind: NetworkPolicy") == 2


class TestUmbrellaChartDeclaresStarRocks:
    def test_umbrella_chart_lists_starrocks(self) -> None:
        chart = _load_yaml(UMBRELLA)
        names = [d["name"] for d in chart["dependencies"]]
        assert "starrocks" in names, "umbrella must declare starrocks dependency"

    def test_umbrella_starrocks_has_condition(self) -> None:
        chart = _load_yaml(UMBRELLA)
        for d in chart["dependencies"]:
            if d["name"] == "starrocks":
                assert d.get("condition") == "starrocks.enabled"
                return
        pytest.fail("starrocks dependency not found")

    def test_umbrella_order_with_other_lake_charts(self) -> None:
        """StarRocks should sit after Iceberg + Trino in the umbrella
        dependency list — the BI integration depends on Iceberg/Trino
        being present.
        """
        chart = _load_yaml(UMBRELLA)
        names = [d["name"] for d in chart["dependencies"]]
        if "starrocks" not in names:
            pytest.skip("starrocks not in umbrella")
        assert names.index("starrocks") > names.index("trino"), (
            "starrocks should be declared after trino in umbrella deps"
        )