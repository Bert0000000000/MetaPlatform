"""Contract tests for AppHub release records used by the release tab."""
from __future__ import annotations


def test_list_releases_for_seeded_app_returns_page(client, auth_headers_acme) -> None:
    response = client.get(
        "/api/v1/apphub/apps/app-data/releases?page=1&size=20",
        headers=auth_headers_acme,
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert isinstance(body["items"], list)
    assert body["total"] == len(body["items"])
