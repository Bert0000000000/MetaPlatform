"""MinIO / S3 bucket namespacing by tenant id.

Each tenant gets its own bucket `metaplatform-<tenant-id>`. The
client here never lets a caller touch another tenant's bucket: the
`bucket_for(ctx)` helper raises on tenant mismatch. In production,
the IAM policy attached to the per-tenant STS role enforces the
same constraint server-side, so even a misbehaving client cannot
cross the boundary.
"""
from __future__ import annotations

import re

from mate_platform.tenancy.context import RequestContext
from mate_platform.tenancy.guards import is_cross_tenant_admin, require_tenant


_TENANT_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_-]{0,62}$")
_BUCKET_PREFIX = "metaplatform-"


class MinioBucketError(Exception):
    """Raised when a MinIO operation would cross tenant boundaries."""


def _validate_tenant_id(tenant_id: str) -> str:
    if not _TENANT_ID_PATTERN.match(tenant_id):
        raise MinioBucketError(
            f"invalid tenant id {tenant_id!r}; must match {_TENANT_ID_PATTERN.pattern}"
        )
    return tenant_id


def bucket_for(ctx: RequestContext, *, claimed_tenant: str | None = None) -> str:
    """Return the bucket name for the given context.

    If `claimed_tenant` is provided (e.g. a path parameter), the
    context tenant must match it, unless the caller has the
    `cross_tenant_admin` realm role.
    """
    actual = require_tenant(ctx)
    _validate_tenant_id(actual)
    if claimed_tenant is not None and claimed_tenant != actual and not is_cross_tenant_admin(ctx):
        raise MinioBucketError(
            f"claimed tenant {claimed_tenant!r} does not match request tenant {actual!r}"
        )
    return f"{_BUCKET_PREFIX}{actual}"


def object_key(ctx: RequestContext, *parts: str) -> str:
    """Build an object key scoped to the tenant's bucket.

    Example:
        object_key(ctx, "uploads", "2026", "07", "doc.pdf")
        -> "uploads/2026/07/doc.pdf"
    """
    body = "/".join(p for p in parts if p)
    return body or "_"