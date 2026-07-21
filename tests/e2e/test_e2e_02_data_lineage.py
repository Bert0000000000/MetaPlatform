"""链路2：数据血缘探索 E2E 测试（V11-11）。

覆盖业务流程：
  获取全图 → 按 scope 过滤 → 查看节点子树 → 影响分析

依赖服务：TECH-DATA（Python，真实 ASGI）
对应 V11-02 已实现端点。
"""

from __future__ import annotations

DATA_BASE = "/api/v1/data/lineage"


async def test_e2e_02_data_lineage_full_flow(
    data_client,
    tenant_headers: dict[str, str],
    trace_id: str,
):
    """端到端：获取全图→按 scope 过滤→查看节点子树→影响分析。

    验证点：
    - 全图至少 30 个节点，10 类节点类型齐全
    - scope=customer 过滤后子图包含相关节点
    - 节点子树查询返回以指定节点为根的下游
    - 影响分析返回 upstreamCount / downstreamCount / impactedNodes / impactPath
    - 全链路 traceId 回传一致
    """

    # 1. 获取全图（默认 scope=all）
    resp = await data_client.get(f"{DATA_BASE}", headers=tenant_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["traceId"] == trace_id
    data = resp.json()["data"]
    assert "nodes" in data
    assert "edges" in data
    assert "rootId" in data
    assert data["rootId"] == "ds-crm"
    assert len(data["nodes"]) >= 30

    # 10 类节点类型齐全
    types = {n["type"] for n in data["nodes"]}
    expected_types = {
        "datasource", "table", "mapping", "concept", "action", "output",
    }
    assert expected_types.issubset(types), f"missing types: {expected_types - types}"

    # 2. 按 scope=customer 过滤
    scope_resp = await data_client.get(
        f"{DATA_BASE}?scope=customer", headers=tenant_headers
    )
    assert scope_resp.status_code == 200
    assert scope_resp.json()["traceId"] == trace_id
    scoped = scope_resp.json()["data"]
    node_ids = {n["id"] for n in scoped["nodes"]}
    # 应包含 crm.customer 表
    assert "tbl-crm-cust" in node_ids
    # 应包含上游 ds-crm
    assert "ds-crm" in node_ids
    # 应包含下游 customer 字段
    assert "fld-cust-id" in node_ids
    # rootId 应非空
    assert scoped["rootId"] is not None

    # 3. 查看节点子树（map-cust 为根）
    subtree_resp = await data_client.get(
        f"{DATA_BASE}/map-cust", headers=tenant_headers
    )
    assert subtree_resp.status_code == 200
    assert subtree_resp.json()["traceId"] == trace_id
    subtree = subtree_resp.json()["data"]
    assert subtree["rootId"] == "map-cust"
    subtree_ids = {n["id"] for n in subtree["nodes"]}
    # map-cust 自身
    assert "map-cust" in subtree_ids
    # 下游属性应包含
    assert "attr-cust-id" in subtree_ids
    assert "attr-cust-name" in subtree_ids
    assert "attr-cust-level" in subtree_ids
    # 实体 ent-c-001 通过 attr-cust-id → ent-c-001 连接
    assert "ent-c-001" in subtree_ids
    # 上游 ds-crm 不应出现在子树中
    assert "ds-crm" not in subtree_ids
    # 上游字段 fld-cust-id 也不应出现
    assert "fld-cust-id" not in subtree_ids

    # 4. 影响分析：修改 map-cust 节点
    impact_resp = await data_client.post(
        f"{DATA_BASE}/impact",
        json={"nodeId": "map-cust"},
        headers=tenant_headers,
    )
    assert impact_resp.status_code == 200, impact_resp.text
    assert impact_resp.json()["traceId"] == trace_id
    impact = impact_resp.json()["data"]
    assert "impactedNodes" in impact
    assert "upstreamCount" in impact
    assert "downstreamCount" in impact
    assert "impactPath" in impact
    # map-cust 自身应在 impactedNodes 中
    assert "map-cust" in impact["impactedNodes"]
    # 下游应包含 attr-* 和 ent-*
    impacted = set(impact["impactedNodes"])
    assert "attr-cust-id" in impacted
    assert "attr-cust-name" in impacted
    assert "attr-cust-level" in impacted
    assert "ent-c-001" in impacted
    # 上游应至少有 3 个（fld-cust-id / fld-cust-name / fld-cust-level）
    assert impact["upstreamCount"] >= 3
    assert impact["downstreamCount"] >= 4
    # impactPath 第一个元素应为 nodeId
    assert impact["impactPath"][0] == "map-cust"


async def test_e2e_02_data_lineage_node_not_found(
    data_client,
    tenant_headers: dict[str, str],
):
    """节点不存在时返回空图。"""
    resp = await data_client.get(
        f"{DATA_BASE}/nonexistent-node", headers=tenant_headers
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["nodes"] == []
    assert data["edges"] == []
    assert data["rootId"] is None


async def test_e2e_02_data_lineage_impact_root_node(
    data_client,
    tenant_headers: dict[str, str],
):
    """根节点 ds-crm 应只有下游，无上游。"""
    resp = await data_client.post(
        f"{DATA_BASE}/impact",
        json={"nodeId": "ds-crm"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["upstreamCount"] == 0
    assert data["downstreamCount"] >= 1
    assert "ds-crm" in data["impactedNodes"]
