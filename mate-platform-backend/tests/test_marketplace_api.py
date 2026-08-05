"""marketplace API routes tests。"""
from __future__ import annotations

import uuid
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from mate_platform.marketplace.api.install import router as install_router
from mate_platform.marketplace.api.installed import (
    router as installed_router,
)


class _FakeUser:
    """模拟 SEC-IAM-01 中间件注入到 request.state.user 的 user 对象。"""

    def __init__(self, *, scopes: frozenset[str], user_id: str, tenant_id: str):
        self.scopes = scopes
        self.id = user_id
        self.tenant_id = tenant_id


def _build_app(*, user_scopes: frozenset[str] = frozenset()):
    app = FastAPI()
    app.include_router(install_router, prefix="/api/v1/marketplace")
    app.include_router(installed_router, prefix="/api/v1/marketplace")

    @app.middleware("http")
    async def inject_user(request, call_next):
        request.state.user = _FakeUser(
            scopes=user_scopes,
            user_id=str(uuid.uuid4()),
            tenant_id=str(uuid.uuid4()),
        )
        request.state.db = AsyncMock()
        request.state.outbox = AsyncMock()
        return await call_next(request)

    return app


@pytest.mark.asyncio
async def test_install_returns_202_with_id(monkeypatch):
    """POST /install 命中 platform.marketplace.write scope → 202 + install_id。"""
    from mate_platform.marketplace.api import install as install_api_module

    fake_id = uuid.uuid4()

    async def fake_create(*args, **kwargs):
        return fake_id, False

    monkeypatch.setattr(
        install_api_module, "create_install", fake_create
    )

    app = _build_app(
        user_scopes=frozenset({"platform.marketplace.write"})
    )
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.post(
            "/api/v1/marketplace/install",
            json={
                "kind": "mcp",
                "artifact_id": str(uuid.uuid4()),
                "version": "1.0.0",
            },
        )
    assert resp.status_code == 202
    body = resp.json()
    assert body["install_id"] == str(fake_id)


@pytest.mark.asyncio
async def test_installed_requires_oauth_scope():
    """GET /installed 缺 scope → 401/403(此处我们让 user.scopes 空 → 401)。"""
    app = _build_app(user_scopes=frozenset())

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.get("/api/v1/marketplace/installed")
    # 不持有任何 scope,应被 401/403 拒
    assert resp.status_code in (401, 403)