"""OpenAPI contract tests for deep-research.yaml.

Verifies the contract file:
  * Parses as valid YAML.
  * Declares the expected operationId.
  * Carries the ADR-0014 step-6 three-part security block.
  * Declares the FR-DEEP-RESEARCH-INVOKE requirement id.
"""
from __future__ import annotations

from pathlib import Path

import pytest

yaml = pytest.importorskip("yaml")

CONTRACT = (
    Path(__file__).resolve().parents[3]
    / "contracts"
    / "openapi"
    / "services"
    / "deep-research.yaml"
)


def _load() -> dict:
    assert CONTRACT.exists(), f"contract not found: {CONTRACT}"
    with CONTRACT.open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def test_contract_parses_and_has_invoke_path() -> None:
    spec = _load()
    assert spec["openapi"].startswith("3.")
    assert "/api/v1/a2a/agent/deep-research/invoke" in spec["paths"]


def test_operation_id_matches() -> None:
    spec = _load()
    op = spec["paths"]["/api/v1/a2a/agent/deep-research/invoke"]["post"]
    assert op["operationId"] == "deepResearchInvokeDeepResearch"


def test_security_is_three_part() -> None:
    spec = _load()
    op = spec["paths"]["/api/v1/a2a/agent/deep-research/invoke"]["post"]
    security = op["security"]
    assert isinstance(security, list) and len(security) == 1
    entry = security[0]
    assert "bearerAuth" in entry
    assert "tenantHeader" in entry
    assert "oidcScopes" in entry
    scopes = entry["oidcScopes"]
    assert isinstance(scopes, list) and "platform.write" in scopes


def test_carries_requirement_id() -> None:
    spec = _load()
    op = spec["paths"]["/api/v1/a2a/agent/deep-research/invoke"]["post"]
    reqs = op.get("x-mate-requirements", [])
    assert "FR-DEEP-RESEARCH-INVOKE" in reqs


def test_security_schemes_defined() -> None:
    spec = _load()
    schemes = spec["components"]["securitySchemes"]
    assert schemes["bearerAuth"]["type"] == "http"
    assert schemes["bearerAuth"]["scheme"] == "bearer"
    assert schemes["tenantHeader"]["in"] == "header"
    assert schemes["tenantHeader"]["name"] == "X-Tenant-Id"


def test_request_and_response_schemas_present() -> None:
    spec = _load()
    schemas = spec["components"]["schemas"]
    assert "DeepResearchInvokeRequest" in schemas
    assert "DeepResearchInvokeResponse" in schemas
    assert "Source" in schemas
    # capability_id enum must only allow web-research.
    cap = schemas["DeepResearchInvokeRequest"]["properties"]["capability_id"]
    assert cap["enum"] == ["web-research"]
