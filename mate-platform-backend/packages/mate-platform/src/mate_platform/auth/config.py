"""Runtime configuration for the mate-platform.auth stack.

All values are read from environment variables so that the same code path
works in dev, contract, integration, staging, and production. The
production profile refuses to start if KEYCLOAK_URL is unset, per the
hard-rule-5 no-local-fallback-in-production rule.
"""
from __future__ import annotations

import os
from dataclasses import dataclass


def _require(name: str, *, allow_empty: bool = False) -> str:  # pyright: ignore[reportUnusedFunction]
    value = os.environ.get(name, "")
    if not allow_empty and not value:
        raise RuntimeError(
            f"required environment variable {name!r} is not set. "
            f"In production, refusing to fall back to a local identity source."
        )
    return value


def _optional(name: str, default: str) -> str:
    return os.environ.get(name, default) or default


def _int(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError as exc:
        raise RuntimeError(f"env {name!r} must be an int, got {raw!r}") from exc


def _bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name, "").strip().lower()
    if not raw:
        return default
    return raw in {"1", "true", "yes", "y", "on"}


@dataclass(frozen=True, slots=True)
class AuthConfig:
    keycloak_url: str
    realm: str
    audience: str
    service_client_id: str
    service_client_secret: str
    jwks_refresh_seconds: int
    jwks_request_timeout_seconds: int
    leeway_seconds: int
    legacy_login_compat: bool
    insecure_skip_signature: bool

    @property
    def issuer(self) -> str:
        return f"{self.keycloak_url.rstrip('/')}/realms/{self.realm}"

    @property
    def jwks_uri(self) -> str:
        return f"{self.issuer}/protocol/openid-connect/certs"

    @property
    def token_uri(self) -> str:
        return f"{self.issuer}/protocol/openid-connect/token"


def load_auth_config() -> AuthConfig:
    legacy = _bool("LEGACY_LOGIN_COMPAT", default=False)
    insecure = _bool("INSECURE_SKIP_SIGNATURE", default=False)
    keycloak_url = _optional("KEYCLOAK_URL", "")
    realm = _optional("KEYCLOAK_REALM", "metaplatform")
    audience = _optional("KEYCLOAK_AUDIENCE", "metaplatform-backend")
    service_client_id = _optional("SERVICE_CLIENT_ID", "metaplatform-backend")
    service_client_secret = os.environ.get("SERVICE_CLIENT_SECRET", "")
    if not legacy:
        if not keycloak_url:
            raise RuntimeError(
                "KEYCLOAK_URL is required when LEGACY_LOGIN_COMPAT is false "
                "(production profile: no local identity source)."
            )
        if not service_client_secret:
            raise RuntimeError(
                "SERVICE_CLIENT_SECRET is required when LEGACY_LOGIN_COMPAT is "
                "false; the secret must come from SealedSecret/ExternalSecret."
            )
    return AuthConfig(
        keycloak_url=keycloak_url,
        realm=realm,
        audience=audience,
        service_client_id=service_client_id,
        service_client_secret=service_client_secret,
        jwks_refresh_seconds=_int("JWKS_REFRESH_SECONDS", 300),
        jwks_request_timeout_seconds=_int("JWKS_REQUEST_TIMEOUT_SECONDS", 5),
        leeway_seconds=_int("JWT_LEEWAY_SECONDS", 30),
        legacy_login_compat=legacy,
        insecure_skip_signature=insecure,
    )
