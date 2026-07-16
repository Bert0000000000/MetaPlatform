"""Tenant and trace context resolution from request headers.

Phase 2 (S-LLMGW-06) adds real JWT (HS256) verification via ``TECH-IAM``.
The contract is:

- Non-whitelisted endpoints require a valid ``Authorization: Bearer <jwt>``.
- ``X-Tenant-Id`` header is accepted as a fallback; JWT ``tenantId`` claim
  takes priority.
- ``X-Trace-Id`` is propagated; otherwise a fresh UUID v4 is generated.
- ``resolve_context`` is kept as a lower-level helper (no JWT enforcement)
  so existing unit tests that call it directly remain green.
"""

from __future__ import annotations

import base64
import json
import uuid
from dataclasses import dataclass
from typing import Optional

from fastapi import Header, Request

from app.common.errors import UnauthorizedError
from app.common.jwt_auth import (
    JWT_WHITELIST,
    extract_bearer_token,
    verify_token,
)


PUBLIC_TENANT_ID = "_public"
"""Marker tenant id for system-wide shared models."""


@dataclass(frozen=True)
class RequestContext:
    tenant_id: str
    trace_id: str
    user_id: Optional[str] = None
    username: Optional[str] = None


def _extract_tenant_from_bearer(auth_header: Optional[str]) -> Optional[str]:
    """Legacy helper: decode JWT payload as plain JSON (no signature check).

    Kept for backward compatibility with ``resolve_context`` which is still
    used by direct unit tests.
    """

    if not auth_header:
        return None
    parts = auth_header.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    token = parts[1].strip()
    # Try JWT-style payload decode: header.payload.signature
    chunks = token.split(".")
    if len(chunks) >= 2:
        try:
            padded = chunks[1] + "=" * (-len(chunks[1]) % 4)
            payload_bytes = base64.urlsafe_b64decode(padded.encode("ascii"))
            payload = json.loads(payload_bytes.decode("utf-8"))
            tenant = payload.get("tenantId") or payload.get("tenant_id")
            if isinstance(tenant, str) and tenant:
                return tenant
        except Exception:
            return None
    return None


def resolve_context(
    x_tenant_id: Optional[str],
    authorization: Optional[str],
    x_trace_id: Optional[str],
) -> RequestContext:
    """Resolve tenant/trace from headers **without** JWT enforcement.

    ``x_tenant_id`` wins over the (unverified) JWT payload.  This function is
    kept for backward compatibility with direct unit tests and does **not**
    enforce JWT validity.
    """

    trace_id = x_trace_id or str(uuid.uuid4())
    tenant_id = x_tenant_id or _extract_tenant_from_bearer(authorization)
    if not tenant_id:
        tenant_id = "tenant-default"
    return RequestContext(tenant_id=tenant_id, trace_id=trace_id)


# FastAPI dependency alias used by routers.
async def request_context_dep(
    request: Request,
    x_tenant_id: Optional[str] = Header(default=None, alias="X-Tenant-Id"),
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
    x_trace_id: Optional[str] = Header(default=None, alias="X-Trace-Id"),
) -> RequestContext:
    """Resolve the request context with JWT enforcement.

    - Whitelisted paths (see ``JWT_WHITELIST``) skip JWT enforcement.
    - All other paths require a valid HS256 JWT.
    - Tenant priority: JWT ``tenantId`` > ``X-Tenant-Id`` > ``tenant-default``.
    """

    trace_id = x_trace_id or str(uuid.uuid4())
    path = request.url.path
    is_whitelisted = path in JWT_WHITELIST

    jwt_claims: Optional[dict] = None

    if is_whitelisted:
        # Whitelisted: best-effort JWT parse, never enforce.
        token = extract_bearer_token(authorization)
        if token:
            try:
                jwt_claims = verify_token(token)
            except UnauthorizedError:
                pass
    else:
        # Non-whitelisted: JWT is mandatory.
        token = extract_bearer_token(authorization)
        if not token:
            raise UnauthorizedError("缺少认证令牌")
        jwt_claims = verify_token(token)

    # Tenant priority: JWT claim > header > default.
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
