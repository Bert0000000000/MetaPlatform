"""Outgoing httpx middleware that auto-injects Authorization + X-Tenant-Id."""

from __future__ import annotations

from collections.abc import Generator

import httpx

from .bearer import BearerAuth


class ForwardedUserAuth(httpx.Auth):
    """Forward an already verified user token with its authenticated tenant."""

    def __init__(self, authorization: str, *, tenant_id: str) -> None:
        scheme, _, token = authorization.strip().partition(" ")
        if scheme.lower() != "bearer" or not token.strip() or not tenant_id:
            raise ValueError("A verified user bearer token and tenant are required")
        self._authorization = "Bearer " + token.strip()
        self._tenant_id = tenant_id

    def auth_flow(self, request: httpx.Request) -> Generator[httpx.Request, httpx.Response, None]:
        request.headers["Authorization"] = self._authorization
        request.headers["X-Tenant-Id"] = self._tenant_id
        yield request


def user_async_client(
    authorization: str, *, tenant_id: str, timeout: httpx.Timeout | float, base_url: str = ""
) -> httpx.AsyncClient:
    """Construct the ACL transport for user-delegated internal service calls."""
    return httpx.AsyncClient(
        auth=ForwardedUserAuth(authorization, tenant_id=tenant_id),
        timeout=timeout,
        base_url=base_url,
    )


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
