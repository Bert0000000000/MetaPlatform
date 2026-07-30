"""Outgoing BearerAuth client used by the mate-clients ACL layer.

A `BearerAuth` instance knows how to attach an `Authorization: Bearer
<token>` header (and the matching `X-Tenant-Id` header) to outgoing
HTTP calls. The token is fetched on demand and cached.

This is the *outbound* counterpart of `mate_platform.auth` (the
inbound verifier). They share the same Keycloak configuration
contract; the only difference is the OAuth2 grant (client_credentials
vs authorization_code).
"""
from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from typing import Any

import httpx


class BearerAuthError(Exception):
    """Raised when a bearer token cannot be obtained."""


@dataclass(frozen=True, slots=True)
class CachedToken:
    access_token: str
    expires_at: float


class BearerAuth:
    """Client for OAuth2 client_credentials.

    The instance is bound to a fixed (client_id, client_secret, scope)
    triple. Use one instance per service-to-service identity; share
    across threads safely via the internal lock.

    For the application''s own service identity, prefer
    `mate_platform.auth.ServiceIdentity`; this class is for the
    out-process client side, where the secret comes from environment
    variables injected by SealedSecret / ExternalSecret.
    """

    RENEW_LEEWAY_SECONDS = 60.0

    def __init__(
        self,
        *,
        token_uri: str,
        client_id: str,
        client_secret: str,
        scope: str = "platform.read",
        timeout_seconds: int = 5,
    ) -> None:
        if not client_id or not client_secret:
            raise BearerAuthError(
                "BearerAuth requires non-empty client_id and client_secret"
            )
        self._token_uri = token_uri
        self._client_id = client_id
        self._client_secret = client_secret
        self._scope = scope
        self._timeout = timeout_seconds
        self._lock = threading.Lock()
        self._cached: CachedToken | None = None

    def token(self) -> str:
        with self._lock:
            now = time.time()
            if self._cached is None or self._cached.expires_at - self.RENEW_LEEWAY_SECONDS <= now:
                self._cached = self._fetch(now)
            return self._cached.access_token

    def invalidate(self) -> None:
        with self._lock:
            self._cached = None

    def _fetch(self, now: float) -> CachedToken:
        try:
            with httpx.Client(timeout=self._timeout) as client:
                resp = client.post(
                    self._token_uri,
                    data={
                        "grant_type": "client_credentials",
                        "client_id": self._client_id,
                        "client_secret": self._client_secret,
                        "scope": self._scope,
                    },
                    headers={"Accept": "application/json"},
                )
        except httpx.HTTPError as exc:
            raise BearerAuthError(f"token request failed: {exc}") from exc
        if resp.status_code != 200:
            raise BearerAuthError(
                f"token endpoint returned {resp.status_code}: {resp.text[:200]}"
            )
        try:
            payload: dict[str, Any] = resp.json()
        except ValueError as exc:
            raise BearerAuthError(f"token response not JSON: {exc}") from exc
        access = payload.get("access_token")
        expires_in = payload.get("expires_in")
        if not isinstance(access, str) or not isinstance(expires_in, (int, float)):
            raise BearerAuthError("token response missing access_token / expires_in")
        return CachedToken(
            access_token=access,
            expires_at=now + float(expires_in),
        )