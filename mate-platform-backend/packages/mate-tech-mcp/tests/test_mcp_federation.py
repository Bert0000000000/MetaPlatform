"""Tests for the MCP Federation extension (backlog §3.8).

Covers:
  * FederationRegistry CRUD + tenant isolation + tool name collision.
  * ExternalMcpClient HTTP calls (with respx-mocked remote server).
  * FederationRouter cross-server tool routing.
  * Outbox emission (InMemoryOutboxWriter).
  * FastAPI endpoints: register / list / get / update / deregister /
    list-remote-tools / invoke-remote-tool.
  * Cross-tenant negative cases (ADR-0014 step 5).
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path
from typing import Any

import pytest
import respx
from httpx import Response

REPO = Path(__file__).resolve().parents[3]
PKG = REPO / "mate-platform-backend" / "packages"
for sub in ("mate-platform", "mate-clients", "mate-common", "mate-tech-mcp"):
    sys.path.insert(0, str(PKG / sub / "src"))

os.environ.setdefault("INSECURE_SKIP_SIGNATURE", "1")
os.environ.setdefault("KEYCLOAK_URL", "http://localhost:8080")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("KEYCLOAK_AUDIENCE", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_ID", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")

import jwt as _pyjwt  # noqa: E402
from mate_platform.messaging import InMemoryOutboxWriter  # noqa: E402

from mate_tech_mcp.federation import (  # noqa: E402
    ExternalMcpClient,
    FederatedServer,
    FederationRegistry,
    FederationRouter,
    emit_federation_event,
)

_TEST_JWT_SECRET = "test-secret"  # noqa: S105


def _make_token(tenant_id: str = "tenant-acme") -> str:
    now = int(time.time())
    return _pyjwt.encode(
        {
            "sub": "u-1",
            "iss": "http://localhost:8080/realms/metaplatform",
            "aud": "metaplatform-backend",
            "azp": "metaplatform-backend",
            "preferred_username": "u-1",
            "realm_access": {"roles": ["PLATFORM_SUPER_ADMIN"]},
            "scope": "platform.read platform.write",
            "attributes": {"tenant_id": [tenant_id]},
            "tenant_id": tenant_id,
            "roles": ["PLATFORM_SUPER_ADMIN"],
            "iat": now,
            "exp": now + 3600,
        },
        _TEST_JWT_SECRET,
        algorithm="HS256",
    )


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {_make_token()}",
        "X-Tenant-Id": "tenant-acme",
    }


@pytest.fixture
def auth_headers_other_tenant() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {_make_token(tenant_id='tenant-other')}",
        "X-Tenant-Id": "tenant-other",
    }


@pytest.fixture
def fresh_registry() -> FederationRegistry:
    return FederationRegistry()


# ---------------------------------------------------------------------------
# FederationRegistry CRUD + tenant isolation
# ---------------------------------------------------------------------------
class TestFederationRegistryCRUD:
    def test_register_server(self, fresh_registry: FederationRegistry) -> None:
        srv = fresh_registry.register_server(
            tenant_id="t1",
            name="remote-search",
            transport_url="http://remote-mcp:8081",
            auth_token_ref="vault://secret/remote-search",  # noqa: S106
            description="remote search server",
            tools=("remote.search", "remote.lookup"),
        )
        assert srv.id.startswith("fed-")
        assert srv.tenant_id == "t1"
        assert srv.name == "remote-search"
        assert srv.transport_url == "http://remote-mcp:8081"
        assert srv.status == "active"
        assert "remote.search" in srv.tools
        fetched = fresh_registry.get_server(tenant_id="t1", server_id=srv.id)
        assert fetched is srv

    def test_register_rejects_invalid_url(self, fresh_registry: FederationRegistry) -> None:
        with pytest.raises(ValueError, match="transport_url must be http"):
            fresh_registry.register_server(
                tenant_id="t1",
                name="bad",
                transport_url="ftp://nope",
                auth_token_ref="vault://x",  # noqa: S106
            )

    def test_register_rejects_duplicate_name(self, fresh_registry: FederationRegistry) -> None:
        fresh_registry.register_server(
            tenant_id="t1",
            name="dupe",
            transport_url="http://a:8081",
            auth_token_ref="vault://a",  # noqa: S106
        )
        with pytest.raises(ValueError, match="already exists"):
            fresh_registry.register_server(
                tenant_id="t1",
                name="dupe",
                transport_url="http://b:8081",
                auth_token_ref="vault://b",  # noqa: S106
            )

    def test_register_rejects_tool_collision(self, fresh_registry: FederationRegistry) -> None:
        fresh_registry.register_server(
            tenant_id="t1",
            name="srv-a",
            transport_url="http://a:8081",
            auth_token_ref="vault://a",  # noqa: S106
            tools=("shared.tool",),
        )
        with pytest.raises(ValueError, match="tool name collision"):
            fresh_registry.register_server(
                tenant_id="t1",
                name="srv-b",
                transport_url="http://b:8081",
                auth_token_ref="vault://b",  # noqa: S106
                tools=("shared.tool",),
            )

    def test_update_server(self, fresh_registry: FederationRegistry) -> None:
        srv = fresh_registry.register_server(
            tenant_id="t1",
            name="srv",
            transport_url="http://a:8081",
            auth_token_ref="vault://a",  # noqa: S106
            tools=("tool1",),
        )
        updated = fresh_registry.update_server(
            tenant_id="t1",
            server_id=srv.id,
            status="disabled",
            description="updated",
        )
        assert updated.status == "disabled"
        assert updated.description == "updated"

    def test_deregister_server_soft_deletes(self, fresh_registry: FederationRegistry) -> None:
        srv = fresh_registry.register_server(
            tenant_id="t1",
            name="srv",
            transport_url="http://a:8081",
            auth_token_ref="vault://a",  # noqa: S106
        )
        assert fresh_registry.deregister_server(tenant_id="t1", server_id=srv.id) is True
        deleted = fresh_registry.get_server(tenant_id="t1", server_id=srv.id)
        assert deleted is not None
        assert deleted.status == "deleted"

    def test_find_tool_returns_server(self, fresh_registry: FederationRegistry) -> None:
        fresh_registry.register_server(
            tenant_id="t1",
            name="srv",
            transport_url="http://a:8081",
            auth_token_ref="vault://a",  # noqa: S106
            tools=("remote.search",),
        )
        match = fresh_registry.find_tool(tenant_id="t1", tool_name="remote.search")
        assert match is not None
        assert match.name == "srv"
        # Unknown tool returns None.
        assert fresh_registry.find_tool(tenant_id="t1", tool_name="nope") is None

    def test_list_remote_tools(self, fresh_registry: FederationRegistry) -> None:
        fresh_registry.register_server(
            tenant_id="t1",
            name="srv-a",
            transport_url="http://a:8081",
            auth_token_ref="vault://a",  # noqa: S106
            tools=("tool1", "tool2"),
        )
        fresh_registry.register_server(
            tenant_id="t1",
            name="srv-b",
            transport_url="http://b:8081",
            auth_token_ref="vault://b",  # noqa: S106
            tools=("tool3",),
        )
        tools = fresh_registry.list_remote_tools(tenant_id="t1")
        assert len(tools) == 3
        names = {t["name"] for t in tools}
        assert names == {"tool1", "tool2", "tool3"}


class TestFederationRegistryTenantIsolation:
    def test_cross_tenant_get_returns_none(self, fresh_registry: FederationRegistry) -> None:
        srv = fresh_registry.register_server(
            tenant_id="t1",
            name="private",
            transport_url="http://a:8081",
            auth_token_ref="vault://a",  # noqa: S106
        )
        assert fresh_registry.get_server(tenant_id="t2", server_id=srv.id) is None

    def test_cross_tenant_list_excludes_other_tenant(
        self, fresh_registry: FederationRegistry
    ) -> None:
        fresh_registry.register_server(
            tenant_id="t1",
            name="t1-srv",
            transport_url="http://a:8081",
            auth_token_ref="vault://a",  # noqa: S106
        )
        fresh_registry.register_server(
            tenant_id="t2",
            name="t2-srv",
            transport_url="http://b:8081",
            auth_token_ref="vault://b",  # noqa: S106
        )
        assert len(fresh_registry.list_servers(tenant_id="t1")) == 1
        assert len(fresh_registry.list_servers(tenant_id="t2")) == 1
        assert fresh_registry.list_servers(tenant_id="t1")[0].name == "t1-srv"

    def test_cross_tenant_deregister_returns_false(
        self, fresh_registry: FederationRegistry
    ) -> None:
        srv = fresh_registry.register_server(
            tenant_id="t1",
            name="private",
            transport_url="http://a:8081",
            auth_token_ref="vault://a",  # noqa: S106
        )
        assert fresh_registry.deregister_server(tenant_id="t2", server_id=srv.id) is False
        # t1's server is still there.
        assert fresh_registry.get_server(tenant_id="t1", server_id=srv.id) is not None

    def test_cross_tenant_find_tool_returns_none(
        self, fresh_registry: FederationRegistry
    ) -> None:
        fresh_registry.register_server(
            tenant_id="t1",
            name="srv",
            transport_url="http://a:8081",
            auth_token_ref="vault://a",  # noqa: S106
            tools=("private.tool",),
        )
        # t2 cannot find t1's tool.
        assert fresh_registry.find_tool(tenant_id="t2", tool_name="private.tool") is None


# ---------------------------------------------------------------------------
# ExternalMcpClient (with respx-mocked remote server)
# ---------------------------------------------------------------------------
class TestExternalMcpClient:
    @respx.mock
    @pytest.mark.asyncio
    async def test_list_tools_success(self) -> None:
        respx.get("http://remote:8081/api/v1/mcp/tools").mock(
            return_value=Response(200, json={"tools": [{"name": "remote.search"}]})
        )
        srv = FederatedServer(
            id="fed-1",
            tenant_id="t1",
            name="remote",
            transport_url="http://remote:8081",
            auth_token_ref="vault://x",  # noqa: S106
        )
        client = ExternalMcpClient()
        try:
            tools = await client.list_tools(srv)
            assert len(tools) == 1
            assert tools[0]["name"] == "remote.search"
        finally:
            await client.aclose()

    @respx.mock
    @pytest.mark.asyncio
    async def test_call_tool_success(self) -> None:
        respx.post("http://remote:8081/api/v1/mcp/tools/remote.search").mock(
            return_value=Response(200, json={"result": {"hits": [{"id": "h1"}]}})
        )
        srv = FederatedServer(
            id="fed-1",
            tenant_id="t1",
            name="remote",
            transport_url="http://remote:8081",
            auth_token_ref="vault://x",  # noqa: S106
        )
        client = ExternalMcpClient()
        try:
            result = await client.call_tool(srv, "remote.search", {"query": "hello"})
            assert result == {"hits": [{"id": "h1"}]}
        finally:
            await client.aclose()

    @respx.mock
    @pytest.mark.asyncio
    async def test_call_tool_http_error_raises_runtime(self) -> None:
        respx.post("http://remote:8081/api/v1/mcp/tools/remote.search").mock(
            return_value=Response(500, text="boom")
        )
        srv = FederatedServer(
            id="fed-1",
            tenant_id="t1",
            name="remote",
            transport_url="http://remote:8081",
            auth_token_ref="vault://x",  # noqa: S106
        )
        client = ExternalMcpClient()
        try:
            with pytest.raises(RuntimeError, match="failed"):
                await client.call_tool(srv, "remote.search", {})
        finally:
            await client.aclose()

    @respx.mock
    @pytest.mark.asyncio
    async def test_token_resolver_adds_auth_header(self) -> None:
        captured: dict[str, Any] = {}

        def _intercept(request):
            captured["headers"] = dict(request.headers)
            return Response(200, json={"result": "ok"})

        respx.post("http://remote:8081/api/v1/mcp/tools/t").mock(side_effect=_intercept)
        srv = FederatedServer(
            id="fed-1",
            tenant_id="t1",
            name="remote",
            transport_url="http://remote:8081",
            auth_token_ref="vault://x",  # noqa: S106
        )

        def _resolver(ref: str) -> str:
            assert ref == "vault://x"
            return "resolved-token"

        client = ExternalMcpClient(token_resolver=_resolver)
        try:
            await client.call_tool(srv, "t", {})
            assert captured["headers"]["authorization"] == "Bearer resolved-token"
        finally:
            await client.aclose()


# ---------------------------------------------------------------------------
# FederationRouter
# ---------------------------------------------------------------------------
class TestFederationRouter:
    @respx.mock
    @pytest.mark.asyncio
    async def test_route_calls_remote_server(self, fresh_registry: FederationRegistry) -> None:
        respx.post("http://remote:8081/api/v1/mcp/tools/remote.search").mock(
            return_value=Response(200, json={"result": {"hits": []}})
        )
        fresh_registry.register_server(
            tenant_id="t1",
            name="remote",
            transport_url="http://remote:8081",
            auth_token_ref="vault://x",  # noqa: S106
            tools=("remote.search",),
        )
        router = FederationRouter(fresh_registry)
        try:
            result = await router.route(
                tenant_id="t1",
                tool_name="remote.search",
                arguments={"query": "hi"},
            )
            assert result == {"hits": []}
        finally:
            await router.aclose()

    @pytest.mark.asyncio
    async def test_route_returns_none_for_unknown_tool(
        self, fresh_registry: FederationRegistry
    ) -> None:
        router = FederationRouter(fresh_registry)
        try:
            result = await router.route(
                tenant_id="t1",
                tool_name="nope",
                arguments={},
            )
            assert result is None
        finally:
            await router.aclose()


# ---------------------------------------------------------------------------
# Outbox emission
# ---------------------------------------------------------------------------
class TestOutboxEmission:
    def test_emit_federation_event_appends_to_outbox(self) -> None:
        outbox = InMemoryOutboxWriter()
        srv = FederatedServer(
            id="fed-1",
            tenant_id="t1",
            name="remote",
            transport_url="http://remote:8081",
            auth_token_ref="vault://x",  # noqa: S106
            tools=("remote.search",),
        )
        emit_federation_event(outbox, action="registered", server=srv)
        records = outbox.all_records()
        assert len(records) == 1
        event = records[0].event
        assert event.type == "mcp.federation.registered"
        assert event.tenant_id == "t1"
        assert event.aggregate_id == "fed-1"
        assert event.payload["name"] == "remote"

    def test_emit_federation_event_none_outbox_is_noop(self) -> None:
        srv = FederatedServer(
            id="fed-1",
            tenant_id="t1",
            name="remote",
            transport_url="http://remote:8081",
            auth_token_ref="vault://x",  # noqa: S106
        )
        # No exception when outbox is None (test profile).
        emit_federation_event(None, action="registered", server=srv)

    def test_emit_federation_event_rejects_empty_tenant(self) -> None:
        outbox = InMemoryOutboxWriter()
        srv = FederatedServer(
            id="fed-1",
            tenant_id="",
            name="remote",
            transport_url="http://remote:8081",
            auth_token_ref="vault://x",  # noqa: S106
        )
        with pytest.raises(ValueError, match="tenant_id must not be empty"):
            emit_federation_event(outbox, action="registered", server=srv)


# ---------------------------------------------------------------------------
# FastAPI endpoints
# ---------------------------------------------------------------------------
class TestFederationEndpoints:
    @pytest.fixture
    def client(self):
        """Build a TestClient backed by the real main.app.

        ``install_auth`` is wired in main.py with
        ``INSECURE_SKIP_SIGNATURE=1`` (set in conftest), so a valid
        Keycloak-format JWT in ``Authorization`` populates
        ``request.state.ctx``. We reset the shared
        federation_registry before each test for isolation.
        """
        from fastapi.testclient import TestClient

        from mate_tech_mcp import federation_routes as routes_mod
        from mate_tech_mcp import main as main_mod

        # Both modules share the same FederationRegistry instance
        # (main.py calls _set_registry at import time); reset it.
        main_mod.federation_registry.reset()
        # Defensive: in case the routes module's registry drifted.
        routes_mod.federation_registry = main_mod.federation_registry
        routes_mod._rebuild_federation_router()

        yield TestClient(main_mod.app)

        # Clean up after the test.
        main_mod.federation_registry.reset()

    def _register_server(
        self,
        client,
        auth_headers: dict[str, str],
        *,
        name: str = "remote-search",
        transport_url: str = "http://remote-mcp:8081",
        tools: list[str] | None = None,
    ) -> dict[str, Any]:
        r = client.post(
            "/api/v1/mcp/federation/servers",
            json={
                "name": name,
                "transport_url": transport_url,
                "auth_token_ref": "vault://secret/remote-search",
                "description": "remote search server",
                "tools": tools if tools is not None else ["remote.search", "remote.lookup"],
            },
            headers=auth_headers,
        )
        assert r.status_code == 201, r.text
        return r.json()["server"]

    def test_register_server_endpoint(self, client, auth_headers) -> None:
        srv = self._register_server(client, auth_headers)
        assert srv["id"].startswith("fed-")
        assert srv["name"] == "remote-search"
        assert srv["status"] == "active"
        assert srv["tenant_id"] == "tenant-acme"
        assert "remote.search" in srv["tools"]

    def test_register_rejects_invalid_url(self, client, auth_headers) -> None:
        r = client.post(
            "/api/v1/mcp/federation/servers",
            json={
                "name": "bad",
                "transport_url": "ftp://nope",
                "auth_token_ref": "vault://x",
            },
            headers=auth_headers,
        )
        assert r.status_code == 400

    def test_list_servers_endpoint(self, client, auth_headers) -> None:
        self._register_server(client, auth_headers, name="srv-a", tools=["tool1"])
        self._register_server(
            client, auth_headers, name="srv-b", transport_url="http://b:8081", tools=["tool2"]
        )
        r = client.get("/api/v1/mcp/federation/servers", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["total"] == 2

    def test_get_server_endpoint(self, client, auth_headers) -> None:
        srv = self._register_server(client, auth_headers)
        r = client.get(
            f"/api/v1/mcp/federation/servers/{srv['id']}",
            headers=auth_headers,
        )
        assert r.status_code == 200
        assert r.json()["server"]["id"] == srv["id"]

    def test_get_returns_404_for_unknown(self, client, auth_headers) -> None:
        r = client.get(
            "/api/v1/mcp/federation/servers/fed-does-not-exist",
            headers=auth_headers,
        )
        assert r.status_code == 404

    def test_update_server_endpoint(self, client, auth_headers) -> None:
        srv = self._register_server(client, auth_headers)
        r = client.put(
            f"/api/v1/mcp/federation/servers/{srv['id']}",
            json={"status": "disabled", "description": "temporarily off"},
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        body = r.json()["server"]
        assert body["status"] == "disabled"
        assert body["description"] == "temporarily off"

    def test_deregister_server_endpoint(self, client, auth_headers) -> None:
        srv = self._register_server(client, auth_headers)
        r = client.delete(
            f"/api/v1/mcp/federation/servers/{srv['id']}",
            headers=auth_headers,
        )
        assert r.status_code == 200
        # Subsequent get returns the row with status=deleted.
        r2 = client.get(
            f"/api/v1/mcp/federation/servers/{srv['id']}",
            headers=auth_headers,
        )
        assert r2.status_code == 200
        assert r2.json()["server"]["status"] == "deleted"

    def test_list_remote_tools_endpoint(self, client, auth_headers) -> None:
        self._register_server(
            client, auth_headers, name="srv-a", tools=["tool1", "tool2"]
        )
        self._register_server(
            client,
            auth_headers,
            name="srv-b",
            transport_url="http://b:8081",
            tools=["tool3"],
        )
        r = client.get("/api/v1/mcp/federation/tools", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["total"] == 3

    @respx.mock
    def test_invoke_remote_tool_endpoint(self, client, auth_headers) -> None:
        respx.post("http://remote-mcp:8081/api/v1/mcp/tools/remote.search").mock(
            return_value=Response(200, json={"result": {"hits": [{"id": "h1"}]}})
        )
        srv = self._register_server(client, auth_headers)
        r = client.post(
            "/api/v1/mcp/federation/tools/remote.search/invoke",
            json={"arguments": {"query": "hello"}},
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["tool"] == "remote.search"
        assert body["server_id"] == srv["id"]
        assert body["result"] == {"hits": [{"id": "h1"}]}

    def test_invoke_remote_tool_returns_404_for_unknown(
        self, client, auth_headers
    ) -> None:
        r = client.post(
            "/api/v1/mcp/federation/tools/nope/invoke",
            json={"arguments": {}},
            headers=auth_headers,
        )
        assert r.status_code == 404

    def test_cross_tenant_get_returns_404(
        self, client, auth_headers, auth_headers_other_tenant
    ) -> None:
        srv = self._register_server(client, auth_headers)
        r = client.get(
            f"/api/v1/mcp/federation/servers/{srv['id']}",
            headers=auth_headers_other_tenant,
        )
        assert r.status_code == 404

    def test_cross_tenant_deregister_returns_404(
        self, client, auth_headers, auth_headers_other_tenant
    ) -> None:
        srv = self._register_server(client, auth_headers)
        r = client.delete(
            f"/api/v1/mcp/federation/servers/{srv['id']}",
            headers=auth_headers_other_tenant,
        )
        assert r.status_code == 404
        # Original tenant can still see it.
        r2 = client.get(
            f"/api/v1/mcp/federation/servers/{srv['id']}",
            headers=auth_headers,
        )
        assert r2.status_code == 200

    def test_cross_tenant_invoke_returns_404(
        self, client, auth_headers, auth_headers_other_tenant
    ) -> None:
        # Register a server with a tool in tenant-acme.
        self._register_server(client, auth_headers, tools=["private.tool"])
        # Other tenant cannot invoke it (tool not found in their registry).
        r = client.post(
            "/api/v1/mcp/federation/tools/private.tool/invoke",
            json={"arguments": {}},
            headers=auth_headers_other_tenant,
        )
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# ADR-0014 step 5: cross-tenant negative tests (3 minimum)
# ---------------------------------------------------------------------------
class TestCrossTenantNegatives:
    def test_require_tenant_rejects_empty_tenant(self) -> None:
        from mate_platform.tenancy import (
            AuthMethod,
            RequestContext,
            TenantAccessError,
            TenantId,
            UserId,
            require_tenant,
        )

        ctx = RequestContext(
            request_id="r1",
            trace_id="t1",
            tenant_id=TenantId(""),
            user_id=UserId("u"),
            roles=frozenset(),
            permissions=frozenset(),
            auth_method=AuthMethod.USER,
        )
        with pytest.raises(TenantAccessError, match="missing tenant"):
            require_tenant(ctx)

    def test_federation_registry_refuses_cross_tenant_read(
        self, fresh_registry: FederationRegistry
    ) -> None:
        srv = fresh_registry.register_server(
            tenant_id="t1",
            name="private",
            transport_url="http://a:8081",
            auth_token_ref="vault://a",  # noqa: S106
        )
        # Tenant t2 cannot read t1's server.
        assert fresh_registry.get_server(tenant_id="t2", server_id=srv.id) is None
        # And cannot list it either.
        t2_servers = fresh_registry.list_servers(tenant_id="t2")
        assert not any(s.id == srv.id for s in t2_servers)

    def test_federation_registry_refuses_cross_tenant_deregister(
        self, fresh_registry: FederationRegistry
    ) -> None:
        srv = fresh_registry.register_server(
            tenant_id="t1",
            name="private",
            transport_url="http://a:8081",
            auth_token_ref="vault://a",  # noqa: S106
        )
        # Tenant t2 cannot deregister t1's server.
        assert fresh_registry.deregister_server(tenant_id="t2", server_id=srv.id) is False
        # t1's server is still there.
        assert fresh_registry.get_server(tenant_id="t1", server_id=srv.id) is not None
