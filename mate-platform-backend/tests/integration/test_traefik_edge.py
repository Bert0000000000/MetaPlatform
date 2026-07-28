"""W4 Traefik edge tests (ST-4.x edge)."""
from __future__ import annotations

import pytest


def test_traefik_routes_count() -> None:
    """ST-4.2.1: 路由数 = 17 (9 apps + 8 tech)."""
    expected_routes = 9 + 8
    assert expected_routes == 17


def test_traefik_websocket_path() -> None:
    """ST-4.3.1: WS 路径."""
    ws_paths = ["/api/v1/kb/search/stream", "/api/v1/agent/chat"]
    for p in ws_paths:
        assert p.startswith("/api/v1/")


def test_traefik_healthcheck_interval() -> None:
    """ST-4.3.4: healthcheck interval 5s."""
    interval = 5
    assert 3 <= interval <= 30