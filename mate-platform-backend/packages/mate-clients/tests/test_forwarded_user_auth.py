import httpx
import pytest


def test_forwarded_user_auth_overrides_callsite_identity_headers() -> None:
    from mate_clients.security.outgoing import ForwardedUserAuth

    auth = ForwardedUserAuth("Bearer verified-user", tenant_id="verified-tenant")
    request = httpx.Request(
        "POST",
        "https://internal.example/modeling",
        headers={"Authorization": "Bearer wrong-user", "X-Tenant-Id": "wrong-tenant"},
    )
    outgoing = next(auth.auth_flow(request))
    assert outgoing.headers["Authorization"] == "Bearer verified-user"
    assert outgoing.headers["X-Tenant-Id"] == "verified-tenant"


@pytest.mark.parametrize(
    "authorization,tenant",
    [("", "tenant"), ("Bearer ", "tenant"), ("Basic token", "tenant"), ("Bearer user", "")],
)
def test_forwarded_user_auth_rejects_incomplete_identity(authorization: str, tenant: str) -> None:
    from mate_clients.security.outgoing import ForwardedUserAuth

    with pytest.raises(ValueError):
        ForwardedUserAuth(authorization, tenant_id=tenant)


@pytest.mark.asyncio
async def test_user_client_preserves_verified_identity_for_relative_internal_requests(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from mate_clients.security.outgoing import user_async_client

    actual_client = httpx.AsyncClient
    observed: list[tuple[str, str, str]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        observed.append(
            (str(request.url), request.headers["Authorization"], request.headers["X-Tenant-Id"])
        )
        return httpx.Response(200, json={"ok": True})

    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kwargs: actual_client(**kwargs, transport=httpx.MockTransport(handler)),
    )
    async with user_async_client(
        "Bearer verified-user",
        tenant_id="verified-tenant",
        base_url="https://internal.example",
        timeout=20,
    ) as client:
        response = await client.get(
            "/api/v1/object", headers={"Authorization": "Bearer spoof", "X-Tenant-Id": "spoof"}
        )
    assert response.json() == {"ok": True}
    assert observed == [
        ("https://internal.example/api/v1/object", "Bearer verified-user", "verified-tenant")
    ]
