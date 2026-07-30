"""Service identity (client_credentials) for service-to-service auth."""
from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from typing import Any

import httpx


class IdentityError(Exception):
    """Raised when a service identity token cannot be obtained."""


@dataclass(frozen=True, slots=True)
class ServiceToken:
    access_token: str
    expires_at: float
    scope: str


class ServiceIdentity:
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
            raise IdentityError(
                "ServiceIdentity requires non-empty client_id and client_secret"
            )
        self._token_uri = token_uri
        self._client_id = client_id
        self._client_secret = client_secret
        self._scope = scope
        self._timeout = timeout_seconds
        self._lock = threading.Lock()
        self._token: ServiceToken | None = None

    def token(self) -> str:
        with self._lock:
            now = time.time()
            if self._token is None or self._token.expires_at - self.RENEW_LEEWAY_SECONDS <= now:
                self._token = self._fetch(now)
            return self._token.access_token

    def invalidate(self) -> None:
        with self._lock:
            self._token = None

    def _fetch(self, now: float) -> ServiceToken:
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
            raise IdentityError(f"identity request failed: {exc}") from exc
        if resp.status_code != 200:
            raise IdentityError(
                f"identity endpoint returned {resp.status_code}: {resp.text[:200]}"
            )
        try:
            payload: dict[str, Any] = resp.json()
        except ValueError as exc:
            raise IdentityError(f"identity response not JSON: {exc}") from exc
        access = payload.get("access_token")
        expires_in = payload.get("expires_in")
        if not isinstance(access, str) or not isinstance(expires_in, (int, float)):
            raise IdentityError("identity response missing access_token / expires_in")
        return ServiceToken(
            access_token=access,
            expires_at=now + float(expires_in),
            scope=str(payload.get("scope") or self._scope),
        )