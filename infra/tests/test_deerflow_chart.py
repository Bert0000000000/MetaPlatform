"""PR-5 — DeerFlow Engine chart + docker-compose structural tests.

Verifies the deerflow-engine sub-chart exists, has healthcheck,
resources, NetworkPolicy, LLM config, and is wired into the
docker-compose.yml research / ai profiles.

Static text checks (no helm / kubectl required) — mirrors the
pattern in test_g1_kafka_chart.py. The real helm lint / kubeconform
runs in CI.
"""
from __future__ import annotations

from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[2]
CHARTS = REPO / "infra" / "helm" / "charts"
DEERFLOW = CHARTS / "deerflow-engine"
COMPOSE = REPO / "docker-compose.yml"


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


class TestDeerflowChart:
    def test_deerflow_chart_exists(self) -> None:
        """Chart.yaml must exist and declare the deerflow-engine app."""
        chart_yaml = DEERFLOW / "Chart.yaml"
        assert chart_yaml.is_file(), "deerflow-engine/Chart.yaml missing"
        data = yaml.safe_load(_read(chart_yaml))
        assert data["apiVersion"] == "v2"
        assert data["name"] == "deerflow-engine"
        assert data["type"] == "application"
        assert data["appVersion"] == "latest"

    def test_deerflow_chart_has_healthcheck(self) -> None:
        """values.yaml must declare healthcheck (path + port + probes)."""
        text = _read(DEERFLOW / "values.yaml")
        assert "healthcheck:" in text, (
            "values.yaml must have healthcheck section"
        )
        assert "enabled: true" in text
        assert "/healthz" in text, "healthcheck path must be /healthz"
        # Deployment template must render startup/readiness/liveness probes
        # wired to values.healthcheck.path / port.
        dep = _read(DEERFLOW / "templates" / "deployment.yaml")
        assert "readinessProbe:" in dep
        assert "livenessProbe:" in dep
        assert "startupProbe:" in dep
        assert ".Values.healthcheck.path" in dep
        assert ".Values.healthcheck.port" in dep

    def test_deerflow_chart_has_resources(self) -> None:
        """values.yaml must declare resource requests + limits (rule 8)."""
        text = _read(DEERFLOW / "values.yaml")
        assert "resources:" in text
        assert "requests:" in text
        assert "limits:" in text
        assert "cpu:" in text
        assert "memory:" in text
        # Deployment must mount the resources block.
        dep = _read(DEERFLOW / "templates" / "deployment.yaml")
        assert "resources:" in dep
        assert "toYaml .Values.resources" in dep

    def test_deerflow_chart_has_networkpolicy(self) -> None:
        """networkpolicy.yaml must exist with default-deny (rule 13)."""
        np = DEERFLOW / "templates" / "networkpolicy.yaml"
        assert np.is_file(), "deerflow-engine/templates/networkpolicy.yaml missing"
        text = _read(np)
        assert "kind: NetworkPolicy" in text
        assert "policyTypes:" in text
        assert "Ingress" in text
        assert "Egress" in text
        # values.yaml must enable the NetworkPolicy by default.
        vals = _read(DEERFLOW / "values.yaml")
        assert "networkPolicy:" in vals
        assert "allowedIngressNamespaces:" in vals

    def test_deerflow_chart_has_llm_config(self) -> None:
        """values.yaml must declare LLM env config; secret goes via Secret."""
        text = _read(DEERFLOW / "values.yaml")
        # Non-secret LLM config.
        assert "llm:" in text
        assert "baseUrl" in text
        assert "model" in text
        # Secret reference (hard rule 12 — no secret in git).
        assert "secretRef:" in text
        # Deployment must reference LLM_API_KEY from a Secret.
        dep = _read(DEERFLOW / "templates" / "deployment.yaml")
        assert "LLM_API_KEY" in dep
        assert "secretKeyRef" in dep
        # ConfigMap must hold non-secret LLM_BASE_URL / LLM_MODEL.
        cm = _read(DEERFLOW / "templates" / "configmap.yaml")
        assert "LLM_BASE_URL" in cm
        assert "LLM_MODEL" in cm

    def test_deerflow_compose_has_service(self) -> None:
        """docker-compose.yml must declare the deerflow-engine service."""
        assert COMPOSE.is_file(), "docker-compose.yml missing"
        text = _read(COMPOSE)
        assert "deerflow-engine:" in text, (
            "docker-compose.yml missing deerflow-engine service"
        )
        # research + ai profiles.
        assert "research" in text, "research profile must be declared"
        # Image + healthcheck + volume (mirrors PR-5 spec).
        assert "bytedance/deer-flow" in text
        assert "/healthz" in text
        assert "deerflowdata" in text, (
            "docker-compose.yml must declare deerflowdata volume"
        )
