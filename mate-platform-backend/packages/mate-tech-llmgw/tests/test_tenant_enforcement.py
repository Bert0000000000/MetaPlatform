"""P4: tenant enforcement on business endpoints (2026-09-09).

ctx (JWT) tenant is the source of truth:
- body tenant_id empty → backfilled from ctx
- body tenant_id ≠ ctx tenant → 403
- no ctx / anonymous ctx → body value kept (dev_server anonymous paths
  and the auth-less test apps keep working)
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from mate_platform.tenancy import AuthMethod

from mate_tech_llmgw.api.routes import legacy_router, router


@dataclass
class _Ctx:
    tenant_id: str
    user_id: str
    auth_method: AuthMethod

    @property
    def is_authenticated(self) -> bool:
        return self.auth_method != AuthMethod.ANONYMOUS


def _make_app(ctx: Any) -> TestClient:
    app = FastAPI()
    app.include_router(router)
    app.include_router(legacy_router)

    @app.middleware("http")
    async def _inject_ctx(request: Request, call_next):
        if ctx is not None:
            request.state.ctx = ctx
        return await call_next(request)

    return TestClient(app)


@pytest.fixture
def user_ctx() -> _Ctx:
    return _Ctx(tenant_id="tenant-a", user_id="u1", auth_method=AuthMethod.USER)


def _post(client: TestClient, path: str, tenant_id: str | None) -> Any:
    body: dict[str, Any] = {
        "model": "gpt-4o-mini",
        "messages": [{"role": "user", "content": "hi"}],
    }
    if tenant_id is not None:
        body["tenant_id"] = tenant_id
    return client.post(path, json=body)


def test_body_tenant_mismatch_returns_403(user_ctx: _Ctx) -> None:
    client = _make_app(user_ctx)
    resp = _post(client, "/api/v1/llmgw/chat", tenant_id="tenant-b")
    assert resp.status_code == 403
    assert resp.json() == {"detail": "tenant access denied"}


def test_body_tenant_matching_ctx_passes(user_ctx: _Ctx) -> None:
    client = _make_app(user_ctx)
    resp = _post(client, "/api/v1/llmgw/chat", tenant_id="tenant-a")
    # Reaches the router (any status but 403 proves enforcement passed;
    # without provider keys a stub/failure response is expected in dev).
    assert resp.status_code != 403


def test_missing_body_tenant_backfilled_from_ctx(user_ctx: _Ctx) -> None:
    """Direct unit test: 'default' sentinel tenant is replaced by the ctx tenant."""
    from types import SimpleNamespace

    from mate_tech_llmgw.api.routes import ChatRequest, _apply_request_tenant

    req = ChatRequest(
        model="gpt-4o-mini", messages=[{"role": "user", "content": "hi"}]
    )
    request = SimpleNamespace(state=SimpleNamespace(ctx=user_ctx))
    _apply_request_tenant(request, req)
    assert req.tenant_id == "tenant-a"  # backfilled over the "default" sentinel


def test_no_ctx_keeps_body_tenant(monkeypatch: pytest.MonkeyPatch) -> None:
    """Auth-less apps (path-alias tests / dev_server) keep body tenant."""
    client = _make_app(None)
    resp = _post(client, "/api/v1/llmgw/chat", tenant_id="whatever")
    assert resp.status_code != 403


def test_anonymous_ctx_keeps_body_tenant() -> None:
    anon = _Ctx(tenant_id="tenant-a", user_id="anon", auth_method=AuthMethod.ANONYMOUS)
    client = _make_app(anon)
    resp = _post(client, "/api/v1/llmgw/chat", tenant_id="whatever")
    assert resp.status_code != 403


def test_real_chat_endpoint_enforces_tenant(user_ctx: _Ctx) -> None:
    client = _make_app(user_ctx)
    resp = client.post(
        "/api/v1/llmgw/chat/real",
        json={
            "provider": "openai",
            "messages": [{"role": "user", "content": "hi"}],
            "tenant_id": "tenant-b",
        },
    )
    assert resp.status_code == 403


def test_embeddings_endpoint_enforces_tenant(user_ctx: _Ctx) -> None:
    client = _make_app(user_ctx)
    resp = client.post(
        "/api/v1/llmgw/embeddings",
        json={"input": ["x"], "model": "text-embedding-3-small", "tenant_id": "tenant-b"},
    )
    assert resp.status_code == 403


def test_legacy_alias_enforces_tenant(user_ctx: _Ctx) -> None:
    client = _make_app(user_ctx)
    resp = _post(client, "/api/v1/llm/chat", tenant_id="tenant-b")
    assert resp.status_code == 403
