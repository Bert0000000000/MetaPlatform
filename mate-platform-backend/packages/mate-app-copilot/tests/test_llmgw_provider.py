"""Tests for the HTTP-based llmgw provider (TD-6).

Verifies the circuit-breaker fallback to ``stub_provider`` when the
mate-tech-llmgw service is unreachable, and that both providers
expose the same interface shapes.
"""
from __future__ import annotations

import os
import time

os.environ.setdefault("INSECURE_SKIP_SIGNATURE", "1")
os.environ.setdefault("KEYCLOAK_URL", "http://localhost:8080")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")

from mate_app_copilot.llm import llmgw_provider, stub_provider

from mate_clients.security.bearer import BearerAuth, CachedToken

# Port 1 is never listened on, so the connection is refused immediately.
UNREACHABLE_URL = "http://localhost:1"


def _make_auth() -> BearerAuth:
    """BearerAuth with a pre-seeded token cache (no network hit)."""
    auth = BearerAuth(
        token_uri="http://localhost:8080/realms/metaplatform/protocol/openid-connect/token",
        client_id="metaplatform-backend",
        client_secret="test-secret",
        scope="platform.read",
    )
    # Pre-seed the cache so token() never hits the network.
    auth._cached = CachedToken(  # type: ignore[attr-defined]
        access_token="stub-cached-token",
        expires_at=time.time() + 3600.0,
    )
    return auth


def _make_provider() -> llmgw_provider.LlmgwProvider:
    return llmgw_provider.LlmgwProvider(
        base_url=UNREACHABLE_URL,
        auth=_make_auth(),
        tenant_id="tenant-acme",
        timeout=1.0,
    )


def test_llmgw_provider_falls_back_on_connection_error() -> None:
    """When llmgw is unreachable every method returns the stub result."""
    provider = _make_provider()

    texts = ["hello", "world"]
    assert provider.embeddings(texts) == stub_provider.embeddings(texts)

    messages = [{"role": "user", "content": "hi"}]
    assert provider.chat(messages) == stub_provider.chat(messages)

    # generate_sql routes through self.chat(); on fallback it therefore
    # returns stub_provider.chat() for the SQL-generation messages, not
    # stub_provider.generate_sql(). Assert that exact path.
    sql_messages: list[dict] = [
        {
            "role": "system",
            "content": (
                "Generate a SQL SELECT statement for the given tables "
                "and prompt. Return only SQL."
            ),
        },
        {"role": "user", "content": f"Tables: {['orders']}\nPrompt: show orders"},
    ]
    assert provider.generate_sql("show orders", ["orders"]) == stub_provider.chat(sql_messages)


def test_llmgw_provider_interface_matches_stub() -> None:
    """Both providers return the same shapes for each method."""
    texts = ["alpha", "beta"]
    messages = [{"role": "user", "content": "ping"}]

    provider = _make_provider()

    stub_emb = stub_provider.embeddings(texts)
    prov_emb = provider.embeddings(texts)
    assert isinstance(stub_emb, list) and isinstance(prov_emb, list)
    assert all(isinstance(v, list) for v in stub_emb)
    assert all(isinstance(v, list) for v in prov_emb)

    stub_chat = stub_provider.chat(messages)
    prov_chat = provider.chat(messages)
    assert isinstance(stub_chat, str) and isinstance(prov_chat, str)

    stub_sql = stub_provider.generate_sql("count users", ["users"])
    prov_sql = provider.generate_sql("count users", ["users"])
    assert isinstance(stub_sql, str) and isinstance(prov_sql, str)
