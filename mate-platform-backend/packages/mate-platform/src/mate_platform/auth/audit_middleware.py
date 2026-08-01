"""DATA-D0-D8 D5 — cross-tenant data access audit middleware.

Integrates the existing ``mate_platform.auth.audit`` surface with
the FastAPI request lifecycle so that any request entering the
cross-tenant admin channel emits a structured audit event — without
requiring each handler to call ``emit_cross_tenant_data_access``
manually.

Design:
  - Read-only: a pure observer middleware; never mutates the
    request or short-circuits responses.
  - Opt-in: attached only to routes that allow cross-tenant access
    (``is_cross_tenant_admin(ctx)``). Standard tenant-scoped routes
    bypass it.
  - Sink pluggable: defaults to ``StdoutAuditSink``; tests inject
    ``InMemoryAuditSink``. Production wires a Kafka-backed sink
    (outbox event ``audit.cross_tenant_data_access``) via the
    platform's outbox relay.
  - Dataset inference: the middleware cannot know which dataset
    a handler touched; it records ``dataset="*"`` as a placeholder
    and relies on the handler to emit a finer-grained event if
    needed. The audit log row is still valuable for "who crossed
    tenant boundary when" forensics.

Per ADR-0016 §3.3 D5.
"""
from __future__ import annotations

from typing import Any, Awaitable, Callable

from fastapi import FastAPI, Request, Response

from ..auth.audit import (
    CrossTenantAuditSink,
    CrossTenantDataAccess,
    InMemoryAuditSink,
    emit_cross_tenant_data_access,
)
from ..tenancy.context import RequestContext
from ..tenancy.guards import is_cross_tenant_admin


def install_cross_tenant_audit_middleware(
    app: FastAPI,
    *,
    sink: CrossTenantAuditSink | None = None,
) -> None:
    """Install the D5 audit middleware on a FastAPI app.

    Called once per app during ``create_app``. The ``sink`` parameter
    is for tests; production leaves it ``None`` and the default
    ``StdoutAuditSink`` is used (the OTel collector captures the
    log line).
    """

    @app.middleware("http")
    async def audit_cross_tenant(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        # Resolve the caller's tenant identity from the request
        # context populated by the auth middleware. If the request
        # has no tenant context yet (unauth), defer to the auth
        # middleware's 401 response — nothing to audit.
        ctx: RequestContext | None = getattr(request.state, "ctx", None)
        if ctx is None:
            return await call_next(request)
        actor_tenant = getattr(ctx, "tenant_id", None)
        if not actor_tenant:
            return await call_next(request)

        # Determine whether this request is in cross-tenant admin
        # mode. We peek at the request context populated by the
        # auth middleware; if it's missing (early in the pipeline)
        # we just skip — auth middleware runs before us.
        if not is_cross_tenant_admin(ctx):
            return await call_next(request)

        # Extract the target tenant from the path (X-Tenant-Id header
        # or path parameter). When actor and target differ, the
        # access is cross-tenant and we emit the audit event.
        target_tenant = (
            request.headers.get("X-Tenant-Id") or actor_tenant
        )

        response = await call_next(request)

        if target_tenant != actor_tenant:
            emit_cross_tenant_data_access(
                actor_user_id=getattr(ctx, "user_id", "unknown"),
                actor_tenant_id=actor_tenant,
                target_tenant_id=target_tenant,
                operation=request.method,
                dataset=str(request.url.path),
                trace_id=getattr(ctx, "trace_id", ""),
                sink=sink,
            )

        return response


def make_test_sink() -> InMemoryAuditSink:
    """Build an ``InMemoryAuditSink`` for tests."""
    return InMemoryAuditSink()
