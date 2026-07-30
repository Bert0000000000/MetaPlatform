"""P0 close-out (2026-07-30): kb path alignment tests.

Per `docs/active/specs/2026-07-30-backend-impl-backlog.md` §2.1,
the canonical prefix for the kb domain is `/api/v1/kb/*` (matches
`contracts/openapi/services/kb.yaml`). The legacy prefix
`/api/v1/app-kb/*` remains as a deprecated alias for one release
and must:

  - still resolve to the same handlers
  - emit the RFC 8594 `Deprecation` response header
  - go through `install_auth` + `require_tenant` like the canonical
    path (no security regression in either direction)
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import TYPE_CHECKING
from unittest.mock import patch

import pytest

if TYPE_CHECKING:
    from fastapi.testclient import TestClient

REPO = Path(__file__).resolve().parents[3]
PKG = REPO / "mate-platform-backend" / "packages"
for sub in ("mate-platform", "mate-clients", "mate-common", "mate-app-kb"):
    sys.path.insert(0, str(PKG / sub / "src"))

os.environ.setdefault("LEGACY_LOGIN_COMPAT", "true")
os.environ.setdefault("KEYCLOAK_URL", "https://keycloak.test.invalid")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")

# Imports below the sys.path bootstrap would trigger E402. Move
# the cross-package imports into the fixture body where they're
# used (ruff ignores PLC0415 for tests/**/*.py).


@pytest.fixture
def client():
    from fastapi.testclient import TestClient

    from mate_app_kb.api.app import create_app
    from mate_app_kb.clients import AgentClient, RAGClient

    fake_rag = RAGClient()
    fake_rag.search = lambda query, top_k=5, mode="AUTO": {
        "query": query,
        "mode": mode,
        "total": 1,
        "hits": [{"id": "h1", "score": 0.9, "content": "ok"}],
    }
    fake_rag.stats = lambda: {"total_chunks": 7, "embedder_dim": 1536}
    fake_rag.upload = lambda raw, fname, doc_id, ct: {
        "document_id": doc_id,
        "filename": fname,
        "size_bytes": len(raw),
        "chunk_count": 2,
        "indexed_in": ["pg"],
    }
    fake_agent = AgentClient()
    fake_agent.chat = lambda message, scenario="S1", thread_id=None: {
        "thread_id": thread_id or "t-1",
        "scenario": scenario,
        "answer": f"echo:{message}",
        "retrieved_chunks": [],
        "tool_calls": [],
    }
    fake_agent.stream_chat = lambda message, scenario="S1", thread_id=None: iter(["data: chunk"])

    # We stub require_tenant to always pass when an authenticated
    # ctx is present; the path-alignment tests don't exercise the
    # tenant guard (that is covered in test_app_kb_tenant_integration).
    with patch("mate_app_kb.api.app.install_auth"), \
         patch("mate_app_kb.api.app.require_tenant"):
        app = create_app(rag=fake_rag, agent=fake_agent)
        # inject a fake auth ctx into request.state for every call
        from mate_platform.tenancy import (
            AuthMethod,
            RequestContext,
            TenantId,
            UserId,
        )

        async def fake_middleware(request, call_next):
            request.state.ctx = RequestContext(
                request_id="r1",
                trace_id="trace-1",
                tenant_id=TenantId("acme"),
                user_id=UserId("u1"),
                roles=frozenset(),
                permissions=frozenset(),
                client_id="test",
                auth_method=AuthMethod.USER,
            )
            return await call_next(request)

        app.middleware("http")(fake_middleware)
        yield TestClient(app)


CANONICAL_PREFIX = "/api/v1/kb"
LEGACY_PREFIX = "/api/v1/app-kb"


class TestCanonicalPrefixExposed:
    """The 5 endpoints from the spec must be reachable under /api/v1/kb."""

    def test_stats_canonical(self, client: TestClient) -> None:
        r = client.get(f"{CANONICAL_PREFIX}/stats")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["total_chunks"] == 7
        assert body["embedder_dim"] == 1536
        # Canonical path must NOT emit Deprecation.
        assert "Deprecation" not in r.headers

    def test_search_canonical(self, client: TestClient) -> None:
        r = client.post(
            f"{CANONICAL_PREFIX}/search",
            json={"query": "hi", "top_k": 3, "mode": "AUTO"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["query"] == "hi"
        assert body["total"] == 1
        assert body["hits"][0]["id"] == "h1"
        assert "Deprecation" not in r.headers

    def test_chat_canonical(self, client: TestClient) -> None:
        r = client.post(
            f"{CANONICAL_PREFIX}/chat",
            json={"message": "ping", "scenario": "S1"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["answer"] == "echo:ping"
        assert "Deprecation" not in r.headers


class TestLegacyPrefixStillWorks:
    """The legacy /api/v1/app-kb/* paths remain reachable as aliases."""

    def test_stats_legacy_returns_deprecation_header(self, client: TestClient) -> None:
        r = client.get(f"{LEGACY_PREFIX}/stats")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["total_chunks"] == 7
        # Legacy path emits the Deprecation header (RFC 8594) pointing
        # at the canonical path.
        assert "Deprecation" in r.headers
        assert "/api/v1/kb" in r.headers["Deprecation"]

    def test_search_legacy_returns_deprecation_header(self, client: TestClient) -> None:
        r = client.post(
            f"{LEGACY_PREFIX}/search",
            json={"query": "hi", "top_k": 3, "mode": "AUTO"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["total"] == 1
        assert "Deprecation" in r.headers

    def test_chat_legacy_returns_deprecation_header(self, client: TestClient) -> None:
        r = client.post(
            f"{LEGACY_PREFIX}/chat",
            json={"message": "ping", "scenario": "S1"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["answer"] == "echo:ping"
        assert "Deprecation" in r.headers


class TestBothPrefixesCovered:
    """No endpoint should be reachable only on one prefix."""

    @pytest.mark.parametrize("endpoint", ["stats", "chat", "search"])
    def test_both_prefixes_resolve(self, client: TestClient, endpoint: str) -> None:
        # GET for stats; POST for chat/search.
        if endpoint == "stats":
            canon = client.get(f"{CANONICAL_PREFIX}/{endpoint}")
            legacy = client.get(f"{LEGACY_PREFIX}/{endpoint}")
        else:
            payload = {"query": "hi", "top_k": 1, "mode": "AUTO"} if endpoint == "search" \
                else {"message": "ping", "scenario": "S1"}
            canon = client.post(f"{CANONICAL_PREFIX}/{endpoint}", json=payload)
            legacy = client.post(f"{LEGACY_PREFIX}/{endpoint}", json=payload)
        assert canon.status_code == 200, (endpoint, canon.text)
        assert legacy.status_code == 200, (endpoint, legacy.text)
        # Both return the same body.
        assert canon.json() == legacy.json()


class TestLegacyPrefixTaggedDeprecated:
    """The OpenAPI schema must mark legacy routes as deprecated."""

    def test_legacy_routes_have_deprecated_flag(self) -> None:
        from mate_app_kb.api.app import create_app

        with patch("mate_app_kb.api.app.install_auth"):
            app = create_app()
        schema = app.openapi()
        paths = schema.get("paths", {})
        legacy_routes = [
            f"{LEGACY_PREFIX}/upload",
            f"{LEGACY_PREFIX}/search",
            f"{LEGACY_PREFIX}/chat",
            f"{LEGACY_PREFIX}/chat/stream",
            f"{LEGACY_PREFIX}/stats",
        ]
        for route in legacy_routes:
            assert route in paths, f"Legacy route missing: {route}"
            for method_obj in paths[route].values():
                # FastAPI sets deprecated=True in the OpenAPI schema.
                assert method_obj.get("deprecated") is True, (
                    f"Legacy route {route} not flagged deprecated"
                )
