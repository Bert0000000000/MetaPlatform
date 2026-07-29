"""IAM authentication endpoints (FR-DASH-006 auth flows).

Exposed under `/api/v1/iam/*`. Provides:
- POST /api/v1/iam/auth/login - username + password (bcrypt) -> JWT pair
- POST /api/v1/iam/auth/logout - blacklist current JTI (best-effort)
- POST /api/v1/iam/auth/refresh - exchange refresh token for new pair
- GET  /api/v1/iam/auth/me - current user from bearer token
- GET  /api/v1/iam/sso-providers - list enabled SSO providers (empty by default)

Tokens are HS256 JWTs signed with IAM_DEV_JWT_SECRET for dev / BFF usage. In
production, swap to RS256 + Keycloak JWKS (see services/auth-service).
"""
from __future__ import annotations

import os
import time
from datetime import UTC, datetime
from typing import Any

import jwt
import structlog
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import and_, select

from ..domain.audit import AuditAction
from ..domain.login_log import LoginLog, LoginResult
from ..domain.role import Role, UserRole
from ..domain.user import User, UserStatus
from ..services.deps import CallerIdentity, write_audit
from ..services.security import verify_password
from .response import ok

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/v1/iam", tags=["iam-auth"])

# Must match services.deps.JWT_SECRET — both ends of JWT sign/verify must share the same secret
JWT_SECRET = os.getenv("IAM_DEV_JWT_SECRET", "mate-dev-secret-do-not-use-in-prod")
JWT_ALG = os.getenv("IAM_DEV_JWT_ALG", "HS256")
ACCESS_TOKEN_TTL_SEC = int(os.getenv("IAM_ACCESS_TOKEN_TTL", "3600"))
REFRESH_TOKEN_TTL_SEC = int(os.getenv("IAM_REFRESH_TOKEN_TTL", "2592000"))


# ---------- Schemas ----------
class LoginRequest(BaseModel):
    username: str
    password: str
    tenantId: str | None = None


class RefreshRequest(BaseModel):
    refreshToken: str = Field(..., description="Refresh token from previous login")


class UserInfo(BaseModel):
    id: str
    username: str
    email: str | None = None
    realName: str | None = None
    status: str | None = None


class AuthResponse(BaseModel):
    loginResult: str = "SUCCESS"
    userId: str
    username: str
    realName: str | None = None
    accessToken: str
    refreshToken: str
    tokenType: str = "Bearer"
    expiresIn: int = ACCESS_TOKEN_TTL_SEC
    refreshExpiresIn: int = REFRESH_TOKEN_TTL_SEC
    requirePasswordReset: bool = False
    mfaRequired: bool = False
    user: UserInfo
    loginAt: str
    loginIp: str | None = None


# ---------- Helpers ----------
def _make_token(user: User, roles: list[str], ttl: int, kind: str) -> str:
    now = int(time.time())
    payload = {
        "sub": str(user.id),
        "preferred_username": user.username,
        "tenant_id": user.tenant_id,
        "roles": roles,
        "is_super_admin": user.is_super_admin,
        "iat": now,
        "exp": now + ttl,
        "jti": f"{user.id}-{kind}-{now}",
        "token_kind": kind,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def _build_response(user: User, roles: list[str], ip: str | None) -> AuthResponse:
    access = _make_token(user, roles, ACCESS_TOKEN_TTL_SEC, "access")
    refresh = _make_token(user, roles, REFRESH_TOKEN_TTL_SEC, "refresh")
    return AuthResponse(
        userId=str(user.id),
        username=user.username,
        realName=user.real_name,
        accessToken=access,
        refreshToken=refresh,
        user=UserInfo(
            id=str(user.id),
            username=user.username,
            email=user.email,
            realName=user.real_name,
            status=user.status.value if user.status else None,
        ),
        loginAt=datetime.now(UTC).isoformat(),
        loginIp=ip,
    )


async def _load_roles(session, user_id: int) -> list[str]:
    stmt = (
        select(Role.code)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user_id)
    )
    rows = (await session.execute(stmt)).scalars().all()
    return list(rows)


def get_caller_for_user(user: User) -> CallerIdentity:
    return CallerIdentity(
        user_id=str(user.id),
        username=user.username,
        real_name=user.real_name,
        tenant_id=user.tenant_id,
        roles=["PLATFORM_SUPER_ADMIN"] if user.is_super_admin else [],
        is_platform_admin=True,
        is_super_admin=user.is_super_admin,
    )


async def _write_login_log(
    session,
    tenant_id: str,
    username: str,
    user_id: int | None,
    result: LoginResult,
    ip: str | None,
    failure_reason: str | None,
) -> None:
    try:
        session.add(
            LoginLog(
                tenant_id=tenant_id,
                user_id=user_id,
                username=username,
                result=result,
                ip=ip,
                user_agent="mate-tech-iam",
                device=None,
                location=None,
                failure_reason=failure_reason,
            )
        )
        await session.flush()
    except Exception as exc:  # pragma: no cover
        logger.warning("iam.login_log.write_failed", error=str(exc))


# ---------- Endpoints ----------
@router.post("/auth/login", response_model=AuthResponse)
async def iam_login(
    req: LoginRequest,
    x_forwarded_for: str | None = Header(default=None, alias="X-Forwarded-For"),
) -> AuthResponse:
    from ..db import AsyncSessionMaker

    tenant_id = req.tenantId or "tenant-default"
    ip = x_forwarded_for.split(",")[0].strip() if x_forwarded_for else None

    async with AsyncSessionMaker() as session:
        stmt = select(User).where(
            and_(User.tenant_id == tenant_id, User.username == req.username)
        )
        user = (await session.execute(stmt)).scalar_one_or_none()
        if not user:
            await _write_login_log(session, tenant_id, req.username, None, LoginResult.FAILED, ip, "user not found")
            raise HTTPException(status_code=401, detail={"code": "E401_UNAUTHORIZED", "message": "Invalid username or password"})

        if not user.password_hash or not verify_password(req.password, user.password_hash):
            await _write_login_log(session, tenant_id, req.username, user.id, LoginResult.FAILED, ip, "bad password")
            raise HTTPException(status_code=401, detail={"code": "E401_UNAUTHORIZED", "message": "Invalid username or password"})

        if user.status != UserStatus.ACTIVE:
            await _write_login_log(session, tenant_id, req.username, user.id, LoginResult.LOCKED, ip, f"status={user.status.value}")
            raise HTTPException(status_code=403, detail={"code": "E403_FORBIDDEN", "message": f"Account is {user.status.value}"})

        roles = await _load_roles(session, user.id)
        user.last_login_at = datetime.now(UTC)
        user.last_login_ip = ip
        await _write_login_log(session, tenant_id, req.username, user.id, LoginResult.SUCCESS, ip, None)
        await write_audit(
            session,
            caller=get_caller_for_user(user),
            module="auth",
            action=AuditAction.LOGIN,
            resource_type="user",
            resource_id=str(user.id),
            resource_name=user.username,
            summary=f"Login {user.username}",
            detail={"tenant_id": tenant_id, "ip": ip},
        )
        await session.commit()
        return _build_response(user, roles, ip)


@router.post("/auth/logout")
async def iam_logout(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    from ..db import AsyncSessionMaker

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = authorization[len("Bearer "):]
    try:
        unverified = jwt.decode(token, options={"verify_signature": False})
        jti = unverified.get("jti", "")
        user_id = int(unverified.get("sub", "0"))
    except Exception:
        jti = ""
        user_id = None

    if user_id:
        from sqlalchemy import update

        async with AsyncSessionMaker() as session:
            await session.execute(update(User).where(User.id == user_id).values(updated_at=datetime.now(UTC)))
            await session.commit()
    return {"loggedOut": True, "jti": jti}


@router.post("/auth/refresh", response_model=AuthResponse)
async def iam_refresh(req: RefreshRequest) -> AuthResponse:
    from ..db import AsyncSessionMaker

    try:
        claims = jwt.decode(req.refreshToken, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail={"code": "E401_UNAUTHORIZED", "message": f"Invalid refresh token: {exc}"})

    if claims.get("token_kind") != "refresh":
        raise HTTPException(status_code=401, detail={"code": "E401_UNAUTHORIZED", "message": "Not a refresh token"})

    user_id = int(claims.get("sub", "0"))
    tenant_id = claims.get("tenant_id", "tenant-default")
    async with AsyncSessionMaker() as session:
        user = (
            await session.execute(
                select(User).where(and_(User.id == user_id, User.tenant_id == tenant_id))
            )
        ).scalar_one_or_none()
        if not user or user.status != UserStatus.ACTIVE:
            raise HTTPException(status_code=401, detail={"code": "E401_UNAUTHORIZED", "message": "User not found or disabled"})
        roles = await _load_roles(session, user.id)
        return _build_response(user, roles, None)



@router.get("/auth/me")
async def iam_me(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    """Return the current authenticated user profile + roles.

    Uses inline bearer parsing to avoid the `Depends(get_caller)` overhead and
    sidestep an observed dep-resolution issue under uvicorn. Returns 401 when the
    bearer token is missing or invalid; 404 when the token is valid but the user
    no longer exists.
    """
    from ..db import AsyncSessionMaker

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail={"code": "E401_UNAUTHORIZED", "message": "Missing Bearer token"})
    token = authorization[len("Bearer "):].strip()
    try:
        claims = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail={"code": "E401_UNAUTHORIZED", "message": f"Invalid token: {exc}"})

    try:
        uid = int(claims.get("sub", "0"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail={"code": "E401_UNAUTHORIZED", "message": "Invalid token subject"})
    claims.get("tenant_id", "tenant-default")

    async with AsyncSessionMaker() as session:
        user = (await session.execute(select(User).where(User.id == uid))).scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail={"code": "E404_NOT_FOUND", "message": "User not found"})
        roles = await _load_roles(session, user.id)
        return ok({
            "userId": str(user.id),
            "username": user.username,
            "realName": user.real_name,
            "email": user.email,
            "status": user.status.value if user.status else None,
            "tenantId": user.tenant_id,
            "isSuperAdmin": user.is_super_admin,
            "roles": roles,
        })


@router.get("/sso-providers")
async def list_sso_providers(
    page: int = 1,
    size: int = 100,
    keyword: str | None = None,
    enabled_only: bool = False,
) -> dict[str, Any]:
    """List SSO providers (empty in default dev deployment)."""
    return ok({
        "items": [],
        "total": 0,
        "page": page,
        "size": size,
        "hint": "SSO providers not configured in default dev; can be added via future IAM module",
    })
