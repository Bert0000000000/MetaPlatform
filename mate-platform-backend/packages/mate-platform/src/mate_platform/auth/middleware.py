"""FastAPI middleware that injects a verified RequestContext."""
from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from ..tenancy.context import AuthMethod, RequestContext, TenantId, UserId
from .config import AuthConfig, load_auth_config
from .identity import ServiceIdentity
from .tenant import TenantError, resolve_tenant
from .verifier import TokenError, TokenVerifier

logger = logging.getLogger(__name__)

ANONYMOUS_PATHS: frozenset[str] = frozenset(
    {
        "/healthz",
        "/readyz",
        "/openapi.json",
        "/docs",
        "/docs/oauth2-redirect",
    }
)


def install_auth(
    app: FastAPI,
    *,
    config: AuthConfig | None = None,
    extra_anonymous_paths: set[str] | None = None,
) -> TokenVerifier:
    """Install the bearer-token auth middleware on `app`.

    Args:
        app: The FastAPI application.
        config: Override for the resolved AuthConfig.
        extra_anonymous_paths: Paths that should bypass the bearer-token
            requirement and resolve an anonymous RequestContext (e.g.
            workbench login at `/api/v1/dashboard/auth/login`). Per-path;
            methods are not filtered, so POST endpoints in this set will
            still receive `require_tenant`-style guard checks downstream
            (where applicable).

    The DEFAULT anonymous paths (`/healthz`, `/readyz`, `/openapi.json`,
    `/docs`, `/docs/oauth2-redirect`) are always honoured. Pass
    `extra_anonymous_paths` to widen the set for a specific service.
    """
    cfg = config or load_auth_config()
    verifier = TokenVerifier(cfg)
    anonymous_paths: frozenset[str] = (
        ANONYMOUS_PATHS if extra_anonymous_paths is None
        else ANONYMOUS_PATHS | frozenset(extra_anonymous_paths)
    )
    app.add_middleware(
        AuthMiddleware,
        config=cfg,
        verifier=verifier,
        anonymous_paths=anonymous_paths,
    )
    app.state.auth_config = cfg
    app.state.token_verifier = verifier
    return verifier


def build_service_identity(cfg: AuthConfig | None = None) -> ServiceIdentity:
    cfg = cfg or load_auth_config()
    if cfg.legacy_login_compat and not cfg.service_client_secret:
        raise RuntimeError(
            "ServiceIdentity cannot be built without SERVICE_CLIENT_SECRET; "
            "the secret must come from SealedSecret / ExternalSecret."
        )
    return ServiceIdentity(
        token_uri=cfg.token_uri,
        client_id=cfg.service_client_id,
        client_secret=cfg.service_client_secret,
    )


class AuthMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app: ASGIApp,
        *,
        config: AuthConfig,
        verifier: TokenVerifier,
        anonymous_paths: frozenset[str] | None = None,
    ) -> None:
        super().__init__(app)
        self._config = config
        self._verifier = verifier
        self._anonymous_paths = anonymous_paths or ANONYMOUS_PATHS

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        if request.url.path in self._anonymous_paths:
            request.state.ctx = _anonymous_ctx(request)
            return await call_next(request)

        token = _extract_bearer(request.headers.get("authorization"))
        if not token:
            return _unauth("missing bearer token", status=401)
        try:
            claims = self._verifier.verify(token)
        except TokenError as exc:
            return _unauth(f"token rejected: {exc}", status=401)

        try:
            binding = resolve_tenant(
                claims,
                header_tenant=request.headers.get("x-tenant-id"),
                allow_switch=_switch_allowed(claims),
            )
        except TenantError as exc:
            return _unauth(f"tenant binding rejected: {exc}", status=403)

        auth_method = AuthMethod.SERVICE if _looks_like_service(claims) else AuthMethod.USER
        request.state.ctx = RequestContext(
            request_id=request.headers.get("x-request-id", ""),
            trace_id=_extract_trace_id(request),
            tenant_id=TenantId(binding.tenant_id),
            user_id=UserId(claims.sub),
            roles=claims.realm_roles,
            permissions=claims.client_roles,
            scopes=claims.scopes,
            client_id=claims.azp,
            auth_method=auth_method,
        )
        request.state.tenant_switched = binding.switched
        return await call_next(request)


def _extract_bearer(header: str | None) -> str | None:
    if not header:
        return None
    parts = header.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip() or None


def _extract_trace_id(request: Request) -> str:
    tp = request.headers.get("traceparent")
    if tp:
        segments = tp.split("-")
        if len(segments) >= 2 and len(segments[1]) == 32:
            return segments[1]
    return request.headers.get("x-trace-id", "")


def _switch_allowed(claims) -> bool:
    return "tenant_switch_enabled" in claims.scopes


def _looks_like_service(claims) -> bool:
    return "preferred_username" not in _claims_dict(claims) and bool(claims.azp)


def _claims_dict(claims) -> dict:
    return {
        "sub": claims.sub,
        "azp": claims.azp,
        "iss": claims.iss,
        "aud": claims.aud,
        "tenant_id": claims.tenant_id,
        "realm_roles": claims.realm_roles,
        "client_roles": claims.client_roles,
        "scopes": claims.scopes,
        "expires_at": claims.expires_at,
        "not_before": claims.not_before,
        "jti": claims.jti,
    }


def _anonymous_ctx(request: Request) -> RequestContext:
    return RequestContext(
        request_id=request.headers.get("x-request-id", ""),
        trace_id=_extract_trace_id(request),
        tenant_id=TenantId(""),
        user_id=UserId(""),
        roles=frozenset(),
        permissions=frozenset(),
        scopes=frozenset(),
        client_id="",
        auth_method=AuthMethod.ANONYMOUS,
    )


def _unauth(message: str, *, status: int) -> Response:
    return JSONResponse(
        status_code=status,
        content={
            "error": "unauthorized" if status == 401 else "forbidden",
            "detail": message,
        },
    )
