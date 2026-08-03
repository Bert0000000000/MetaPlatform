"""PostgreSQL Row-Level Security session-variable bridge (G6 增强).

This module is the *third* line of defence behind the SQLAlchemy event
listener (``db_filter.py``) and the ``require_tenant`` guard: it makes
sure the PostgreSQL session carries the current tenant_id so the
``tenant_isolation`` RLS policy (``mate-platform-backend/alembic/
versions/20260801_0008_tenant_rls.py``) has a non-empty value to
match.

Without this bridge, PostgreSQL's ``current_setting('app.tenant_id')``
returns the database-level default ``''`` and the RLS policy's
``tenant_id = ''`` predicate matches **nothing** (deny-by-default).
That is safe but unhelpful — every query returns 0 rows even when the
SQLAlchemy listener would have allowed them.

We solve that by attaching a ``connect`` event listener to each
SQLAlchemy engine the first time a session begins a unit of work with
a ``RequestContext``. The listener issues ``SET LOCAL app.tenant_id =
'<tenant>'`` and, for ``cross_tenant_admin``, also
``SET LOCAL app.bypass_tenant = 'true'`` so the policy short-circuits
(``USING (true)`` style behaviour is *not* enabled by this module — the
policy itself still allows the row; the bypass flag is recorded for
audit).

Cross-cutting concerns
----------------------

* **dev / SQLite** — SQLite has no concept of session GUCs. We gate on
  ``engine.dialect.name == "postgresql"`` so dev keeps working.
* **service identities** — They carry a real ``tenant_id`` (the service
  tenant) so the normal path applies. The bypass flag is reserved for
  the cross-tenant admin realm role only.
* **fail-closed** — If the engine cannot accept the ``SET LOCAL`` (e.g.
  the connection is broken) we raise immediately rather than silently
  proceeding with a deny-by-default session.
* **audit** — Every call into this module emits a structured log
  record so the audit pipeline can correlate request → session.

Usage
-----

Call ``attach_rls_listener(engine)`` once per engine; subsequent
sessions use ``bind_tenant_context(session, ctx)`` (the existing API
in ``db_filter.py``) and ``install_rls_session(session, ctx)`` from
this module right after.

The middleware path (production) wires the two together inside
``mate_platform.auth.middleware``'s ``AuthMiddleware.dispatch`` — that
work lives in the companion ``rls_session_middleware`` callable.
"""
from __future__ import annotations

import logging
from collections.abc import Callable

from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from .audit import emit_cross_tenant_access
from .context import RequestContext
from .guards import is_cross_tenant_admin, require_tenant

logger = logging.getLogger(__name__)

# PostgreSQL session GUC names. Keep these in sync with the policy
# emitted by Alembic 0008 (``tenant_isolation`` policy).
GUC_TENANT_ID = "app.tenant_id"
GUC_BYPASS = "app.bypass_tenant"

# Sentinel for "no engine listener attached yet". Maps engine id() to
# bool — idempotent registration is the caller's responsibility.
_LISTENER_ATTACHED: dict[int, bool] = {}


def _escape_pg_string(value: str) -> str:
    """Escape a tenant_id for embedding in a ``SET LOCAL`` statement.

    PostgreSQL string literals escape single-quotes by doubling them;
    ``SET LOCAL`` parses the value with the same rules as standard
    SQL string literals. We refuse anything that contains a
    NUL/control character to fail-fast on misbehaving callers.
    """
    if any(ord(c) < 0x20 for c in value):
        raise ValueError(
            f"tenant_id contains a control character: {value!r}"
        )
    return value.replace("'", "''")


def _build_set_local_statements(ctx: RequestContext) -> list[str]:
    """Return the SQL statements to attach the tenant context.

    Always emits ``SET LOCAL app.tenant_id``; cross-tenant admin
    sessions additionally flag ``app.bypass_tenant = 'true'`` so the
    audit pipeline can detect them. The bypass flag does not actually
    change the RLS policy — that is the responsibility of the policy
    itself and the request still goes through normal
    ``tenant_isolation`` matching.
    """
    tenant_id = require_tenant(ctx)
    stmts: list[str] = [
        f"SET LOCAL {GUC_TENANT_ID} = '{_escape_pg_string(tenant_id)}'"
    ]
    if is_cross_tenant_admin(ctx):
        stmts.append(f"SET LOCAL {GUC_BYPASS} = 'true'")
    return stmts


def attach_rls_listener(engine: Engine) -> None:
    """Mark an engine as RLS-aware.

    The companion ``install_rls_session`` helper is the actual
    workhorse — it issues the ``SET LOCAL`` GUCs on demand when a
    request opens a session. This function is a no-op marker so
    diagnostics / tests can tell which engines have been wired and
    so future ``connect``-event style wiring can plug in without
    changing call sites.

    Idempotent — calling twice on the same engine is a no-op.
    """
    eid = id(engine)
    if _LISTENER_ATTACHED.get(eid):
        return
    _LISTENER_ATTACHED[eid] = True


def install_rls_session(session: Session, ctx: RequestContext) -> None:
    """Bind ``ctx`` to the session and emit the corresponding ``SET LOCAL``
    GUCs on the underlying connection.

    This is the workhorse called by ``mate_platform.auth.middleware``
    for each authenticated request. It mirrors the existing
    ``bind_tenant_context(session, ctx)`` helper in ``db_filter.py``
    but, in addition, primes the PostgreSQL session so the RLS
    policy has a non-empty ``app.tenant_id`` to match against.

    No-op on non-PostgreSQL backends (the engine dialect gate is the
    caller's responsibility; this helper trusts the engine).
    """
    if ctx is None:
        raise ValueError("install_rls_session requires a RequestContext")

    bind_tenant_context(session, ctx)

    engine = session.get_bind()
    if engine.dialect.name != "postgresql":
        return  # SQLite / MySQL — nothing to set.

    cross_tenant = is_cross_tenant_admin(ctx)
    tenant_id = require_tenant(ctx)

    stmts = _build_set_local_statements(ctx)

    # We need a live connection to issue SET LOCAL. ``session.connection()``
    # returns the underlying Connection; it implicitly begins a
    # transaction if one is not yet open, satisfying PostgreSQL's
    # requirement.
    conn = session.connection()
    for stmt in stmts:
        conn.exec_driver_sql(stmt)

    if cross_tenant:
        emit_cross_tenant_access(
            actor_user_id=ctx.user_id,
            actor_client_id=ctx.client_id,
            operation="SET LOCAL app.bypass_tenant=true",
            target_tenants=[],
        )

    logger.info(
        "audit.rls_session_attached",
        extra={
            "actor_user_id": ctx.user_id,
            "actor_client_id": ctx.client_id,
            "tenant_id": tenant_id,
            "bypass": cross_tenant,
        },
    )


def bind_tenant_context(session: Session, ctx: RequestContext | None) -> None:
    """Convenience re-export so callers can install RLS + listener in
    one call without depending on ``db_filter`` directly.

    Identical to ``mate_platform.tenancy.db_filter.bind_tenant_context``
    — kept here so ``install_rls_session`` is self-contained.
    """
    session.info["tenant_ctx"] = ctx


def is_attached(engine: Engine) -> bool:
    """Return ``True`` if the engine has had its RLS listener installed.

    Intended for diagnostics and tests.
    """
    return _LISTENER_ATTACHED.get(id(engine), False)


# ---------------------------------------------------------------------------
# Helper for AuthMiddleware
# ---------------------------------------------------------------------------
def rls_session_middleware(
    session_factory: Callable[[], Session],
) -> Callable[[RequestContext], Session]:
    """Return a closure that opens a session bound to the given context.

    Production wiring looks like::

        factory = rls_session_middleware(lambda: Session(engine))
        ctx = request.state.ctx
        with factory(ctx) as session:
            rows = session.execute(...).all()

    The middleware emits the ``SET LOCAL`` GUCs as soon as the
    session begins, ensuring the RLS policy has a non-empty
    ``app.tenant_id`` value before any data-bearing statement runs.
    """
    def _open(ctx: RequestContext) -> Session:  # type: ignore[no-redef]
        session = session_factory()
        install_rls_session(session, ctx)
        return session

    return _open


__all__ = [
    "GUC_BYPASS",
    "GUC_TENANT_ID",
    "attach_rls_listener",
    "bind_tenant_context",
    "install_rls_session",
    "is_attached",
    "rls_session_middleware",
]
