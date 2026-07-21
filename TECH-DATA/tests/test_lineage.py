"""Lineage endpoints tests (V11-02)."""

from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_get_lineage_full(client, tenant_headers):
    """无 scope 或 scope=all 时返回完整血缘图。"""
    resp = await client.get("/api/v1/data/lineage", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "nodes" in data
    assert "edges" in data
    assert data["rootId"] == "ds-crm"
    # 应包含数据源/表/字段/映射/概念/属性/实体/关系/Action/输出 10 类节点
    types = {n["type"] for n in data["nodes"]}
    assert "datasource" in types
    assert "table" in types
    assert "mapping" in types
    assert "concept" in types
    assert "action" in types
    assert "output" in types


@pytest.mark.asyncio
async def test_get_lineage_with_scope_all_explicit(client, tenant_headers):
    resp = await client.get(
        "/api/v1/data/lineage?scope=all", headers=tenant_headers
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data["nodes"]) >= 30  # 默认图至少 30 个节点


@pytest.mark.asyncio
async def test_get_lineage_scope_filter(client, tenant_headers):
    """scope=customer 应只返回与 customer 相关的子图（上下游 BFS）。"""
    resp = await client.get(
        "/api/v1/data/lineage?scope=customer", headers=tenant_headers
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    # customer 命中 ds-crm 的 crm.customer 表 + concept-customer 等
    node_ids = {n["id"] for n in data["nodes"]}
    # 应包含 crm.customer 表
    assert "tbl-crm-cust" in node_ids
    # 应包含上游 ds-crm
    assert "ds-crm" in node_ids
    # 应包含下游 customer 字段
    assert "fld-cust-id" in node_ids
    # rootId 应为第一个匹配节点
    assert data["rootId"] is not None


@pytest.mark.asyncio
async def test_get_lineage_scope_no_match(client, tenant_headers):
    """scope 不匹配任何节点时返回完整图。"""
    resp = await client.get(
        "/api/v1/data/lineage?scope=zzz_no_match", headers=tenant_headers
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data["nodes"]) >= 30


@pytest.mark.asyncio
async def test_get_lineage_by_node(client, tenant_headers):
    """获取以 map-cust 为根的子树，应包含其下游所有节点（attr-*/ent-*）。"""
    resp = await client.get(
        "/api/v1/data/lineage/map-cust", headers=tenant_headers
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["rootId"] == "map-cust"
    node_ids = {n["id"] for n in data["nodes"]}
    # map-cust 自身
    assert "map-cust" in node_ids
    # 下游属性应包含
    assert "attr-cust-id" in node_ids
    assert "attr-cust-name" in node_ids
    assert "attr-cust-level" in node_ids
    # 实体 ent-c-001 通过 attr-cust-id → ent-c-001 连接
    assert "ent-c-001" in node_ids
    # 上游 ds-crm 不应出现在子树中
    assert "ds-crm" not in node_ids
    # 上游字段 fld-cust-id 也不应出现
    assert "fld-cust-id" not in node_ids


@pytest.mark.asyncio
async def test_get_lineage_by_node_not_found(client, tenant_headers):
    """节点不存在时返回空图。"""
    resp = await client.get(
        "/api/v1/data/lineage/nonexistent-node", headers=tenant_headers
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["nodes"] == []
    assert data["edges"] == []
    assert data["rootId"] is None


@pytest.mark.asyncio
async def test_analyze_impact(client, tenant_headers):
    """影响分析：修改 map-cust 节点，下游应包含 attr-* 和 ent-* 等。"""
    resp = await client.post(
        "/api/v1/data/lineage/impact",
        json={"nodeId": "map-cust"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "impactedNodes" in data
    assert "upstreamCount" in data
    assert "downstreamCount" in data
    assert "impactPath" in data
    # map-cust 自身应在 impactedNodes 中
    assert "map-cust" in data["impactedNodes"]
    # 下游应包含 attr-cust-id / attr-cust-name / attr-cust-level
    impacted = set(data["impactedNodes"])
    assert "attr-cust-id" in impacted
    assert "attr-cust-name" in impacted
    assert "attr-cust-level" in impacted
    # 下游应包含实体 ent-c-001（通过 attr-cust-id → ent-c-001）
    assert "ent-c-001" in impacted
    # 上游应包含 fld-cust-id / fld-cust-name / fld-cust-level
    assert data["upstreamCount"] >= 3
    # impactPath 第一个元素应为 nodeId
    assert data["impactPath"][0] == "map-cust"
    assert data["downstreamCount"] >= 4


@pytest.mark.asyncio
async def test_analyze_impact_node_not_found(client, tenant_headers):
    """影响分析：节点不存在时返回仅包含自身的结果。"""
    resp = await client.post(
        "/api/v1/data/lineage/impact",
        json={"nodeId": "nonexistent"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["impactedNodes"] == ["nonexistent"]
    assert data["upstreamCount"] == 0
    assert data["downstreamCount"] == 0
    assert data["impactPath"] == ["nonexistent"]


@pytest.mark.asyncio
async def test_analyze_impact_root_node(client, tenant_headers):
    """影响分析：根节点 ds-crm 应只有下游，无上游。"""
    resp = await client.post(
        "/api/v1/data/lineage/impact",
        json={"nodeId": "ds-crm"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["upstreamCount"] == 0
    assert data["downstreamCount"] >= 1
    assert "ds-crm" in data["impactedNodes"]


@pytest.mark.asyncio
async def test_analyze_impact_leaf_node(client, tenant_headers):
    """影响分析：叶子节点 out-email 应只有上游，无下游。"""
    resp = await client.post(
        "/api/v1/data/lineage/impact",
        json={"nodeId": "out-email"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["downstreamCount"] == 0
    assert data["upstreamCount"] >= 1
    assert "out-email" in data["impactedNodes"]
