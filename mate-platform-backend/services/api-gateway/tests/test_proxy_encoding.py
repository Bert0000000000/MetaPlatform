"""Regression tests for reserved characters in proxied command paths."""
from __future__ import annotations

from collections.abc import Iterator

import httpx
import pytest
from fastapi.testclient import TestClient
from mate_api_gateway.main import _build_target_url, app


@pytest.fixture
def proxy_client() -> Iterator[tuple[TestClient, list[httpx.Request]]]:
    forwarded: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        forwarded.append(request)
        return httpx.Response(200, json={"ok": True})

    previous_client = getattr(app.state, "client", None)
    previous_redis = getattr(app.state, "redis", None)
    app.state.client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    app.state.redis = None
    try:
        yield TestClient(app), forwarded
    finally:
        app.state.client = previous_client
        app.state.redis = previous_redis


def test_proxy_preserves_colon_in_action_command_path(
    proxy_client: tuple[TestClient, list[httpx.Request]],
):
    client, forwarded = proxy_client

    response = client.post(
        "/api/v1/action-proposals/proposal-1:confirm",
        json={"actor_id": "reviewer"},
    )

    assert response.status_code == 200
    assert len(forwarded) == 1
    assert forwarded[0].url.raw_path == b"/api/v1/action-proposals/proposal-1:confirm"


def test_proxy_decodes_encoded_colon_before_forwarding():
    target = _build_target_url(
        "http://orchestrator:8505",
        "/api/v1/action-proposals/proposal-1%3Aconfirm",
    )

    assert target.raw_path == b"/api/v1/action-proposals/proposal-1:confirm"
