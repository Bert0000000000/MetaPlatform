"""Happy-path tests for the mate-app-hub endpoints (FR-APP-HUB-001..005).

Endpoints under `/api/v1/apphub/*`:
    - GET /apps             — registered applications
    - GET /apps/groups      — application groups (技术分类)
    - GET /apps/domains     — business domains (业务域, tab 候选来源)
    - GET /modules          — business modules
    - GET /pages            — page templates
    - GET /templates        — workflow / form templates

Each test asserts the response shape, the seed minima declared in
`mate_app_hub.repositories.in_memory`, and basic filter behaviour.
"""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_list_apps_returns_seeded_catalog(
    client: TestClient, auth_headers_acme: dict[str, str]
) -> None:
    r = client.get("/api/v1/apphub/apps", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 15, body
    codes = {item["code"] for item in body["items"]}
    # Required apps (per checklist §95)
    expected_subset = {
        "kb",
        "rag",
        "llmgw",
        "mcp",
        "obs",
        "msg",
        "ont",
        "agent",
        "arch",
        "copilot",
        "dashboard",
        "dw",
        "a2a",
        "wfe",
        "data",
    }
    assert expected_subset.issubset(codes), codes
    # Every item must carry the acme tenant_id
    assert all(item["tenant_id"] == "tenant-acme" for item in body["items"])


def test_list_apps_supports_keyword_filter(
    client: TestClient, auth_headers_acme: dict[str, str]
) -> None:
    # "knowledge" matches the KB app name ("Knowledge Base").
    # Apps outside the knowledge group must not match.
    r = client.get(
        "/api/v1/apphub/apps",
        params={"keyword": "knowledge"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    codes = {item["code"] for item in r.json()["items"]}
    assert "kb" in codes
    assert "dw" not in codes
    assert "obs" not in codes

    # Category filter is exact-match and gives the platform team
    # a deterministic enumeration of every app in the platform group.
    r2 = client.get(
        "/api/v1/apphub/apps",
        params={"category": "platform"},
        headers=auth_headers_acme,
    )
    assert r2.status_code == 200, r2.text
    items = r2.json()["items"]
    assert items, "category=platform must return at least one app"
    assert all(it["category"] == "platform" for it in items), items


def test_list_app_groups(client: TestClient, auth_headers_acme: dict[str, str]) -> None:
    r = client.get(
        "/api/v1/apphub/apps/groups",
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 3, body
    codes = {g["code"] for g in body["items"]}
    assert codes == {"knowledge", "platform", "data", "business"}


def test_list_app_domains(client: TestClient, auth_headers_acme: dict[str, str]) -> None:
    """业务域 facet：应用中心业务域 tab 的候选来源。"""
    r = client.get(
        "/api/v1/apphub/apps/domains",
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 6, body
    codes = {d["code"] for d in body["items"]}
    assert codes == {
        "platform-base",
        "order",
        "supply-chain",
        "customer",
        "knowledge-svc",
        "finance",
    }, codes
    # Sorted by sort_order, and every item is tenant-scoped + carries a name.
    orders = [d["sort_order"] for d in body["items"]]
    assert orders == sorted(orders), orders
    assert all(d["tenant_id"] == "tenant-acme" for d in body["items"])
    assert all(d["name"] for d in body["items"])


def test_apps_carry_business_domain(client: TestClient, auth_headers_acme: dict[str, str]) -> None:
    """每个应用都必须带 business_domain，且值是已登记的域码（或空串）。"""
    domains = {
        d["code"]
        for d in client.get("/api/v1/apphub/apps/domains", headers=auth_headers_acme).json()[
            "items"
        ]
    }
    r = client.get("/api/v1/apphub/apps", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    for item in items:
        assert "business_domain" in item, item
        assert item["business_domain"] in domains, item

    # 平台底座的 15 个组件全部归到 platform-base。
    by_code = {i["code"]: i["business_domain"] for i in items}
    for code in ("kb", "rag", "llmgw", "obs", "data"):
        assert by_code[code] == "platform-base", code

    # 业务应用分布在各自业务域，让 tab 有真实内容。
    assert by_code["order-review"] == "order"
    assert by_code["supplier-perf"] == "supply-chain"
    assert by_code["customer-recovery"] == "customer"
    assert by_code["expense-draft"] == "finance"


def test_list_modules_with_app_filter(
    client: TestClient, auth_headers_acme: dict[str, str]
) -> None:
    r = client.get(
        "/api/v1/apphub/modules",
        params={"app_code": "arch"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    assert len(items) >= 2, items
    assert all(m["app_code"] == "arch" for m in items), items
    assert all(m["tenant_id"] == "tenant-acme" for m in items)


def test_list_pages_and_templates(client: TestClient, auth_headers_acme: dict[str, str]) -> None:
    r1 = client.get("/api/v1/apphub/pages", headers=auth_headers_acme)
    assert r1.status_code == 200, r1.text
    pages = r1.json()
    assert pages["total"] >= 12, pages

    r2 = client.get(
        "/api/v1/apphub/templates",
        params={"template_type": "form"},
        headers=auth_headers_acme,
    )
    assert r2.status_code == 200, r2.text
    templates = r2.json()
    assert templates["total"] >= 2, templates
    assert all(t["template_type"] == "form" for t in templates["items"])
