"""Edge case tests for MCP API (ST-5.3.8.x).

Uses ``tests.conftest.make_keycloak_token`` so the bearer token satisfies
``install_auth`` (iss/aud). The ``make_test_token`` helper in
``mate_tech_mcp.auth`` produces alg=none tokens which the production
middleware rejects — it is only valid for the legacy ``http_bridge`` route
(no longer used after P3-W10 Fix-1 moved endpoints to ``api/origin_routes``).

Also patches the module-level ``_rate_limiter`` with a no-op fake so
these tests do not require a live Redis (mirrors dev/CI environments
where Redis is not started by default).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

# install_auth() reads these at app-import time. Set BEFORE main import so
# the auth config resolves in dev/test profile (mirrors conftest.py).
os.environ.setdefault("INSECURE_SKIP_SIGNATURE", "1")
os.environ.setdefault("KEYCLOAK_URL", "http://localhost:8080")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("KEYCLOAK_AUDIENCE", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_ID", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")

# tests/conftest.py exports make_keycloak_token; allow this in-tree
# test file to import it via sys.path so we do not duplicate fixtures.
_TESTS_DIR = Path(__file__).resolve().parents[2] / "tests"
if str(_TESTS_DIR) not in sys.path:
    sys.path.insert(0, str(_TESTS_DIR))

import pytest  # noqa: E402  (placed after env setup)
from conftest import make_keycloak_token  # noqa: E402  (import after sys.path tweak)

from mate_tech_mcp import main as mcp_main  # noqa: E402
from mate_tech_mcp.main import app  # noqa: E402

# Patch the module-level rate limiter so call_tool never touches Redis.
_NOOP_LIMITER = MagicMock()
_NOOP_LIMITER.check = AsyncMock(return_value=None)
mcp_main._rate_limiter = _NOOP_LIMITER
mcp_main.app.state.rate_limiter = _NOOP_LIMITER


@pytest.mark.asyncio
async def test_call_tool_no_token() -> None:
    """无 Bearer token → 401."""
    from fastapi.testclient import TestClient

    client = TestClient(app)
    resp = client.post("/api/v1/mcp/tools/kb_search", json={"arguments": {"query": "x"}})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_call_tool_unknown_tool() -> None:
    """已知 token + 未知工具 → 404."""
    from fastapi.testclient import TestClient

    client = TestClient(app)
    token = make_keycloak_token(sub="alice", tenant_id="acme")
    resp = client.post(
        "/api/v1/mcp/tools/nonexistent_tool",
        json={"arguments": {}},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404
    assert "nonexistent_tool" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_call_tool_expired_token() -> None:
    """过期 token → 401."""
    import time

    from fastapi.testclient import TestClient

    client = TestClient(app)
    make_keycloak_token(sub="alice", tenant_id="acme")
    # Manually craft an expired token by passing the make_keycloak_token
    # ``iat``/``exp`` overrides via direct jwt.encode.
    import jwt as pyjwt

    expired = pyjwt.encode(
        {
            "sub": "alice",
            "iss": "http://localhost:8080/realms/metaplatform",
            "aud": "metaplatform-backend",
            "tenant_id": "acme",
            "roles": ["PLATFORM_SUPER_ADMIN"],
            "iat": int(time.time()) - 3600,
            "exp": int(time.time()) - 10,
        },
        "test-secret",
        algorithm="HS256",
    )
    resp = client.post(
        "/api/v1/mcp/tools/kb_search",
        json={"arguments": {"query": "x"}},
        headers={"Authorization": f"Bearer {expired}"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_call_tool_success() -> None:
    """正常路径 → 200 + 工具结果."""
    import respx
    from fastapi.testclient import TestClient
    from httpx import Response

    respx.post("http://localhost:8006/api/v1/rag/search").mock(
        return_value=Response(
            200,
            json={"hits": [{"id": "doc1", "score": 0.9}], "total": 1},
        )
    )

    client = TestClient(app)
    token = make_keycloak_token(sub="alice", tenant_id="acme")
    resp = client.post(
        "/api/v1/mcp/tools/kb_search",
        json={"arguments": {"query": "test", "top_k": 1}},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["tool"] == "kb_search"
    assert "result" in body


@pytest.mark.asyncio
async def test_prompt_unknown_404() -> None:
    """未知 prompt → 404."""
    from fastapi.testclient import TestClient

    client = TestClient(app)
    token = make_keycloak_token(sub="alice", tenant_id="acme")
    resp = client.post(
        "/api/v1/mcp/prompts/missing",
        json={},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404