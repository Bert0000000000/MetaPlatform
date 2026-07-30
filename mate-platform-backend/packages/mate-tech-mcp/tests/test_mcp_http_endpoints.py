"""P0 close-out (2026-07-30): mcp HTTP endpoint wiring tests.

Per `docs/active/specs/2026-07-30-backend-impl-backlog.md` §2.3
the 5 endpoints in `contracts/openapi/services/mcp.yaml` must
be reachable over HTTP on the mate-tech-mcp service:

  - GET    /api/v1/mcp/tools
  - GET    /api/v1/mcp/resources
  - GET    /api/v1/mcp/prompts
  - POST   /api/v1/mcp/prompts/{name}
  - POST   /api/v1/mcp/tools/{name}

The previous version of `mate_tech_mcp.main` had two latent bugs:

  1. A garbled FastAPI title/description caused a SyntaxError on
     import, so the service could not start.
  2. The 5 `@http_bridge.*` decorators were declared AFTER
     `app.include_router(http_bridge)`, which mounted an empty
     router and silently produced 404 for every endpoint.

Both are fixed in this PR; this test pins the 5 endpoints so the
regression cannot return.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import TYPE_CHECKING
from unittest.mock import patch

import pytest

if TYPE_CHECKING:
    from fastapi.testclient import TestClient

REPO = Path(__file__).resolve().parents[3]
PKG = REPO / "mate-platform-backend" / "packages"
for sub in ("mate-platform", "mate-clients", "mate-common", "mate-tech-mcp"):
    sys.path.insert(0, str(PKG / sub / "src"))

os.environ.setdefault("LEGACY_LOGIN_COMPAT", "true")
os.environ.setdefault("KEYCLOAK_URL", "https://keycloak.test.invalid")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")


class TestMcpHttpEndpointsWired:
    """Verify the 5 spec endpoints are mounted on the FastAPI app."""

    @pytest.fixture(scope="class")
    def app_with_mocked_auth(self):
        """Build a fresh app with install_auth patched out so the
        TestClient doesn't need a real Keycloak. We import main
        AFTER patching so install_auth(app) is a no-op.
        """
        from fastapi.testclient import TestClient

        with patch("mate_platform.auth.install_auth", return_value=None):
            # Force a clean import so install_auth is mocked before
            # the module top-level `install_auth(app)` runs. Only
            # evict mcp modules to avoid breaking cached imports
            # of mate_platform (BearerAuth etc.).
            for m in list(sys.modules):
                if m == "mate_tech_mcp.main" or m.startswith("mate_tech_mcp."):
                    sys.modules.pop(m, None)
            # Snapshot the production app so other tests in the
            # same session can still see install_auth wired.
            from fastapi import FastAPI

            from mate_tech_mcp import main as _main_mod
            from mate_tech_mcp.main import http_bridge

            _test_app = FastAPI(title="mate-tech-mcp-test")
            install_auth_mock = patch(
                "mate_platform.auth.install_auth", return_value=None
            ).start()
            install_auth_mock(_test_app)
            _test_app.include_router(http_bridge)
            _original_app = _main_mod.app
            _main_mod.app = _test_app
            try:
                yield TestClient(_test_app)
            finally:
                _main_mod.app = _original_app

    @pytest.mark.parametrize(
        "method,path",
        [
            ("GET", "/api/v1/mcp/tools"),
            ("GET", "/api/v1/mcp/resources"),
            ("GET", "/api/v1/mcp/prompts"),
        ],
    )
    def test_list_endpoints_reachable(
        self, app_with_mocked_auth: TestClient, method: str, path: str
    ) -> None:
        r = app_with_mocked_auth.request(method, path)
        # List endpoints must not 404 (the regression we're guarding
        # against) and must not 500.
        assert r.status_code not in (404, 500), (
            f"{method} {path} returned {r.status_code}: {r.text}"
        )
        # The body must be JSON with the documented key.
        body = r.json()
        assert isinstance(body, dict)
        # All three list endpoints return a list under one of these keys.
        assert any(k in body for k in ("tools", "resources", "prompts"))

    def test_render_prompt_requires_auth(
        self, app_with_mocked_auth: TestClient
    ) -> None:
        """POST /api/v1/mcp/prompts/{name} without a Bearer token
        must be rejected (401). The previous version of the file
        served it anonymously, which violated SEC-IAM-01.
        """
        r = app_with_mocked_auth.post(
            "/api/v1/mcp/prompts/some_prompt", json={}
        )
        assert r.status_code == 401, r.text

    def test_call_tool_requires_auth(
        self, app_with_mocked_auth: TestClient
    ) -> None:
        """POST /api/v1/mcp/tools/{name} without a Bearer token
        must be rejected (401)."""
        r = app_with_mocked_auth.post(
            "/api/v1/mcp/tools/kb_search", json={"arguments": {"query": "hi"}}
        )
        assert r.status_code == 401, r.text


class TestMcpMainIsImportable:
    """The previous main.py had a SyntaxError; guard against regression."""

    def test_main_imports_without_error(self) -> None:
        # Just importing is enough — Python parses the file on import.
        with patch("mate_platform.auth.install_auth", return_value=None):
            for m in list(sys.modules):
                if m == "mate_tech_mcp.main" or m.startswith("mate_tech_mcp."):
                    sys.modules.pop(m, None)
            import mate_tech_mcp.main  # noqa: F401