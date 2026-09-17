"""llmgw `/chat/real` 契约与回显抑制（批次 llmgw-fallback-hardening）。

背景：llmgw 在上游不可用时会把**输入原样抄回来**冒充答复（`[stub-fallback]`）。
Agent 产品层的员工拿到这种产出时 `status` 仍是 `ok` —— 假回执从后门回来了。
本批加一个**可选**请求字段 `allow_stub_fallback`（默认 true 保持兼容），
Agent 产品层传 false，让失败如实暴露。

另外把写死的 30s 上游超时做成可配（reasoning 模型 + 大 prompt 天然更慢）。

覆盖：
  - test_provider_with_fallback_disabled_raises：provider 层关掉回显时抛错
  - test_route_allow_stub_fallback_false_fails_closed：路由层收 false → 503，不回显
  - test_route_without_flag_still_echoes：不带该字段 → 行为与改动前一致
  - test_upstream_timeout_is_configurable：超时可由环境变量配置
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
import respx
from fastapi import FastAPI
from httpx import Response
from starlette.testclient import TestClient

# Ensure src paths are on sys.path + Keycloak env vars are set for app import.
_REPO = Path(__file__).resolve().parents[3]
_PKG = _REPO / "mate-platform-backend" / "packages"
for _sub in ("mate-platform", "mate-clients", "mate-common", "mate-tech-llmgw"):
    _p = str(_PKG / _sub / "src")
    if _p not in sys.path:
        sys.path.insert(0, _p)

os.environ.setdefault("LEGACY_LOGIN_COMPAT", "true")
os.environ.setdefault("KEYCLOAK_URL", "https://keycloak.test.invalid")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")

from mate_tech_llmgw.api import routes as llmgw_routes
from mate_tech_llmgw.chat import ChatMessage
from mate_tech_llmgw.providers.real_openai_provider import RealOpenAIProvider


def _make_client() -> TestClient:
    app = FastAPI(title="llmgw-real-contract-test")
    app.include_router(llmgw_routes.router)
    return TestClient(app)


# ---------------------------------------------------------------------------
# provider 层：关掉回显就得抛错，不能返回假答复
# ---------------------------------------------------------------------------
@respx.mock
@pytest.mark.asyncio
async def test_provider_with_fallback_disabled_raises() -> None:
    """allow_fallback=False 时上游 500 必须抛错，不得返回 `[stub-fallback]` 回显。"""
    respx.post("https://api.openai.com/v1/chat/completions").mock(
        return_value=Response(500, text="Internal Server Error"),
    )
    provider = RealOpenAIProvider(api_key="sk-test", model="gpt-4o-mini", allow_fallback=False)
    msgs = [ChatMessage(role="user", content="查询本月异常订单")]
    try:
        with pytest.raises(RuntimeError):
            await provider.chat(msgs)
    finally:
        await provider.aclose()


# ---------------------------------------------------------------------------
# 路由层：请求字段 allow_stub_fallback
# ---------------------------------------------------------------------------
def test_route_without_flag_still_echoes(monkeypatch: pytest.MonkeyPatch) -> None:
    """回归：不带该字段的调用方，行为与改动前一致（无 key → 回显 + fallback=true）。

    其它服务还在用 llmgw，本批**不能**顺手把它们已有的降级能力关掉。
    """
    monkeypatch.setenv("OPENAI_API_KEY", "")

    client = _make_client()
    r = client.post(
        "/api/v1/llmgw/chat/real",
        json={
            "provider": "openai",
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": "hello"}],
            "tenant_id": "tenant-test",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["fallback"] is True
    assert "[stub-fallback]" in body["content"]


def test_route_allow_stub_fallback_false_fails_closed(monkeypatch: pytest.MonkeyPatch) -> None:
    """Agent 产品层的调用：显式传 false 时，上游不可用**不得**回显，要如实失败。"""
    monkeypatch.setenv("OPENAI_API_KEY", "")

    client = _make_client()
    r = client.post(
        "/api/v1/llmgw/chat/real",
        json={
            "provider": "openai",
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": "分析本月异常订单"}],
            "tenant_id": "tenant-test",
            "allow_stub_fallback": False,
        },
    )
    assert r.status_code == 503, r.text
    assert "[stub-fallback]" not in r.text
    assert "synthetic fallback is disabled" in r.text


# ---------------------------------------------------------------------------
# 上游超时：可配 + 默认值给 reasoning 模型留够
# ---------------------------------------------------------------------------
def test_upstream_timeout_default_has_room_for_reasoning_models() -> None:
    """默认超时要明显大于老的 30s —— 30s 是给普通对话写的，reasoning 模型会顶穿。"""
    assert llmgw_routes.upstream_timeout() > 30.0


def test_upstream_timeout_is_configurable(monkeypatch: pytest.MonkeyPatch) -> None:
    """环境变量能改到生效值。"""
    monkeypatch.setenv("LLMGW_UPSTREAM_TIMEOUT", "7.5")
    assert llmgw_routes.upstream_timeout() == pytest.approx(7.5)


def test_upstream_timeout_ignores_garbage(monkeypatch: pytest.MonkeyPatch) -> None:
    """配错了不能把服务带崩，退回默认值。"""
    monkeypatch.setenv("LLMGW_UPSTREAM_TIMEOUT", "not-a-number")
    assert llmgw_routes.upstream_timeout() > 30.0
