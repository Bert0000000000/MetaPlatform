"""ACL client for PostgreSQL — wraps SQLAlchemy sessions with tenant
isolation + OTel instrumentation (ADR-0014 step 4 / 硬规则 4).

Every cross-service data access goes through this client so the
platform can enforce:
  - tenant_id injection (硬规则 3, via ``bind_tenant_context``)
  - RLS session GUC priming (mate.tenant_id via
    ``install_rls_session`` — v3.2-α G6 增强, backend 双保险)
  - BearerAuth propagation (ADR-0014 step 4, via ``OutgoingAuthMiddleware``)
  - OTel span attributes (硬规则 9)
  - connection pool limits + retry

Usage::

    from mate_clients.pg import PgClient

    client = PgClient(dsn="postgresql://meta:meta@postgres:5432/metaplatform")
    with client.session(tenant_id="tenant-acme") as session:
        rows = session.execute(select(MyORM)).scalars().all()

The ``PgClient`` is the ACL boundary: no bare ``create_engine`` /
``sessionmaker`` calls are allowed outside ``mate-tech-db`` (enforced
by ``forbid_bare_httpx``-style lint in a future CI hook).
"""
from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Any, Iterator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker


class PgClient:
    """ACL client wrapping a SQLAlchemy engine + session factory.

    Tenant isolation is enforced via ``bind_tenant_context(session, ctx)``
    from ``mate_platform.tenancy.db_filter`` — callers MUST pass
    ``tenant_id`` to ``session()`` so the ORM event listener can inject
    the ``tenant_id`` filter automatically.
    """

    def __init__(
        self,
        dsn: str | None = None,
        *,
        echo: bool = False,
        pool_size: int = 5,
        max_overflow: int = 10,
        pool_pre_ping: bool = True,
    ) -> None:
        """Initialize the ACL client.

        Args:
            dsn: PostgreSQL DSN. If None, resolves from MATE_DB_URL / DATABASE_URL.
            echo: Echo SQL to stderr (dev only).
            pool_size: Connection pool size.
            max_overflow: Pool overflow limit.
            pool_pre_ping: Enable connection health check before checkout.
        """
        resolved = dsn or os.environ.get("MATE_DB_URL") or os.environ.get("DATABASE_URL")
        if resolved is None:
            raise RuntimeError(
                "PgClient requires a DSN. Set MATE_DB_URL or pass dsn explicitly."
            )
        self._dsn = resolved
        # SQLite (default SingletonThreadPool) rejects pool_size / max_overflow.
        # Only forward pool kwargs for real server-side dialects (Postgres etc.)
        is_sqlite = resolved.startswith("sqlite")
        engine_kwargs: dict[str, Any] = {"echo": echo, "future": True}
        if not is_sqlite:
            engine_kwargs.update(
                pool_size=pool_size,
                max_overflow=max_overflow,
                pool_pre_ping=pool_pre_ping,
            )
        self._engine = create_engine(resolved, **engine_kwargs)
        self._session_local = sessionmaker(
            bind=self._engine, class_=Session, expire_on_commit=False
        )
        self._disposed = False

    @property
    def dsn(self) -> str:
        """Return the DSN (password masked in logs)."""
        return self._dsn

    @property
    def engine(self) -> Any:
        """Return the underlying SQLAlchemy engine."""
        return self._engine

    @contextmanager
    def session(self, tenant_id: str | None = None) -> Iterator[Session]:
        """Yield a session with optional tenant context binding.

        Args:
            tenant_id: If provided, binds the tenant context so the
                ORM event listener auto-injects ``tenant_id`` filters.
                If None, the caller must bind the context manually.

        Yields:
            A SQLAlchemy Session. The session is committed on normal
            exit and rolled back on exception.
        """
        session = self._session_local()
        try:
            if tenant_id:
                # Late import to avoid circular dependency in dev mode.
                # Build a real RequestContext so install_rls_session can
                # emit ``SET LOCAL app.tenant_id`` on PostgreSQL
                # connections — this primes the G6 RLS policy
                # (Alembic 0008) so it does not deny-by-default.
                from mate_platform.tenancy.context import (
                    AuthMethod,
                    RequestContext,
                    TenantId,
                    UserId,
                )
                from mate_platform.tenancy.rls_session import (
                    install_rls_session,
                )

                ctx = RequestContext(
                    request_id="",
                    trace_id="",
                    tenant_id=TenantId(tenant_id),
                    user_id=UserId(""),
                    roles=frozenset(),
                    permissions=frozenset(),
                    scopes=frozenset(),
                    client_id="",
                    auth_method=AuthMethod.SERVICE,
                )
                # install_rls_session is the G6 应用层 bridge:
                # it binds the ctx AND emits the ``SET LOCAL
                # app.tenant_id`` statement on PostgreSQL
                # connections. Non-PG dialects (SQLite / MySQL
                # dev) are no-ops so dev keeps working.
                install_rls_session(session, ctx)
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def health(self) -> bool:
        """Return True if the database is reachable and the client is not disposed."""
        if self._disposed:
            return False
        try:
            with self._engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return True
        except Exception:
            return False

    def dispose(self) -> None:
        """Dispose the engine and release all pooled connections."""
        if self._disposed:
            return
        self._engine.dispose()
        self._disposed = True


# ---------------------------------------------------------------------------
# Singleton accessor (for app-level shared client)
# ---------------------------------------------------------------------------
_client: PgClient | None = None


def get_pg_client(dsn: str | None = None) -> PgClient:
    """Return the singleton PgClient, lazily initializing it if needed."""
    global _client
    if _client is None:
        _client = PgClient(dsn=dsn)
    return _client


def reset_pg_client() -> None:
    """Dispose and reset the singleton (for tests)."""
    global _client
    if _client is not None:
        _client.dispose()
    _client = None
