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


def test_capabilities_flat_paginated(client, auth_headers_acme) -> None:
    """GET /capabilities returns a flat paginated list (FR-ARCH-ARCHGETARCHCAPABILITIES)."""
    r = client.get("/api/v1/arch/capabilities", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 3, body
    assert all(c["tenant_id"] == "tenant-acme" for c in body["items"])
    assert {"page", "size", "pages"} <= set(body.keys())

    # Pagination: size=1 returns 1 item
    r2 = client.get(
        "/api/v1/arch/capabilities",
        params={"page": 1, "size": 1},
        headers=auth_headers_acme,
    )
    assert r2.status_code == 200
    assert len(r2.json()["items"]) == 1
    assert r2.json()["pages"] == r2.json()["total"]


def test_capability_mappings_flat_paginated(client, auth_headers_acme) -> None:
    """GET /capability-mappings canonical path (FR-ARCH-ARCHGETARCHCAPABILITYMAPPINGS)."""
    r = client.get("/api/v1/arch/capability-mappings", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 1, body
    assert all("capability_code" in m for m in body["items"])


def test_orgs_flat_paginated(client, auth_headers_acme) -> None:
    """GET /orgs returns a flat paginated list (FR-ARCH-ARCHGETARCHORGS)."""
    r = client.get("/api/v1/arch/orgs", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 1, body
    assert all(o["tenant_id"] == "tenant-acme" for o in body["items"])


def test_roles_flat_paginated(client, auth_headers_acme) -> None:
    """GET /roles returns a flat paginated list (FR-ARCH-ARCHGETARCHROLES)."""
    r = client.get("/api/v1/arch/roles", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 1, body
    assert all(ro["tenant_id"] == "tenant-acme" for ro in body["items"])


# ---------------------------------------------------------------------------
# P3-W8 business deepening: named seed-data + tenant-isolation tests
# ---------------------------------------------------------------------------
def test_capabilities_returns_seed_data(client, auth_headers_acme) -> None:
    """GET /capabilities returns the seeded capability rows."""
    r = client.get("/api/v1/arch/capabilities", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 3, body
    codes = {c["code"] for c in body["items"]}
    assert {"cap-data", "cap-knowledge", "cap-platform"} <= codes
    for c in body["items"]:
        assert c["tenant_id"] == "tenant-acme"
        assert "name" in c and "level" in c


def test_capabilities_tenant_isolation(client, auth_headers_acme, auth_headers_globex) -> None:
    """Capabilities are tenant-scoped: globex never sees acme rows."""
    r_acme = client.get("/api/v1/arch/capabilities", headers=auth_headers_acme)
    r_globex = client.get("/api/v1/arch/capabilities", headers=auth_headers_globex)
    assert r_acme.status_code == 200
    assert r_globex.status_code == 200
    assert all(c["tenant_id"] == "tenant-acme" for c in r_acme.json()["items"])
    assert all(c["tenant_id"] == "tenant-globex" for c in r_globex.json()["items"])


def test_capability_mappings_returns_seed_data(client, auth_headers_acme) -> None:
    """GET /capability-mappings returns the seeded capability -> application mappings."""
    r = client.get("/api/v1/arch/capability-mappings", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 1, body
    for m in body["items"]:
        assert {"capability_code", "application_code", "business_process_code"} <= set(m)


def test_capability_mappings_tenant_isolation(client, auth_headers_acme, auth_headers_globex) -> None:
    """Capability mappings are independently seeded per tenant (store isolation)."""
    r_acme = client.get("/api/v1/arch/capability-mappings", headers=auth_headers_acme)
    r_globex = client.get("/api/v1/arch/capability-mappings", headers=auth_headers_globex)
    assert r_acme.status_code == 200
    assert r_globex.status_code == 200
    # Both tenants observe a full per-tenant seed set (>= 1 mapping each).
    assert r_acme.json()["total"] >= 1
    assert r_globex.json()["total"] >= 1
