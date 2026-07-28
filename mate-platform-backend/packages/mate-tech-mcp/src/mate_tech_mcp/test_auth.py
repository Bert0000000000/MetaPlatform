"""OAuth JWT tests (ST-5.3.9.2)."""
from __future__ import annotations

import time

import pytest

from mate_tech_mcp.auth import (
    AuthError,
    JWTClaims,
    make_test_token,
    verify_jwt_token,
)


@pytest.mark.asyncio
async def test_valid_token_returns_claims() -> None:
    token = make_test_token(sub="alice", tenant_id="acme", roles=["admin"])
    claims = await verify_jwt_token(token)
    assert claims["sub"] == "alice"
    assert claims["tenant_id"] == "acme"
    assert "admin" in claims["roles"]


@pytest.mark.asyncio
async def test_expired_token_raises() -> None:
    token = make_test_token(expires_in=-10)  # 已过期
    with pytest.raises(AuthError, match="expired"):
        await verify_jwt_token(token)


@pytest.mark.asyncio
async def test_malformed_token_raises() -> None:
    with pytest.raises(AuthError, match="Malformed"):
        await verify_jwt_token("not.a.valid.jwt")


@pytest.mark.asyncio
async def test_empty_token_raises() -> None:
    with pytest.raises(AuthError, match="Empty"):
        await verify_jwt_token("")


@pytest.mark.asyncio
async def test_missing_sub_raises() -> None:
    """测试缺 sub 字段的 token."""
    import base64
    import json

    payload = {"tenant_id": "x", "exp": int(time.time()) + 60}
    b64 = lambda d: base64.urlsafe_b64encode(
        json.dumps(d).encode()
    ).rstrip(b"=").decode()
    bad_token = f"{b64({'alg': 'none'})}.{b64(payload)}.sig"
    with pytest.raises(AuthError, match="sub"):
        await verify_jwt_token(bad_token)


def test_make_test_token_format() -> None:
    token = make_test_token()
    assert token.count(".") == 2