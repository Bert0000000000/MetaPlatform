"""Tool-categories CRUD endpoints for MCP 工具注册中心.

Covers the four endpoints added to `contracts/openapi/services/mcp.yaml`
(mcpGetMcpToolCategories / mcpPostMcpToolCategory /
mcpPutMcpToolCategory / mcpDeleteMcpToolCategory):

  - GET    /api/v1/mcp/tool-categories
  - POST   /api/v1/mcp/tool-categories
  - PUT    /api/v1/mcp/tool-categories/{category_id}
  - DELETE /api/v1/mcp/tool-categories/{category_id}

The MCP 中心 UI (apps/web/src/api/mcphub/tools.ts) calls these with
camelCase bodies and expects camelCase responses.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from mate_tech_mcp.main import app
from mate_tech_mcp.management_repo import reset_management_store


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture(autouse=True)
def _clean_store() -> None:
    reset_management_store()


def _auth(tenant: str = "tenant-acme") -> dict[str, str]:
    from helpers import make_keycloak_token

    token = make_keycloak_token(tenant_id=tenant)
    return {"Authorization": f"Bearer {token}"}


def _create(client: TestClient, tenant: str = "tenant-acme", **overrides) -> dict:
    payload = {"name": "知识检索", "code": "kb-search", "sort_order": 1, **overrides}
    resp = client.post("/api/v1/mcp/tool-categories", json=payload, headers=_auth(tenant))
    assert resp.status_code == 201, resp.text
    return resp.json()


class TestListToolCategories:
    def test_list_empty(self, client: TestClient) -> None:
        resp = client.get("/api/v1/mcp/tool-categories", headers=_auth())
        assert resp.status_code == 200, resp.text
        assert resp.json() == []

    def test_list_returns_created(self, client: TestClient) -> None:
        _create(client)
        resp = client.get("/api/v1/mcp/tool-categories", headers=_auth())
        assert resp.status_code == 200, resp.text
        cats = resp.json()
        assert len(cats) == 1
        assert cats[0]["code"] == "kb-search"
        assert cats[0]["name"] == "知识检索"
        assert cats[0]["sortOrder"] == 1

    def test_list_sorted_by_sort_order_then_name(self, client: TestClient) -> None:
        _create(client, code="z-last", sort_order=2, name="Z 分类")
        _create(client, code="a-first", sort_order=1, name="A 分类")
        resp = client.get("/api/v1/mcp/tool-categories", headers=_auth())
        codes = [c["code"] for c in resp.json()]
        assert codes == ["a-first", "z-last"]

    def test_list_requires_auth(self, client: TestClient) -> None:
        resp = client.get("/api/v1/mcp/tool-categories")
        assert resp.status_code == 401


class TestCreateToolCategory:
    def test_create_returns_camelcase(self, client: TestClient) -> None:
        cat = _create(client)
        assert cat["id"].startswith("cat-")
        assert cat["createdAt"] and cat["updatedAt"]
        assert cat["parentId"] is None

    def test_create_with_parent(self, client: TestClient) -> None:
        cat = _create(client, parent_id="cat-root")
        assert cat["parentId"] == "cat-root"

    def test_create_duplicate_code_400(self, client: TestClient) -> None:
        _create(client)
        resp = client.post(
            "/api/v1/mcp/tool-categories",
            json={"name": "重复", "code": "kb-search"},
            headers=_auth(),
        )
        assert resp.status_code == 400, resp.text

    def test_create_missing_name_422(self, client: TestClient) -> None:
        resp = client.post(
            "/api/v1/mcp/tool-categories",
            json={"code": "no-name"},
            headers=_auth(),
        )
        assert resp.status_code == 422


class TestUpdateToolCategory:
    def test_update_ok(self, client: TestClient) -> None:
        cat = _create(client)
        resp = client.put(
            f"/api/v1/mcp/tool-categories/{cat['id']}",
            json={"name": "改名", "code": "kb-search", "sort_order": 5},
            headers=_auth(),
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["name"] == "改名"
        assert body["sortOrder"] == 5
        assert body["id"] == cat["id"]

    def test_update_missing_404(self, client: TestClient) -> None:
        resp = client.put(
            "/api/v1/mcp/tool-categories/cat-nope",
            json={"name": "x", "code": "x"},
            headers=_auth(),
        )
        assert resp.status_code == 404

    def test_update_duplicate_code_400(self, client: TestClient) -> None:
        _create(client, code="first")
        second = _create(client, code="second")
        resp = client.put(
            f"/api/v1/mcp/tool-categories/{second['id']}",
            json={"name": "second", "code": "first"},
            headers=_auth(),
        )
        assert resp.status_code == 400


class TestDeleteToolCategory:
    def test_delete_ok(self, client: TestClient) -> None:
        cat = _create(client)
        resp = client.delete(f"/api/v1/mcp/tool-categories/{cat['id']}", headers=_auth())
        assert resp.status_code == 204
        listing = client.get("/api/v1/mcp/tool-categories", headers=_auth())
        assert listing.json() == []

    def test_delete_missing_404(self, client: TestClient) -> None:
        resp = client.delete("/api/v1/mcp/tool-categories/cat-nope", headers=_auth())
        assert resp.status_code == 404


class TestTenantIsolation:
    def test_tenant_b_does_not_see_tenant_a(self, client: TestClient) -> None:
        _create(client, tenant="tenant-acme")
        resp = client.get("/api/v1/mcp/tool-categories", headers=_auth("tenant-beta"))
        assert resp.json() == []

    def test_tenant_b_cannot_update_tenant_a(self, client: TestClient) -> None:
        cat = _create(client, tenant="tenant-acme")
        resp = client.put(
            f"/api/v1/mcp/tool-categories/{cat['id']}",
            json={"name": "hack", "code": "hack"},
            headers=_auth("tenant-beta"),
        )
        assert resp.status_code == 404
