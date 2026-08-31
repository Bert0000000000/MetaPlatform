"""G5 — full per-endpoint security coverage across all 17 domain contracts.

Extends ``test_service_security_segments.py`` (which checks
securitySchemes + contract-level declarations) with **per-operation
granularity** so that no individual route can ship without an
authentication contract.

Three assertions
----------------
1. **test_all_endpoints_have_security** — every HTTP operation in every
   ``services/*.yaml`` is covered by either a top-level (global)
   ``security:`` declaration on the contract *or* an explicit
   per-operation ``security:`` key.  An endpoint with ``security: []``
   (intentionally public, e.g. login) counts as having a declaration.

2. **test_write_endpoints_use_write_scope** — mutating operations
   (POST / PUT / DELETE / PATCH) that declare ``oidcScopes`` at the
   operation level must require ``platform.write`` (never
   ``platform.read``).  The explicitly pinned query-shaped POST inventory
   is excluded because those operations are read-scoped by contract and is
   verified by ``test_g5_security_parity.py``.  Operations that omit
   ``oidcScopes`` (relying on global security) are skipped.

3. **test_healthz_exempt_from_oidc** — ``/healthz`` probes that carry
   an explicit ``security:`` block must NOT require ``oidcScopes``;
   bearerAuth + tenantHeader suffice for liveness checks.

Related: 13 硬规则 §1 (oasdiff gate), ADR-0011 (SEC-IAM-01).
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

# Query-shaped POST operations are an intentional exception to the HTTP-method
# default.  Keep the identities pinned so a new read-scoped POST cannot evade
# this guard merely by adding ``x-required-scopes`` to itself.
READ_POST_ENDPOINT_IDS = frozenset(
    {
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
)


def _load(path: Path) -> dict[str, Any]:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def _collect_endpoints() -> list[tuple[str, str, str, dict, Any]]:
    """Return ``(filename, method, path, op_dict, global_security)`` tuples."""
    endpoints: list[tuple[str, str, str, dict, Any]] = []
    for svc_file in sorted(SERVICES_DIR.glob("*.yaml")):
        doc = _load(svc_file)
        global_security = doc.get("security")
        for path, path_item in doc.get("paths", {}).items():
            if not isinstance(path_item, dict):
                continue
            for method, op in path_item.items():
                if method.lower() not in HTTP_METHODS:
                    continue
                if not isinstance(op, dict):
                    continue
                endpoints.append((svc_file.name, method.upper(), path, op, global_security))
    return endpoints


def _ep_id(fname: str, method: str, path: str, *_: Any) -> str:
    return f"{fname}::{method} {path}"


ALL_ENDPOINTS = _collect_endpoints()
WRITE_ENDPOINTS = [
    e
    for e in ALL_ENDPOINTS
    if e[1].lower() in WRITE_METHODS and _ep_id(*e) not in READ_POST_ENDPOINT_IDS
]
HEALTHZ_ENDPOINTS = [e for e in ALL_ENDPOINTS if "/healthz" in e[2]]


# ---------------------------------------------------------------------------
# 1. Every endpoint has security coverage
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "fname, method, path, op, global_security",
    ALL_ENDPOINTS,
    ids=[_ep_id(*e) for e in ALL_ENDPOINTS],
)
def test_all_endpoints_have_security(
    fname: str, method: str, path: str, op: dict, global_security: Any,
) -> None:
    """No route ships without an authentication contract.

    Coverage is satisfied when *either* the contract declares a
    top-level ``security:`` default *or* the operation itself carries a
    ``security:`` key (including ``[]`` for intentionally-public routes
    such as login endpoints).
    """
    has_global = global_security is not None
    has_endpoint = "security" in op
    assert has_global or has_endpoint, (
        f"{fname} {method} {path} has no security — neither the contract "
        f"declares a top-level security nor the operation carries one"
    )


def test_endpoint_inventory_non_empty() -> None:
    """Guard: we actually collected endpoints; 0 means a path bug."""
    assert len(ALL_ENDPOINTS) >= 50, (
        f"Expected ≥50 endpoints across 17 domains, got {len(ALL_ENDPOINTS)}"
    )


# ---------------------------------------------------------------------------
# 2. Write endpoints that declare oidcScopes use platform.write
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "fname, method, path, op, global_security",
    WRITE_ENDPOINTS,
    ids=[_ep_id(*e) for e in WRITE_ENDPOINTS],
)
def test_write_endpoints_use_write_scope(
    fname: str, method: str, path: str, op: dict, global_security: Any,
) -> None:
    """Mutating operations declaring ``oidcScopes`` must require write.

    Operations without an explicit ``security`` block inherit the
    contract-level default and are skipped here (covered by
    ``test_all_endpoints_have_security``).  Only operations that
    *explicitly* declare ``oidcScopes`` are checked, ensuring the scope
    is ``platform.write`` (never ``platform.read``) for mutations.
    """
    if "security" not in op:
        pytest.skip("operation inherits global security — no oidcScopes to check")
    sec = op["security"]
    if not sec:  # security: []  → intentionally public (e.g. login)
        pytest.skip("operation is intentionally public (security: [])")
    for req in sec:
        if isinstance(req, dict) and "oidcScopes" in req:
            scopes = req["oidcScopes"]
            assert "platform.write" in scopes, (
                f"{fname} {method} {path} declares oidcScopes {scopes} "
                f"but a write operation must include platform.write"
            )


# ---------------------------------------------------------------------------
# 3. /healthz probes are exempt from oidcScopes
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "fname, method, path, op, global_security",
    HEALTHZ_ENDPOINTS,
    ids=[_ep_id(*e) for e in HEALTHZ_ENDPOINTS],
)
def test_healthz_exempt_from_oidc(
    fname: str, method: str, path: str, op: dict, global_security: Any,
) -> None:
    """``/healthz`` must not require ``oidcScopes``.

    Liveness probes carry bearerAuth + tenantHeader at most; requiring
    an OAuth scope would break infrastructure health-check tooling that
    has no scope-aware token.
    """
    if "security" not in op:
        pytest.skip("healthz inherits global security — no explicit block")
    sec = op["security"]
    if not sec:  # security: [] → fully public probe
        return
    for req in sec:
        if isinstance(req, dict):
            assert "oidcScopes" not in req, (
                f"{fname} {method} {path} requires oidcScopes but "
                f"healthz probes must be exempt"
            )
