"""Worker service identity (client_credentials).

In production the orchestrator must present a service identity when
calling the MCP / A2A centers (both enforce ``install_auth``). The
identity is minted from the Keycloak client-credentials env vars and
reused across calls (cached + auto-renewed by ``ServiceIdentity``).

In dev / test profile (``INSECURE_SKIP_SIGNATURE=true``), when no
``SERVICE_CLIENT_SECRET`` is configured, the worker falls back to a
locally-minted HS256 token (``LegacyServiceIdentity``) accepted by
peers that skip signature verification — same contract as
mate-tech-iam ``_make_token``. This keeps the orchestrator → center
leg authenticated end-to-end in the dev environment.
"""
from __future__ import annotations

import os
import threading
import time
from typing import Any

import jwt

try:  # mate_platform is a workspace dep of the orchestrator
    from mate_platform.auth.identity import ServiceIdentity
except ImportError:  # pragma: no cover - defensive
    ServiceIdentity = None

_IAM_SECRET = os.getenv("IAM_DEV_JWT_SECRET", "mate-dev-secret-do-not-use-in-prod")
_IAM_ALG = os.getenv("IAM_DEV_JWT_ALG", "HS256")
_TOKEN_TTL_SEC = int(os.getenv("IAM_ACCESS_TOKEN_TTL", "3600"))


class LegacyServiceIdentity:
    """Dev-profile service identity: mints a local HS256 token on demand.

    Exposes the same ``.token()`` surface as ``ServiceIdentity`` so the
    ACL ``OutgoingAuthMiddleware`` can inject it unchanged. Only usable
    when peers run with ``INSECURE_SKIP_SIGNATURE=true``.
    """

    def __init__(self, *, tenant_id: str = "tenant-default") -> None:
        self._tenant_id = tenant_id
        self._lock = threading.Lock()
        self._token: str | None = None
        self._expires_at = 0

    def token(self) -> str:
        now = int(time.time())
        with self._lock:
            if self._token is not None and self._expires_at > now + 60:
                return self._token
            payload = {
                "iss": os.getenv("KEYCLOAK_URL", "http://keycloak:8080").rstrip("/")
                + "/realms/"
                + os.getenv("KEYCLOAK_REALM", "metaplatform"),
                "aud": os.getenv("KEYCLOAK_AUDIENCE", "metaplatform-backend"),
                "azp": os.getenv("SERVICE_CLIENT_ID", "metaplatform-backend"),
                "realm_access": {"roles": ["platform-read"]},
                "scope": "platform.read platform.write",
                "attributes": {"tenant_id": [self._tenant_id]},
                "sub": "mate-tech-orchestrator",
                "preferred_username": "mate-tech-orchestrator",
                "tenant_id": self._tenant_id,
                "iat": now,
                "exp": now + _TOKEN_TTL_SEC,
                "jti": f"orch-{now}",
                "token_kind": "access",
            }
            self._token = jwt.encode(payload, _IAM_SECRET, algorithm=_IAM_ALG)
            self._expires_at = now + _TOKEN_TTL_SEC
            return self._token


def build_service_identity() -> Any:
    """Build a service identity: Keycloak client_credentials or legacy dev token."""
    client_id = os.getenv("SERVICE_CLIENT_ID", "")
    client_secret = os.getenv("SERVICE_CLIENT_SECRET", "")
    keycloak_url = os.getenv("KEYCLOAK_URL", "http://keycloak:8080").rstrip("/")
    realm = os.getenv("KEYCLOAK_REALM", "metaplatform")
    if ServiceIdentity is not None and client_id and client_secret:
        return ServiceIdentity(
            token_uri=f"{keycloak_url}/realms/{realm}/protocol/openid-connect/token",
            client_id=client_id,
            client_secret=client_secret,
            scope="platform.read platform.write",
        )
    return LegacyServiceIdentity()

