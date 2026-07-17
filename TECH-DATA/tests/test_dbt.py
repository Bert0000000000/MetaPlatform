"""DBT endpoints tests (P3-DATA-02)."""

from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_create_dbt_project(client, tenant_headers):
    body = {
        "name": "analytics",
        "projectPath": "/workspace/dbt/analytics",
        "profile": "analytics",
        "target": "dev",
    }
    resp = await client.post("/api/v1/data/dbt/projects", json=body, headers=tenant_headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["name"] == "analytics"


@pytest.mark.asyncio
async def test_list_dbt_projects(client, tenant_headers):
    body = {"name": "proj1", "projectPath": "/tmp/p1", "profile": None, "target": None}
    await client.post("/api/v1/data/dbt/projects", json=body, headers=tenant_headers)
    resp = await client.get("/api/v1/data/dbt/projects", headers=tenant_headers)
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert len(items) >= 1


@pytest.mark.asyncio
async def test_create_dbt_model_and_list(client, tenant_headers):
    body = {"name": "p1", "projectPath": "/tmp/x", "profile": None, "target": None}
    proj = await client.post("/api/v1/data/dbt/projects", json=body, headers=tenant_headers)
    pid = proj.json()["data"]["id"]

    model = {
        "name": "stg_orders",
        "schema": "staging",
        "materialized": "view",
        "sql": "SELECT * FROM raw.orders",
        "dependencies": ["raw_orders"],
    }
    resp = await client.post(
        f"/api/v1/data/dbt/projects/{pid}/models", json=model, headers=tenant_headers
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["name"] == "stg_orders"

    resp = await client.get(
        f"/api/v1/data/dbt/projects/{pid}/models", headers=tenant_headers
    )
    assert resp.json()["data"]["items"][0]["name"] == "stg_orders"


@pytest.mark.asyncio
async def test_dbt_compile_and_run(client, tenant_headers):
    body = {"name": "p2", "projectPath": "/tmp/p2", "profile": None, "target": "dev"}
    proj = await client.post("/api/v1/data/dbt/projects", json=body, headers=tenant_headers)
    pid = proj.json()["data"]["id"]
    resp = await client.post(
        f"/api/v1/data/dbt/projects/{pid}/compile", headers=tenant_headers
    )
    assert resp.status_code == 200
    assert "DBT compile" in resp.json()["data"]["compiledSql"]

    resp = await client.post(
        f"/api/v1/data/dbt/projects/{pid}/run", headers=tenant_headers
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "SUCCESS"


@pytest.mark.asyncio
async def test_dbt_dag(client, tenant_headers):
    body = {"name": "p3", "projectPath": "/tmp/p3", "profile": None, "target": None}
    proj = await client.post("/api/v1/data/dbt/projects", json=body, headers=tenant_headers)
    pid = proj.json()["data"]["id"]
    m1 = {
        "name": "stg_a",
        "schema": "staging",
        "materialized": "view",
        "sql": "SELECT 1",
        "dependencies": [],
    }
    m2 = {
        "name": "stg_b",
        "schema": "staging",
        "materialized": "view",
        "sql": "SELECT * FROM stg_a",
        "dependencies": ["stg_a"],
    }
    await client.post(f"/api/v1/data/dbt/projects/{pid}/models", json=m1, headers=tenant_headers)
    await client.post(f"/api/v1/data/dbt/projects/{pid}/models", json=m2, headers=tenant_headers)
    resp = await client.get(
        f"/api/v1/data/dbt/projects/{pid}/dag", headers=tenant_headers
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data["nodes"]) == 2
    assert any(e["source"] and e["target"] for e in data["edges"])