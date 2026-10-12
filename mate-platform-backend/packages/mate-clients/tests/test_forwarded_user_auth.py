import httpx
import pytest


def test_forwarded_user_auth_overrides_callsite_identity_headers():
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
def test_forwarded_user_auth_rejects_incomplete_identity(authorization, tenant):
    from mate_clients.security.outgoing import ForwardedUserAuth

    with pytest.raises(ValueError):
        ForwardedUserAuth(authorization, tenant_id=tenant)
