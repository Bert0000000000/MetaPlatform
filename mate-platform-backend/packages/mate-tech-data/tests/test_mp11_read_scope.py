"""Authenticated tenant readers must hold the declared platform.read scope."""

import pytest
from mate_tech_data.api import app as api

from .conftest import _keycloak_token


@pytest.mark.parametrize(
    "method,path",
    [
        ("GET", "/api/v1/data/sources"),
        ("GET", "/api/v1/data/sources/absent"),
        ("GET", "/api/v1/data/sources/absent/schema"),
        ("POST", "/api/v1/data/sources/absent/test"),
    ],
)
@pytest.mark.parametrize("scopes", ["", "platform.write"])
def test_missing_read_scope_denied_before_repository_or_connector(
    client, monkeypatch, method, path, scopes
):
    calls = []

    def unexpected(*args, **kwargs):
        calls.append(True)
        return []

    for name in (
        "list_sources",
        "get_source",
        "get_source_schema",
        "test_source_connection",
        "get_app",
    ):
        if hasattr(api, name):
            monkeypatch.setattr(api, name, unexpected)
    response = client.request(
        method, path, headers={"Authorization": "Bearer " + _keycloak_token(scopes=scopes)}
    )
    assert response.status_code == 403
    assert calls == []


def test_verified_read_scope_preserves_read_only_access(client, monkeypatch):
    calls = []

    def read(tenant_id, *args, **kwargs):
        calls.append(tenant_id)
        return []

    monkeypatch.setattr(api, "list_sources", read)
    response = client.get(
        "/api/v1/data/sources",
        headers={"Authorization": "Bearer " + _keycloak_token(scopes="platform.read")},
    )
    assert response.status_code == 200
    assert calls == ["tenant-acme"]
