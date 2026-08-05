"""Shared fixtures for adversarial security tests.

These tests are platform-level (not per-app) and exercise the
boundaries that ADR-0018 (BUSINESS-SLICES SLO) requires us to hold:

* tenant isolation guards (rule 3)
* outgoing ACL middleware (rule 4)
* PII mask before LLM / external boundary
* quota + cost ceiling enforcement
* prompt-injection helpers (rule that retrieval content must not
  override system policy)

The fixtures deliberately avoid live network — every HTTP/Redis/PG
boundary is mocked so the tests run on a developer laptop.
"""

from __future__ import annotations

import os
import time

import jwt as pyjwt
import pytest

os.environ.setdefault("INSECURE_SKIP_SIGNATURE", "1")
os.environ.setdefault("KEYCLOAK_URL", "http://localhost:8080")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("KEYCLOAK_AUDIENCE", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_ID", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")

JWT_SECRET = "test-secret"


def _mint_token(
    *,
    sub: str = "u-1",
    tenant_id: str = "tenant-acme",
    roles: list[str] | None = None,
    scopes: str = "platform.read platform.write",
) -> str:
    now = int(time.time())
    resolved = roles if roles is not None else ["PLATFORM_USER"]
    return pyjwt.encode(
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
        JWT_SECRET,
        algorithm="HS256",
    )


@pytest.fixture
def acme_token() -> str:
    return _mint_token(tenant_id="tenant-acme")


@pytest.fixture
def globex_token() -> str:
    return _mint_token(tenant_id="tenant-globex")


@pytest.fixture
def cross_tenant_admin_token() -> str:
    return _mint_token(tenant_id="tenant-acme", roles=["PLATFORM_USER", "cross_tenant_admin"])


@pytest.fixture
def acme_auth_header(acme_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {acme_token}"}


@pytest.fixture
def globex_auth_header(globex_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {globex_token}"}
