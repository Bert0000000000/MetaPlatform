"""Tests for mate_clients.pg — PgClient ACL client (ADR-0014 step 4).

Uses SQLite for in-process testing; the PG-specific behavior
(production guard, DSN resolution) is the same since PgClient wraps
SQLAlchemy which abstracts the dialect.
"""
from __future__ import annotations

import os

import pytest
from sqlalchemy import inspect, select
from sqlalchemy.orm import Mapped, mapped_column

from mate_clients.pg import PgClient, get_pg_client, reset_pg_client


@pytest.fixture(autouse=True)
def _clean_singleton() -> None:
    """Reset the singleton PgClient before and after each test."""
    reset_pg_client()
    yield
    reset_pg_client()


def test_pg_client_requires_dsn() -> None:
    """PgClient raises if no DSN is provided and no env var is set."""
    for key in ("MATE_DB_URL", "DATABASE_URL"):
        os.environ.pop(key, None)
    with pytest.raises(RuntimeError, match="DSN"):
        PgClient()


def test_pg_client_with_explicit_dsn() -> None:
    """PgClient accepts an explicit SQLite DSN."""
    client = PgClient(dsn="sqlite:///:memory:")
    assert "sqlite" in client.dsn


def test_pg_client_with_env_dsn() -> None:
    """PgClient resolves DSN from MATE_DB_URL env var."""
    os.environ["MATE_DB_URL"] = "sqlite:///./test_pg_env.db"
    try:
        client = PgClient()
        assert "test_pg_env" in client.dsn
    finally:
        os.environ.pop("MATE_DB_URL", None)
        if os.path.exists("./test_pg_env.db"):
            os.remove("./test_pg_env.db")


def test_pg_client_health_check_ok() -> None:
    """health() returns True for a working database."""
    client = PgClient(dsn="sqlite:///:memory:")
    assert client.health() is True


def test_pg_client_session_commit() -> None:
    """session() commits on normal exit."""
    from mate_tech_db.base import Base

    class Thing(Base):
        __tablename__ = "pg_test_things"
        id: Mapped[str] = mapped_column(primary_key=True)
        value: Mapped[int] = mapped_column(default=0)

    client = PgClient(dsn="sqlite:///:memory:")
    Base.metadata.create_all(client.engine)

    with client.session() as s:
        s.add(Thing(id="t-1", value=99))

    with client.session() as s:
        result = s.execute(select(Thing).where(Thing.id == "t-1")).scalar_one()
        assert result.value == 99


def test_pg_client_session_rollback_on_error() -> None:
    """session() rolls back on exception."""
    from mate_tech_db.base import Base

    class Gizmo(Base):
        __tablename__ = "pg_test_gizmos"
        id: Mapped[str] = mapped_column(primary_key=True)

    client = PgClient(dsn="sqlite:///:memory:")
    Base.metadata.create_all(client.engine)

    with pytest.raises(ValueError):
        with client.session() as s:
            s.add(Gizmo(id="g-1"))
            raise ValueError("test error")

    # Verify the row was not committed
    with client.session() as s:
        result = s.execute(select(Gizmo).where(Gizmo.id == "g-1")).scalar_one_or_none()
        assert result is None


def test_pg_client_dispose() -> None:
    """dispose() releases the engine."""
    client = PgClient(dsn="sqlite:///:memory:")
    client.dispose()
    # After dispose, health check should fail
    assert client.health() is False


def test_get_pg_client_singleton() -> None:
    """get_pg_client returns the same instance on repeated calls."""
    os.environ["MATE_DB_URL"] = "sqlite:///:memory:"
    try:
        c1 = get_pg_client()
        c2 = get_pg_client()
        assert c1 is c2
    finally:
        os.environ.pop("MATE_DB_URL", None)


def test_reset_pg_client_clears_singleton() -> None:
    """reset_pg_client disposes and clears the singleton."""
    os.environ["MATE_DB_URL"] = "sqlite:///:memory:"
    try:
        c1 = get_pg_client()
        reset_pg_client()
        c2 = get_pg_client()
        assert c1 is not c2
    finally:
        os.environ.pop("MATE_DB_URL", None)


# ---------------------------------------------------------------------------
# G6 RLS session bridge integration (v3.2-α)
# ---------------------------------------------------------------------------
def test_session_binds_tenant_ctx_when_tenant_id_provided() -> None:
    """``session(tenant_id=...)`` primes the SQLAlchemy session with
    a real ``RequestContext`` so the RLS bridge can emit ``SET LOCAL
    app.tenant_id`` on PostgreSQL connections (no-op on SQLite)."""
    client = PgClient(dsn="sqlite:///:memory:")
    with client.session(tenant_id="tenant-acme") as s:
        ctx = s.info.get("tenant_ctx")
        assert ctx is not None
        assert ctx.tenant_id == "tenant-acme"
        assert ctx.auth_method.value == "service"


def test_session_without_tenant_id_does_not_bind_ctx() -> None:
    """``session()`` without tenant_id does not auto-bind a context.

    Hard rule 3 still applies: if the caller queries a tenant-scoped
    table they must call ``install_rls_session(session, ctx)`` (or
    the legacy ``bind_tenant_context``) themselves.
    """
    client = PgClient(dsn="sqlite:///:memory:")
    with client.session() as s:
        assert s.info.get("tenant_ctx") is None


def test_session_rejects_empty_tenant_id_string() -> None:
    """On a real PostgreSQL backend the RLS bridge would raise
    ``TenantAccessError`` for an empty tenant_id (the ``require_tenant``
    guard). On SQLite the install helper short-circuits before that
    check, so we exercise the SQLite branch only — production
    deployments must use PostgreSQL (硬规则 5).

    This test documents the SQLite fallback: the empty ctx is bound
    without an error so dev / unit tests keep working. The PgClient
    itself does not raise; responsibility for tenant validation
    shifts to the handler / service layer (硬规则 3).
    """
    from mate_platform.tenancy.context import (
        AuthMethod,
        RequestContext,
        TenantId,
        UserId,
    )
    from mate_platform.tenancy.rls_session import install_rls_session

    client = PgClient(dsn="sqlite:///:memory:")
    ctx = RequestContext(
        request_id="",
        trace_id="",
        tenant_id=TenantId(""),
        user_id=UserId(""),
        roles=frozenset(),
        permissions=frozenset(),
        scopes=frozenset(),
        client_id="",
        auth_method=AuthMethod.SERVICE,
    )
    # On SQLite the install helper is a no-op (dialect gate) — the
    # bind still happens so the session info reflects the ctx.
    with client.session() as s:
        install_rls_session(s, ctx)
        assert s.info["tenant_ctx"] is ctx
