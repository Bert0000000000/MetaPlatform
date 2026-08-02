"""G5 — three-part security parity across all 17 domain contracts.

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


def _collect_endpoints() -> list[tuple[str, str, str, dict]]:
    """Return ``(filename, method, path, op_dict)`` for every HTTP operation."""
    endpoints: list[tuple[str, str, str, dict]] = []
    for svc_file in sorted(SERVICES_DIR.glob("*.yaml")):
        doc = _load(svc_file)
        for path, path_item in doc.get("paths", {}).items():
            if not isinstance(path_item, dict):
                continue
            for method, op in path_item.items():
                if method.lower() not in HTTP_METHODS:
                    continue
                if not isinstance(op, dict):
                    continue
                endpoints.append((svc_file.name, method.upper(), path, op))
    return endpoints


def _is_exempt(path: str) -> bool:
    return path in EXEMPT_EXACT_PATHS


def _expected_scope(method: str, path: str) -> str:
    if ADMIN_MARKER in path:
        return "platform.admin"
    if method.lower() in WRITE_METHODS:
        return "platform.write"
    return "platform.read"


def _ep_id(fname: str, method: str, path: str, *_: Any) -> str:
    return f"{fname}::{method} {path}"


ALL_ENDPOINTS = _collect_endpoints()

# Endpoints that carry a non-empty explicit ``security:`` block and are NOT
# exempt health/metrics probes — these must have full three-part security.
SECURED_ENDPOINTS = [
    (fname, method, path, op)
    for fname, method, path, op in ALL_ENDPOINTS
    if not _is_exempt(path)
    and "security" in op
    and op["security"]  # non-empty (not intentionally public)
]


# ---------------------------------------------------------------------------
# 1. Every secured endpoint has the full three-part security
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "fname, method, path, op",
    SECURED_ENDPOINTS,
    ids=[_ep_id(*e) for e in SECURED_ENDPOINTS],
)
def test_secured_endpoints_have_three_part_security(
    fname: str, method: str, path: str, op: dict,
) -> None:
    """Each non-exempt operation with explicit ``security:`` must declare all
    three schemes: ``bearerAuth``, ``tenantHeader``, ``oidcScopes``."""
    sec = op["security"]
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
    "fname, method, path, op",
    SECURED_ENDPOINTS,
    ids=[_ep_id(*e) for e in SECURED_ENDPOINTS],
)
def test_oidc_scopes_valid_and_appropriate(
    fname: str, method: str, path: str, op: dict,
) -> None:
    """``oidcScopes`` must use valid scope names and match the HTTP method."""
    req = op["security"][0]
    scopes = req["oidcScopes"]
    assert isinstance(scopes, list), (
        f"{fname} {method} {path} oidcScopes is not a list"
    )
    for s in scopes:
        assert s in VALID_SCOPES, (
            f"{fname} {method} {path} has invalid scope '{s}'"
        )

    expected = _expected_scope(method, path)
    assert expected in scopes, (
        f"{fname} {method} {path} oidcScopes={scopes} "
        f"but method={method} path={path} requires '{expected}'"
    )


# ---------------------------------------------------------------------------
# 3. Write endpoints never declare only platform.read
# ---------------------------------------------------------------------------
WRITE_SECURED = [
    (fname, method, path, op)
    for fname, method, path, op in SECURED_ENDPOINTS
    if method.lower() in WRITE_METHODS and ADMIN_MARKER not in path
]


@pytest.mark.parametrize(
    "fname, method, path, op",
    WRITE_SECURED,
    ids=[_ep_id(*e) for e in WRITE_SECURED],
)
def test_write_endpoints_not_read_only(
    fname: str, method: str, path: str, op: dict,
) -> None:
    """Mutating (non-admin) operations must include ``platform.write``."""
    scopes = op["security"][0]["oidcScopes"]
    assert "platform.write" in scopes, (
        f"{fname} {method} {path} is a write operation but "
        f"oidcScopes={scopes} lacks platform.write"
    )


# ---------------------------------------------------------------------------
# 4. Admin endpoints use platform.admin
# ---------------------------------------------------------------------------
ADMIN_SECURED = [
    (fname, method, path, op)
    for fname, method, path, op in SECURED_ENDPOINTS
    if ADMIN_MARKER in path
]


@pytest.mark.parametrize(
    "fname, method, path, op",
    ADMIN_SECURED,
    ids=[_ep_id(*e) for e in ADMIN_SECURED],
)
def test_admin_endpoints_use_admin_scope(
    fname: str, method: str, path: str, op: dict,
) -> None:
    """Paths under ``/admin/`` must require ``platform.admin``."""
    scopes = op["security"][0]["oidcScopes"]
    assert "platform.admin" in scopes, (
        f"{fname} {method} {path} is an admin endpoint but "
        f"oidcScopes={scopes} lacks platform.admin"
    )


# ---------------------------------------------------------------------------
# 5. Health probes are exempt from oidcScopes
# ---------------------------------------------------------------------------
HEALTH_ENDPOINTS = [
    (fname, method, path, op)
    for fname, method, path, op in ALL_ENDPOINTS
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


# ---------------------------------------------------------------------------
# 6. Inventory guards
# ---------------------------------------------------------------------------
def test_secured_endpoint_inventory_non_empty() -> None:
    """Guard: we collected secured endpoints; 0 means a collection bug."""
    assert len(SECURED_ENDPOINTS) >= 50, (
        f"Expected >=50 secured endpoints, got {len(SECURED_ENDPOINTS)}"
    )


def test_all_seventeen_domains_present() -> None:
    """All 17 known domains must be in the contract set."""
    names = {p.stem for p in SERVICES_DIR.glob("*.yaml")}
    expected = {
        "a2a", "agent", "apphub", "arch", "copilot", "dashboard", "data",
        "dw", "iam", "kb", "llmgw", "mcp", "msg", "obs", "ont", "rag", "wfe",
    }
    assert names == expected, f"service contract set drifted: {names ^ expected}"
