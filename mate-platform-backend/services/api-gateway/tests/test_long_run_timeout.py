"""网关上游超时：同步长跑的服务要单独放宽（agent-team 的 POST /runs 会 504）。

**为什么单独一条**：`POST /api/v1/agent-team/runs` 是**同步**接口——一个请求等
整轮编排跑完（拆解 + 并行派活 + 汇合），实测约 60s，正好压在网关全局的 60s 读
超时上。表现为间歇性 504，而且 run 其实**已经建好了**，只是调用方拿不到 run_id
（用户看到的是"提交失败"，重试一次就多跑一轮）。

修法是按服务名单独放宽，而不是把全局读超时一起抬高——后者会让真正卡住的上游
多占几倍的连接。这条用例把"哪个服务拿到多长的超时"钉死。
"""

from __future__ import annotations

import httpx
import pytest
from fastapi.testclient import TestClient
from mate_api_gateway.main import (
    LONG_RUN_SERVICES,
    LONG_RUN_TIMEOUT_SEC,
    UPSTREAM_TIMEOUT_SEC,
    _upstream_timeout,
    app,
)


def test_long_run_services_get_the_wider_read_timeout() -> None:
    assert "agent-team" in LONG_RUN_SERVICES, "长跑名单里必须有 agent-team"
    assert _upstream_timeout("agent-team").read == LONG_RUN_TIMEOUT_SEC
    assert LONG_RUN_TIMEOUT_SEC > UPSTREAM_TIMEOUT_SEC, "放宽得比全局大，否则这条修复没有意义"


def test_other_services_keep_the_global_timeout() -> None:
    assert _upstream_timeout("mcp").read == UPSTREAM_TIMEOUT_SEC
    assert _upstream_timeout("ont").read == UPSTREAM_TIMEOUT_SEC


@pytest.fixture
def seen_timeouts(monkeypatch) -> list[dict]:
    """抓下每个上游请求实际带的超时（httpx 把它记在 extensions 里）。"""
    seen: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(dict(request.extensions.get("timeout") or {}))
        return httpx.Response(200, json={"ok": True})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    monkeypatch.setattr(app, "state", app.state)
    app.state.client = client
    yield seen
    client.aclose()


def test_agent_team_requests_go_out_with_the_wider_timeout(seen_timeouts: list[dict]) -> None:
    tc = TestClient(app, raise_server_exceptions=False)
    assert tc.post("/api/v1/agent-team/runs", json={"goal": "x"}).status_code == 200
    assert seen_timeouts and seen_timeouts[-1]["read"] == LONG_RUN_TIMEOUT_SEC


def test_other_routes_still_go_out_with_the_global_timeout(seen_timeouts: list[dict]) -> None:
    tc = TestClient(app, raise_server_exceptions=False)
    assert tc.get("/api/v1/ont/v2/object-types").status_code == 200
    assert seen_timeouts and seen_timeouts[-1]["read"] == UPSTREAM_TIMEOUT_SEC
