"""Happy-path + cross-tenant tests for the Data Product (Iceberg ADS) domain.

Covers all 9 endpoints under ``/api/v1/data/products``:

  - CRUD (create / list / get / update / delete)
  - Lifecycle transitions (publish / certify / suspend)
  - Filter / pagination / tenant isolation
  - Outbox event emission for every write

This mirrors ``test_app_data.py`` for CDC tasks + data sources,
satisfying FR-DATA-016..024.
"""
from __future__ import annotations

from mate_platform.messaging.outbox import InMemoryOutboxWriter


# ---------------------------------------------------------------------------
# CRUD — basic surface
# ---------------------------------------------------------------------------
def test_list_data_products(client, auth_headers_acme) -> None:
    """Seed catalog exposes >=3 products for the tenant."""
    r = client.get("/api/v1/data/products", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 3, body
    assert all(p["tenant_id"] == "tenant-acme" for p in body["items"])
    assert {"page", "size", "pages", "items"} <= set(body.keys())
    assert all(p["status"] == "published" for p in body["items"])


def test_list_data_products_with_status_filter(client, auth_headers_acme) -> None:
    """status=draft returns only draft products (none seeded as draft)."""
    # Create a draft product
    create = client.post(
        "/api/v1/data/products",
        json={
            "name": "Draft DP",
            "source_paimon_table": "paimon.ods.draft",
            "target_iceberg_table": "iceberg.ads.draft",
            "modality": "structured",
        },
        headers=auth_headers_acme,
    )
    assert create.status_code == 200, create.text
    draft_id = create.json()["id"]

    r = client.get(
        "/api/v1/data/products", params={"status": "draft"}, headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 1
    assert all(p["status"] == "draft" for p in body["items"])
    assert any(p["id"] == draft_id for p in body["items"])


def test_list_data_products_with_modality_filter(client, auth_headers_acme) -> None:
    """modality=embedding returns products whose modality==embedding."""
    create = client.post(
        "/api/v1/data/products",
        json={
            "name": "Embedding DP",
            "source_paimon_table": "paimon.ods.embeddings",
            "target_iceberg_table": "iceberg.ads.embeddings",
            "modality": "embedding",
        },
        headers=auth_headers_acme,
    )
    assert create.status_code == 200, create.text

    r = client.get(
        "/api/v1/data/products",
        params={"modality": "embedding"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 1
    assert all(p["modality"] == "embedding" for p in body["items"])


def test_create_data_product(
    client, auth_headers_acme, outbox: InMemoryOutboxWriter,
) -> None:
    """POST /products → 200, defaults: status=draft, version=1, modality=structured."""
    r = client.post(
        "/api/v1/data/products",
        json={
            "name": "New Product",
            "source_paimon_table": "paimon.ods.orders",
            "target_iceberg_table": "iceberg.ads.orders_summary",
            "modality": "structured",
            "owner": "alice",
            "description": "Daily order summary",
            "tags": ["orders", "daily"],
        },
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["id"].startswith("dp-")
    assert body["status"] == "draft"
    assert body["version"] == 1
    assert body["modality"] == "structured"
    assert body["owner"] == "alice"
    assert body["description"] == "Daily order summary"
    assert body["tags"] == ["orders", "daily"]
    assert body["tenant_id"] == "tenant-acme"

    types = {rec.event.type for rec in outbox.all_records()}
    assert "data.product.created" in types, types


def test_get_data_product(client, auth_headers_acme) -> None:
    products = client.get(
        "/api/v1/data/products", headers=auth_headers_acme,
    ).json()["items"]
    pid = products[0]["id"]

    r = client.get(f"/api/v1/data/products/{pid}", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    detail = r.json()
    assert detail["id"] == pid
    assert detail["tenant_id"] == "tenant-acme"


def test_get_data_product_404(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/data/products/missing-id", headers=auth_headers_acme)
    assert r.status_code == 404, r.text


def test_update_data_product(
    client, auth_headers_acme, outbox: InMemoryOutboxWriter,
) -> None:
    """PUT /products/{id} → mutable fields patched; outbox emitted."""
    create = client.post(
        "/api/v1/data/products",
        json={
            "name": "Pre-update",
            "source_paimon_table": "paimon.ods.orders",
            "target_iceberg_table": "iceberg.ads.orders_summary",
        },
        headers=auth_headers_acme,
    )
    assert create.status_code == 200, create.text
    pid = create.json()["id"]
    outbox._records.clear()

    r = client.put(
        f"/api/v1/data/products/{pid}",
        json={
            "name": "Post-update",
            "description": "now with docs",
            "tags": ["orders"],
        },
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == "Post-update"
    assert body["description"] == "now with docs"
    assert body["tags"] == ["orders"]
    # Status / version untouched by patch
    assert body["status"] == "draft"
    assert body["version"] == 1

    types = {rec.event.type for rec in outbox.all_records()}
    assert "data.product.updated" in types, types


def test_delete_data_product(
    client, auth_headers_acme, outbox: InMemoryOutboxWriter,
) -> None:
    create = client.post(
        "/api/v1/data/products",
        json={
            "name": "To Delete",
            "source_paimon_table": "paimon.ods.x",
            "target_iceberg_table": "iceberg.ads.x",
        },
        headers=auth_headers_acme,
    )
    assert create.status_code == 200, create.text
    pid = create.json()["id"]
    outbox._records.clear()

    r = client.delete(f"/api/v1/data/products/{pid}", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    assert r.json() == {"deleted": True, "id": pid}

    # Confirm gone
    r2 = client.get(f"/api/v1/data/products/{pid}", headers=auth_headers_acme)
    assert r2.status_code == 404

    types = {rec.event.type for rec in outbox.all_records()}
    assert "data.product.deleted" in types, types


# ---------------------------------------------------------------------------
# Lifecycle transitions
# ---------------------------------------------------------------------------
def test_publish_data_product_bumps_version(
    client, auth_headers_acme, outbox: InMemoryOutboxWriter,
) -> None:
    """POST /publish sets status=published + version += 1, emits event."""
    create = client.post(
        "/api/v1/data/products",
        json={
            "name": "Pub Product",
            "source_paimon_table": "paimon.ods.x",
            "target_iceberg_table": "iceberg.ads.x",
            "modality": "structured",
        },
        headers=auth_headers_acme,
    )
    pid = create.json()["id"]
    assert create.json()["version"] == 1
    outbox._records.clear()

    r = client.post(
        f"/api/v1/data/products/{pid}/publish", headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["id"] == pid
    assert body["status"] == "published"
    assert body["version"] == 2

    types = {rec.event.type for rec in outbox.all_records()}
    assert "data.product.published" in types, types


def test_certify_requires_owner(client, auth_headers_acme) -> None:
    """POST /certify returns 409 when the product has no owner."""
    create = client.post(
        "/api/v1/data/products",
        json={
            "name": "No Owner",
            "source_paimon_table": "paimon.ods.x",
            "target_iceberg_table": "iceberg.ads.x",
            # owner omitted on purpose
        },
        headers=auth_headers_acme,
    )
    pid = create.json()["id"]

    r = client.post(
        f"/api/v1/data/products/{pid}/certify", headers=auth_headers_acme,
    )
    assert r.status_code == 409, r.text


def test_certify_with_owner_emits_event(
    client, auth_headers_acme, outbox: InMemoryOutboxWriter,
) -> None:
    """POST /certify with non-empty owner → status=certified + outbox event."""
    create = client.post(
        "/api/v1/data/products",
        json={
            "name": "Certifiable",
            "source_paimon_table": "paimon.ods.x",
            "target_iceberg_table": "iceberg.ads.x",
            "owner": "bob",
        },
        headers=auth_headers_acme,
    )
    pid = create.json()["id"]
    outbox._records.clear()

    r = client.post(
        f"/api/v1/data/products/{pid}/certify", headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "certified"
    assert body["id"] == pid

    types = {rec.event.type for rec in outbox.all_records()}
    assert "data.product.certified" in types, types


def test_suspend_data_product(
    client, auth_headers_acme, outbox: InMemoryOutboxWriter,
) -> None:
    """POST /suspend sets status=suspended; no version bump; emits event."""
    create = client.post(
        "/api/v1/data/products",
        json={
            "name": "To Suspend",
            "source_paimon_table": "paimon.ods.x",
            "target_iceberg_table": "iceberg.ads.x",
        },
        headers=auth_headers_acme,
    )
    pid = create.json()["id"]
    baseline_version = create.json()["version"]
    outbox._records.clear()

    r = client.post(
        f"/api/v1/data/products/{pid}/suspend", headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "suspended"
    assert body["version"] == baseline_version  # no bump on suspend

    types = {rec.event.type for rec in outbox.all_records()}
    assert "data.product.suspended" in types, types


def test_data_product_versions_lists_history(client, auth_headers_acme) -> None:
    """GET /products/{id}/versions returns current version + history entries."""
    create = client.post(
        "/api/v1/data/products",
        json={
            "name": "Versioned",
            "source_paimon_table": "paimon.ods.x",
            "target_iceberg_table": "iceberg.ads.x",
        },
        headers=auth_headers_acme,
    )
    pid = create.json()["id"]

    r = client.get(
        f"/api/v1/data/products/{pid}/versions", headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["id"] == pid
    assert body["version"] == 1
    assert body["status"] == "draft"
    assert isinstance(body["history"], list)
    assert len(body["history"]) >= 1
    first = body["history"][0]
    assert {"version", "status", "at"} <= set(first.keys())


# ---------------------------------------------------------------------------
# Pagination + tenant isolation
# ---------------------------------------------------------------------------
def test_list_data_products_pagination(
    client, auth_headers_acme,
) -> None:
    """Pagination metadata is correct for small page sizes."""
    # Use size=1 -> expect 3 pages from a 3+ seed catalog
    r = client.get(
        "/api/v1/data/products",
        params={"page": 1, "size": 1},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["size"] == 1
    assert body["page"] == 1
    assert body["total"] >= 3
    assert body["pages"] >= 3
    assert len(body["items"]) == 1


def test_data_product_tenant_isolation(
    client, auth_headers_acme, auth_headers_globex,
) -> None:
    """Cross-tenant: globex cannot read or delete acme's product → 404."""
    # acme creates a product
    create = client.post(
        "/api/v1/data/products",
        json={
            "name": "Acme Only",
            "source_paimon_table": "paimon.ods.acme_only",
            "target_iceberg_table": "iceberg.ads.acme_only",
            "owner": "alice",
        },
        headers=auth_headers_acme,
    )
    assert create.status_code == 200, create.text
    pid = create.json()["id"]

    # globex cannot see it
    r = client.get(
        f"/api/v1/data/products/{pid}", headers=auth_headers_globex,
    )
    assert r.status_code == 404, r.text

    # ...and cannot delete it
    r2 = client.delete(
        f"/api/v1/data/products/{pid}", headers=auth_headers_globex,
    )
    assert r2.status_code == 404, r2.text

    # ...and cannot publish it
    r3 = client.post(
        f"/api/v1/data/products/{pid}/publish", headers=auth_headers_globex,
    )
    assert r3.status_code == 404, r3.text

    # Confirm the product is still owned by acme and visible to acme
    still = client.get(
        f"/api/v1/data/products/{pid}", headers=auth_headers_acme,
    )
    assert still.status_code == 200, still.text
    assert still.json()["tenant_id"] == "tenant-acme"
