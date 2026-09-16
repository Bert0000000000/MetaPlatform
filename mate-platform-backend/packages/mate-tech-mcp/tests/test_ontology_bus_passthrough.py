"""1.1 task 1c: the ontology proxy calls the ontology engine *as the caller*.

The MCP ontology proxy used to authenticate outbound with a service-identity
``client_credentials`` token and a static ``X-Tenant-Id`` from the
environment. The ontology engine's ``AuthMiddleware`` rejects that token
(it carries no ``tenant`` claim), so agent-team worked around the bus
entirely and called the ontology engine directly.

These tests pin the fix: the proxy forwards the **caller's** bearer token and
the **caller's** tenant for the duration of one request, falling back to the
service identity only when no caller is bound (internal/stdio paths).

Pinned alongside it: ``ont_list_classes`` returns a compacted
``rid + name`` list. That compaction came from agent-team's bypass; moving
the ontology tool face back onto the bus means the bus must keep it — see
``docs/active/specs/2026-09-16-agent-product-layer-env-facts.md`` §6.
"""

from __future__ import annotations

from typing import Any

import pytest
import respx
from httpx import Response

from mate_tech_mcp.caller_context import bind_caller, current_caller
from mate_tech_mcp.tools.ontology_proxy import OntListClassesTool, OntObjectQueryTool

ONT_BASE = "http://ont.test:8007"
USER_JWT = "eyJhbGciOiJSUzI1NiJ9.user.token"


def _list_tool() -> OntListClassesTool:
    return OntListClassesTool(base_url=ONT_BASE)


def _query_tool() -> OntObjectQueryTool:
    return OntObjectQueryTool(base_url=ONT_BASE)


@pytest.fixture(autouse=True)
def _no_service_identity(monkeypatch: pytest.MonkeyPatch) -> None:
    """Make the service-identity fallback invisible unless a test wants it."""
    monkeypatch.delenv("TECH_ONT_TOKEN", raising=False)


# --- caller context ------------------------------------------------------
def test_current_caller_is_none_outside_a_binding() -> None:
    assert current_caller() is None


@pytest.mark.asyncio
async def test_bind_caller_is_scoped_to_the_block() -> None:
    with bind_caller(tenant_id="tenant-acme", bearer_token=USER_JWT):
        caller = current_caller()
        assert caller is not None
        assert caller.tenant_id == "tenant-acme"
        assert caller.bearer_token == USER_JWT
    assert current_caller() is None


# --- outbound token passthrough -----------------------------------------
@respx.mock
@pytest.mark.asyncio
async def test_outbound_uses_the_callers_token_and_tenant() -> None:
    route = respx.post(f"{ONT_BASE}/api/v1/ont/v2/object-query").mock(
        return_value=Response(200, json={"kind": "objects", "rows": []})
    )
    tool = _query_tool()
    with bind_caller(tenant_id="tenant-acme", bearer_token=USER_JWT):
        await tool(source="ont.acme.obj.order.v1")
    await tool.aclose()

    request = route.calls[0].request
    assert request.headers["authorization"] == f"Bearer {USER_JWT}"
    assert request.headers["x-tenant-id"] == "tenant-acme"


@respx.mock
@pytest.mark.asyncio
async def test_two_callers_do_not_share_a_token() -> None:
    route = respx.get(f"{ONT_BASE}/api/v1/ont/v2/object-types").mock(
        return_value=Response(200, json=[])
    )
    tool = _list_tool()
    with bind_caller(tenant_id="tenant-a", bearer_token="eyJ.a"):
        await tool()
    with bind_caller(tenant_id="tenant-b", bearer_token="eyJ.b"):
        await tool()
    await tool.aclose()

    sent = [
        (c.request.headers["authorization"], c.request.headers["x-tenant-id"]) for c in route.calls
    ]
    assert sent == [("Bearer eyJ.a", "tenant-a"), ("Bearer eyJ.b", "tenant-b")]


@respx.mock
@pytest.mark.asyncio
async def test_without_a_caller_it_falls_back_to_service_identity(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Internal callers (stdio, REST bridge without a user) keep working."""
    monkeypatch.setenv("TECH_ONT_TOKEN", "eyJ.service.token")
    monkeypatch.setenv("TECH_ONT_TENANT", "tenant-default")
    route = respx.get(f"{ONT_BASE}/api/v1/ont/v2/object-types").mock(
        return_value=Response(200, json=[])
    )
    tool = OntListClassesTool(base_url=ONT_BASE)
    await tool()
    await tool.aclose()

    request = route.calls[0].request
    assert request.headers["authorization"] == "Bearer eyJ.service.token"
    assert request.headers["x-tenant-id"] == "tenant-default"


# --- compaction (1.0 lesson, moved onto the bus) -------------------------
@respx.mock
@pytest.mark.asyncio
async def test_list_classes_is_compacted_to_rid_and_name() -> None:
    raw = [
        {
            "rid": "ont.tenant-default.obj.sopbench-order-fulfillment.v1",
            "properties": [{"rid": "ont.tenant-default.prop.order-id.v1"}],
        }
    ]
    respx.get(f"{ONT_BASE}/api/v1/ont/v2/object-types").mock(return_value=Response(200, json=raw))
    tool = _list_tool()
    result: Any = await tool()
    await tool.aclose()

    assert result["count"] == 1
    assert result["classes"][0]["rid"] == "ont.tenant-default.obj.sopbench-order-fulfillment.v1"
    assert result["classes"][0]["name"] == "sopbench-order-fulfillment"
    # Property definitions must NOT ride along: 47 types with their fields
    # blow past the per-result truncation limit and the model then picks the
    # wrong class (measured — see the env-facts card §6).
    assert "properties" not in result["classes"][0]


# --- sk-mcp callers cannot forward their key -----------------------------
@respx.mock
@pytest.mark.asyncio
async def test_api_key_caller_falls_back_to_service_identity(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An ``sk-mcp-*`` key is centre-only: name the tenant, use our identity.

    Forwarding the raw key produces an unverifiable bearer at the ontology
    engine (measured: 401). The surfaces bind an empty token for API-key
    callers; the tenant still comes from the caller, never from the env.
    """
    monkeypatch.setenv("TECH_ONT_TOKEN", "eyJ.service.token")
    monkeypatch.setenv("TECH_ONT_TENANT", "tenant-default")
    route = respx.get(f"{ONT_BASE}/api/v1/ont/v2/object-types").mock(
        return_value=Response(200, json=[])
    )
    tool = _list_tool()
    with bind_caller(tenant_id="tenant-acme", bearer_token=""):
        await tool()
    await tool.aclose()

    request = route.calls[0].request
    assert request.headers["authorization"] == "Bearer eyJ.service.token"
    assert request.headers["x-tenant-id"] == "tenant-acme"


# --- 服务身份代指名租户（realm 的可选 scope）-----------------------------
_KEYCLOAK = "http://keycloak.test:8080"


def _kc_router() -> respx.Route:
    """Mock Keycloak's token endpoint; returns the route for inspection."""
    return respx.post(f"{_KEYCLOAK}/realms/metaplatform/protocol/openid-connect/token").mock(
        return_value=Response(200, json={"access_token": "eyJ.minted", "expires_in": 300})
    )


def _scope_of(route: respx.Route) -> str:
    from urllib.parse import parse_qs

    body = parse_qs(route.calls.last.request.content.decode())
    return body["scope"][0]


@respx.mock
@pytest.mark.asyncio
async def test_api_key_caller_requests_the_tenant_switch_scope(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """sk-mcp 调用方没有用户 token 可透传 → 用服务身份**代它指名租户**。

    本体引擎只在令牌带 ``tenant_switch_enabled`` 时才认 ``X-Tenant-Id``，
    所以这条路径必须显式申请该 scope。
    """
    monkeypatch.setenv("TECH_ONT_TOKEN", "mcp-service-secret")
    monkeypatch.setenv("KEYCLOAK_URL", _KEYCLOAK)
    kc = _kc_router()
    ont = respx.get(f"{ONT_BASE}/api/v1/ont/v2/object-types").mock(
        return_value=Response(200, json=[])
    )
    tool = OntListClassesTool(base_url=ONT_BASE)
    with bind_caller(tenant_id="tenant-acme", bearer_token=""):
        await tool()
    await tool.aclose()

    assert "tenant_switch_enabled" in _scope_of(kc)
    assert ont.calls[0].request.headers["x-tenant-id"] == "tenant-acme"
    assert ont.calls[0].request.headers["authorization"] == "Bearer eyJ.minted"


@respx.mock
@pytest.mark.asyncio
async def test_user_token_caller_does_not_touch_keycloak(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """用户令牌路径是纯透传，不换令牌、也不申请额外 scope。"""
    monkeypatch.setenv("TECH_ONT_TOKEN", "mcp-service-secret")
    monkeypatch.setenv("KEYCLOAK_URL", _KEYCLOAK)
    kc = _kc_router()
    ont = respx.get(f"{ONT_BASE}/api/v1/ont/v2/object-types").mock(
        return_value=Response(200, json=[])
    )
    tool = _list_tool()
    with bind_caller(tenant_id="tenant-acme", bearer_token=USER_JWT):
        await tool()
    await tool.aclose()

    assert not kc.called
    assert ont.calls[0].request.headers["authorization"] == f"Bearer {USER_JWT}"


@respx.mock
@pytest.mark.asyncio
async def test_switch_scope_is_configurable(monkeypatch: pytest.MonkeyPatch) -> None:
    """realm 未开该 scope 时置空即可关闭——Keycloak 对未注册 scope 会 400。"""
    monkeypatch.setenv("TECH_ONT_TOKEN", "mcp-service-secret")
    monkeypatch.setenv("KEYCLOAK_URL", _KEYCLOAK)
    monkeypatch.setenv("TECH_ONT_SWITCH_SCOPE", "")
    kc = _kc_router()
    respx.get(f"{ONT_BASE}/api/v1/ont/v2/object-types").mock(return_value=Response(200, json=[]))
    tool = _list_tool()
    with bind_caller(tenant_id="tenant-acme", bearer_token=""):
        await tool()
    await tool.aclose()

    assert _scope_of(kc) == "openid"
