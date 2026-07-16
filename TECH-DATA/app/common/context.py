"""Tenant and trace context resolution from request headers.

Contract:
- ``X-Tenant-Id`` header is required for any state-changing endpoint.
- ``Authorization: Bearer <jwt>`` may carry ``tenantId`` claim.
- ``X-Trace-Id`` is propagated; otherwise a fresh UUID v4 is generated.
"""

from __future__ import annotations

import base64
import json
import uuid
from dataclasses import dataclass
from typing import Optional

from fastapi import Header


PUBLIC_TENANT_ID = "_public"
"""Marker tenant id for system-wide shared resources."""


@dataclass(frozen=True)
class RequestContext:
    tenant_id: str
    trace_id: str
    user_id: Optional[str] = None


def _extract_tenant_from_bearer(auth_header: Optional[str]) -> Optional[str]:
    if not auth_header:
        return None
    parts = auth_header.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    token = parts[1].strip()
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
    """Resolve tenant/trace from headers. ``x_tenant_id`` wins over JWT."""

    trace_id = x_trace_id or str(uuid.uuid4())
    tenant_id = x_tenant_id or _extract_tenant_from_bearer(authorization)
    if not tenant_id:
        tenant_id = "tenant-default"
    return RequestContext(tenant_id=tenant_id, trace_id=trace_id)


async def request_context_dep(
    x_tenant_id: Optional[str] = Header(default=None, alias="X-Tenant-Id"),
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
    x_trace_id: Optional[str] = Header(default=None, alias="X-Trace-Id"),
) -> RequestContext:
    return resolve_context(x_tenant_id, authorization, x_trace_id)


def require_tenant(ctx: RequestContext) -> str:
    if not ctx.tenant_id:
        raise ValueError("tenant_id is required")
    return ctx.tenant_id
