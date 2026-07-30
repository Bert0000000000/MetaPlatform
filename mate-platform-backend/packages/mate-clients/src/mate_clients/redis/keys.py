"""Redis key namespacing by tenant id.

All Redis access in the platform goes through the helpers here so the
`t:<tenant-id>:` prefix is always applied. ACL rules on the Redis
server side (configured per-environment) reject any key written
without the prefix; combined with the client-side helper this gives
two layers of defense.

Cross-tenant operations (admin scope) use a different key namespace
`x:<admin-actor>:` to make cross-tenant reads easy to audit.
"""
from __future__ import annotations

import re

from mate_platform.tenancy.context import RequestContext
from mate_platform.tenancy.guards import is_cross_tenant_admin, require_tenant

_TENANT_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_-]{0,62}$")


class RedisKeyError(Exception):
    """Raised when a Redis key cannot be safely namespaced."""


def _validate_tenant_id(tenant_id: str) -> str:
    if not _TENANT_ID_PATTERN.match(tenant_id):
        raise RedisKeyError(
            f"invalid tenant id {tenant_id!r}; must match {_TENANT_ID_PATTERN.pattern}"
        )
    return tenant_id


def tenant_prefix(ctx: RequestContext) -> str:
    """Return the per-tenant key prefix for the given context.

    The prefix is `t:<tenant-id>:`. For cross-tenant admin sessions
    the prefix is `x:<client-id>:` (audit traceability) so that
    cross-tenant operations are easy to spot in Redis monitoring.
    """
    tenant_id = require_tenant(ctx)
    _validate_tenant_id(tenant_id)
    if is_cross_tenant_admin(ctx):
        actor = ctx.client_id or ctx.user_id or "anon"
        return f"x:{actor}:"
    return f"t:{tenant_id}:"


def k(ctx: RequestContext, *parts: str) -> str:
    """Build a fully-namespaced Redis key.

    Example:
        k(ctx, "rate_limit", user_id) -> "t:t1:rate_limit:user-1"

    Empty parts are skipped. None parts are converted to "" and
    also skipped. The result is a single colon-separated string.
    """
    prefix = tenant_prefix(ctx)
    body = ":".join(p for p in parts if p)
    return f"{prefix}{body}" if body else prefix.rstrip(":")


def pattern_for(ctx: RequestContext, suffix_pattern: str) -> str:
    """Build a SCAN / KEYS pattern scoped to a tenant.

    Example:
        pattern_for(ctx, "rate_limit:*") -> "t:t1:rate_limit:*"
    """
    prefix = tenant_prefix(ctx)
    return f"{prefix}{suffix_pattern}"
