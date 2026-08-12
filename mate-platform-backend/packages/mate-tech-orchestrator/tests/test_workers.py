"""W3 tests: worker service identity (client_credentials) wiring.

The MCP / A2A centers enforce ``install_auth``; production calls must
carry a service identity. These tests verify the identity builder and
its wiring into the ACL clients.
"""
from __future__ import annotations

from mate_tech_orchestrator.workers.a2a import A2AWorker
from mate_tech_orchestrator.workers.identity import build_service_identity
from mate_tech_orchestrator.workers.mcp import McpWorker


def test_identity_legacy_token_without_creds(monkeypatch) -> None:
    # Dev profile (INSECURE_SKIP_SIGNATURE=true, no SERVICE_CLIENT_SECRET):
    # falls back to a locally-minted legacy token provider so the
    # orchestrator → center leg stays authenticated.
    monkeypatch.delenv("SERVICE_CLIENT_ID", raising=False)
    monkeypatch.delenv("SERVICE_CLIENT_SECRET", raising=False)
    ident = build_service_identity()
    assert ident is not None
    assert callable(ident.token)
    assert isinstance(ident.token(), str) and ident.token().count(".") == 2


def test_identity_built_with_creds(monkeypatch) -> None:
    monkeypatch.setenv("SERVICE_CLIENT_ID", "svc-1")
    monkeypatch.setenv("SERVICE_CLIENT_SECRET", "svc-secret")
    ident = build_service_identity()
    assert ident is not None
    assert ident._client_id == "svc-1"
    assert "protocol/openid-connect/token" in ident._token_uri


def test_mcp_worker_wires_identity(monkeypatch) -> None:
    monkeypatch.setenv("SERVICE_CLIENT_ID", "svc-1")
    monkeypatch.setenv("SERVICE_CLIENT_SECRET", "svc-secret")
    worker = McpWorker()
    # The ACL client received the identity as its auth token provider.
    assert worker._client._auth is not None


def test_a2a_worker_wires_identity(monkeypatch) -> None:
    monkeypatch.setenv("SERVICE_CLIENT_ID", "svc-1")
    monkeypatch.setenv("SERVICE_CLIENT_SECRET", "svc-secret")
    worker = A2AWorker()
    assert worker._client._auth is not None
