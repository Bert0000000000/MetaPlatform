"""Tenant and trace context resolution from request headers."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Optional

from fastapi import Header, Request

from app.common.errors import UnauthorizedError
from app.common.jwt_auth import (
    extract_bearer_token,
    is_whitelisted,
    verify_token,
)


@dataclass(frozen=True)
class RequestContext:
    tenant_id: str
    trace_id: str
    user_id: Optional[str] = None
    username: Optional[str] = None


async def request_context_dep(
    request: Request,
    x_tenant_id: Optional[str] = Header(default=None, alias="X-Tenant-Id"),
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
    x_trace_id: Optional[str] = Header(default=None, alias="X-Trace-Id"),
) -> RequestContext:
    """Resolve the request context with JWT enforcement.

    - Whitelisted paths (see ``is_whitelisted``) skip JWT enforcement.
    - All other paths require a valid HS256 JWT.
    - Tenant priority: JWT ``tenantId`` > ``X-Tenant-Id`` > ``tenant-default``.
    """

    trace_id = x_trace_id or str(uuid.uuid4())
    path = request.url.path
    whitelisted = is_whitelisted(path)

    jwt_claims: Optional[dict] = None

    if whitelisted:
        token = extract_bearer_token(authorization)
        if token:
            try:
                jwt_claims = verify_token(token)
            except UnauthorizedError:
                pass
    else:
        token = extract_bearer_token(authorization)
        if not token:
            raise UnauthorizedError("缺少认证令牌")
        jwt_claims = verify_token(token)

    tenant_id: Optional[str] = None
    user_id: Optional[str] = None
    username: Optional[str] = None

    if jwt_claims:
        tenant_id = jwt_claims.get("tenantId") or jwt_claims.get("tenant_id")
        user_id = jwt_claims.get("sub")
        username = jwt_claims.get("username")

    if not tenant_id:
        tenant_id = x_tenant_id
    if not tenant_id:
        tenant_id = "tenant-default"

    return RequestContext(
        tenant_id=tenant_id,
        trace_id=trace_id,
        user_id=user_id,
        username=username,
    )


def require_tenant(ctx: RequestContext) -> str:
    if not ctx.tenant_id:
        raise ValueError("tenant_id is required")
    return ctx.tenant_id
