"""Verify the network-policies sub-chart enforces default-deny + explicit allow.

These checks combine two sources:
  - The template text (for structure: kind, policyTypes, namespacing, etc.)
  - The values.yaml (for the actual port numbers / target names referenced
    from the templates via {{ .Values... }})
"""
from __future__ import annotations

from pathlib import Path

import pytest
import yaml

NP_TEMPLATES = Path(__file__).resolve().parents[1] / "helm" / "charts" / "network-policies" / "templates"
NP_VALUES = Path(__file__).resolve().parents[1] / "helm" / "charts" / "network-policies" / "values.yaml"


def _read_template(name: str) -> str:
    return (NP_TEMPLATES / name).read_text(encoding="utf-8")


def _read_values() -> dict:
    return yaml.safe_load(NP_VALUES.read_text(encoding="utf-8"))


class TestDefaultDeny:
    def test_default_deny_template_present(self) -> None:
        assert (NP_TEMPLATES / "default-deny.yaml").is_file()

    def test_default_deny_covers_ingress(self) -> None:
        text = _read_template("default-deny.yaml")
        assert "kind: NetworkPolicy" in text
        assert "Ingress" in text
        assert "policyTypes:" in text
        assert "podSelector: {}" in text, "default-deny must apply to all pods"

    def test_default_deny_covers_egress(self) -> None:
        text = _read_template("default-deny.yaml")
        assert "Egress" in text, "default-deny.yaml must cover egress"

    def test_default_deny_values_enabled(self) -> None:
        vals = _read_values()
        assert vals["defaultDeny"]["ingress"] is True
        assert vals["defaultDeny"]["egress"] is True


class TestExplicitAllow:
    def test_allow_dns_template(self) -> None:
        text = _read_template("allow-dns.yaml")
        assert "kind: NetworkPolicy" in text
        assert "kube-system" in text

    def test_allow_dns_values_contain_port_53(self) -> None:
        vals = _read_values()
        ports = vals["allowedEgress"]["dns"]["ports"]
        assert any(p["port"] == 53 for p in ports)
        assert any(p["protocol"] == "UDP" for p in ports)
        assert any(p["protocol"] == "TCP" for p in ports)

    def test_allow_dataplane_template(self) -> None:
        text = _read_template("allow-dataplane.yaml")
        assert "kind: NetworkPolicy" in text

    def test_allow_dataplane_values_list_postgres_redis_kafka(self) -> None:
        vals = _read_values()
        targets = vals["allowedEgress"]["dataPlane"]["targets"]
        names = {t["name"] for t in targets}
        assert names == {"postgres", "redis", "kafka"}, (
            f"data-plane allow must include postgres/redis/kafka, got {names}"
        )
        ports = {t["name"]: t["port"] for t in targets}
        assert ports["postgres"] == 5432
        assert ports["redis"] == 6379
        assert ports["kafka"] == 9092

    def test_allow_keycloak_template(self) -> None:
        text = _read_template("allow-keycloak.yaml")
        assert "kind: NetworkPolicy" in text
        assert "keycloak" in text

    def test_allow_keycloak_values_use_8080(self) -> None:
        vals = _read_values()
        assert vals["allowedEgress"]["keycloak"]["port"] == 8080

    def test_allow_otel_template(self) -> None:
        text = _read_template("allow-otel.yaml")
        assert "kind: NetworkPolicy" in text
        assert "otel-collector" in text

    def test_allow_otel_values_use_4317(self) -> None:
        vals = _read_values()
        assert vals["allowedEgress"]["otelCollector"]["port"] == 4317

    def test_allow_ingress_from_api_gateway(self) -> None:
        text = _read_template("allow-ingress.yaml")
        assert "kind: NetworkPolicy" in text
        assert "api-gateway" in text


class TestAnnotationPolicy:
    """All NetworkPolicies should carry a policy.description annotation so
    reviewers can scan the rendered output and understand the rule intent."""

    @pytest.mark.parametrize("template_name", [
        "default-deny.yaml",
        "allow-dns.yaml",
        "allow-dataplane.yaml",
        "allow-keycloak.yaml",
        "allow-otel.yaml",
        "allow-ingress.yaml",
    ])
    def test_has_policy_description(self, template_name: str) -> None:
        text = _read_template(template_name)
        assert "policy.description" in text, (
            f"{template_name} should carry a policy.description annotation"
        )
