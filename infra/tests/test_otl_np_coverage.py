"""GOVERN-09 OTel + NetworkPolicy coverage checks.

Validates that:
1. ``network-policies`` chart ships the 6 baseline policy templates
   (default-deny ingress + egress + 4 allow rules).
2. ``service-templates`` exposes ``otelEnv`` helper with the 7
   standard OTel SDK environment variables (§13-硬规则#9 surface).
3. ``service-templates/values.yaml`` declares the OTel defaults.
4. ``values-production.yaml`` does not disable PG RLS (GOVERN-06
   hardening is preserved at the helm values layer).
"""
from __future__ import annotations

from pathlib import Path

import yaml

from conftest import CHARTS_DIR


NP_REQUIRED = {
    "default-deny.yaml",
    "allow-keycloak.yaml",
    "allow-otel.yaml",
    "allow-dataplane.yaml",
    "allow-dns.yaml",
    "allow-ingress.yaml",
}

OTEL_ENV_VARS = {
    "OTEL_SERVICE_NAME",
    "OTEL_EXPORTER_OTLP_ENDPOINT",
    "OTEL_RESOURCE_ATTRIBUTES",
    "OTEL_TRACES_SAMPLER",
    "OTEL_TRACES_SAMPLER_ARG",
    "OTEL_METRICS_EXPORTER",
    "OTEL_LOGS_EXPORTER",
}


class TestNetworkPolicyChart:
    def test_all_required_policy_templates_present(self, charts_dir: Path) -> None:
        np_dir = charts_dir / "network-policies" / "templates"
        present = {p.name for p in np_dir.iterdir() if p.suffix == ".yaml"}
        missing = NP_REQUIRED - present
        assert not missing, f"network-policies/templates missing: {missing}"

    def test_default_deny_covers_ingress_and_egress(self, charts_dir: Path) -> None:
        dd = (charts_dir / "network-policies" / "templates" / "default-deny.yaml").read_text(
            encoding="utf-8"
        )
        assert "Ingress" in dd, "default-deny must cover Ingress policyType"
        assert "Egress" in dd, "default-deny must cover Egress policyType"


class TestServiceTemplatesOtelHelper:
    def test_otelEnv_helper_defined(self, charts_dir: Path) -> None:
        helpers = (
            charts_dir / "service-templates" / "templates" / "_helpers.tpl"
        ).read_text(encoding="utf-8")
        assert "service-templates.otelEnv" in helpers

    def test_otelEnv_renders_all_required_env_vars(self, charts_dir: Path) -> None:
        helpers = (
            charts_dir / "service-templates" / "templates" / "_helpers.tpl"
        ).read_text(encoding="utf-8")
        # Extract the otelEnv define block only (greedy).
        start = helpers.find("define \"service-templates.otelEnv\"")
        assert start >= 0
        block = helpers[start:]
        end = block.find("{{- end -}}")
        body = block[: end if end > 0 else len(block)]
        missing = OTEL_ENV_VARS - set(body.split("name: ")[1:]) if False else set()
        # direct check: each var name appears in the helper body
        for var in OTEL_ENV_VARS:
            assert var in body, f"otelEnv helper missing env var {var}"

    def test_values_declares_otel_defaults(self, charts_dir: Path) -> None:
        values = yaml.safe_load(
            (charts_dir / "service-templates" / "values.yaml").read_text(encoding="utf-8")
        )
        otel = values["defaults"]["otel"]
        assert otel["exporterEndpoint"], "otel.exporterEndpoint default required"
        assert otel["sampler"], "otel.sampler default required"
        assert otel["samplerArg"], "otel.samplerArg default required"


class TestHelmValuesRlsGuard:
    def test_production_values_does_not_disable_rls(self, helm_dir: Path) -> None:
        values = yaml.safe_load(
            (helm_dir / "values-production.yaml").read_text(encoding="utf-8")
        )
        postgresql = values.get("postgresql", {})
        params = postgresql.get("postgresqlParameters", {})
        # GOVERN-06 default is rowSecurity=on; production must not opt out.
        rs = params.get("rowSecurity", "on")
        assert rs == "on", f"production rowSecurity must be 'on', got {rs!r}"