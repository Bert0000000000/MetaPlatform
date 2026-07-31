"""Shared pytest fixtures for mate-app-hub tests."""
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

from mate_app_hub.main import create_app
from mate_app_hub.repositories import in_memory as in_memory_repo

JWT_SECRET = "test-secret"  # noqa: S105 — test-only signing key (verifier is in INSECURE mode)


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
