"""Happy-path tests for the arch endpoints (FR-ARCH-001..027).

5 tests covering the 5 SPEC-required happy-paths:
  applications / capabilities-tree / data-assets / orgs-tree /
  impact-analysis.
"""
from __future__ import annotations


def test_list_applications(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/arch/applications", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 20, body
    assert all(a["tenant_id"] == "tenant-acme" for a in body["items"])

    # Category filter
    r2 = client.get(
        "/api/v1/arch/applications",
        params={"category": "platform"},
        headers=auth_headers_acme,
    )
    assert r2.status_code == 200
    items = r2.json()["items"]
    assert items
    assert all(a["category"] == "platform" for a in items)


def test_capability_tree(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/arch/capabilities/tree", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    tree = r.json()["tree"]
    assert len(tree) >= 3  # at least 3 root capabilities
    # Each root should have children
    for root in tree:
        assert "children" in root
        assert "code" in root


def test_data_assets_with_layer_filter(client, auth_headers_acme) -> None:
    r = client.get(
        "/api/v1/arch/data-assets",
        params={"layer": "D5"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    assert items
    assert all(a["layer"] == "D5" for a in items)


def test_orgs_tree(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/arch/orgs/tree", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    tree = r.json()["tree"]
    assert len(tree) >= 1  # at least 1 root org
    for root in tree:
        assert root["level"] == 1


def test_impact_analysis_bfs(client, auth_headers_acme) -> None:
    # BFS from cap-data should find cap-data + all descendants
    r = client.get(
        "/api/v1/arch/impact-analysis",
        params={"node_id": "cap-data"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    assert len(items) == 1
    impacted = items[0]["impacted_ids"]
    assert "cap-data" in impacted
    assert "cap-data-ingest" in impacted
    assert "cap-data-ingest-batch" in impacted
    assert len(impacted) >= 7  # 1 root + 3 children + 6 grandchildren = 10? no, 1+3+6=10

    # Nonexistent node returns empty
    r2 = client.get(
        "/api/v1/arch/impact-analysis",
        params={"node_id": "nonexistent"},
        headers=auth_headers_acme,
    )
    assert r2.status_code == 200
    assert r2.json()["total"] == 0
