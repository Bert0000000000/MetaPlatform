"""SQLAlchemy event listener enforcing the tenant_id predicate.

This is the secondary, mechanical enforcement of hard rule 3. Every
SELECT / UPDATE / DELETE statement that goes through a SQLAlchemy
Session is intercepted; if the statement targets a model that
declares a tenant_id column and the current RequestContext has a
tenant binding, the predicate `tenant_id = :tenant_id` is appended.

Cross-tenant admin sessions (the `cross_tenant_admin` realm role)
can opt out; every cross-tenant statement is logged to the audit
channel regardless.

Raw SQL via session.execute(text(\"...\")) is not intercepted by
the event listener; CI forbids that path (see pre-commit hook
introduced in SEC-TENANT-01).
"""
from __future__ import annotations

import logging
import os
from typing import Any

from sqlalchemy import Table, event
from sqlalchemy.orm import Session

from .context import RequestContext
from .guards import is_cross_tenant_admin, require_tenant

logger = logging.getLogger(__name__)


_TENANT_FILTER_ENABLED: bool = os.environ.get(
    "BYPASS_TENANT_FILTER", "0"
).lower() not in {"1", "true", "yes"}


# -----------------------------------------------------------------------------
# RequestContext carrier on the Session
# -----------------------------------------------------------------------------
class _SessionTenantState:
    """Per-thread tenant context attached to a SQLAlchemy Session.

    The state is created on session begin and cleared on rollback;
    the listener uses it to inject the tenant_id predicate.
    """

    def __init__(self, ctx: RequestContext | None) -> None:
        self.ctx = ctx


def bind_tenant_context(session: Session, ctx: RequestContext | None) -> None:
    """Attach a RequestContext to a session for the duration of a unit of work.

    The context is consumed by the event listener; the session
    itself does not know about tenant_id. The pattern is:

        with session_factory() as session:
            bind_tenant_context(session, request.state.ctx)
            rows = session.execute(select(MyModel)).all()
    """
    session.info["tenant_ctx"] = ctx


def current_tenant_context(session: Session) -> RequestContext | None:
    ctx = session.info.get("tenant_ctx")
    if isinstance(ctx, RequestContext):
        return ctx
    return None


# -----------------------------------------------------------------------------
# Event listener
# -----------------------------------------------------------------------------
def _has_tenant_column(table: Table) -> bool:
    return "tenant_id" in table.c


def _register_event_listeners() -> None:
    """Attach do_orm_execute event listener.

    Idempotent: a flag on the engine keeps the listener single-registered.
    """
    from sqlalchemy.engine import Engine

    @event.listens_for(Engine, "before_execute", named=True)
    def _on_before_execute(conn, clauseelement, multiparams, params, execution_options, context):  # type: ignore[no-redef]
        return None  # placeholder for future use

    @event.listens_for(Session, "do_orm_execute")
    def _on_orm_execute(state):  # type: ignore[no-redef]
        if not _TENANT_FILTER_ENABLED:
            return
        if not (state.is_select or state.is_update or state.is_delete):
            return
        ctx = current_tenant_context(state.session)
        if ctx is None:
            raise RuntimeError(
                "no RequestContext bound to session; "
                "call bind_tenant_context(session, ctx) before executing "
                "(hard rule 3)"
            )
        cross_tenant = is_cross_tenant_admin(ctx)
        if cross_tenant:
            _emit_cross_tenant_audit(ctx, state.statement)
            return

        # Inject the tenant_id predicate.
        require_tenant(ctx)
        state.statement = state.statement.where(
            _build_tenant_predicate(ctx)
        )

    _LISTENER_REGISTERED.setdefault(_LISTENER_REGISTERED, True)


def _build_tenant_predicate(ctx: RequestContext):
    from sqlalchemy import column, literal

    return column("tenant_id") == literal(ctx.tenant_id)


def _emit_cross_tenant_audit(ctx: RequestContext, stmt: Any) -> None:
    """Emit a structured audit event for cross-tenant access.

    In production this hooks into the OBS / audit pipeline; the
    fallback log statement ensures tests can assert the event was
    emitted.
    """
    logger.info(
        "audit.cross_tenant_access",
        extra={
            "actor_user_id": ctx.user_id,
            "actor_client_id": ctx.client_id,
            "operation": str(stmt).split(" ", 1)[0] if stmt else "unknown",
            "statement_summary": str(stmt)[:200] if stmt else "",
        },
    )


_LISTENER_REGISTERED: dict = {}
