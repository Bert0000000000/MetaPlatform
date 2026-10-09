"""Public login HTTP boundaries with an isolated OIDC provider transport."""

from importlib import import_module
from pathlib import Path
from urllib.parse import parse_qs

import httpx
import pytest


@pytest.fixture
def auth_service(monkeypatch):
    monkeypatch.setenv("KEYCLOAK_URL", "http://provider.invalid")
    monkeypatch.setenv("SERVICE_CLIENT_SECRET", "fixture-service-secret")
    monkeypatch.setenv("IAM_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
    monkeypatch.syspath_prepend(
        str(Path(__file__).resolve().parents[1] / "services/auth-service/src")
    )
    service = import_module("mate_auth_service.main")
    monkeypatch.setattr(service, "KEYCLOAK_CLIENT_SECRET", "fixture-client-secret")
    return service


LOGIN_PATHS = ["/api/v1/iam/auth/login", "/api/v1/dashboard/auth/login"]


@pytest.mark.asyncio
@pytest.mark.parametrize("path", LOGIN_PATHS)
async def test_password_login_requests_identity_scope_and_returns_provider_subject(
    auth_service, path
):
    forms = []

    def provider(request):
        if request.url.path.endswith("/token"):
            forms.append(parse_qs(request.content.decode()))
            return httpx.Response(
                200,
                json={
                    "access_token": "fixture-access",
                    "refresh_token": "fixture-refresh",
                    "token_type": "Bearer",
                    "expires_in": 120,
                    "refresh_expires_in": 240,
                },
            )
        assert request.url == auth_service.OIDC_USERINFO_URL
        assert request.headers["Authorization"] == "Bearer fixture-access"
        if forms[0].get("scope") != ["openid"]:
            return httpx.Response(403, json={"error": "insufficient_scope"})
        return httpx.Response(
            200,
            json={
                "sub": "provider-person-42",
                "preferred_username": "actual-person",
                "name": "Provider Person",
                "email": "fixture@example.invalid",
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(provider)) as oidc:
        auth_service.app.state.client = oidc
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=auth_service.app), base_url="http://test"
        ) as client:
            response = await client.post(
                path,
                json={
                    "username": "fixture-person",
                    "password": "fixture-password",
                    "tenantId": "request-tenant-does-not-inject-identity",
                },
            )
    assert response.status_code == 200
    assert forms == [
        {
            "grant_type": ["password"],
            "scope": ["openid"],
            "client_id": [auth_service.KEYCLOAK_CLIENT_ID],
            "client_secret": ["fixture-client-secret"],
            "username": ["fixture-person"],
            "password": ["fixture-password"],
        }
    ]
    body = response.json()
    assert body["userId"] == body["user"]["id"] == "provider-person-42"
    assert body["username"] == body["user"]["username"] == "actual-person"
    assert body["accessToken"] == "fixture-access"
    assert body["refreshToken"] == "fixture-refresh"
    assert body["user"]["email"] == "fixture@example.invalid"
    assert body["expiresIn"] == 120
    assert "tenantId" not in body


@pytest.mark.asyncio
@pytest.mark.parametrize("path", LOGIN_PATHS)
@pytest.mark.parametrize("userinfo_failure", ["forbidden", "no-subject", "timeout"])
async def test_userinfo_failure_keeps_best_effort_login_without_manufacturing_id(
    auth_service, path, userinfo_failure
):
    def provider(request):
        if request.url.path.endswith("/token"):
            return httpx.Response(200, json={"access_token": "fixture-access"})
        if userinfo_failure == "timeout":
            raise httpx.ReadTimeout("fixture timeout", request=request)
        if userinfo_failure == "forbidden":
            return httpx.Response(403, json={"error": "insufficient_scope"})
        return httpx.Response(200, json={"preferred_username": "actual-person"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(provider)) as oidc:
        auth_service.app.state.client = oidc
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=auth_service.app), base_url="http://test"
        ) as client:
            response = await client.post(
                path,
                json={
                    "username": "fixture-person",
                    "password": "fixture-password",
                },
            )
    assert response.status_code == 200
    body = response.json()
    assert body["accessToken"] == "fixture-access"
    assert body["userId"] == body["user"]["id"] == ""


@pytest.mark.asyncio
@pytest.mark.parametrize("path", LOGIN_PATHS)
@pytest.mark.parametrize("failure, expected", [("rejected", 400), ("timeout", 504)])
async def test_provider_token_failures_preserve_public_errors(
    auth_service, path, failure, expected
):
    def provider(request):
        assert request.url.path.endswith("/token")
        if failure == "timeout":
            raise httpx.ReadTimeout("fixture timeout", request=request)
        return httpx.Response(
            400,
            json={
                "error": "invalid_grant",
                "error_description": "Fixture credentials rejected",
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(provider)) as oidc:
        auth_service.app.state.client = oidc
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=auth_service.app), base_url="http://test"
        ) as client:
            response = await client.post(
                path,
                json={
                    "username": "fixture-person",
                    "password": "fixture-password",
                },
            )
    assert response.status_code == expected
    assert response.json()["detail"] == (
        "Keycloak timeout" if failure == "timeout" else "Fixture credentials rejected"
    )
