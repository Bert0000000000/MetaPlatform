"""JWT token verification against a Keycloak JWKS cache."""
from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from typing import Any

import jwt

from .config import AuthConfig
from .jwks import JWKSCache, JWKSError


class TokenError(Exception):
    """Raised when a token cannot be verified or fails claim checks."""


@dataclass(frozen=True, slots=True)
class VerifiedClaims:
    sub: str
    azp: str
    iss: str
    aud: str
    tenant_id: str
    realm_roles: frozenset[str]
    client_roles: frozenset[str]
    scopes: frozenset[str]
    expires_at: int
    not_before: int
    jti: str


class TokenVerifier:
    def __init__(self, config: AuthConfig, cache: JWKSCache | None = None) -> None:
        self._config = config
        self._cache = cache or JWKSCache(
            config.jwks_uri,
            timeout_seconds=config.jwks_request_timeout_seconds,
        )

    def verify(self, token: str) -> VerifiedClaims:
        if not token:
            raise TokenError("empty token")
        if self._config.insecure_skip_signature:
            claims = _decode_unverified(token)
        else:
            claims = self._verify_with_cache(token)

        aud = _coerce_str(claims.get("aud"))
        if not aud or self._config.audience not in _aud_set(aud):
            raise TokenError(
                f"audience mismatch: token has {aud!r}, "
                f"expected to contain {self._config.audience!r}"
            )
        iss = _coerce_str(claims.get("iss"))
        if iss != self._config.issuer:
            raise TokenError(
                f"issuer mismatch: token has {iss!r}, expected {self._config.issuer!r}"
            )

        realm_roles = _collect_realm_roles(claims)
        client_roles = _collect_client_roles(claims, azp=_coerce_str(claims.get("azp")))
        scopes = _collect_scopes(claims)
        tenant_id = _extract_tenant_id(claims)

        return VerifiedClaims(
            sub=_coerce_str(claims.get("sub")) or "",
            azp=_coerce_str(claims.get("azp")) or "",
            iss=iss or "",
            aud=aud or "",
            tenant_id=tenant_id,
            realm_roles=realm_roles,
            client_roles=client_roles,
            scopes=scopes,
            expires_at=_coerce_int(claims.get("exp")),
            not_before=_coerce_int(claims.get("nbf")),
            jti=_coerce_str(claims.get("jti")) or "",
        )

    def _verify_with_cache(self, token: str) -> dict[str, Any]:
        try:
            header = jwt.get_unverified_header(token)
        except jwt.PyJWTError as exc:
            raise TokenError(f"token header unreadable: {exc}") from exc
        alg = header.get("alg")
        if alg not in {"RS256", "RS384", "RS512"}:
            raise TokenError(
                f"unsupported alg {alg!r}; only RS256/RS384/RS512 are accepted"
            )
        kid = header.get("kid")
        if not kid:
            raise TokenError("token header missing kid")

        key = self._cache.get_or_refresh(kid)
        if key is None:
            raise JWKSError(f"no JWKS entry for kid {kid!r}")
        public_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key))
        try:
            return jwt.decode(
                token,
                key=public_key,
                algorithms=[alg],
                audience=self._config.audience,
                issuer=self._config.issuer,
                leeway=self._config.leeway_seconds,
                options={"require": ["exp", "iat", "iss", "sub", "aud"]},
            )
        except jwt.PyJWTError as exc:
            raise TokenError(f"token verification failed: {exc}") from exc


def _decode_unverified(token: str) -> dict[str, Any]:
    parts = token.split(".")
    if len(parts) != 3:
        raise TokenError("malformed JWT (expected 3 parts)")
    payload = parts[1]
    padding = 4 - len(payload) % 4
    if padding != 4:
        payload += "=" * padding
    try:
        raw = base64.urlsafe_b64decode(payload.encode("ascii"))
        return json.loads(raw)
    except (ValueError, json.JSONDecodeError) as exc:
        raise TokenError(f"token payload not JSON: {exc}") from exc


def _coerce_str(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return str(value)


def _coerce_int(value: Any) -> int:
    if value is None:
        return 0
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _aud_set(aud: Any) -> set[str]:
    if isinstance(aud, str):
        return {aud}
    if isinstance(aud, (list, tuple, set)):
        return {str(x) for x in aud}
    return set()


def _collect_realm_roles(claims: dict[str, Any]) -> frozenset[str]:
    realm_access = claims.get("realm_access") or {}
    if not isinstance(realm_access, dict):
        return frozenset()
    roles = realm_access.get("roles") or []
    if not isinstance(roles, list):
        return frozenset()
    return frozenset(str(r) for r in roles if isinstance(r, str))


def _collect_client_roles(claims: dict[str, Any], *, azp: str) -> frozenset[str]:
    resource_access = claims.get("resource_access") or {}
    if not isinstance(resource_access, dict):
        return frozenset()
    if not azp:
        return frozenset()
    client = resource_access.get(azp) or {}
    if not isinstance(client, dict):
        return frozenset()
    roles = client.get("roles") or []
    if not isinstance(roles, list):
        return frozenset()
    return frozenset(str(r) for r in roles if isinstance(r, str))


def _collect_scopes(claims: dict[str, Any]) -> frozenset[str]:
    scope = claims.get("scope")
    if isinstance(scope, str) and scope:
        return frozenset(scope.split())
    return frozenset()


def _extract_tenant_id(claims: dict[str, Any]) -> str:
    attrs = claims.get("attributes")
    if isinstance(attrs, dict):
        tenant = attrs.get("tenant_id")
        if isinstance(tenant, list) and tenant:
            return str(tenant[0])
        if isinstance(tenant, str) and tenant:
            return tenant
    fallback = claims.get("tenant")
    if isinstance(fallback, str):
        return fallback
    return ""
