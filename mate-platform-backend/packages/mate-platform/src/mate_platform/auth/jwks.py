"""JWKS client with thread-safe cache and rotation support.

The cache is keyed by `kid` and is updated:
  - On first use (cold start).
  - On every successful verification that finds no matching kid.
  - In the background every `jwks_refresh_seconds`.

Algorithm whitelist is RS256 / RS384 / RS512. HS* is rejected to prevent
alg-confusion attacks (CVE-2015-9235 family).
"""
from __future__ import annotations

import threading
import time
from typing import Any

import httpx

ALLOWED_ALGS: frozenset[str] = frozenset({"RS256", "RS384", "RS512"})


class JWKSError(Exception):
    """Raised when JWKS cannot be fetched or contains no usable keys."""


class JWKSCache:
    """Thread-safe JWKS cache."""

    def __init__(self, jwks_uri: str, *, timeout_seconds: int = 5) -> None:
        self._uri = jwks_uri
        self._timeout = timeout_seconds
        self._lock = threading.RLock()
        self._by_kid: dict[str, dict[str, Any]] = {}
        self._last_fetch_ts: float = 0.0

    @property
    def last_fetch_ts(self) -> float:
        with self._lock:
            return self._last_fetch_ts

    def get(self, kid: str) -> dict[str, Any] | None:
        with self._lock:
            return self._by_kid.get(kid)

    def all_keys(self) -> list[dict[str, Any]]:
        with self._lock:
            return list(self._by_kid.values())

    def refresh(self, *, force: bool = False) -> int:
        with self._lock:
            try:
                with httpx.Client(timeout=self._timeout) as client:
                    resp = client.get(
                        self._uri,
                        headers={"X-Robots-Tag": "noindex"},
                    )
                if resp.status_code != 200:
                    raise JWKSError(
                        f"JWKS endpoint returned {resp.status_code}: {resp.text[:200]}"
                    )
                payload = resp.json()
            except httpx.HTTPError as exc:
                raise JWKSError(f"JWKS request failed: {exc}") from exc
            except ValueError as exc:
                raise JWKSError(f"JWKS response not JSON: {exc}") from exc

            keys = payload.get("keys") or []
            new_by_kid: dict[str, dict[str, Any]] = {}
            for key in keys:
                if not isinstance(key, dict):
                    continue
                alg = key.get("alg", "RS256")
                if alg not in ALLOWED_ALGS:
                    continue
                kid = key.get("kid")
                if not kid:
                    continue
                if not key.get("n") or not key.get("e"):
                    continue
                new_by_kid[kid] = key

            if not new_by_kid and not force:
                raise JWKSError("JWKS endpoint returned no usable keys")

            self._by_kid = new_by_kid
            self._last_fetch_ts = time.time()
            return len(new_by_kid)

    def get_or_refresh(self, kid: str) -> dict[str, Any] | None:
        key = self.get(kid)
        if key is not None:
            return key
        self.refresh()
        return self.get(kid)
