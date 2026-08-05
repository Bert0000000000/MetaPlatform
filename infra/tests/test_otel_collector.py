"""Verify the otel-collector sub-chart structure and configmap content.

These checks work on the raw template text (since the files contain Helm
template directives that are not valid YAML until rendered by helm).
"""
from __future__ import annotations

from pathlib import Path

import yaml

OTEL_DIR = (
    Path(__file__).resolve().parents[1] / "helm" / "charts" / "otel-collector"
)


def _read(name: str) -> str:
    return (OTEL_DIR / name).read_text(encoding="utf-8")


class TestOtelChartMetadata:
    def test_chart_yaml_is_valid_yaml(self) -> None:
        data = yaml.safe_load(_read("Chart.yaml"))
        assert data["apiVersion"] == "v2"

    def test_values_yaml_is_valid_yaml(self) -> None:
        data = yaml.safe_load(_read("values.yaml"))
        assert data["image"]["repository"] == "otel/opentelemetry-collector-contrib"
        assert data["image"]["tag"] == "0.104.0"

    def test_receivers_otlp_enabled(self) -> None:
        data = yaml.safe_load(_read("values.yaml"))
        assert data["receivers"]["otlp"]["grpc"]["enabled"] is True
        assert data["receivers"]["otlp"]["http"]["enabled"] is True
        assert data["receivers"]["otlp"]["grpc"]["port"] == 4317
        assert data["receivers"]["otlp"]["http"]["port"] == 4318


class TestOtelConfigmap:
    def test_configmap_kind_present(self) -> None:
        text = _read("templates/configmap.yaml")
        assert "kind: ConfigMap" in text
        assert "relay.yaml" in text
        assert "data:" in text

    def test_pipelines_present(self) -> None:
        text = _read("templates/configmap.yaml")
        assert "traces:" in text
        assert "metrics:" in text
        assert "logs:" in text

    def test_receivers_in_configmap(self) -> None:
        text = _read("templates/configmap.yaml")
        assert "otlp/grpc" in text
        assert "otlp/http" in text

    def test_processors_in_configmap(self) -> None:
        text = _read("templates/configmap.yaml")
        assert "memory_limiter" in text
        assert "batch" in text
        assert "attributes/tenant" in text

    def test_exporters_in_configmap(self) -> None:
        text = _read("templates/configmap.yaml")
        assert "otlphttp" in text or "logging" in text


class TestOtelDeployment:
    def test_kind_is_deployment(self) -> None:
        text = _read("templates/deployment.yaml")
        assert "kind: Deployment" in text

    def test_runs_as_non_root(self) -> None:
        text = _read("templates/deployment.yaml")
        assert "runAsNonRoot: true" in text, "deployment must runAsNonRoot"
        assert "readOnlyRootFilesystem: true" in text
        assert "ALL" in text  # capabilities dropped

    def test_uses_configmap_volume(self) -> None:
        text = _read("templates/deployment.yaml")
        assert "configMap:" in text
        assert "relay.yaml" in text

    def test_has_probes(self) -> None:
        text = _read("templates/deployment.yaml")
        assert "livenessProbe:" in text
        assert "readinessProbe:" in text

    def test_uses_secret_ref_for_postgres_password(self) -> None:
        text = _read("templates/deployment.yaml")
        assert "secretKeyRef" in text
        assert "postgres-admin" in text
        # Production-readiness 13 hard rule 12: Secret must not enter git.
        assert "value: postgres" not in text
        assert "password: postgres" not in text


class TestOtelNetworkPolicy:
    def test_otel_np_present(self) -> None:
        text = _read("templates/networkpolicy.yaml")
        assert "kind: NetworkPolicy" in text
        assert "policyTypes:" in text
        assert "Ingress" in text
        assert "Egress" in text

    def test_otel_np_allows_metaplatform_ingress(self) -> None:
        text = _read("templates/networkpolicy.yaml")
        assert "metaplatform" in text
        assert "4317" in text
        assert "4318" in text

    def test_otel_np_allows_tempo_egress(self) -> None:
        text = _read("templates/networkpolicy.yaml")
        assert "tempo" in text


class TestOtelServiceMonitor:
    def test_servicemonitor_kind_present(self) -> None:
        text = _read("templates/servicemonitor.yaml")
        assert "kind: ServiceMonitor" in text
        assert "monitoring.coreos.com" in text
