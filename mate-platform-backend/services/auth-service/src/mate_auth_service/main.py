"""Mate Platform - Auth Service.

职责 (per agent.md "网关层: Traefik + AuthService"):
  - JWT 校验 (RS256, Keycloak JWKS)
  - 租户识别 (从 token claims 提取 tenant_id)
  - token 黑名单 (Redis, 登出/吊销)

不职责 (边界):
  - 不做切流决策 (那是 Traefik 边网关)
  - 不发 token (Keycloak)
  - 不写用户/角色 (Keycloak admin API)
"""
from __future__ import annotations

import os
import time
from contextlib import asynccontextmanager, suppress
from typing import Any

import httpx
import jwt
import structlog
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

logger = structlog.get_logger(__name__)


# ---- Config ----
KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://keycloak:8080")
KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "metaplatform")
KEYCLOAK_CLIENT_ID = os.getenv("KEYCLOAK_CLIENT_ID", "metaplatform-backend")
KEYCLOAK_CLIENT_SECRET = os.getenv("KEYCLOAK_CLIENT_SECRET", "")
KEYCLOAK_INTERNAL_URL = os.getenv("KEYCLOAK_INTERNAL_URL", KEYCLOAK_URL)

JWKS_URL = f"{KEYCLOAK_INTERNAL_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/certs"
ISSUER = f"{KEYCLOAK_INTERNAL_URL}/realms/{KEYCLOAK_REALM}"
OIDC_USERINFO_URL = f"{KEYCLOAK_INTERNAL_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/userinfo"

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
JWKS_REFRESH_SEC = int(os.getenv("JWKS_REFRESH_SEC", "300"))
JWKS_CACHE_KEY = f"jwks:{KEYCLOAK_REALM}"
TOKEN_BLACKLIST_KEY_PREFIX = "token:revoked:"

ALLOWED_ALGS = ["RS256", "RS384", "RS512"]

# kid -> public key
_jwks_cache: dict[str, Any] = {}


# ---- JWKS handling ----
async def _fetch_jwks(client: httpx.AsyncClient) -> dict[str, Any]:
    r = await client.get(JWKS_URL, timeout=5.0)
    r.raise_for_status()
    jwks = r.json()
    keys: dict[str, Any] = {}
    for k in jwks.get("keys", []):
        kid = k.get("kid")
        if not kid:
            continue
        try:
            keys[kid] = jwt.algorithms.RSAAlgorithm.from_jwk(k)
        except Exception as exc:
            logger.warning("jwks.parse_failed", kid=kid, error=str(exc))
    return keys


async def _refresh_jwks_if_needed(client: httpx.AsyncClient) -> None:
    global _jwks_cache
    # Try Redis-cached first
    if _jwks_cache:
        return
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(REDIS_URL, decode_responses=True)
        cached = await r.get(JWKS_CACHE_KEY)
        if cached:
            import json
            data = json.loads(cached)
            for _kid, _ in data.items():
                pass  # values are jwk strings, not keys
            # rebuild keys
            _jwks_cache = await _fetch_jwks(client)
        else:
            _jwks_cache = await _fetch_jwks(client)
            # cache jwks dict (re-fetched above) to redis as JSON of raw jwk strings
            jwk_payload = {kid: jwt.algorithms.RSAAlgorithm.to_jwk(key) for kid, key in _jwks_cache.items()}
            await r.set(JWKS_CACHE_KEY, json_dumps(jwk_payload), ex=JWKS_REFRESH_SEC)
        await r.aclose()
    except Exception as exc:
        logger.warning("jwks.redis_cache_failed", error=str(exc))
        _jwks_cache = await _fetch_jwks(client)


def json_dumps(obj: Any) -> str:
    import json
    return json.dumps(obj, default=str)


# ---- Schemas ----

class IamLoginRequest(BaseModel):
    username: str
    password: str
    tenantId: str | None = None


class IamRefreshRequest(BaseModel):
    refreshToken: str = Field(..., description="Refresh token from previous login")


class IamAuthUserInfo(BaseModel):
    id: str = ""
    username: str = ""
    email: str | None = None
    realName: str | None = None


class IamAuthResponse(BaseModel):
    accessToken: str
    refreshToken: str | None = None
    tokenType: str = "Bearer"
    expiresIn: int = 3600
    refreshExpiresIn: int = 0
    userId: str | None = None
    username: str | None = None
    realName: str | None = None
    user: IamAuthUserInfo | None = None
    requirePasswordReset: bool = False
    mfaRequired: bool = False
    loginAt: str | None = None


class VerifyRequest(BaseModel):
    token: str = Field(..., description="Bearer JWT from client")


class VerifyResponse(BaseModel):
    valid: bool
    subject: str | None = None
    tenant_id: str | None = None
    username: str | None = None
    email: str | None = None
    roles: list[str] = Field(default_factory=list)
    scopes: list[str] = Field(default_factory=list)
    expires_at: int = 0
    issued_at: int = 0


class RevokeRequest(BaseModel):
    jti: str = Field(..., description="JWT ID to revoke (logout)")


# ---- Lifespan ----
@asynccontextmanager
async def lifespan(app: FastAPI):
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(__import__("logging"), log_level)
        ),
    )
    app.state.client = httpx.AsyncClient(timeout=httpx.Timeout(5.0, connect=2.0))
    try:
        await _refresh_jwks_if_needed(app.state.client)
        logger.info("jwks.warmed", key_count=len(_jwks_cache))
    except Exception as exc:
        logger.warning("jwks.warmup_failed", error=str(exc))
    try:
        import redis.asyncio as aioredis
        app.state.redis = aioredis.from_url(REDIS_URL, decode_responses=True)
        await app.state.redis.ping()
    except Exception as exc:
        logger.warning("redis.connect_failed", error=str(exc))
        app.state.redis = None
    logger.info("mate-auth-service.startup", version=app.version)
    yield
    await app.state.client.aclose()
    if app.state.redis is not None:
        with suppress(Exception):
            await app.state.redis.aclose()
    logger.info("mate-auth-service.shutdown")


app = FastAPI(
    title="mate-auth-service",
    version="0.1.0",
    description="JWT verify + tenant resolution (Keycloak JWKS)",
    lifespan=lifespan,
)


# ---- Endpoints ----
@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok", "version": app.version}


@app.get("/readyz")
async def readyz() -> dict[str, Any]:
    checks = {
        "keycloak_jwks": len(_jwks_cache) > 0,
        "redis": app.state.redis is not None,
    }
    overall = all(checks.values())
    return {"status": "ok" if overall else "degraded", "checks": checks}


@app.post("/api/v1/auth/verify", response_model=VerifyResponse)
async def verify(req: VerifyRequest) -> VerifyResponse:
    # Check blacklist first
    try:
        unverified = jwt.get_unverified_header(req.token)
        unverified_claims = jwt.decode(req.token, options={"verify_signature": False})
        jti = unverified_claims.get("jti", "")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail=f"Malformed token: {exc}")

    if app.state.redis and jti:
        try:
            if await app.state.redis.exists(f"{TOKEN_BLACKLIST_KEY_PREFIX}{jti}"):
                raise HTTPException(status_code=401, detail="Token revoked")
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning("blacklist.check_failed", error=str(exc))

    # Refresh JWKS if unknown kid
    kid = unverified.get("kid")
    if not kid or kid not in _jwks_cache:
        try:
            new_keys = await _fetch_jwks(app.state.client)
            _jwks_cache.update(new_keys)
        except Exception as exc:
            logger.error("jwks.refresh_failed", error=str(exc))
            raise HTTPException(status_code=503, detail="JWKS unavailable")

    if kid not in _jwks_cache:
        raise HTTPException(status_code=401, detail="Unknown signing key")

    # Verify
    try:
        claims = jwt.decode(
            req.token,
            _jwks_cache[kid],
            algorithms=ALLOWED_ALGS,
            issuer=ISSUER,
            audience=KEYCLOAK_CLIENT_ID,
            options={"require": ["exp", "iat", "iss", "sub"]},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidIssuerError:
        raise HTTPException(status_code=401, detail="Invalid issuer")
    except jwt.InvalidAudienceError:
        raise HTTPException(status_code=401, detail="Invalid audience")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")

    return VerifyResponse(
        valid=True,
        subject=claims.get("sub"),
        tenant_id=claims.get("tenant_id") or claims.get("organization"),
        username=claims.get("preferred_username"),
        email=claims.get("email"),
        roles=claims.get("realm_access", {}).get("roles", []),
        scopes=claims.get("scope", "").split() if claims.get("scope") else [],
        expires_at=claims.get("exp", 0),
        issued_at=claims.get("iat", 0),
    )


@app.post("/api/v1/auth/revoke")
async def revoke(req: RevokeRequest) -> dict[str, Any]:
    """Add a JTI to the blacklist (used by /logout)."""
    if app.state.redis is None:
        raise HTTPException(status_code=503, detail="Redis unavailable")
    try:
        await app.state.redis.set(
            f"{TOKEN_BLACKLIST_KEY_PREFIX}{req.jti}",
            "1",
            ex=3600,  # 1h; should match token remaining lifetime
        )
        return {"revoked": True, "jti": req.jti}
    except Exception as exc:
        logger.error("revoke.failed", error=str(exc))
        raise HTTPException(status_code=500, detail=f"Revoke failed: {exc}")


@app.get("/api/v1/auth/userinfo")
async def userinfo(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    """Proxy to Keycloak userinfo endpoint (RFC 7662 OIDC)."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = authorization[len("Bearer "):]
    try:
        r = await app.state.client.get(OIDC_USERINFO_URL, headers={"Authorization": f"Bearer {token}"})
        if r.status_code == 200:
            return r.json()
        raise HTTPException(status_code=r.status_code, detail=r.text)
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Keycloak userinfo timeout")




# ---- IAM Auth proxy endpoints (login/refresh/logout) ----
@app.post("/api/v1/iam/auth/login", response_model=IamAuthResponse)
async def iam_login(req: IamLoginRequest) -> IamAuthResponse:
    """Password grant to Keycloak, return AuthResponse (camelCase)."""
    if not KEYCLOAK_CLIENT_SECRET:
        raise HTTPException(status_code=503, detail="KEYCLOAK_CLIENT_SECRET not configured")
    token_url = f"{KEYCLOAK_INTERNAL_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/token"
    form = {
        "grant_type": "password",
        "client_id": KEYCLOAK_CLIENT_ID,
        "client_secret": KEYCLOAK_CLIENT_SECRET,
        "username": req.username,
        "password": req.password,
    }
    try:
        r = await app.state.client.post(
            token_url,
            data=form,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Keycloak timeout")
    if r.status_code != 200:
        try:
            err = r.json()
            detail = err.get("error_description") or err.get("error") or "Login failed"
        except Exception:
            detail = r.text or "Login failed"
        raise HTTPException(status_code=r.status_code, detail=detail)
    td = r.json()
    access_token = td.get("access_token", "")
    refresh_token = td.get("refresh_token", "")
    # Fetch userinfo for username/email (best-effort)
    userinfo: dict[str, Any] = {}
    try:
        ui = await app.state.client.get(
            OIDC_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if ui.status_code == 200:
            userinfo = ui.json()
    except Exception as exc:
        logger.warning("iam_login.userinfo_failed", error=str(exc))
    sub = userinfo.get("sub", "")
    preferred = userinfo.get("preferred_username", req.username)
    return IamAuthResponse(
        accessToken=access_token,
        refreshToken=refresh_token or None,
        tokenType=td.get("token_type", "Bearer"),
        expiresIn=td.get("expires_in", 3600),
        refreshExpiresIn=td.get("refresh_expires_in", 0),
        userId=sub,
        username=preferred,
        realName=userinfo.get("name") or None,
        user=IamAuthUserInfo(
            id=sub,
            username=preferred,
            email=userinfo.get("email"),
            realName=userinfo.get("name"),
        ),
        loginAt=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    )


@app.post("/api/v1/iam/auth/refresh", response_model=IamAuthResponse)
async def iam_refresh(req: IamRefreshRequest) -> IamAuthResponse:
    """Refresh grant to Keycloak."""
    if not KEYCLOAK_CLIENT_SECRET:
        raise HTTPException(status_code=503, detail="KEYCLOAK_CLIENT_SECRET not configured")
    token_url = f"{KEYCLOAK_INTERNAL_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/token"
    form = {
        "grant_type": "refresh_token",
        "client_id": KEYCLOAK_CLIENT_ID,
        "client_secret": KEYCLOAK_CLIENT_SECRET,
        "refresh_token": req.refreshToken,
    }
    try:
        r = await app.state.client.post(
            token_url,
            data=form,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Keycloak timeout")
    if r.status_code != 200:
        try:
            err = r.json()
            detail = err.get("error_description") or err.get("error") or "Refresh failed"
        except Exception:
            detail = r.text or "Refresh failed"
        raise HTTPException(status_code=r.status_code, detail=detail)
    td = r.json()
    return IamAuthResponse(
        accessToken=td.get("access_token", ""),
        refreshToken=td.get("refresh_token") or None,
        tokenType=td.get("token_type", "Bearer"),
        expiresIn=td.get("expires_in", 3600),
        refreshExpiresIn=td.get("refresh_expires_in", 0),
    )


@app.post("/api/v1/iam/auth/logout")
async def iam_logout(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    """Logout: blacklist current JTI in Redis; best-effort Keycloak end_session."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = authorization[len("Bearer "):]
    jti = ""
    exp = 0
    try:
        unverified = jwt.decode(token, options={"verify_signature": False})
        jti = unverified.get("jti", "")
        exp = unverified.get("exp", 0)
    except Exception:
        pass
    if app.state.redis and jti:
        ttl = max(exp - int(time.time()), 1) if exp else 3600
        try:
            await app.state.redis.set(f"{TOKEN_BLACKLIST_KEY_PREFIX}{jti}", "1", ex=ttl)
        except Exception as exc:
            logger.warning("iam_logout.blacklist_failed", error=str(exc))
    # Best-effort Keycloak logout (no refresh token here, so skip end_session call)
    return {"loggedOut": True, "jti": jti}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8101")))
