"""v3.2 W1 — real federation components e2e tests (mock httpx).

Covers the three new federation pieces added in W1
(``2026-08-02-v3.2-parallel-prompts.md`` W1 / ADR-0014):

  * ``McpRemoteClient`` — real HTTP discover / invoke / health, with
    explicit ``AuthError`` (401) / ``RemoteUnavailableError``
    (503 + timeout) / ``RemoteError`` (other) failure modes.
  * ``HealthChecker`` — heartbeat that flips unreachable servers
    active → inactive (persisted as ``disabled``).
  * ``FederationDLQ`` — tenant-scoped dead-letter queue with replay.

The httpx transport is mocked by injecting a fake ``AsyncClient`` so
the tests are fully offline.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from unittest.mock import AsyncMock, Mock

import httpx
import pytest

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

from mate_tech_mcp.federation import (  # noqa: E402
    AuthError,
    FederationDLQ,
    FederationDLQEntry,
    FederationRegistry,
    HealthChecker,
    McpRemoteClient,
    RemoteError,
    RemoteUnavailableError,
)

ENDPOINT = "http://remote-mcp:8081"
TOKEN = "test-bearer-token"  # noqa: S105


# ---------------------------------------------------------------------------
# httpx mock helpers
# ---------------------------------------------------------------------------
def _response(status_code: int = 200, json_data: object | None = None, text: str = "") -> Mock:
    """Build a fake ``httpx.Response`` with the bits the client reads."""
    resp = Mock()
    resp.status_code = status_code
    resp.json.return_value = json_data if json_data is not None else {}
    resp.text = text
    return resp


def _mock_httpx_client(
    *,
    get_return: Mock | None = None,
    get_side_effect: BaseException | None = None,
    post_return: Mock | None = None,
    post_side_effect: BaseException | None = None,
) -> AsyncMock:
    """Build a mock ``httpx.AsyncClient`` with the given get/post behaviour."""
    client = AsyncMock(spec=httpx.AsyncClient)
    if get_side_effect is not None:
        client.get = AsyncMock(side_effect=get_side_effect)
    else:
        client.get = AsyncMock(return_value=get_return)
    if post_side_effect is not None:
        client.post = AsyncMock(side_effect=post_side_effect)
    else:
        client.post = AsyncMock(return_value=post_return)
    return client


# ---------------------------------------------------------------------------
# McpRemoteClient — discover / invoke / health
# ---------------------------------------------------------------------------
class TestMcpRemoteClient:
    @pytest.mark.asyncio
    async def test_remote_client_discover_tools_success(self) -> None:
        mock_client = _mock_httpx_client(
            get_return=_response(
                200, json_data={"tools": [{"name": "remote.search"}, {"name": "remote.lookup"}]}
            )
        )
        client = McpRemoteClient(httpx_client=mock_client)

        tools = await client.discover_tools(ENDPOINT, TOKEN)

        assert len(tools) == 2
        assert tools[0]["name"] == "remote.search"
        assert tools[1]["name"] == "remote.lookup"
        mock_client.get.assert_awaited_once()
        called_url = mock_client.get.await_args.args[0]
        assert called_url == f"{ENDPOINT}/tools"
        # Auth header propagated.
        headers = mock_client.get.await_args.kwargs["headers"]
        assert headers["Authorization"] == f"Bearer {TOKEN}"

    @pytest.mark.asyncio
    async def test_remote_client_invoke_tool_success(self) -> None:
        mock_client = _mock_httpx_client(
            post_return=_response(200, json_data={"result": {"hits": [{"id": "h1"}]}})
        )
        client = McpRemoteClient(httpx_client=mock_client)

        result = await client.invoke_tool(ENDPOINT, TOKEN, "remote.search", {"query": "hi"})

        assert result == {"result": {"hits": [{"id": "h1"}]}}
        mock_client.post.assert_awaited_once()
        called_url = mock_client.post.await_args.args[0]
        assert called_url == f"{ENDPOINT}/tools/remote.search"
        body = mock_client.post.await_args.kwargs["json"]
        assert body == {"arguments": {"query": "hi"}}

    @pytest.mark.asyncio
    async def test_remote_client_health_check_true(self) -> None:
        mock_client = _mock_httpx_client(get_return=_response(200))
        client = McpRemoteClient(httpx_client=mock_client)

        ok = await client.health_check(ENDPOINT, TOKEN)

        assert ok is True
        called_url = mock_client.get.await_args.args[0]
        assert called_url == f"{ENDPOINT}/health"

    @pytest.mark.asyncio
    async def test_remote_client_401_raises_auth_error(self) -> None:
        mock_client = _mock_httpx_client(
            get_return=_response(401, json_data={}, text="unauthorized")
        )
        client = McpRemoteClient(httpx_client=mock_client)

        with pytest.raises(AuthError, match="401"):
            await client.discover_tools(ENDPOINT, TOKEN)

    @pytest.mark.asyncio
    async def test_remote_client_503_raises_unavailable(self) -> None:
        mock_client = _mock_httpx_client(
            post_return=_response(503, json_data={}, text="overloaded")
        )
        client = McpRemoteClient(httpx_client=mock_client)

        with pytest.raises(RemoteUnavailableError, match="503"):
            await client.invoke_tool(ENDPOINT, TOKEN, "remote.search", {})

    @pytest.mark.asyncio
    async def test_remote_client_timeout_raises_unavailable(self) -> None:
        mock_client = _mock_httpx_client(
            get_side_effect=httpx.TimeoutException("read timed out")
        )
        client = McpRemoteClient(httpx_client=mock_client)

        with pytest.raises(RemoteUnavailableError, match="timed out"):
            await client.discover_tools(ENDPOINT, TOKEN)

    @pytest.mark.asyncio
    async def test_remote_client_other_error_raises_remote_error(self) -> None:
        mock_client = _mock_httpx_client(
            get_return=_response(500, json_data={}, text="internal")
        )
        client = McpRemoteClient(httpx_client=mock_client)

        with pytest.raises(RemoteError, match="500"):
            await client.discover_tools(ENDPOINT, TOKEN)

    @pytest.mark.asyncio
    async def test_remote_client_health_check_false_on_503(self) -> None:
        # health_check must NEVER raise — a 503 maps to False.
        mock_client = _mock_httpx_client(
            get_return=_response(503, json_data={}, text="overloaded")
        )
        client = McpRemoteClient(httpx_client=mock_client)

        ok = await client.health_check(ENDPOINT, TOKEN)

        assert ok is False

    @pytest.mark.asyncio
    async def test_remote_client_health_check_false_on_timeout(self) -> None:
        # A transport-level failure also maps to False (never raises).
        mock_client = _mock_httpx_client(
            get_side_effect=httpx.ConnectError("connection refused")
        )
        client = McpRemoteClient(httpx_client=mock_client)

        ok = await client.health_check(ENDPOINT, TOKEN)

        assert ok is False


# ---------------------------------------------------------------------------
# HealthChecker — heartbeat flips dead servers to disabled
# ---------------------------------------------------------------------------
class TestHealthChecker:
    @pytest.mark.asyncio
    async def test_health_checker_updates_inactive_servers(self) -> None:
        registry = FederationRegistry()
        healthy = registry.register_server(
            tenant_id="t1",
            name="up-server",
            transport_url="http://up:8081",
            auth_token_ref="vault://up",  # noqa: S106
            tools=("tool.a",),
        )
        dead = registry.register_server(
            tenant_id="t1",
            name="down-server",
            transport_url="http://down:8081",
            auth_token_ref="vault://down",  # noqa: S106
            tools=("tool.b",),
        )

        async def _health(endpoint: str, auth_token: str | None) -> bool:
            return endpoint == "http://up:8081"

        remote = Mock()
        remote.health_check = _health
        checker = HealthChecker(registry, remote, interval_sec=60)

        results = await checker.check_all()

        assert results[healthy.id] == "active"
        assert results[dead.id] == "inactive"
        # Registry persisted the dead one as disabled (its status vocabulary).
        assert (
            registry.get_server(tenant_id="t1", server_id=dead.id).status == "disabled"
        )
        assert (
            registry.get_server(tenant_id="t1", server_id=healthy.id).status == "active"
        )
        # A disabled server should not be routable.
        assert registry.find_tool(tenant_id="t1", tool_name="tool.b") is None

    @pytest.mark.asyncio
    async def test_health_checker_skips_disabled_servers(self) -> None:
        registry = FederationRegistry()
        active = registry.register_server(
            tenant_id="t1",
            name="up",
            transport_url="http://up:8081",
            auth_token_ref="vault://up",  # noqa: S106
            tools=("tool.a",),
        )
        already_down = registry.register_server(
            tenant_id="t1",
            name="down",
            transport_url="http://down:8081",
            auth_token_ref="vault://down",  # noqa: S106
            tools=("tool.b",),
        )
        # Flip one to disabled before the run.
        registry.update_server(
            tenant_id="t1", server_id=already_down.id, status="disabled"
        )

        call_count = 0

        async def _health(endpoint: str, auth_token: str | None) -> bool:
            nonlocal call_count
            call_count += 1
            return True

        remote = Mock()
        remote.health_check = _health
        checker = HealthChecker(registry, remote)

        results = await checker.check_all()

        # The disabled server is reported inactive and is NOT probed.
        assert results[already_down.id] == "inactive"
        assert results[active.id] == "active"
        assert call_count == 1

    @pytest.mark.asyncio
    async def test_health_checker_marks_inactive_on_exception(self) -> None:
        registry = FederationRegistry()
        srv = registry.register_server(
            tenant_id="t1",
            name="flaky",
            transport_url="http://flaky:8081",
            auth_token_ref="vault://flaky",  # noqa: S106
            tools=("tool.x",),
        )

        async def _boom(endpoint: str, auth_token: str | None) -> bool:
            raise RuntimeError("remote blew up")

        remote = Mock()
        remote.health_check = _boom
        checker = HealthChecker(registry, remote)

        results = await checker.check_all()

        # The heartbeat swallows the exception and still flips the server.
        assert results[srv.id] == "inactive"
        assert (
            registry.get_server(tenant_id="t1", server_id=srv.id).status == "disabled"
        )


# ---------------------------------------------------------------------------
# FederationDLQ — put / list / replay / tenant isolation
# ---------------------------------------------------------------------------
class TestFederationDLQ:
    def _entry(
        self,
        *,
        tenant_id: str = "t1",
        server_id: str = "fed-00000001",
        tool_name: str = "remote.search",
        entry_id: str = "",
    ) -> FederationDLQEntry:
        return FederationDLQEntry(
            entry_id=entry_id,
            tenant_id=tenant_id,
            server_id=server_id,
            tool_name=tool_name,
            arguments={"query": "hi"},
            error="RemoteUnavailableError: 503",
        )

    def test_dlq_put_and_list(self) -> None:
        dlq = FederationDLQ()
        e1 = dlq.put(self._entry(tenant_id="t1", tool_name="tool.a"))
        e2 = dlq.put(self._entry(tenant_id="t2", tool_name="tool.b"))

        # put auto-assigns a deterministic id.
        assert e1.entry_id.startswith("dlq-")
        assert e2.entry_id != e1.entry_id
        assert len(dlq.list()) == 2

    def test_dlq_replay_retries(self) -> None:
        dlq = FederationDLQ()
        entry = dlq.put(self._entry())

        # Replay succeeds and consumes the entry (handed back to the
        # processing pipeline; it leaves the DLQ).
        assert dlq.replay(entry.entry_id) is True
        assert dlq.list() == []
        # Replaying an already-consumed / unknown entry returns False.
        assert dlq.replay(entry.entry_id) is False
        assert dlq.replay("dlq-does-not-exist") is False

    def test_dlq_tenant_isolation(self) -> None:
        dlq = FederationDLQ()
        dlq.put(self._entry(tenant_id="t1", tool_name="t1.tool"))
        dlq.put(self._entry(tenant_id="t1", tool_name="t1.other"))
        dlq.put(self._entry(tenant_id="t2", tool_name="t2.tool"))

        # Unfiltered list sees all entries.
        assert len(dlq.list()) == 3
        # Tenant-scoped list enforces isolation (SEC-TENANT-01 hard rule 3).
        t1_only = dlq.list(tenant_id="t1")
        assert len(t1_only) == 2
        assert all(e.tenant_id == "t1" for e in t1_only)
        t2_only = dlq.list(tenant_id="t2")
        assert len(t2_only) == 1
        assert t2_only[0].tenant_id == "t2"
        # Tenant with no entries gets an empty list.
        assert dlq.list(tenant_id="t3") == []
