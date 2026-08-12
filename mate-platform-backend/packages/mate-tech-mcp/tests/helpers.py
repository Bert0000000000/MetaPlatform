"""Test helpers for mate-tech-mcp (kept out of conftest.py).

``conftest.py`` must not expose bare-module imports that tests rely on
(``from conftest import ...`` resolves ambiguously when multiple test
packages are collected in one session). Token helpers live here so both
conftest fixtures and test modules import them by path.
"""
from __future__ import annotations

import time

import jwt as _pyjwt

_TEST_JWT_SECRET = "test-secret"  # noqa: S105 - test-only signing key


def make_keycloak_token(
    *,
    sub: str = "u-1",
    tenant_id: str = "tenant-acme",
    roles: list[str] | None = None,
    scopes: str = "platform.read platform.write",
) -> str:
    """Build a Keycloak-format JWT compatible with mate_platform.auth.

    The install_auth middleware validates iss/aud even under
    INSECURE_SKIP_SIGNATURE=1, so the token must carry the expected
    claims to reach the handler instead of being rejected with 401.
    """
    now = int(time.time())
    resolved = roles or ["PLATFORM_SUPER_ADMIN"]
    return _pyjwt.encode(
        {
            "sub": sub,
            "iss": "http://localhost:8080/realms/metaplatform",
            "aud": "metaplatform-backend",
            "azp": "metaplatform-backend",
            "preferred_username": sub,
            "realm_access": {"roles": resolved},
            "scope": scopes,
            "attributes": {"tenant_id": [tenant_id]},
            "tenant_id": tenant_id,
            "roles": resolved,
            "iat": now,
            "exp": now + 3600,
        },
        _TEST_JWT_SECRET,
        algorithm="HS256",
    )


def auth_header(tenant_id: str = "tenant-acme") -> dict[str, str]:
    """Return an Authorization header with a Keycloak-format token."""
    return {"Authorization": f"Bearer {make_keycloak_token(tenant_id=tenant_id)}"}
