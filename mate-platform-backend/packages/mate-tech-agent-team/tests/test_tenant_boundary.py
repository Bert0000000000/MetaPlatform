"""ADR-0068 · 租户切换边界收口的单元判据。

覆盖四件事（对应 ADR §3 的不变量与 §5-S3 的判据）：

* ``_runtime_bearer`` 的配置矩阵（没配 / 配齐 / 只配一半）；
* ``_resolve_outbound_token`` 的取值序（N4：用户令牌永远第一）；
* 出站 HTTP 的**真实形状**——无用户令牌时带 runtime 身份 + ``X-Tenant-Id``，
  有用户令牌时 runtime 完全不参与（用假 transport 抓请求头断言，不起网络）；
* realm JSON 的结构（N1/N2：切换 scope 只链在两个专用 client 上）——
  这里测的是 agent-team 视角的那一半；完整结构断言在 ``infra/tests``。

**负例（共享密钥不能代任意租户）的服务端行为**不在本文件：
``mate_platform.auth.tenant.resolve_tenant`` 对"token 无切换 scope + 头部指名
别的租户"的拒绝在 ``test_sec_iam_01.py`` 已有；活栈上的端到端负例见本批验收
文档的 drill 记录。
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

import httpx
import pytest
from mate_tech_agent_team.wiring import (
    RUNTIME_CLIENT_ID_ENV,
    RUNTIME_CLIENT_SECRET_ENV,
    _resolve_outbound_token,
    _runtime_bearer,
)

from mate_clients.llmgw import LlmgwClient
from mate_clients.mcp.tools import McpToolsClient
from mate_clients.security import BearerAuth

REALM_FILE = Path(__file__).resolve().parents[4] / "infra" / "keycloak" / "realm-mate.json"


class _StaticAuth:
    """`.token() -> 固定值` 的出站身份替身（不起 Keycloak）。"""

    def __init__(self, token: str) -> None:
        self._token = token

    def token(self) -> str:
        return self._token


def _capture_transport(captured: list[httpx.Request]) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, json={"content": "ok"})

    return httpx.MockTransport(handler)


# ── _runtime_bearer：配置矩阵 ───────────────────────────────────────────────


def test_runtime_bearer_is_absent_when_unconfigured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(RUNTIME_CLIENT_ID_ENV, raising=False)
    monkeypatch.delenv(RUNTIME_CLIENT_SECRET_ENV, raising=False)
    assert _runtime_bearer() is None


def test_runtime_bearer_builds_from_the_env_pair(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(RUNTIME_CLIENT_ID_ENV, "agent-team-runtime")
    monkeypatch.setenv(RUNTIME_CLIENT_SECRET_ENV, "runtime-secret")
    auth = _runtime_bearer()
    assert isinstance(auth, BearerAuth)
    # client_id 是私有字段；用"同一 client_id 换到的 token 请求"这个可观察面来断言
    # 绑定对象——BearerAuth 构造即拒绝空 id/secret，这里再核一次 token_uri 形状。
    assert auth._client_id == "agent-team-runtime"
    assert auth._token_uri.endswith("/realms/metaplatform/protocol/openid-connect/token")


@pytest.mark.parametrize(
    ("client_id", "secret"),
    [("agent-team-runtime", ""), ("", "runtime-secret")],
)
def test_a_half_configured_runtime_identity_refuses_to_start(
    monkeypatch: pytest.MonkeyPatch, client_id: str, secret: str
) -> None:
    """只配一半 → 启动失败：半开着的 runtime 身份比不开更危险（配了一半
    的部署看起来是启用了边界收口，实际出站仍在拿共享身份撞守卫）。"""
    monkeypatch.setenv(RUNTIME_CLIENT_ID_ENV, client_id)
    monkeypatch.setenv(RUNTIME_CLIENT_SECRET_ENV, secret)
    with pytest.raises(RuntimeError, match="必须成对配置"):
        _runtime_bearer()


# ── _resolve_outbound_token：取值序（N4）───────────────────────────────────


def test_the_user_token_always_wins_over_the_runtime_client() -> None:
    """N4：有用户令牌（含换来的委托令牌）时 runtime client 完全不参与。"""
    called = False

    def _explode() -> str:  # pragma: no cover - 一旦被调用即失败
        nonlocal called
        called = True
        return "runtime-token"

    class _Exploding:
        token = _explode

    out = asyncio.run(_resolve_outbound_token("user-jwt", _Exploding()))
    assert out == "user-jwt"
    assert called is False


def test_the_runtime_client_stands_in_when_there_is_no_user_token() -> None:
    out = asyncio.run(_resolve_outbound_token("", _StaticAuth("runtime-token")))
    assert out == "runtime-token"


def test_without_a_runtime_client_the_token_stays_empty() -> None:
    """没配 runtime client = 保持空（如实失败），不悄悄换服务身份冒充。"""
    assert asyncio.run(_resolve_outbound_token("", None)) == ""


# ── 出站 HTTP 的真实形状（假 transport 抓头）───────────────────────────────


def _last_headers(captured: list[httpx.Request]) -> dict[str, str]:
    assert captured, "一个请求都没发出去"
    return dict(captured[-1].headers)


@pytest.mark.asyncio
async def test_llmgw_hop_carries_the_runtime_identity_and_tenant_when_tokenless() -> None:
    """无用户令牌：请求带 runtime 身份 + X-Tenant-Id（租户绑定守卫放行的唯一
    服务形态——token 的 defaultClientScope 里有切换 scope）。"""
    captured: list[httpx.Request] = []
    client = LlmgwClient(
        "http://llmgw.test",
        auth=_StaticAuth("runtime-token"),
        tenant_id="tenant-default",
        user_token="",
        transport=_capture_transport(captured),
    )
    await client.chat_with_tools(messages=[{"role": "user", "content": "hi"}], model="m")
    headers = _last_headers(captured)
    assert headers["authorization"] == "Bearer runtime-token"
    assert headers["x-tenant-id"] == "tenant-default"
    await client.aclose()


@pytest.mark.asyncio
async def test_llmgw_hop_ignores_the_runtime_identity_when_a_user_token_exists() -> None:
    """有用户令牌：Authorization 是用户那份，runtime 身份不出现（N4）。"""
    captured: list[httpx.Request] = []
    client = LlmgwClient(
        "http://llmgw.test",
        auth=_StaticAuth("runtime-token"),
        tenant_id="tenant-default",
        user_token="user-jwt",
        transport=_capture_transport(captured),
    )
    await client.chat_with_tools(messages=[{"role": "user", "content": "hi"}], model="m")
    headers = _last_headers(captured)
    assert headers["authorization"] == "Bearer user-jwt"
    assert "runtime-token" not in headers["authorization"]
    await client.aclose()


@pytest.mark.asyncio
async def test_mcp_rest_hop_carries_the_runtime_identity_when_tokenless() -> None:
    """MCP 工具面（REST）与 llmgw 同一条出站形状（接管续跑的两跳都过）。"""
    captured: list[httpx.Request] = []
    client = McpToolsClient(
        "http://mcp.test",
        auth=_StaticAuth("runtime-token"),
        tenant_id="tenant-default",
        user_token="",
    )
    # 换掉底层 transport 抓请求，但把构造时装好的出站中间件原样带过去
    # （直接换 _client 会把它丢掉——auth 挂在 client 上，不在 transport 上）。
    client._client = httpx.AsyncClient(
        transport=_capture_transport(captured), auth=client._client.auth
    )
    await client.call_tool(name="kb_search", arguments={"q": "x"})
    headers = _last_headers(captured)
    assert headers["authorization"] == "Bearer runtime-token"
    assert headers["x-tenant-id"] == "tenant-default"
    await client.aclose()


# ── realm JSON：agent-team 视角的结构断言（N2 的一半）─────────────────────


def _realm_doc() -> dict[str, Any]:
    return json.loads(REALM_FILE.read_text(encoding="utf-8"))


def test_the_runtime_client_is_linked_to_the_switch_scope_by_default() -> None:
    clients = {c["clientId"]: c for c in _realm_doc()["clients"]}
    runtime = clients["agent-team-runtime"]
    assert "tenant_switch_enabled" in runtime.get("defaultClientScopes", [])
    # 服务专用：不开标准流 / 密码流——它只该做 client_credentials。
    assert runtime.get("serviceAccountsEnabled") is True
    assert runtime.get("standardFlowEnabled") is False
    assert runtime.get("directAccessGrantsEnabled") is False
    # 下游校验的 audience 与共享 client 一致（llmgw / 网关的 AuthConfig 不用改）。
    mappers = runtime.get("protocolMappers", [])
    audiences = [
        m["config"].get("included.custom.audience")
        for m in mappers
        if m.get("protocolMapper") == "oidc-audience-mapper"
    ]
    assert "metaplatform-backend" in audiences
