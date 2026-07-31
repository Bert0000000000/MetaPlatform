"""Conftest for mate-tech-msg (ST-5.1.12.1)."""
from __future__ import annotations

# install_auth() reads these env vars at app-import time. Set them
# BEFORE any `mate_tech_msg.main` import so the AuthConfig resolves in
# test profile (mirrors mate-tech-iam / mate-app-copilot conftest).
import os
import time

os.environ.setdefault("INSECURE_SKIP_SIGNATURE", "1")
os.environ.setdefault("KEYCLOAK_URL", "http://localhost:8080")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("KEYCLOAK_AUDIENCE", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_ID", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")

# BUSINESS-SLICES P1 wave 2: ensure cross-package paths work
# without `pip install -e .`. The block is appended after all
# `from __future__` and standard imports to keep Python happy.
import sys as _bsl_sys
from pathlib import Path as _bsl_Path
from unittest.mock import AsyncMock

import jwt as _pyjwt
import pytest

_BSL_MONOREPO = _bsl_Path(__file__).resolve().parents[3]
for _bsl_sub in (
    "mate-tech-msg",
    "mate-platform",
    "mate-clients",
    "mate-common",
):
    _bsl_p = str(_BSL_MONOREPO / "packages" / _bsl_sub / "src")
    if _bsl_p not in _bsl_sys.path:
        _bsl_sys.path.insert(0, _bsl_p)
from mate_tech_msg.dedup import DedupStore
from mate_tech_msg.kafka_client import KafkaClient

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


@pytest.fixture
def kafka_client_with_mock_producer() -> KafkaClient:
    """KafkaClient whose producer.send_and_wait returns a fresh
    metadata-like object on every call. Tests can read .partition,
    ".offset" and assert .send_and_wait was called."""
    client = KafkaClient(bootstrap_servers="mock://localhost:9092")
    producer_mock = AsyncMock()
    # Return a value with .partition/.offset attributes; AsyncMock
    # set as return_value gets unwrapped once at await time.
    meta = type("Meta", (), {"partition": 0, "offset": 0})()
    producer_mock.send_and_wait = AsyncMock(return_value=meta)
    client._producer = producer_mock
    return client


@pytest.fixture
def dedup_mock() -> DedupStore:
    store = DedupStore.__new__(DedupStore)
    store._redis = AsyncMock()
    store._ttl = 7 * 24 * 3600
    return store
