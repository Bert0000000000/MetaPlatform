"""G5 — per-service OpenAPI ``security`` segment compliance.

Every domain service contract under
``mate-platform-backend/contracts/openapi/services/`` must declare the
SEC-IAM-01 security baseline so that no route ships without an authentication
contract (13 硬规则 §13 第 1 条: "Swagger 没有接口，不写 route"; ADR-0011).

For each service.yaml we assert:

1. ``components.securitySchemes`` exists and defines at least the
   ``bearerAuth`` (Keycloak JWT) and ``tenantHeader`` (X-Tenant-Id) schemes.
2. The contract declares a top-level ``security:`` requirement (the service
   default) AND at least one HTTP operation carries an explicit per-operation
   ``security:`` reference.
"""
from __future__ import annotations

from pathlib import Path

import pytest
import yaml

# infra/tests/conftest.py -> infra/tests -> infra -> <repo>
REPO_ROOT = Path(__file__).resolve().parents[2]
SERVICES_DIR = REPO_ROOT / "mate-platform-backend" / "contracts" / "openapi" / "services"

HTTP_METHODS = frozenset({"get", "post", "put", "delete", "patch", "head", "options"})


def _service_files() -> list[Path]:
    return sorted(SERVICES_DIR.glob("*.yaml"))


def _load(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def _id_for(path: Path) -> str:
    return path.name


SERVICE_FILES = _service_files()


class TestServiceSecuritySegments:
    """One parametrised assertion per service contract keeps failures granular."""

    @pytest.mark.parametrize("service_file", SERVICE_FILES, ids=_id_for)
    def test_security_schemes_declared(self, service_file: Path) -> None:
        doc = _load(service_file)
        schemes = doc.get("components", {}).get("securitySchemes", {})
        assert schemes, f"{service_file.name} has no components.securitySchemes"
        assert "bearerAuth" in schemes, (
            f"{service_file.name} securitySchemes missing bearerAuth"
        )
        assert "tenantHeader" in schemes, (
            f"{service_file.name} securitySchemes missing tenantHeader"
        )

    @pytest.mark.parametrize("service_file", SERVICE_FILES, ids=_id_for)
    def test_security_schemes_well_formed(self, service_file: Path) -> None:
        doc = _load(service_file)
        schemes = doc["components"]["securitySchemes"]
        # bearerAuth must be an HTTP bearer (JWT) scheme.
        assert schemes["bearerAuth"].get("type") == "http", (
            f"{service_file.name} bearerAuth must be type: http"
        )
        assert schemes["bearerAuth"].get("scheme") == "bearer"
        # tenantHeader must bind the X-Tenant-Id header.
        th = schemes["tenantHeader"]
        assert th.get("type") == "apiKey"
        assert th.get("in") == "header"
        assert th.get("name") == "X-Tenant-Id"

    @pytest.mark.parametrize("service_file", SERVICE_FILES, ids=_id_for)
    def test_contract_and_endpoints_declare_security(self, service_file: Path) -> None:
        doc = _load(service_file)
        # The contract as a whole must declare a security default.
        assert doc.get("security"), (
            f"{service_file.name} has no top-level security declaration"
        )
        # At least one operation must carry an explicit per-operation security.
        ops_with_security = 0
        for methods in doc.get("paths", {}).values():
            for method, op in methods.items():
                if method in HTTP_METHODS and isinstance(op, dict) and "security" in op:
                    ops_with_security += 1
        assert ops_with_security >= 1, (
            f"{service_file.name} has no operation with an explicit security reference"
        )


def test_all_seventeen_domains_covered() -> None:
    """Guard against silent contract drift: exactly the 17 known domains."""
    names = {p.stem for p in SERVICE_FILES}
    expected = {
        "a2a", "agent", "apphub", "arch", "copilot", "dashboard", "data",
        "dw", "iam", "kb", "llmgw", "mcp", "msg", "obs", "ont", "rag", "wfe",
    }
    assert names == expected, f"service contract set drifted: {names ^ expected}"
