"""Shared pytest fixtures for mate-tech-iam tests."""
from __future__ import annotations

import os
import tempfile
import time
from collections.abc import AsyncIterator

import jwt as pyjwt
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

# Force in-memory SQLite and disable telemetry BEFORE app import.
os.environ.setdefault("IAM_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("IAM_DATA_DIR", tempfile.mkdtemp(prefix="mate-iam-test-"))
os.environ.setdefault("IAM_DEV_JWT_SECRET", "test-secret")
# install_auth() in mate_tech_iam.main reads these to build AuthConfig.
# Tests use Keycloak-format JWTs (see make_keycloak_token below) and
# rely on INSECURE_SKIP_SIGNATURE=1 to skip JWKS lookup.
os.environ.setdefault("INSECURE_SKIP_SIGNATURE", "1")
os.environ.setdefault("KEYCLOAK_URL", "http://localhost:8080")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("KEYCLOAK_AUDIENCE", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_ID", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")
os.environ.setdefault("LOG_LEVEL", "WARNING")

from mate_tech_iam.db import AsyncSessionMaker, engine, init_db
from mate_tech_iam.main import app
from mate_tech_iam.seed import seed
from mate_tech_iam.services.deps import (
    JWT_SECRET,
)


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    await init_db()
    async with AsyncSessionMaker() as session:
        await seed(session)
        yield session
    # Drop tables for next test.
    from sqlmodel import SQLModel

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)


def make_keycloak_token(
    sub: str = "u-1",
    *,
    roles: list[str] | None = None,
    scopes: str = "platform.read platform.write",
    tenant_id: str = "tenant-default",
    azp: str = "metaplatform-backend",
) -> str:
    """Build a Keycloak-format JWT compatible with mate_platform.auth.

    The verifier expects:
      * `iss` == `{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}`
      * `aud` == `{KEYCLOAK_AUDIENCE}` (string or list)
      * realm roles live under `realm_access.roles`
      * scopes are space-separated under `scope`
      * tenant_id lives under `attributes.tenant_id[0]` (Keycloak attribute syntax)

    Tests run with INSECURE_SKIP_SIGNATURE=1 so signature verification
    is skipped, but iss/aud checks remain — the token must therefore
    carry the correct values.
    """
    now = int(time.time())
    resolved_roles = roles or ["PLATFORM_SUPER_ADMIN"]
    payload = {
        "sub": sub,
        "iss": "http://localhost:8080/realms/metaplatform",
        "aud": "metaplatform-backend",
        "azp": azp,
        "preferred_username": sub,
        "realm_access": {"roles": resolved_roles},
        "scope": scopes,
        "attributes": {"tenant_id": [tenant_id]},
        # Legacy dev claims read by services/deps.get_caller (admin/users
        # endpoints). install_auth's verifier reads realm_access instead;
        # both claims coexist for the test bridge.
        "tenant_id": tenant_id,
        "roles": resolved_roles,
        "iat": now,
        "exp": now + 3600,
    }
    # Note: signing key is irrelevant under INSECURE_SKIP_SIGNATURE=1,
    # but pyjwt requires *some* key. JWT_SECRET matches what the
    # legacy IAM auth router uses, so the same token works whether
    # it reaches install_auth (Keycloak path) or the legacy
    # services/deps.parse_token fallback.
    return pyjwt.encode(payload, JWT_SECRET, algorithm="HS256")


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncIterator[AsyncClient]:
    """AsyncClient wrapping the FastAPI app, with a Keycloak-format bearer token."""
    token = make_keycloak_token(
        sub="admin",
        roles=["PLATFORM_SUPER_ADMIN", "PLATFORM_ADMIN"],
        scopes="platform.read platform.write",
        tenant_id="tenant-default",
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://testserver",
        headers={
            "Authorization": f"Bearer {token}",
        },
    ) as ac:
        yield ac


def make_token(sub: str, roles: list[str], tenant: str = "tenant-default") -> str:
    """Backwards-compat helper for tests that still build legacy HS256 tokens.

    These tokens lack iss/aud and therefore do NOT pass the bearer-token
    middleware once `install_auth` is in place. Prefer `make_keycloak_token`
    for new tests; this helper is retained for any test that intentionally
    exercises the legacy services/deps.parse_token path.
    """
    return pyjwt.encode(
        {"sub": sub, "roles": roles, "tenant_id": tenant},
        JWT_SECRET,
        algorithm="HS256",
    )
