"""Tests for long-lived MCP API keys (ADR-0062).

Covers key material generation, the SQL store's tenant-scoped CRUD, the
``install_auth`` verifier hook end-to-end (including fail-closed behaviour when
storage is disabled), the management endpoints shipped behind the MCP center UI,
and the security invariant that an API key cannot reach the HITL proposal tools.
"""

from __future__ import annotations

import asyncio
import sys
import types
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

_MONOREPO = Path(__file__).resolve().parents[3]
_DB_SRC = str(_MONOREPO / "packages" / "mate-tech-db" / "src")
if _DB_SRC not in sys.path:
    sys.path.insert(0, _DB_SRC)

from mate_platform.auth import install_auth
from mate_platform.tenancy import AuthMethod
from mate_tech_db.base import create_all, init_engine, reset_engine

from mate_tech_mcp.protocol.streamable import MateStreamableHttpServer
from mate_tech_mcp.repositories import sql_models as models
from mate_tech_mcp.security import (
    KEY_PREFIX,
    McpApiKeyRejected,
    McpApiKeyStore,
    generate_api_key,
    hash_key,
    mcp_api_key_verifier,
    set_api_key_runtime,
)
from mate_tech_mcp.server import create_server

TENANT_A = "tenant-acme"
TENANT_B = "tenant-bigo"


@pytest.fixture(autouse=True)
def _fresh_store() -> Iterator[McpApiKeyStore]:
    """SQLite in-memory schema + a wired store for every test."""
    reset_engine()
    init_engine("sqlite:///:memory:")
    create_all()
    store = McpApiKeyStore()
    set_api_key_runtime(store)
    yield store
    set_api_key_runtime(None)
    reset_engine()


class _FakeRequest:
    def __init__(self, headers: dict[str, str] | None = None) -> None:
        self.headers = headers or {}
        self.state = types.SimpleNamespace()


def _verify(token: str) -> object:
    return asyncio.run(mcp_api_key_verifier(_FakeRequest(), token))


# ---------------------------------------------------------------------------
# Key material
# ---------------------------------------------------------------------------
def test_generate_api_key_shape() -> None:
    plaintext, digest, prefix = generate_api_key()
    assert plaintext.startswith(KEY_PREFIX)
    assert len(digest) == 64  # sha256 hex
    assert digest == hash_key(plaintext)
    assert prefix == plaintext[:11]
    assert plaintext not in digest


def test_generate_api_key_is_unique() -> None:
    assert generate_api_key()[0] != generate_api_key()[0]


# ---------------------------------------------------------------------------
# Store
# ---------------------------------------------------------------------------
def test_store_persists_hash_only(_fresh_store: McpApiKeyStore) -> None:
    record, plaintext = _fresh_store.create(tenant_id=TENANT_A, key_name="codex")

    stored = _fresh_store.get_by_hash(hash_key(plaintext))
    assert stored is not None
    assert stored.key_id == record.key_id
    # The plaintext must not be recoverable from the row.
    from mate_tech_db.base import get_session

    session = get_session()
    try:
        row = session.get(models.McpApiKeyORM, record.key_id)
        assert row is not None
        assert plaintext not in str(row.__dict__)
    finally:
        session.close()


def test_store_is_tenant_scoped(_fresh_store: McpApiKeyStore) -> None:
    _fresh_store.create(tenant_id=TENANT_A, key_name="a")
    _fresh_store.create(tenant_id=TENANT_B, key_name="b")

    assert [k.key_name for k in _fresh_store.list_keys(TENANT_A)] == ["a"]
    assert [k.key_name for k in _fresh_store.list_keys(TENANT_B)] == ["b"]


def test_revoke_is_tenant_scoped(_fresh_store: McpApiKeyStore) -> None:
    record, _ = _fresh_store.create(tenant_id=TENANT_A, key_name="a")

    # Another tenant must not be able to revoke it.
    assert _fresh_store.revoke(TENANT_B, record.key_id) is False
    assert _fresh_store.list_keys(TENANT_A)

    assert _fresh_store.revoke(TENANT_A, record.key_id) is True
    assert _fresh_store.list_keys(TENANT_A) == []


# ---------------------------------------------------------------------------
# Verifier
# ---------------------------------------------------------------------------
def test_verifier_accepts_valid_key(_fresh_store: McpApiKeyStore) -> None:
    record, plaintext = _fresh_store.create(tenant_id=TENANT_A, key_name="codex")

    ctx = _verify(plaintext)
    assert str(ctx.auth_method) == "api_key"  # type: ignore[attr-defined]
    assert str(ctx.tenant_id) == TENANT_A  # type: ignore[attr-defined]
    assert str(ctx.user_id) == f"apikey:{record.key_id}"  # type: ignore[attr-defined]
    assert ctx.is_authenticated  # type: ignore[attr-defined]
    assert not ctx.is_service  # type: ignore[attr-defined]


def test_verifier_rejects_non_mcp_token(_fresh_store: McpApiKeyStore) -> None:
    """A JWT-shaped token must fall through untouched, not be misread."""
    with pytest.raises(McpApiKeyRejected):
        _verify("eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1LTEifQ.signature")


def test_verifier_rejects_unknown_key(_fresh_store: McpApiKeyStore) -> None:
    with pytest.raises(McpApiKeyRejected):
        _verify(KEY_PREFIX + "not-a-real-key")


def test_verifier_rejects_revoked_key(_fresh_store: McpApiKeyStore) -> None:
    record, plaintext = _fresh_store.create(tenant_id=TENANT_A)
    assert _fresh_store.revoke(TENANT_A, record.key_id)
    with pytest.raises(McpApiKeyRejected):
        _verify(plaintext)


def test_verifier_rejects_expired_key(_fresh_store: McpApiKeyStore) -> None:
    _, plaintext = _fresh_store.create(
        tenant_id=TENANT_A,
        expires_at=datetime.now(UTC) - timedelta(minutes=1),
    )
    with pytest.raises(McpApiKeyRejected):
        _verify(plaintext)


def test_verifier_accepts_future_expiry(_fresh_store: McpApiKeyStore) -> None:
    _, plaintext = _fresh_store.create(
        tenant_id=TENANT_A,
        expires_at=datetime.now(UTC) + timedelta(hours=1),
    )
    assert str(_verify(plaintext).auth_method) == "api_key"  # type: ignore[attr-defined]


def test_verifier_fails_closed_when_store_disabled() -> None:
    """No store (MATE_DB_URL unset) must reject, never silently allow."""
    set_api_key_runtime(None)
    token = generate_api_key()[0]
    with pytest.raises(McpApiKeyRejected):
        _verify(token)


# ---------------------------------------------------------------------------
# install_auth integration (the real seam)
# ---------------------------------------------------------------------------
def _whoami_app() -> FastAPI:
    app = FastAPI()
    install_auth(app, api_key_verifier=mcp_api_key_verifier)

    @app.get("/api/v1/mcp/whoami")
    async def whoami(request: Request) -> dict[str, str]:
        ctx = request.state.ctx
        return {
            "auth_method": str(ctx.auth_method),
            "tenant_id": str(ctx.tenant_id),
            "user_id": str(ctx.user_id),
        }

    return app


def test_middleware_authenticates_api_key(_fresh_store: McpApiKeyStore) -> None:
    record, plaintext = _fresh_store.create(tenant_id=TENANT_A, key_name="codex")
    client = TestClient(_whoami_app())

    resp = client.get("/api/v1/mcp/whoami", headers={"Authorization": f"Bearer {plaintext}"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["auth_method"] == "api_key"
    assert body["tenant_id"] == TENANT_A
    assert body["user_id"] == f"apikey:{record.key_id}"


def test_middleware_rejects_unknown_api_key(_fresh_store: McpApiKeyStore) -> None:
    client = TestClient(_whoami_app())
    resp = client.get(
        "/api/v1/mcp/whoami",
        headers={"Authorization": f"Bearer {KEY_PREFIX}definitely-not-issued"},
    )
    assert resp.status_code == 401


def test_middleware_still_requires_a_token(_fresh_store: McpApiKeyStore) -> None:
    client = TestClient(_whoami_app())
    assert client.get("/api/v1/mcp/whoami").status_code == 401


# ---------------------------------------------------------------------------
# HITL invariant — an API key must never unlock AI-direct-write
# ---------------------------------------------------------------------------
class _HitlTool:
    name = "ont_confirm_proposal"
    description = "HITL-bound proposal confirmation"
    input_schema = {"type": "object", "properties": {"proposal_id": {"type": "string"}}}
    agent_invokable = False

    async def __call__(self, **arguments: object) -> dict[str, object]:
        return {"confirmed": True}


def test_api_key_cannot_reach_hitl_tool() -> None:
    """The HITL gate is credential-independent: the streamable surface strips
    ``__caller__`` unconditionally, so even a caller claiming to be a user is
    treated as an agent and blocked."""
    server = create_server("test-hitl")
    tool = _HitlTool()
    tool.handler = tool  # type: ignore[attr-defined]
    server.register_tool(tool)
    surface = MateStreamableHttpServer(server)

    with pytest.raises(PermissionError):
        asyncio.run(
            surface.call_tool(
                "ont_confirm_proposal",
                {"__caller__": "user", "proposal_id": "prop-1"},
            )
        )


def test_hitl_tool_is_advertised_as_not_agent_invokable() -> None:
    server = create_server("test-hitl-advert")
    tool = _HitlTool()
    tool.handler = tool  # type: ignore[attr-defined]
    server.register_tool(tool)

    listed = asyncio.run(server.list_tools())
    entry = next(t for t in listed if t["name"] == "ont_confirm_proposal")
    assert entry["agentInvokable"] is False


# ---------------------------------------------------------------------------
# Management endpoints (MCP center UI)
# ---------------------------------------------------------------------------
def _keys_app() -> FastAPI:
    from mate_tech_mcp.api.management_routes import router

    app = FastAPI()
    app.include_router(router)

    @app.middleware("http")
    async def _inject_ctx(request: Request, call_next):  # type: ignore[no-untyped-def]
        from mate_platform.tenancy import RequestContext, TenantId, UserId

        request.state.ctx = RequestContext(
            request_id="",
            trace_id="",
            tenant_id=TenantId(TENANT_A),
            user_id=UserId("u-admin"),
            roles=frozenset({"PLATFORM_SUPER_ADMIN"}),
            permissions=frozenset(),
            auth_method=AuthMethod.USER,
        )
        return await call_next(request)

    return app


def test_create_endpoint_returns_plaintext_once(_fresh_store: McpApiKeyStore) -> None:
    client = TestClient(_keys_app())

    created = client.post("/api/v1/mcp/api-keys", json={"name": "cursor-ide"})
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["name"] == "cursor-ide"
    assert body["key"].startswith(KEY_PREFIX)
    assert body["prefix"] == body["key"][:11]
    assert body["enabled"] is True

    # The listing must never carry the plaintext again.
    listed = client.get("/api/v1/mcp/api-keys")
    assert listed.status_code == 200
    rows = listed.json()
    assert len(rows) == 1
    assert "key" not in rows[0]
    assert rows[0]["prefix"] == body["prefix"]


def test_created_key_authenticates(_fresh_store: McpApiKeyStore) -> None:
    """Full loop: mint through the UI endpoint, then authenticate with it."""
    created = TestClient(_keys_app()).post("/api/v1/mcp/api-keys", json={"name": "codex"})
    plaintext = created.json()["key"]

    resp = TestClient(_whoami_app()).get(
        "/api/v1/mcp/whoami", headers={"Authorization": f"Bearer {plaintext}"}
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["tenant_id"] == TENANT_A


def test_create_endpoint_requires_name(_fresh_store: McpApiKeyStore) -> None:
    resp = TestClient(_keys_app()).post("/api/v1/mcp/api-keys", json={"name": "  "})
    assert resp.status_code == 422


def test_delete_endpoint_revokes(_fresh_store: McpApiKeyStore) -> None:
    client = TestClient(_keys_app())
    created = client.post("/api/v1/mcp/api-keys", json={"name": "codex"}).json()

    assert client.delete(f"/api/v1/mcp/api-keys/{created['id']}").status_code == 200
    assert client.get("/api/v1/mcp/api-keys").json() == []
    with pytest.raises(McpApiKeyRejected):
        _verify(created["key"])


def test_delete_endpoint_404s_for_unknown_key(_fresh_store: McpApiKeyStore) -> None:
    assert TestClient(_keys_app()).delete("/api/v1/mcp/api-keys/key-nope").status_code == 404


def test_endpoints_503_when_store_disabled() -> None:
    set_api_key_runtime(None)
    assert TestClient(_keys_app()).get("/api/v1/mcp/api-keys").status_code == 503


def test_api_key_caller_cannot_mint_keys(_fresh_store: McpApiKeyStore) -> None:
    """A leaked key must not be able to issue itself a replacement."""
    from mate_platform.tenancy import RequestContext, TenantId, UserId

    app = FastAPI()
    from mate_tech_mcp.api.management_routes import router

    app.include_router(router)

    @app.middleware("http")
    async def _api_key_ctx(request: Request, call_next):  # type: ignore[no-untyped-def]
        request.state.ctx = RequestContext(
            request_id="",
            trace_id="",
            tenant_id=TenantId(TENANT_A),
            user_id=UserId("apikey:key-1"),
            roles=frozenset(),
            permissions=frozenset(),
            auth_method=AuthMethod.API_KEY,
        )
        return await call_next(request)

    resp = TestClient(app).post("/api/v1/mcp/api-keys", json={"name": "escalation"})
    assert resp.status_code == 403
