from __future__ import annotations

"""Conftest for mate-tech-ont."""

# install_auth() reads these env vars at app-import time. Set them
# BEFORE any `mate_tech_ont.main` import so the AuthConfig resolves in
# test profile (mirrors mate-tech-iam / mate-tech-mcp conftest).
import os
import time

os.environ.setdefault("INSECURE_SKIP_SIGNATURE", "1")
os.environ.setdefault("KEYCLOAK_URL", "http://localhost:8080")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("KEYCLOAK_AUDIENCE", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_ID", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")


# BUSINESS-SLICES: ensure cross-package paths work without `pip install -e .`
import sys as _sys
from pathlib import Path as _Path

_MONOREPO = _Path(__file__).resolve().parents[3]
for _sub in (
    "mate-tech-ont",
    "mate-platform",
    "mate-clients",
    "mate-common",
):
    _p = str(_MONOREPO / "packages" / _sub / "src")
    if _p not in _sys.path:
        _sys.path.insert(0, _p)

# BUSINESS-SLICES: ensure cross-package paths work without `pip install -e .`
import sys as _bsl_sys
from pathlib import Path as _bsl_Path

import pytest

_BSL_MONOREPO = _bsl_Path(__file__).resolve().parents[3]
for _bsl_sub in (
    "mate-tech-ont",
    "mate-platform",
    "mate-clients",
    "mate-common",
):
    _bsl_p = str(_BSL_MONOREPO / "packages" / _bsl_sub / "src")
    if _bsl_p not in _bsl_sys.path:
        _bsl_sys.path.insert(0, _bsl_p)

# BUSINESS-SLICES: ensure cross-package paths work without `pip install -e .`
import sys as _bsl_sys
from pathlib import Path as _bsl_Path

_BSL_MONOREPO = _bsl_Path(__file__).resolve().parents[3]
for _bsl_sub in (
    "mate-tech-ont",
    "mate-platform",
    "mate-clients",
    "mate-common",
):
    _bsl_p = str(_BSL_MONOREPO / "packages" / _bsl_sub / "src")
    if _bsl_p not in _bsl_sys.path:
        _bsl_sys.path.insert(0, _bsl_p)
import jwt as _pyjwt

from mate_tech_ont.instances.store import store as instance_store
from mate_tech_ont.security.tenant import TenantContext

_TEST_JWT_SECRET = "test-secret"  # noqa: S105


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


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {make_keycloak_token()}"}


@pytest.fixture(autouse=True)
def _reset_stores() -> None:
    instance_store._instances.clear()
    instance_store._relations.clear()


@pytest.fixture
def acme_ctx() -> TenantContext:
    return TenantContext(tenant_id="acme", user_id="alice", roles=("editor",))


@pytest.fixture
def bob_ctx() -> TenantContext:
    return TenantContext(tenant_id="bob", user_id="bob", roles=("editor",))
