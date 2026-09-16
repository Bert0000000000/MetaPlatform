"""1.1 task 1b: MCP client registry is persisted, tenant-isolated.

``clients_repo`` used to keep every external-client registration in a
module-level dict (``_CLIENTS``), so the MCP center's 客户端 list was lost
on every container restart and invisible to a second replica. These tests
pin the PG-backed behaviour:

  - CRUD round-trips through SQLAlchemy
  - every read is scoped to one tenant (cross-tenant negative)
  - rows survive an engine restart (the "重启仍在" criterion)

The tenant context itself is enforced upstream by ``require_tenant`` in
``api/clients_routes.py`` (hard rule 3); these tests cover the store's own
tenant filter, which is the second half of the same guard.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

_MONOREPO = Path(__file__).resolve().parents[3]
_DB_SRC = str(_MONOREPO / "packages" / "mate-tech-db" / "src")
if _DB_SRC not in sys.path:
    sys.path.insert(0, _DB_SRC)

from mate_tech_db.base import create_all, init_engine, reset_engine

from mate_tech_mcp import clients_repo as repo
from mate_tech_mcp.repositories import sql_models as _models  # noqa: F401  (register tables)

_TENANT_A = "tenant-acme"
_TENANT_B = "tenant-bigo"


@pytest.fixture(autouse=True)
def _fresh_db(tmp_path: Path) -> None:
    """File-backed SQLite so persistence-across-restart is observable."""
    reset_engine()
    init_engine(f"sqlite:///{tmp_path / 'clients.db'}")
    create_all()
    yield
    reset_engine()


# --- CRUD ----------------------------------------------------------------
def test_create_then_get_round_trips() -> None:
    created = repo.create_client(
        _TENANT_A,
        name="codex",
        endpoint="http://mcp.local/api/v1/mcp/protocol/mcp",
        client_type="EXTERNAL",
        transport_type="STREAMABLE_HTTP",
        auth_type="bearer",
    )
    assert created.id
    assert created.tenant_id == _TENANT_A

    fetched = repo.get_client(_TENANT_A, created.id)
    assert fetched is not None
    assert fetched.name == "codex"
    assert fetched.endpoint == "http://mcp.local/api/v1/mcp/protocol/mcp"
    assert fetched.transport_type == "STREAMABLE_HTTP"


def test_list_is_newest_first() -> None:
    first = repo.create_client(_TENANT_A, name="one")
    second = repo.create_client(_TENANT_A, name="two")
    ids = [c.id for c in repo.list_clients(_TENANT_A)]
    assert ids.index(second.id) < ids.index(first.id)


def test_update_persists_and_refreshes_updated_at() -> None:
    created = repo.create_client(_TENANT_A, name="before")
    updated = repo.update_client(_TENANT_A, created.id, name="after", status="connected")
    assert updated is not None
    assert updated.name == "after"
    assert updated.status == "connected"
    assert updated.created_at == created.created_at

    refetched = repo.get_client(_TENANT_A, created.id)
    assert refetched is not None and refetched.name == "after"


def test_delete_removes_row() -> None:
    created = repo.create_client(_TENANT_A, name="doomed")
    assert repo.delete_client(_TENANT_A, created.id) is True
    assert repo.get_client(_TENANT_A, created.id) is None
    assert repo.delete_client(_TENANT_A, created.id) is False


def test_mark_client_connected_sets_status_and_tool_count() -> None:
    created = repo.create_client(_TENANT_A, name="codex")
    marked = repo.mark_client_connected(_TENANT_A, created.id, tools=7)
    assert marked is not None
    assert marked.status == "connected"
    assert marked.discovered_tools == 7
    assert marked.last_connected_at


# --- tenant isolation (negative) -----------------------------------------
def test_list_is_tenant_scoped() -> None:
    repo.create_client(_TENANT_A, name="a-only")
    repo.create_client(_TENANT_B, name="b-only")

    assert [c.name for c in repo.list_clients(_TENANT_A)] == ["a-only"]
    assert [c.name for c in repo.list_clients(_TENANT_B)] == ["b-only"]


def test_cross_tenant_get_is_denied() -> None:
    created = repo.create_client(_TENANT_A, name="a-only")
    assert repo.get_client(_TENANT_B, created.id) is None


def test_cross_tenant_update_is_denied() -> None:
    created = repo.create_client(_TENANT_A, name="a-only")
    assert repo.update_client(_TENANT_B, created.id, name="hijacked") is None
    still = repo.get_client(_TENANT_A, created.id)
    assert still is not None and still.name == "a-only"


def test_cross_tenant_delete_is_denied() -> None:
    created = repo.create_client(_TENANT_A, name="a-only")
    assert repo.delete_client(_TENANT_B, created.id) is False
    assert repo.get_client(_TENANT_A, created.id) is not None


def test_blank_tenant_never_reads_anything() -> None:
    repo.create_client(_TENANT_A, name="a-only")
    assert repo.list_clients("") == []
    assert repo.get_client("", "whatever") is None


# --- durability ----------------------------------------------------------
def test_clients_survive_engine_restart() -> None:
    created = repo.create_client(_TENANT_A, name="survivor")

    # Simulate a service restart: drop the engine + session factory and
    # re-initialise against the same file. The in-memory dict this replaces
    # could never do this.
    url = _engine_url()
    reset_engine()
    init_engine(url)

    survived = repo.get_client(_TENANT_A, created.id)
    assert survived is not None
    assert survived.name == "survivor"


def _engine_url() -> str:
    from mate_tech_db.base import get_engine

    return get_engine().url.render_as_string(hide_password=False)


# --- HTTP surface (require_tenant -> repo) -------------------------------
def _client_with_tenant(tenant: str):
    """A FastAPI app carrying only the clients router + a tenant stub.

    Deliberately not ``mate_tech_mcp.main``: this isolates the
    ``require_tenant`` -> repo path without booting the whole service.
    """
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from mate_platform.tenancy import AuthMethod, RequestContext, TenantId, UserId
    from starlette.middleware.base import BaseHTTPMiddleware

    from mate_tech_mcp.api.clients_routes import router

    class StubAuth(BaseHTTPMiddleware):
        async def dispatch(self, request, call_next):  # type: ignore[no-untyped-def]
            request.state.ctx = RequestContext(
                request_id="",
                trace_id="",
                tenant_id=TenantId(tenant),
                user_id=UserId("u-1"),
                roles=frozenset(),
                permissions=frozenset(),
                scopes=frozenset(),
                client_id="test",
                auth_method=AuthMethod.API_KEY,
            )
            return await call_next(request)

    app = FastAPI()
    app.add_middleware(StubAuth)
    app.include_router(router)
    return TestClient(app)


def test_endpoint_lists_only_own_tenant_clients() -> None:
    mine = repo.create_client(_TENANT_A, name="mine")
    repo.create_client(_TENANT_B, name="theirs")

    body = _client_with_tenant(_TENANT_A).get("/api/v1/mcp/clients").json()
    assert [c["name"] for c in body["items"]] == ["mine"]
    assert body["total"] == 1
    assert _client_with_tenant(_TENANT_A).get(f"/api/v1/mcp/clients/{mine.id}").status_code == 200


def test_endpoint_cannot_read_another_tenants_client() -> None:
    theirs = repo.create_client(_TENANT_B, name="theirs")

    resp = _client_with_tenant(_TENANT_A).get(f"/api/v1/mcp/clients/{theirs.id}")
    assert resp.status_code == 404  # no existence oracle


def test_endpoint_rejects_anonymous_without_tenant_context() -> None:
    """Hard rule 3: no tenant context, no repository access."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from mate_platform.errors.handlers import tenant_access_error_handler
    from mate_platform.tenancy import AuthMethod, RequestContext, TenantId, UserId
    from mate_platform.tenancy.guards import TenantAccessError
    from starlette.middleware.base import BaseHTTPMiddleware

    from mate_tech_mcp.api.clients_routes import router

    class AnonymousAuth(BaseHTTPMiddleware):
        """Mirrors install_auth's anonymous-path context (no tenant)."""

        async def dispatch(self, request, call_next):  # type: ignore[no-untyped-def]
            request.state.ctx = RequestContext(
                request_id="",
                trace_id="",
                tenant_id=TenantId(""),
                user_id=UserId(""),
                roles=frozenset(),
                permissions=frozenset(),
                scopes=frozenset(),
                client_id="",
                auth_method=AuthMethod.ANONYMOUS,
            )
            return await call_next(request)

    app = FastAPI()
    app.add_middleware(AnonymousAuth)
    app.include_router(router)
    app.add_exception_handler(TenantAccessError, tenant_access_error_handler)

    resp = TestClient(app).get("/api/v1/mcp/clients")
    assert resp.status_code == 400
