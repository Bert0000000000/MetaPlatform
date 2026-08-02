"""Shared pytest fixtures for mate-tech-deep-research tests.

Sets up the env vars required by ``mate_platform.auth`` so the
TestClient can run without a real Keycloak:
  * ``INSECURE_SKIP_SIGNATURE=1`` — token verifier trusts the JWT claims.
  * ``KEYCLOAK_URL``               — required by load_auth_config.
  * ``LEGACY_LOGIN_COMPAT=true``   — allow the no-secret fallback for tests.

Provides:
  * ``outbox``         — a fresh InMemoryOutboxWriter per test.
  * ``client``         — TestClient with the outbox wired in.
  * ``auth_headers_*`` — Bearer tokens bound to tenant-acme / tenant-globex.
"""
from __future__ import annotations

import os
import time
from collections.abc import Iterator

import jwt as pyjwt
import pytest
from fastapi.testclient import TestClient

# Match the mate-app-a2a pattern: set env BEFORE importing mate_platform.auth.
os.environ.setdefault("INSECURE_SKIP_SIGNATURE", "1")
os.environ.setdefault("LEGACY_LOGIN_COMPAT", "true")
os.environ.setdefault("KEYCLOAK_URL", "http://localhost:8080")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("KEYCLOAK_AUDIENCE", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_ID", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")

from mate_platform.messaging.outbox import InMemoryOutboxWriter

from mate_tech_deep_research.api import router as router_module
from mate_tech_deep_research.deerflow.client import DeerFlowClient
from mate_tech_deep_research.main import create_app

JWT_SECRET = "test-secret"


def _keycloak_token(
    *,
    sub: str = "u-1",
    roles: list[str] | None = None,
    scopes: str = "platform.read platform.write",
    tenant_id: str = "tenant-acme",
) -> str:
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


class _StubDeerFlowClient:
    """In-process stub that returns a fixed ResearchResponse.

    Tests can set ``raise_unavailable=True`` to simulate a 503, or
    replace ``response`` with a custom ResearchResponse.
    """

    def __init__(self) -> None:
        from mate_tech_deep_research.api.schemas import (
            ResearchResponse,
            Source,
        )

        self.response = ResearchResponse(
            report="# Stub report\n\nHello.",
            sources=[
                Source(
                    url="https://example.com/1",
                    title="Example",
                    snippet="...",
                    reliability="high",
                    fetched_at="2026-08-02T00:00:00Z",
                )
            ],
            duration_ms=1234,
        )
        self.raise_unavailable = False
        self.calls: list = []

    async def check(self) -> bool:  # pragma: no cover - trivial stub
        return not self.raise_unavailable

    async def research(self, request):  # type: ignore[no-untyped-def]
        from mate_tech_deep_research.deerflow.client import DeerFlowUnavailableError

        self.calls.append(request)
        if self.raise_unavailable:
            raise DeerFlowUnavailableError("stub: DeerFlow Engine unavailable")
        return self.response


@pytest.fixture
def stub_client() -> _StubDeerFlowClient:
    """A stub DeerFlowClient installed as the module-level singleton."""
    stub = _StubDeerFlowClient()
    prev = router_module._client_singleton
    router_module.set_deerflow_client(stub)
    yield stub
    router_module.set_deerflow_client(prev)


@pytest.fixture
def outbox() -> InMemoryOutboxWriter:
    return InMemoryOutboxWriter()


@pytest.fixture
def client(
    outbox: InMemoryOutboxWriter, stub_client: _StubDeerFlowClient,
) -> Iterator[TestClient]:
    """TestClient with a stub DeerFlow client + a fresh in-memory outbox."""
    app = create_app()
    app.state.outbox_writer = outbox
    yield TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def auth_headers_acme() -> dict[str, str]:
    return {"Authorization": f"Bearer {_keycloak_token(tenant_id='tenant-acme')}"}


@pytest.fixture
def auth_headers_globex() -> dict[str, str]:
    return {"Authorization": f"Bearer {_keycloak_token(tenant_id='tenant-globex')}"}


def make_token(**kwargs) -> str:
    """Public helper so individual test modules can mint tokens."""
    return _keycloak_token(**kwargs)
