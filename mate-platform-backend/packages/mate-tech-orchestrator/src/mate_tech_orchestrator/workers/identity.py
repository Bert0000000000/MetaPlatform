"""Worker service identity (client_credentials).

In production the orchestrator must present a service identity when
calling the MCP / A2A centers (both enforce ``install_auth``). The
identity is minted from the Keycloak client-credentials env vars and
reused across calls (cached + auto-renewed by ``ServiceIdentity``).

In dev / test profile, when no ``SERVICE_CLIENT_SECRET`` is configured,
the worker falls back to unauthenticated calls (the centers run with
``INSECURE_SKIP_SIGNATURE`` / mocked auth in tests).
"""
from __future__ import annotations

import os
from typing import Any

try:  # mate_platform is a workspace dep of the orchestrator
    from mate_platform.auth.identity import ServiceIdentity
except ImportError:  # pragma: no cover - defensive
    ServiceIdentity = None


def build_service_identity() -> Any:
    """Build a ServiceIdentity from env, or None when creds are absent."""
    if ServiceIdentity is None:
        return None
    client_id = os.getenv("SERVICE_CLIENT_ID", "")
    client_secret = os.getenv("SERVICE_CLIENT_SECRET", "")
    if not client_id or not client_secret:
        return None
    keycloak_url = os.getenv("KEYCLOAK_URL", "http://keycloak:8080").rstrip("/")
    realm = os.getenv("KEYCLOAK_REALM", "metaplatform")
    return ServiceIdentity(
        token_uri=f"{keycloak_url}/realms/{realm}/protocol/openid-connect/token",
        client_id=client_id,
        client_secret=client_secret,
        scope="platform.read platform.write",
    )
