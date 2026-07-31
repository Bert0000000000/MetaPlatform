"""Outgoing httpx middleware that auto-injects Authorization + X-Tenant-Id."""
from __future__ import annotations

import httpx

from .bearer import BearerAuth


class OutgoingAuthMiddleware:
    """httpx Auth implementation that injects Bearer + X-Tenant-Id.

    Usage:
        auth = BearerAuth(token_uri=..., client_id=..., client_secret=...)
        with httpx.Client(auth=OutgoingAuthMiddleware(auth, tenant_id="t1")) as c:
            r = c.get("https://internal/api/v1/...")
    """

    def __init__(self, auth: BearerAuth, *, tenant_id: str) -> None:
        self._auth = auth
        self._tenant_id = tenant_id

    def __call__(self, request: httpx.Request) -> httpx.Request:
        request.headers["Authorization"] = f"Bearer {self._auth.token()}"
        if self._tenant_id:
            request.headers["X-Tenant-Id"] = self._tenant_id
        return request
