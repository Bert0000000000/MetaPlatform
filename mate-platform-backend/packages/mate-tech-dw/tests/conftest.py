"""Shared pytest fixtures for mate-tech-dw tests."""
from __future__ import annotations

import os
import time
from collections.abc import Iterator

import jwt as pyjwt
import pytest
from fastapi.testclient import TestClient

# Set auth env BEFORE the package (and install_auth) imports — these
# must match what the mate-tech-iam tests use so the same Keycloak
# token shape verifies end-to-end.
os.environ.setdefault("INSECURE_SKIP_SIGNATURE", "1")
os.environ.setdefault("KEYCLOAK_URL", "http://localhost:8080")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("KEYCLOAK_AUDIENCE", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_ID", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")

from mate_tech_dw.main import create_app
from mate_tech_dw.repositories import in_memory as in_memory_repo

JWT_SECRET = "test-secret"


# Tenant-scoped employee id constants. Tests reference these instead of
# hard-coded `dw-emp-N` so that the seed's tenant-prefixed ids
# (e.g. dw-emp-acme-1, dw-emp-globex-1) can change without rewriting
# dozens of test callsites.
ACME_E1 = "dw-emp-acme-1"
ACME_E2 = "dw-emp-acme-2"
ACME_E3 = "dw-emp-acme-3"
ACME_E4 = "dw-emp-acme-4"
ACME_E5 = "dw-emp-acme-5"
ACME_E6 = "dw-emp-acme-6"
ACME_E7 = "dw-emp-acme-7"
GLOBEX_E1 = "dw-emp-globex-1"
GLOBEX_E2 = "dw-emp-globex-2"


def _keycloak_token(
    *,
    sub: str = "u-1",
    roles: list[str] | None = None,
    scopes: str = "platform.read platform.write",
    tenant_id: str = "tenant-acme",
) -> str:
    """Build a Keycloak-format JWT that satisfies install_auth."""
    now = int(time.time())
    resolved = roles if roles is not None else ["PLATFORM_SUPER_ADMIN"]
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
def client() -> Iterator[TestClient]:
    """Per-test TestClient with the in-memory store reset."""
    in_memory_repo.reset_store()
    app = create_app()
    yield TestClient(app)
    in_memory_repo.reset_store()


@pytest.fixture
def auth_headers_acme() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {_keycloak_token(tenant_id='tenant-acme')}",
    }


@pytest.fixture
def auth_headers_globex() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {_keycloak_token(tenant_id='tenant-globex')}",
    }


@pytest.fixture
def acme_emp_id() -> callable:
    """Resolve an acme-tenant employee seed id by its slot number (1..7).

    Mirrors `mate_tech_dw.repositories.in_memory._emp_id` so tests can
    reference `dw-emp-1` (slot) instead of `dw-emp-acme-1` (concrete
    tenant-scoped id).
    """
    def _resolve(n: int) -> str:
        return f"dw-emp-acme-{n}"
    return _resolve


@pytest.fixture
def globex_emp_id() -> callable:
    """Same as `acme_emp_id` but for the globex tenant."""
    def _resolve(n: int) -> str:
        return f"dw-emp-globex-{n}"
    return _resolve
