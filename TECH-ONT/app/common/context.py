"""Tenant and trace context resolution from request headers."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Optional

from fastapi import Header, Request


@dataclass(frozen=True)
class RequestContext:
    tenant_id: str
    trace_id: str
    user_id: Optional[str] = None


async def request_context_dep(
    request: Request,
    x_tenant_id: Optional[str] = Header(default=None, alias="X-Tenant-Id"),
    x_trace_id: Optional[str] = Header(default=None, alias="X-Trace-Id"),
) -> RequestContext:
    """Resolve request context from headers.

    This discovery service trusts upstream IAM/gateway for authentication.
    """

    trace_id = x_trace_id or str(uuid.uuid4())
    tenant_id = x_tenant_id or "tenant-default"
    return RequestContext(tenant_id=tenant_id, trace_id=trace_id)
