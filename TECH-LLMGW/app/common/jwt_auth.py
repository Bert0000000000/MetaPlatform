"""JWT authentication utilities for TECH-IAM integration (S-LLMGW-06).

Provides HS256 token verification, claim extraction, and a path whitelist
so internal/health endpoints can bypass JWT enforcement.
"""

from __future__ import annotations

from typing import Any, Dict, Optional, Set

import jwt
from jwt import ExpiredSignatureError, InvalidTokenError

from app.common.errors import UnauthorizedError
from app.config import settings

JWT_SECRET: str = settings.jwt_secret
JWT_ALGORITHM: str = settings.jwt_algorithm

# Paths that do NOT require a valid JWT.
JWT_WHITELIST: Set[str] = {
    "/health",
    "/api/v1/llmgw/health",
    "/api/v1/llmgw/models/sync",
}


def verify_token(token: str) -> Dict[str, Any]:
    """Verify a JWT's signature and expiry.

    Returns the decoded claims dict (sub / username / tenantId / roles / type …).
    Raises ``UnauthorizedError`` (HTTP 401, code 40101) on expired or invalid
    tokens.
    """

    try:
        payload: Dict[str, Any] = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
        )
    except ExpiredSignatureError as exc:
        raise UnauthorizedError("认证令牌已过期") from exc
    except InvalidTokenError as exc:
        raise UnauthorizedError("认证令牌无效") from exc
    return payload


def create_token(
    claims: Dict[str, Any],
    *,
    expires_in_seconds: int = 3600,
) -> str:
    """Helper to mint a JWT for testing / internal use."""

    from datetime import datetime, timedelta, timezone

    payload = dict(claims)
    now = datetime.now(timezone.utc)
    payload.setdefault("iat", now)
    payload.setdefault("exp", now + timedelta(seconds=expires_in_seconds))
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def extract_bearer_token(authorization: Optional[str]) -> Optional[str]:
    """Return the raw token from an ``Authorization: Bearer <token>`` header."""

    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip() or None
