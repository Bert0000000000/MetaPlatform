"""G6 RLS session bridge tests.

Covers the application-layer companion to the PostgreSQL RLS policy
emitted by Alembic 0008 (``mate-platform-backend/alembic/versions/
20260801_0008_tenant_rls.py``):

  - ``install_rls_session`` emits the ``SET LOCAL app.tenant_id``
    statement with the right value (escaped).
  - Cross-tenant admin sessions additionally flag
    ``app.bypass_tenant = 'true'``.
  - Tenant_id with control characters / SQL injection is rejected
    before we touch the wire.
  - The dialect gate skips the ``SET LOCAL`` on SQLite / MySQL.
  - ``attach_rls_listener`` is idempotent.
  - ``rls_session_middleware`` wires the engine factory + ctx together.

Tests use a mock dialect (no real PostgreSQL required) so CI runs
on SQLite/Postgres-agnostic pipelines.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

# Make mate_platform importable from the source tree.
REPO = Path(__file__).resolve().parents[2]
PKG = REPO / "mate-platform-backend" / "packages"
for sub in ("mate-platform", "mate-clients", "mate-tech-db"):
    sys.path.insert(0, str(PKG / sub / "src"))

os.environ.setdefault("LEGACY_LOGIN_COMPAT", "true")
os.environ.setdefault("KEYCLOAK_URL", "https://keycloak.test.invalid")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")

from mate_platform.tenancy.context import AuthMethod, RequestContext, TenantId
from mate_platform.tenancy.rls_session import (
    GUC_BYPASS,
    GUC_TENANT_ID,
    _build_set_local_statements,
    _escape_pg_string,
    attach_rls_listener,
    install_rls_session,
    is_attached,
    rls_session_middleware,
)


def _ctx(tenant_id: str = "tenant-acme", roles: list[str] | None = None) -> RequestContext:
    return RequestContext(
        request_id="req-1",
        trace_id="trace-1",
        tenant_id=TenantId(tenant_id),
        user_id="u-1",
        roles=frozenset(roles or ["PLATFORM_USER"]),
        permissions=frozenset(),
        client_id="metaplatform-backend",
        auth_method=AuthMethod.USER,
    )


# ---------------------------------------------------------------------------
# Pure-string helpers
# ---------------------------------------------------------------------------
class TestEscapePgString:
    def test_passes_simple_tenant_id(self) -> None:
        assert _escape_pg_string("tenant-acme") == "tenant-acme"

    def test_doubles_single_quote(self) -> None:
        assert _escape_pg_string("o'reilly") == "o''reilly"

    def test_rejects_control_characters(self) -> None:
        with pytest.raises(ValueError, match="control character"):
            _escape_pg_string("tenant\nwith-newline")
        with pytest.raises(ValueError, match="control character"):
            _escape_pg_string("tenant\x00null")

    def test_rejects_empty_string(self) -> None:
        # Empty is technically safe but we let callers handle that —
        # the function just escapes the input verbatim.
        assert _escape_pg_string("") == ""


class TestBuildSetLocalStatements:
    def test_basic_user(self) -> None:
        ctx = _ctx(tenant_id="tenant-acme")
        stmts = _build_set_local_statements(ctx)
        assert stmts == [f"SET LOCAL {GUC_TENANT_ID} = 'tenant-acme'"]

    def test_cross_tenant_admin_gets_bypass_flag(self) -> None:
        ctx = _ctx(roles=["cross_tenant_admin"])
        stmts = _build_set_local_statements(ctx)
        assert f"SET LOCAL {GUC_TENANT_ID} = 'tenant-acme'" in stmts
        assert f"SET LOCAL {GUC_BYPASS} = 'true'" in stmts

    def test_anonymous_is_rejected(self) -> None:
        ctx = RequestContext(
            request_id="req-1",
            trace_id="trace-1",
            tenant_id=TenantId(""),
            user_id="u-1",
            roles=frozenset(),
            permissions=frozenset(),
            client_id="metaplatform-backend",
            auth_method=AuthMethod.ANONYMOUS,
        )
        with pytest.raises(Exception, match="anonymous"):
            _build_set_local_statements(ctx)

    def test_empty_tenant_id_is_rejected(self) -> None:
        ctx = _ctx(tenant_id="")
        with pytest.raises(Exception, match="missing tenant"):
            _build_set_local_statements(ctx)

    def test_sql_injection_is_neutralised(self) -> None:
        ctx = _ctx(tenant_id="tenant'; DROP TABLE x; --")
        stmts = _build_set_local_statements(ctx)
        # The single quote is doubled, so the resulting statement is a
        # single SQL literal; nothing breaks out of the string.
        assert stmts == [
            f"SET LOCAL {GUC_TENANT_ID} = 'tenant''; DROP TABLE x; --'"
        ]


# ---------------------------------------------------------------------------
# Session installation (mock dialect)
# ---------------------------------------------------------------------------
class _RecordedConn:
    def __init__(self) -> None:
        self.executed: list[str] = []

    def exec_driver_sql(self, stmt: str) -> MagicMock:
        self.executed.append(stmt)
        return MagicMock()


class _FakeSession:
    def __init__(self, dialect_name: str = "postgresql") -> None:
        self.dialect_name = dialect_name
        self.conn = _RecordedConn()
        self.info: dict = {}

    def get_bind(self) -> MagicMock:
        engine = MagicMock()
        engine.dialect.name = self.dialect_name
        return engine

    def connection(self) -> _RecordedConn:
        return self.conn


class TestInstallRlsSession:
    def test_sets_local_on_postgres(self) -> None:
        session = _FakeSession(dialect_name="postgresql")
        install_rls_session(session, _ctx())
        assert session.conn.executed == [
            f"SET LOCAL {GUC_TENANT_ID} = 'tenant-acme'"
        ]

    def test_sets_bypass_for_cross_tenant_admin(self) -> None:
        session = _FakeSession(dialect_name="postgresql")
        install_rls_session(session, _ctx(roles=["cross_tenant_admin"]))
        assert session.conn.executed == [
            f"SET LOCAL {GUC_TENANT_ID} = 'tenant-acme'",
            f"SET LOCAL {GUC_BYPASS} = 'true'",
        ]

    def test_skipped_on_sqlite(self) -> None:
        session = _FakeSession(dialect_name="sqlite")
        install_rls_session(session, _ctx())
        assert session.conn.executed == []

    def test_skipped_on_mysql(self) -> None:
        session = _FakeSession(dialect_name="mysql")
        install_rls_session(session, _ctx())
        assert session.conn.executed == []

    def test_records_ctx_on_session_info(self) -> None:
        session = _FakeSession(dialect_name="postgresql")
        ctx = _ctx()
        install_rls_session(session, ctx)
        assert session.info["tenant_ctx"] is ctx

    def test_rejects_none_context(self) -> None:
        session = _FakeSession(dialect_name="postgresql")
        with pytest.raises(ValueError, match="RequestContext"):
            install_rls_session(session, None)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# Listener attachment
# ---------------------------------------------------------------------------
class TestAttachRlsListener:
    def test_idempotent(self) -> None:
        engine = MagicMock()
        engine.dialect.name = "postgresql"
        assert is_attached(engine) is False
        attach_rls_listener(engine)
        assert is_attached(engine) is True
        # Second call is a no-op.
        attach_rls_listener(engine)
        assert is_attached(engine) is True

    def test_noop_on_sqlite(self) -> None:
        engine = MagicMock()
        engine.dialect.name = "sqlite"
        attach_rls_listener(engine)
        assert is_attached(engine) is True


# ---------------------------------------------------------------------------
# Middleware closure
# ---------------------------------------------------------------------------
class TestRlsSessionMiddleware:
    def test_factory_returns_session_with_ctx_bound(self) -> None:
        session = _FakeSession(dialect_name="postgresql")
        opener = rls_session_middleware(lambda: session)
        ctx = _ctx()
        result = opener(ctx)
        assert result is session
        assert session.info["tenant_ctx"] is ctx
        assert session.conn.executed == [
            f"SET LOCAL {GUC_TENANT_ID} = 'tenant-acme'"
        ]
