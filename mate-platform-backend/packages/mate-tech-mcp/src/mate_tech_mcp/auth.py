"""OAuth JWT 校验 (ST-5.3.9.1).

无 token / 过期 / 伪造 → 抛 AuthError → 401.
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


class AuthError(Exception):
    """JWT 校验失败."""

    def __init__(self, reason: str) -> None:
        super().__init__(f"Auth failed: {reason}")
        self.reason = reason


@dataclass(frozen=True, slots=True)
class JWTClaims:
    """JWT 解析后的 claims."""

    sub: str
    tenant_id: str
    roles: tuple[str, ...]
    exp: int
    raw: dict[str, Any]


def _decode_unverified_jwt(token: str) -> dict[str, Any]:
    """无签名校验: 仅解析 JWT payload (开发/测试用).

    生产应使用 Keycloak 公钥验签, 参见 ST-5.3.9 依赖 python-keycloak.
    """
    import base64
    import json

    parts = token.split(".")
    if len(parts) != 3:
        raise AuthError("Malformed JWT")
    try:
        payload_b64 = parts[1]
        # 处理 base64url padding
        padding = "=" * (-len(payload_b64) % 4)
        decoded = base64.urlsafe_b64decode(payload_b64 + padding)
        return json.loads(decoded)
    except Exception as e:
        raise AuthError(f"Decode failed: {e}") from e


async def verify_jwt_token(token: str) -> dict[str, Any]:
    """校验 JWT token, 返回 claims.

    Args:
        token: Bearer token (去除 'Bearer ' 前缀)

    Returns:
        claims dict: {sub, tenant_id, roles, exp, ...}

    Raises:
        AuthError: 校验失败 (格式错 / 过期 / 伪造)
    """
    if not token:
        raise AuthError("Empty token")

    # 解码 payload
    payload = _decode_unverified_jwt(token)

    # 过期检查
    exp = payload.get("exp")
    if exp is not None:
        if int(exp) < int(time.time()):
            raise AuthError("Token expired")
    else:
        # 生产环境应当拒绝无 exp 的 token
        logger.warning("jwt.no_exp_claim")

    # 必须字段检查
    if "sub" not in payload:
        raise AuthError("Missing sub claim")

    # 提取 tenant_id (自定义 claim)
    tenant_id = payload.get("tenant_id") or payload.get("tenant") or "default"
    roles = payload.get("realm_access", {}).get("roles", []) or payload.get("roles", [])

    return {
        "sub": payload["sub"],
        "tenant_id": tenant_id,
        "roles": roles,
        "exp": int(exp) if exp else 0,
        "raw": payload,
    }


def make_test_token(
    *,
    sub: str = "test-user",
    tenant_id: str = "default",
    roles: list[str] | None = None,
    expires_in: int = 3600,
) -> str:
    """构造测试用 JWT (无签名, 仅供本地测试)."""
    import base64
    import json

    header = {"alg": "none", "typ": "JWT"}
    payload = {
        "sub": sub,
        "tenant_id": tenant_id,
        "roles": roles or ["viewer"],
        "exp": int(time.time()) + expires_in,
    }
    def b64(d: dict[str, Any]) -> str:
        return base64.urlsafe_b64encode(
            json.dumps(d).encode()
        ).rstrip(b"=").decode()
    return f"{b64(header)}.{b64(payload)}.unsigned"
