"""G5 — three-part security parity across the canonical 21 service contracts.

Every HTTP operation in every ``services/*.yaml`` must carry the full
SEC-IAM-01 three-part security contract:

    security:
      - bearerAuth: []          # Keycloak JWT
        tenantHeader: []        # X-Tenant-Id
        oidcScopes: [platform.read | platform.write | platform.admin]

Scope assignment rules (verified by this test):

* GET / HEAD / OPTIONS  → ``platform.read``
* POST / PUT / DELETE / PATCH → ``platform.write``
* paths containing ``/admin/`` → ``platform.admin``
* query-shaped POST operations may override the method default with
  ``x-required-scopes``; the operation contract must declare the effective
  scope explicitly instead of relying on heuristics

Exemptions (``security: []`` or health probes):

* ``/healthz``, ``/readyz``, ``/health`` — infra probes, bearerAuth at most
* ``/metrics`` — Prometheus scrape, no auth
* Auth endpoints with ``security: []`` (login / refresh / sso-providers) —
  intentionally public; no token exists before login

Related: 13 硬规则 §1 (oasdiff gate), ADR-0011 (SEC-IAM-01),
``test_g5_security_coverage.py``, ``test_service_security_segments.py``.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
import yaml

# infra/tests/conftest.py -> infra/tests -> infra -> <repo>
REPO_ROOT = Path(__file__).resolve().parents[2]
SERVICES_DIR = REPO_ROOT / "mate-platform-backend" / "contracts" / "openapi" / "services"

HTTP_METHODS = frozenset({"get", "post", "put", "delete", "patch", "head", "options"})
WRITE_METHODS = frozenset({"post", "put", "delete", "patch"})
READ_METHODS = frozenset({"get", "head", "options"})

# Paths exempt from the three-part requirement.
EXEMPT_EXACT_PATHS = frozenset({"/healthz", "/readyz", "/health", "/metrics"})
ADMIN_MARKER = "/admin/"

VALID_SCOPES = frozenset({"platform.read", "platform.write", "platform.admin"})


def _load(path: Path) -> dict[str, Any]:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def _collect_endpoints() -> list[tuple[str, str, str, dict[str, Any], list[dict[str, Any]]]]:
    """Return ``(filename, method, path, op_dict, service_security)`` for each operation."""
    endpoints: list[tuple[str, str, str, dict[str, Any], list[dict[str, Any]]]] = []
    for svc_file in sorted(SERVICES_DIR.glob("*.yaml")):
        doc = _load(svc_file)
        service_security = doc.get("security") or []
        for path, path_item in doc.get("paths", {}).items():
            if not isinstance(path_item, dict):
                continue
            for method, op in path_item.items():
                if method.lower() not in HTTP_METHODS:
                    continue
                if not isinstance(op, dict):
                    continue
                endpoints.append((svc_file.name, method.upper(), path, op, service_security))
    return endpoints


def _is_exempt(path: str) -> bool:
    return path in EXEMPT_EXACT_PATHS


def _effective_security(op: dict[str, Any], service_security: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return op.get("security", service_security)


def _expected_scopes(method: str, path: str, op: dict[str, Any]) -> list[str]:
    declared = op.get("x-required-scopes")
    if declared is not None:
        return declared
    if ADMIN_MARKER in path:
        return ["platform.admin"]
    if method.lower() in WRITE_METHODS:
        return ["platform.write"]
    return ["platform.read"]


def _ep_id(fname: str, method: str, path: str, *_: Any) -> str:
    return f"{fname}::{method} {path}"


ALL_ENDPOINTS = _collect_endpoints()

# Endpoints that carry a non-empty explicit ``security:`` block and are NOT
# exempt health/metrics probes — these must have full three-part security.
SECURED_ENDPOINTS = [
    (fname, method, path, op, service_security)
    for fname, method, path, op, service_security in ALL_ENDPOINTS
    if not _is_exempt(path)
    and _effective_security(op, service_security)  # non-empty (not intentionally public)
]


# ---------------------------------------------------------------------------
# 1. Every secured endpoint has the full three-part security
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "fname, method, path, op, service_security",
    SECURED_ENDPOINTS,
    ids=[_ep_id(*e) for e in SECURED_ENDPOINTS],
)
def test_secured_endpoints_have_three_part_security(
    fname: str, method: str, path: str, op: dict[str, Any], service_security: list[dict[str, Any]],
) -> None:
    """Each non-exempt operation with explicit ``security:`` must declare all
    three schemes: ``bearerAuth``, ``tenantHeader``, ``oidcScopes``."""
    sec = _effective_security(op, service_security)
    assert sec, f"{fname} {method} {path} has empty security — expected three-part"
    req = sec[0]
    assert isinstance(req, dict), (
        f"{fname} {method} {path} security entry is not a dict"
    )
    assert "bearerAuth" in req, (
        f"{fname} {method} {path} missing bearerAuth in security"
    )
    assert "tenantHeader" in req, (
        f"{fname} {method} {path} missing tenantHeader in security"
    )
    assert "oidcScopes" in req, (
        f"{fname} {method} {path} missing oidcScopes in security"
    )


# ---------------------------------------------------------------------------
# 2. oidcScopes values are valid and method-appropriate
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "fname, method, path, op, service_security",
    SECURED_ENDPOINTS,
    ids=[_ep_id(*e) for e in SECURED_ENDPOINTS],
)
def test_oidc_scopes_valid_and_appropriate(
    fname: str, method: str, path: str, op: dict[str, Any], service_security: list[dict[str, Any]],
) -> None:
    """``oidcScopes`` must use canonical scope names and match effective scope."""
    req = _effective_security(op, service_security)[0]
    scopes = req["oidcScopes"]
    assert isinstance(scopes, list), (
        f"{fname} {method} {path} oidcScopes is not a list"
    )
    for s in scopes:
        assert s in VALID_SCOPES, (
            f"{fname} {method} {path} has invalid scope '{s}'"
        )

    declared = op.get("x-required-scopes")
    if declared is not None:
        assert isinstance(declared, list), (
            f"{fname} {method} {path} x-required-scopes is not a list"
        )
        for scope in declared:
            assert scope in VALID_SCOPES, (
                f"{fname} {method} {path} has invalid x-required-scopes entry '{scope}'"
            )

    expected = _expected_scopes(method, path, op)
    if declared is not None:
        assert scopes == expected, (
            f"{fname} {method} {path} oidcScopes={scopes} "
            f"but effective required scopes are {expected}"
        )
    else:
        assert expected[0] in scopes, (
            f"{fname} {method} {path} oidcScopes={scopes} "
            f"but method={method} path={path} requires '{expected[0]}'"
        )


# ---------------------------------------------------------------------------
# 3. Write endpoints never declare only platform.read
# ---------------------------------------------------------------------------
WRITE_SECURED = [
    (fname, method, path, op, service_security)
    for fname, method, path, op, service_security in SECURED_ENDPOINTS
    if _expected_scopes(method, path, op) == ["platform.write"]
]


@pytest.mark.parametrize(
    "fname, method, path, op, service_security",
    WRITE_SECURED,
    ids=[_ep_id(*e) for e in WRITE_SECURED],
)
def test_write_endpoints_not_read_only(
    fname: str, method: str, path: str, op: dict[str, Any], service_security: list[dict[str, Any]],
) -> None:
    """Mutating (non-admin) operations must include ``platform.write``."""
    scopes = _effective_security(op, service_security)[0]["oidcScopes"]
    assert "platform.write" in scopes, (
        f"{fname} {method} {path} is a write operation but "
        f"oidcScopes={scopes} lacks platform.write"
    )


# ---------------------------------------------------------------------------
# 4. Admin endpoints use platform.admin
# ---------------------------------------------------------------------------
ADMIN_SECURED = [
    (fname, method, path, op, service_security)
    for fname, method, path, op, service_security in SECURED_ENDPOINTS
    if _expected_scopes(method, path, op) == ["platform.admin"]
]


@pytest.mark.parametrize(
    "fname, method, path, op, service_security",
    ADMIN_SECURED,
    ids=[_ep_id(*e) for e in ADMIN_SECURED],
)
def test_admin_endpoints_use_admin_scope(
    fname: str, method: str, path: str, op: dict[str, Any], service_security: list[dict[str, Any]],
) -> None:
    """Paths under ``/admin/`` must require ``platform.admin``."""
    scopes = _effective_security(op, service_security)[0]["oidcScopes"]
    assert "platform.admin" in scopes, (
        f"{fname} {method} {path} is an admin endpoint but "
        f"oidcScopes={scopes} lacks platform.admin"
    )


# ---------------------------------------------------------------------------
# 5. Health probes are exempt from oidcScopes
# ---------------------------------------------------------------------------
HEALTH_ENDPOINTS = [
    (fname, method, path, op)
    for fname, method, path, op, _service_security in ALL_ENDPOINTS
    if _is_exempt(path) and "security" in op and op["security"]
]


@pytest.mark.parametrize(
    "fname, method, path, op",
    HEALTH_ENDPOINTS,
    ids=[_ep_id(*e) for e in HEALTH_ENDPOINTS],
)
def test_health_endpoints_exempt_from_oidc(
    fname: str, method: str, path: str, op: dict,
) -> None:
    """``/healthz``, ``/readyz``, ``/health``, ``/metrics`` must not
    require ``oidcScopes``."""
    for req in op["security"]:
        if isinstance(req, dict):
            assert "oidcScopes" not in req, (
                f"{fname} {method} {path} requires oidcScopes but "
                f"infra probe endpoints must be exempt"
            )


REQUIRED_READ_POST_ENDPOINT_IDS = {
    "copilot.yaml::POST /api/v1/copilot/analysis/explain-sql",
    "copilot.yaml::POST /api/v1/copilot/generate/process",
    "copilot.yaml::POST /api/v1/copilot/ontology/graph/query",
    "copilot.yaml::POST /api/v1/copilot/scheduling/employees/match",
    "copilot.yaml::POST /api/v1/copilot/search",
    "ont.yaml::POST /api/v1/ont/federation/query",
    "ont.yaml::POST /api/v1/ont/v2/object-sets/query",
    "ont.yaml::POST /api/v1/ont/v2/object-query",
    "ont.yaml::POST /api/v1/ont/v2/object-search",
}


def _endpoints_by_id() -> dict[str, tuple[str, str, str, dict[str, Any], list[dict[str, Any]]]]:
    return {_ep_id(*endpoint): endpoint for endpoint in ALL_ENDPOINTS}


REQUIRED_READ_POST_ENDPOINTS_DATA = [
    _endpoints_by_id()[endpoint_id]
    for endpoint_id in sorted(REQUIRED_READ_POST_ENDPOINT_IDS)
]


def test_required_read_post_endpoint_inventory_is_pinned() -> None:
    """The known read-shaped POST endpoints must stay covered explicitly."""
    actual = {_ep_id(*endpoint) for endpoint in REQUIRED_READ_POST_ENDPOINTS_DATA}
    assert actual == REQUIRED_READ_POST_ENDPOINT_IDS


READ_POST_ENDPOINTS = REQUIRED_READ_POST_ENDPOINTS_DATA


@pytest.mark.parametrize(
    "fname, method, path, op, service_security",
    READ_POST_ENDPOINTS,
    ids=[_ep_id(*e) for e in READ_POST_ENDPOINTS],
)
def test_read_post_endpoints_declare_x_required_scopes(
    fname: str, method: str, path: str, op: dict[str, Any], service_security: list[dict[str, Any]],
) -> None:
    """POST reads must opt into ``platform.read`` via ``x-required-scopes``."""
    assert service_security is not None
    assert op.get("x-required-scopes") == ["platform.read"], (
        f"{fname} {method} {path} must declare x-required-scopes: [platform.read]"
    )
    assert _effective_security(op, service_security)[0]["oidcScopes"] == ["platform.read"], (
        f"{fname} {method} {path} must remain read-scoped in effective security"
    )


# ---------------------------------------------------------------------------
# 6. Inventory guards
# ---------------------------------------------------------------------------
def test_secured_endpoint_inventory_non_empty() -> None:
    """Guard: we collected secured endpoints; 0 means a collection bug."""
    assert len(SECURED_ENDPOINTS) >= 50, (
        f"Expected >=50 secured endpoints, got {len(SECURED_ENDPOINTS)}"
    )


def test_all_twenty_one_services_present() -> None:
    """The gate inventory is the canonical 21-service OpenAPI contract set."""
    names = {p.stem for p in SERVICES_DIR.glob("*.yaml")}
    expected = {
        "a2a", "agent", "analytics", "apphub", "arch", "copilot", "dashboard",
        "data", "deep-research", "dw", "iam", "kb", "llmgw", "marketplace",
        "mcp", "msg", "obs", "ont", "orchestrator", "rag", "wfe",
    }
    assert names == expected, f"service contract set drifted: {names ^ expected}"
