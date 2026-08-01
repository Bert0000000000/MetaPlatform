"""Historical message query tests for mate-tech-msg (P3-W8).

Covers GET /api/v1/msg/messages:
  * seed history is returned
  * topic filter narrows results
  * tenant isolation (tenant B never sees tenant A's rows)
  * ``since`` epoch-seconds filter
"""
from __future__ import annotations

import os
import sys
import time
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

REPO = Path(__file__).resolve().parents[3]
PKG = REPO / "packages"
for sub in ("mate-platform", "mate-clients", "mate-common", "mate-tech-msg"):
    sys.path.insert(0, str(PKG / sub / "src"))

os.environ.setdefault("INSECURE_SKIP_SIGNATURE", "1")
os.environ.setdefault("KEYCLOAK_URL", "http://localhost:8080")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("KEYCLOAK_AUDIENCE", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_ID", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")

import jwt as _pyjwt  # noqa: E402

from mate_tech_msg import in_memory as msg_store  # noqa: E402
from mate_tech_msg import main as main_mod  # noqa: E402

_TEST_JWT_SECRET = "test-secret"


def _make_token(tenant_id: str = "tenant-acme") -> str:
    now = int(time.time())
    return _pyjwt.encode(
        {
            "sub": "u-1",
            "iss": "http://localhost:8080/realms/metaplatform",
            "aud": "metaplatform-backend",
            "azp": "metaplatform-backend",
            "preferred_username": "u-1",
            "realm_access": {"roles": ["PLATFORM_SUPER_ADMIN"]},
            "scope": "platform.read platform.write",
            "attributes": {"tenant_id": [tenant_id]},
            "tenant_id": tenant_id,
            "roles": ["PLATFORM_SUPER_ADMIN"],
            "iat": now,
            "exp": now + 3600,
        },
        _TEST_JWT_SECRET,
        algorithm="HS256",
    )


@pytest.fixture
def client() -> Iterator[TestClient]:
    msg_store.reset_store()
    yield TestClient(main_mod.app)
    msg_store.reset_store()


@pytest.fixture
def auth_acme() -> dict[str, str]:
    return {"Authorization": f"Bearer {_make_token('tenant-acme')}"}


@pytest.fixture
def auth_globex() -> dict[str, str]:
    return {"Authorization": f"Bearer {_make_token('tenant-globex')}"}


def test_messages_returns_history(client: TestClient, auth_acme) -> None:
    """GET /messages returns the seeded message history."""
    r = client.get("/api/v1/msg/messages", headers=auth_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 1, body
    for m in body["items"]:
        assert m["tenant_id"] == "tenant-acme"
        assert {"id", "topic", "payload", "ts"} <= set(m)


def test_messages_filtered_by_topic(client: TestClient, auth_acme) -> None:
    """GET /messages?topic=... narrows results to that topic."""
    r = client.get(
        "/api/v1/msg/messages",
        params={"topic": "mate.events.user"},
        headers=auth_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 1
    assert all(m["topic"] == "mate.events.user" for m in body["items"])


def test_messages_tenant_isolation(
    client: TestClient, auth_acme, auth_globex,
) -> None:
    """Messages are tenant-scoped: globex never sees acme rows."""
    r_acme = client.get("/api/v1/msg/messages", headers=auth_acme)
    r_globex = client.get("/api/v1/msg/messages", headers=auth_globex)
    assert r_acme.status_code == 200
    assert r_globex.status_code == 200
    assert all(m["tenant_id"] == "tenant-acme" for m in r_acme.json()["items"])
    assert all(m["tenant_id"] == "tenant-globex" for m in r_globex.json()["items"])


def test_messages_since_filter(client: TestClient, auth_acme) -> None:
    """GET /messages?since=<epoch> returns only messages at/after that time."""
    # Seed ts values: 1000, 1100, 1200, 1300 -> since=1250 keeps the last one.
    r = client.get(
        "/api/v1/msg/messages",
        params={"since": 1250.0},
        headers=auth_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 1
    assert all(m["ts"] >= 1250.0 for m in body["items"])
