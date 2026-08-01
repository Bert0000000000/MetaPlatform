"""DATA-D0-D8 helm sub-chart 真实化 tests.

Per ADR-0016 §3.1 + §6.6: the 4 data-platform sub-charts (debezium,
marquez, datahub, ge) must be real helm charts with:
  - Deployment / StatefulSet (workload)
  - ConfigMap (non-sensitive config)
  - Service (ClusterIP)
  - NetworkPolicy (hard rule 13: default-deny + explicit egress)
  - securityContext on every pod + container (hard rule 8)

These checks run without helm / kubectl and act as a static smoke
test on the template text. The real helm lint / kubeconform /
helm-unittest runs in CI.
"""
from __future__ import annotations

from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
CHARTS = REPO / "infra" / "helm" / "charts"

DATA_SUBCHARTS = ("debezium", "marquez", "datahub", "ge")


def _template_path(chart: str, name: str) -> Path:
    return CHARTS / chart / "templates" / name


def _read_template(chart: str, name: str) -> str:
    return _template_path(chart, name).read_text(encoding="utf-8")


def _read_values(chart: str) -> str:
    return (CHARTS / chart / "values.yaml").read_text(encoding="utf-8")


# =============================================================================
# Debezium (CDC)
# =============================================================================
class TestDebeziumSubchart:
    def test_debezium_has_deployment(self) -> None:
        path = _template_path("debezium", "deployment.yaml")
        assert path.is_file(), "debezium/templates/deployment.yaml missing"
        text = _read_template("debezium", "deployment.yaml")
        assert "kind: Deployment" in text
        assert "debezium" in text.lower()

    def test_debezium_has_networkpolicy(self) -> None:
        path = _template_path("debezium", "networkpolicy.yaml")
        assert path.is_file(), "debezium/templates/networkpolicy.yaml missing"
        text = _read_template("debezium", "networkpolicy.yaml")
        assert "kind: NetworkPolicy" in text
        assert "policyTypes:" in text
        assert "Egress" in text

    def test_debezium_egress_allows_postgres_and_kafka(self) -> None:
        """Per ADR-0016 §3.1: Debezium reads from PostgreSQL (source)
        and writes to Kafka (sink). Both must appear in the egress
        rules (hard rule 13)."""
        text = _read_template("debezium", "networkpolicy.yaml")
        assert "postgresql" in text, "egress must allow postgresql"
        assert "kafka" in text, "egress must allow kafka"
        # The egress ports must be referenced (5432 + 9092).
        assert "5432" in text, "postgres port 5432 missing"
        assert "9092" in text, "kafka port 9092 missing"

    def test_debezium_has_configmap(self) -> None:
        path = _template_path("debezium", "configmap.yaml")
        assert path.is_file()
        text = _read_template("debezium", "configmap.yaml")
        assert "kind: ConfigMap" in text

    def test_debezium_has_service(self) -> None:
        path = _template_path("debezium", "service.yaml")
        assert path.is_file()
        text = _read_template("debezium", "service.yaml")
        assert "kind: Service" in text
        # The service type is referenced via .Values.service.type
        # (consistent with kafka / postgresql templates); the
        # ClusterIP default lives in values.yaml.
        assert ".Values.service" in text
        assert "type: ClusterIP" in _read_values("debezium")

    def test_debezium_placeholder_removed(self) -> None:
        """The D0 placeholder ConfigMap must be gone."""
        assert not _template_path("debezium", "00-placeholder.yaml").is_file()

    def test_debezium_values_has_connectors(self) -> None:
        text = _read_values("debezium")
        assert "connectors:" in text
        assert "iam-cdc" in text
        assert "msg-cdc" in text


# =============================================================================
# Marquez (lineage)
# =============================================================================
class TestMarquezSubchart:
    def test_marquez_has_statefulset(self) -> None:
        path = _template_path("marquez", "statefulset.yaml")
        assert path.is_file(), "marquez/templates/statefulset.yaml missing"
        text = _read_template("marquez", "statefulset.yaml")
        assert "kind: StatefulSet" in text
        assert "serviceName:" in text

    def test_marquez_has_networkpolicy(self) -> None:
        path = _template_path("marquez", "networkpolicy.yaml")
        assert path.is_file()
        text = _read_template("marquez", "networkpolicy.yaml")
        assert "kind: NetworkPolicy" in text
        assert "Egress" in text

    def test_marquez_uses_pg_backend(self) -> None:
        """Per ADR-0016 §3.1: Marquez uses PostgreSQL backend."""
        text = _read_template("marquez", "statefulset.yaml")
        assert "POSTGRES_HOST" in text or "POSTGRES_DB" in text, (
            "marquez StatefulSet must reference PostgreSQL backend env vars"
        )
        values_text = _read_values("marquez")
        assert "postgresql" in values_text, (
            "marquez values must point to postgresql backend"
        )

    def test_marquez_has_configmap(self) -> None:
        path = _template_path("marquez", "configmap.yaml")
        assert path.is_file()
        text = _read_template("marquez", "configmap.yaml")
        assert "kind: ConfigMap" in text

    def test_marquez_has_service(self) -> None:
        path = _template_path("marquez", "service.yaml")
        assert path.is_file()
        text = _read_template("marquez", "service.yaml")
        assert "kind: Service" in text

    def test_marquez_placeholder_removed(self) -> None:
        assert not _template_path("marquez", "00-placeholder.yaml").is_file()

    def test_marquez_values_has_tenant_partition(self) -> None:
        text = _read_values("marquez")
        assert "partitionByTenant: true" in text


# =============================================================================
# DataHub (catalog)
# =============================================================================
class TestDatahubSubchart:
    def test_datahub_has_deployment(self) -> None:
        path = _template_path("datahub", "deployment.yaml")
        assert path.is_file(), "datahub/templates/deployment.yaml missing"
        text = _read_template("datahub", "deployment.yaml")
        assert "kind: Deployment" in text

    def test_datahub_has_networkpolicy(self) -> None:
        path = _template_path("datahub", "networkpolicy.yaml")
        assert path.is_file()
        text = _read_template("datahub", "networkpolicy.yaml")
        assert "kind: NetworkPolicy" in text
        assert "Egress" in text

    def test_datahub_egress_allows_kafka(self) -> None:
        """Per ADR-0016 §3.1: DataHub ingests MCE/MAE from Kafka."""
        text = _read_template("datahub", "networkpolicy.yaml")
        assert "kafka" in text, "egress must allow kafka"
        assert "9092" in text, "kafka port 9092 missing"

    def test_datahub_has_configmap(self) -> None:
        path = _template_path("datahub", "configmap.yaml")
        assert path.is_file()
        text = _read_template("datahub", "configmap.yaml")
        assert "kind: ConfigMap" in text
        # Per task: NEO4J / ELASTICSEARCH / KAFKA connections
        assert "neo4j" in text.lower()
        assert "elasticsearch" in text.lower()
        assert "kafka" in text.lower()

    def test_datahub_has_service(self) -> None:
        path = _template_path("datahub", "service.yaml")
        assert path.is_file()
        text = _read_template("datahub", "service.yaml")
        assert "kind: Service" in text

    def test_datahub_placeholder_removed(self) -> None:
        assert not _template_path("datahub", "00-placeholder.yaml").is_file()


# =============================================================================
# Great Expectations (quality)
# =============================================================================
class TestGeSubchart:
    def test_ge_has_deployment(self) -> None:
        path = _template_path("ge", "deployment.yaml")
        assert path.is_file(), "ge/templates/deployment.yaml missing"
        text = _read_template("ge", "deployment.yaml")
        assert "kind: Deployment" in text

    def test_ge_has_networkpolicy(self) -> None:
        path = _template_path("ge", "networkpolicy.yaml")
        assert path.is_file()
        text = _read_template("ge", "networkpolicy.yaml")
        assert "kind: NetworkPolicy" in text
        assert "Egress" in text

    def test_ge_egress_allows_postgres(self) -> None:
        """Per ADR-0016 §3.1: GE uses PostgreSQL backend."""
        text = _read_template("ge", "networkpolicy.yaml")
        assert "postgresql" in text, "egress must allow postgresql"
        assert "5432" in text, "postgres port 5432 missing"

    def test_ge_has_configmap(self) -> None:
        path = _template_path("ge", "configmap.yaml")
        assert path.is_file()
        text = _read_template("ge", "configmap.yaml")
        assert "kind: ConfigMap" in text

    def test_ge_placeholder_removed(self) -> None:
        assert not _template_path("ge", "00-placeholder.yaml").is_file()

    def test_ge_values_has_schedule(self) -> None:
        text = _read_values("ge")
        assert "schedule:" in text


# =============================================================================
# Cross-cutting: all 4 sub-charts
# =============================================================================
class TestAllDataSubcharts:
    @pytest.mark.parametrize("chart", DATA_SUBCHARTS)
    def test_all_subcharts_have_networkpolicy(self, chart: str) -> None:
        """Hard rule 13: NetworkPolicy default-deny = prod-blocking
        when absent. Every data sub-chart must ship one."""
        path = _template_path(chart, "networkpolicy.yaml")
        assert path.is_file(), f"{chart}/templates/networkpolicy.yaml missing"
        text = path.read_text(encoding="utf-8")
        assert "kind: NetworkPolicy" in text
        assert "policyTypes:" in text
        assert "Ingress" in text
        assert "Egress" in text

    @pytest.mark.parametrize("chart", DATA_SUBCHARTS)
    def test_all_subcharts_have_securitycontext(self, chart: str) -> None:
        """Hard rule 8: production-readiness requires securityContext
        (runAsNonRoot + readOnlyRootFilesystem + drop ALL caps)."""
        # Find the workload template (Deployment or StatefulSet).
        workload = None
        for candidate in ("deployment.yaml", "statefulset.yaml"):
            p = _template_path(chart, candidate)
            if p.is_file():
                workload = p
                break
        assert workload is not None, f"{chart} has no Deployment/StatefulSet"
        text = workload.read_text(encoding="utf-8")
        # Pod-level securityContext.
        assert "securityContext:" in text, (
            f"{chart} workload missing securityContext"
        )
        assert "runAsNonRoot: true" in text, (
            f"{chart} must set runAsNonRoot: true"
        )
        # Container-level hardening.
        assert "allowPrivilegeEscalation: false" in text, (
            f"{chart} must set allowPrivilegeEscalation: false"
        )
        assert "readOnlyRootFilesystem: true" in text, (
            f"{chart} must set readOnlyRootFilesystem: true"
        )
        assert "drop:" in text and "ALL" in text, (
            f"{chart} must drop ALL capabilities"
        )

    @pytest.mark.parametrize("chart", DATA_SUBCHARTS)
    def test_all_subcharts_have_resources(self, chart: str) -> None:
        """Hard rule 8: every container must declare resources."""
        # The workload template references resources via
        # `toYaml .Values.resources` (consistent with kafka /
        # postgresql templates); the actual requests/limits live
        # in values.yaml.
        workload_found = False
        for candidate in ("deployment.yaml", "statefulset.yaml"):
            p = _template_path(chart, candidate)
            if p.is_file():
                workload_found = True
                text = p.read_text(encoding="utf-8")
                assert "resources:" in text, (
                    f"{chart}/{candidate} missing resources block"
                )
                assert ".Values.resources" in text, (
                    f"{chart}/{candidate} must reference .Values.resources"
                )
        assert workload_found, f"{chart} has no workload template"
        # values.yaml must define requests + limits.
        values_text = _read_values(chart)
        assert "requests:" in values_text, f"{chart} values missing requests"
        assert "limits:" in values_text, f"{chart} values missing limits"
        assert "cpu:" in values_text
        assert "memory:" in values_text

    @pytest.mark.parametrize("chart", DATA_SUBCHARTS)
    def test_all_subcharts_placeholder_removed(self, chart: str) -> None:
        assert not _template_path(chart, "00-placeholder.yaml").is_file(), (
            f"{chart}/templates/00-placeholder.yaml still present"
        )

    @pytest.mark.parametrize("chart", DATA_SUBCHARTS)
    def test_all_subcharts_have_helpers(self, chart: str) -> None:
        path = CHARTS / chart / "templates" / "_helpers.tpl"
        assert path.is_file(), f"{chart}/templates/_helpers.tpl missing"
        text = path.read_text(encoding="utf-8")
        assert f"{chart}.fullname" in text
        assert f"{chart}.labels" in text
        assert f"{chart}.selectorLabels" in text
