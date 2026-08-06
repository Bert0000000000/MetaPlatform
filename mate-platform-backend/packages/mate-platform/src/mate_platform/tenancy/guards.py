"""Tenant access guards.

These are the primary defense for production-readiness 13 hard rule 3:
\"no tenant context, no repository access\". Every repository / service
implementation calls require_tenant() as its first line; the DB filter
event listener in db_filter.py is the secondary defense that catches
raw SQL paths.
"""
from __future__ import annotations

from collections.abc import Iterable

from .context import AuthMethod, RequestContext, TenantId


class TenantAccessError(Exception):
    """Raised when a tenant-scoped operation is attempted without a
    valid tenant binding."""


def _record_cross_tenant_attempt(reason: str, *, tenant_id: str | None) -> None:
    """Increment the Prometheus counter for cross-tenant attempts (ADR-0018).

    The counter is intentionally fault-tolerant: if prometheus_client
    is not installed, or the metric is uninitialized, we silently
    skip the increment rather than raise into the user-visible path.
    """
    try:
        from prometheus_client import Counter

        from .metrics import cross_tenant_attempt

        counter: Counter | None = cross_tenant_attempt()
        if counter is None:
            return
        counter.labels(reason=reason, tenant_id=tenant_id or "anonymous").inc()
    except Exception:  # pragma: no cover - defensive
        return


def require_tenant(ctx: RequestContext) -> TenantId:
    """Return ctx.tenant_id or raise TenantAccessError.

    This is the canonical check referenced by hard rule 3. It refuses:
      - Anonymous callers.
      - Empty tenant_id (must be present even for service identities).
    """
    if ctx.auth_method == AuthMethod.ANONYMOUS:
        _record_cross_tenant_attempt("anonymous", tenant_id=None)
        raise TenantAccessError(
            "anonymous callers cannot access tenant-scoped data (hard rule 3)"
        )
    if not ctx.tenant_id:
        _record_cross_tenant_attempt("missing", tenant_id=None)
        raise TenantAccessError(
            "missing tenant context; refusing repository access (hard rule 3)"
        )
    return ctx.tenant_id


def require_any_tenant(ctxs: Iterable[RequestContext]) -> TenantId:
    """For bulk operations across multiple contexts.

    Used by admin endpoints that fan out work to many tenants in one
    request: all contexts must agree on the same tenant_id, otherwise
    the operation is rejected (forces the caller to split into
    multiple requests).
    """
    tenants = {ctx.tenant_id for ctx in ctxs if ctx.tenant_id}
    if not tenants:
        _record_cross_tenant_attempt("no_tenant_any_ctx", tenant_id=None)
        raise TenantAccessError("no tenant binding in any context")
    if len(tenants) > 1:
        _record_cross_tenant_attempt(
            "multi_tenant_fanout",
            tenant_id=",".join(sorted(tenants)),
        )
        raise TenantAccessError(
            f"multiple tenants in one request: {sorted(tenants)}; split the request"
        )
    return next(iter(tenants))


def is_cross_tenant_admin(ctx: RequestContext) -> bool:
    """Whether the caller's session is in cross-tenant admin mode.

    Cross-tenant mode is signalled by the `cross_tenant_admin` realm
    role. The DB filter event listener reads this to decide whether
    to inject the tenant_id predicate (or skip it, while still
    emitting the audit event).
    """
    return "cross_tenant_admin" in ctx.roles


def assert_same_tenant(claimed: TenantId, ctx: RequestContext) -> None:
    """For path parameters that carry a tenant_id.

    Path params like /tenants/{tenant_id}/... must equal the request
    tenant. The user can only operate on their own tenant; admin
    paths use a separate URL prefix and a different role.
    """
    if claimed != ctx.tenant_id and not is_cross_tenant_admin(ctx):
        raise TenantAccessError(
            f"path tenant {claimed!r} does not match request tenant {ctx.tenant_id!r}"
        )
