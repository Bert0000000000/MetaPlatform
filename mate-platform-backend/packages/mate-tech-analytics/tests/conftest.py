"""Conftest for mate-tech-analytics.

Mirrors mate-tech-obs/tests/conftest.py: install_auth() reads env vars
at app-import time, so they must be set BEFORE importing
`mate_tech_analytics.main`. Cross-package source paths are injected so
tests run without `pip install -e .`.
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

os.environ.setdefault("INSECURE_SKIP_SIGNATURE", "1")
os.environ.setdefault("KEYCLOAK_URL", "http://localhost:8080")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("KEYCLOAK_AUDIENCE", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_ID", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")
os.environ.setdefault("LEGACY_LOGIN_COMPAT", "true")

# BUSINESS-SLICES: cross-package import paths without `pip install -e .`.
_MONOREPO = Path(__file__).resolve().parents[3]
for _sub in (
    "mate-tech-analytics",
    "mate-platform",
    "mate-clients",
    "mate-common",
):
    _p = str(_MONOREPO / "packages" / _sub / "src")
    if _p not in sys.path:
        sys.path.insert(0, _p)

import jwt as _pyjwt
import pytest
from fastapi.testclient import TestClient

_TEST_JWT_SECRET = "test-secret"
DEFAULT_TENANT = "tenant-acme"
SECOND_TENANT = "tenant-globex"


def make_keycloak_token(
    *,
    sub: str = "u-1",
    tenant_id: str | None = DEFAULT_TENANT,
    roles: list[str] | None = None,
    scopes: str = "platform.read platform.write",
) -> str:
    """Build a Keycloak-format JWT compatible with mate_platform.auth.

    Under INSECURE_SKIP_SIGNATURE=1 the signature is not checked, but
    iss/aud claims still must match the expected config, and the
    attributes.tenant_id claim drives the resolved tenant binding.

    Pass tenant_id=None (or empty) to emit a token with no tenant binding
    so require_tenant() raises TenantAccessError -> 400.
    """
    now = int(time.time())
    resolved = roles or ["PLATFORM_SUPER_ADMIN"]
    attributes: dict[str, list[str]] = {}
    if tenant_id:
        attributes["tenant_id"] = [tenant_id]
    payload: dict[str, object] = {
        "sub": sub,
        "iss": "http://localhost:8080/realms/metaplatform",
        "aud": "metaplatform-backend",
        "azp": "metaplatform-backend",
        "preferred_username": sub,
        "realm_access": {"roles": resolved},
        "scope": scopes,
        "attributes": attributes,
        "roles": resolved,
        "iat": now,
        "exp": now + 3600,
    }
    if tenant_id:
        payload["tenant_id"] = tenant_id
    return _pyjwt.encode(payload, _TEST_JWT_SECRET, algorithm="HS256")


@pytest.fixture
def auth_headers() -> dict[str, str]:
    """Default tenant (tenant-acme) auth headers."""
    return {"Authorization": f"Bearer {make_keycloak_token()}"}


@pytest.fixture
def second_tenant_headers() -> dict[str, str]:
    """A second tenant (tenant-globex) for cross-tenant isolation tests."""
    return {"Authorization": f"Bearer {make_keycloak_token(tenant_id=SECOND_TENANT)}"}


@pytest.fixture
def no_tenant_headers() -> dict[str, str]:
    """Token with no tenant binding -> require_tenant raises 400."""
    return {"Authorization": f"Bearer {make_keycloak_token(tenant_id=None)}"}


@pytest.fixture
def client() -> TestClient:
    from mate_tech_analytics.main import app

    return TestClient(app)
