"""Shared API dependencies: caller identity (from headers / JWT) and audit log helper."""
from __future__ import annotations

import json
import os
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Annotated, Any

import jwt
import structlog
from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_session
from ..domain.audit import AuditAction, AuditLog

logger = structlog.get_logger(__name__)


@dataclass(slots=True)
class CallerIdentity:
    """Authenticated caller info derived from the request (no DB lookup)."""

    user_id: str
    username: str
    real_name: str | None
    tenant_id: str
    roles: list[str]
    is_platform_admin: bool
    is_super_admin: bool

    def has_role(self, *codes: str) -> bool:
        return any(r in self.roles for r in codes)


JWT_SECRET = os.getenv("IAM_DEV_JWT_SECRET", "mate-dev-secret-do-not-use-in-prod")
JWT_ALG = os.getenv("IAM_DEV_JWT_ALG", "HS256")
DEV_USER_HEADER = "x-mate-dev-user"
DEV_TENANT_HEADER = "x-mate-tenant-id"
DEV_ROLES_HEADER = "x-mate-roles"


def _extract_bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return None


def parse_token(token: str) -> dict[str, Any] | None:
    """Decode JWT without verifying audience. Used for dev tokens."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG], options={"verify_aud": False})
    except jwt.PyJWTError as exc:
        logger.warning("iam.jwt.decode_failed", error=str(exc))
        return None


async def get_caller(
    request: Request,
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_tenant: str | None = Header(default=None, alias=DEV_TENANT_HEADER),
    x_user: str | None = Header(default=None, alias=DEV_USER_HEADER),
    x_roles: str | None = Header(default=None, alias=DEV_ROLES_HEADER),
) -> CallerIdentity:
    """Resolve caller identity from JWT (preferred) or dev headers.

    The dev headers are intended for local development and the BFF layer.
    Production deployments must rely on the ``Authorization`` bearer token.

    Priority: install_auth 已验证的 ``request.state.ctx``（role 准确）>
    JWT 解码 > dev headers。
    """
    # 1) install_auth 中间件已填充 ctx（SEC-IAM-01 已验证 token 并注入 roles）
    ctx = getattr(request.state, "ctx", None)
    if ctx is not None and getattr(ctx, "is_authenticated", False):
        return CallerIdentity(
            user_id=str(getattr(ctx, "user_id", "") or ""),
            username=str(getattr(ctx, "user_id", "") or ""),
            real_name=None,
            tenant_id=str(getattr(ctx, "tenant_id", "") or ""),
            roles=list(getattr(ctx, "roles", frozenset())),
            is_platform_admin=any(
                r in getattr(ctx, "roles", frozenset())
                for r in ("PLATFORM_ADMIN", "PLATFORM_ADMIN_VIEWER", "ROLE_PLATFORM_ADMIN")
            ),
            is_super_admin=(
                "PLATFORM_SUPER_ADMIN" in getattr(ctx, "roles", frozenset())
                or bool(getattr(ctx, "is_super_admin", False))
            ),
        )

    claims: dict[str, Any] = {}
    token = _extract_bearer_token(authorization)
    if token:
        decoded = parse_token(token)
        if decoded:
            claims = decoded

    user_id = (
        claims.get("sub")
        or claims.get("user_id")
        or x_user
        or "anonymous"
    )
    username = claims.get("preferred_username") or claims.get("username") or x_user or user_id
    real_name = claims.get("name") or claims.get("real_name")
    tenant_id = (
        claims.get("tenant_id")
        or claims.get("tid")
        or x_tenant
        or claims.get("iss")
        or "tenant-default"
    )

    raw_roles = claims.get("roles") or claims.get("role") or []
    if isinstance(raw_roles, str):
        roles = [r.strip() for r in raw_roles.split(",") if r.strip()]
    else:
        roles = list(raw_roles or [])

    if x_roles:
        roles.extend([r.strip() for r in x_roles.split(",") if r.strip()])

    is_platform_admin = any(
        r in roles for r in ("PLATFORM_ADMIN", "PLATFORM_ADMIN_VIEWER", "ROLE_PLATFORM_ADMIN")
    )
    is_super_admin = "PLATFORM_SUPER_ADMIN" in roles or bool(claims.get("is_super_admin"))

    return CallerIdentity(
        user_id=str(user_id),
        username=str(username),
        real_name=real_name,
        tenant_id=str(tenant_id),
        roles=list(set(roles)),
        is_platform_admin=is_platform_admin,
        is_super_admin=is_super_admin,
    )


async def require_admin(
    caller: CallerIdentity = Depends(get_caller),
) -> CallerIdentity:
    """Allow only platform admins. Super admin gets a pass for everything."""
    if not (caller.is_platform_admin or caller.is_super_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "E403_FORBIDDEN",
                "message": "后台管理接口仅限平台管理员（ROLE_PLATFORM_ADMIN）",
            },
        )
    return caller


async def get_session_dep() -> AsyncIterator[AsyncSession]:
    async for session in get_session():
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session_dep)]
AdminDep = Annotated[CallerIdentity, Depends(require_admin)]
CallerDep = Annotated[CallerIdentity, Depends(get_caller)]


async def write_audit(
    session: AsyncSession,
    caller: CallerIdentity,
    module: str,
    action: AuditAction,
    *,
    resource_type: str | None = None,
    resource_id: str | None = None,
    resource_name: str | None = None,
    summary: str | None = None,
    detail: Any = None,
    request: Request | None = None,
) -> AuditLog:
    """Append an audit log entry. Best-effort: failures are logged but not raised."""
    detail_text: str | None = None
    if detail is not None:
        try:
            detail_text = json.dumps(detail, ensure_ascii=False, default=str)
        except Exception:  # pragma: no cover - defensive
            detail_text = str(detail)
    ip = None
    user_agent = None
    if request is not None:
        ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")

    entry = AuditLog(
        tenant_id=caller.tenant_id,
        actor_id=caller.user_id,
        actor_name=caller.real_name or caller.username,
        module=module,
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id is not None else None,
        resource_name=resource_name,
        summary=summary,
        detail=detail_text,
        ip=ip,
        user_agent=user_agent,
    )
    session.add(entry)
    try:
        await session.flush()
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("iam.audit.flush_failed", error=str(exc))
    return entry

