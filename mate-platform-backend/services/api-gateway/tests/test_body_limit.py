"""网关请求体大小限制单测（安全测试组发现 1MB body → 上游 504 的修复）。"""
from __future__ import annotations

import httpx
import pytest
from fastapi.testclient import TestClient
from mate_api_gateway.main import app


@pytest.fixture
def proxy_client(monkeypatch) -> TestClient:
    monkeypatch.setenv("GATEWAY_MAX_BODY_BYTES", str(1024 * 1024))
    import mate_api_gateway.main as gw

    monkeypatch.setattr(gw, "MAX_BODY_BYTES", 1024 * 1024)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"ok": True})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    monkeypatch.setattr(app, "state", app.state)
    app.state.client = client
    # 不进入 TestClient 上下文——避免 lifespan 覆盖 mock client
    tc = TestClient(app, raise_server_exceptions=False)
    yield tc
    client.aclose()


def test_small_body_passes(proxy_client):
    r = proxy_client.post("/api/v1/marketplace/install", json={"kind": "mcp"})
    assert r.status_code == 200


def test_oversized_body_rejected_413(proxy_client):
    big = "x" * (2 * 1024 * 1024)  # > 1MB limit
    r = proxy_client.post(
        "/api/v1/marketplace/install",
        json={"name": big, "kind": "mcp",
              "artifact_id": "00000000-0000-0000-0000-000000000000",
              "version": "1.0.0"},
    )
    assert r.status_code == 413
    assert r.json()["code"] == "E413_PAYLOAD_TOO_LARGE"
