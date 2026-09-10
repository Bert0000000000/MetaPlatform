"""DATA-D6/D7 — lineage / quality / catalog 治理面测试。

覆盖：lineage 边登记 + 子图、quality 规则登记/执行/持久化（required 正例、
type 反例）、catalog 跨 sources+products 检索、租户隔离、审计 outbox 事件。
"""

from __future__ import annotations

from mate_tech_data.repositories import in_memory as repo


def _reset() -> None:
    repo.reset_store()


def test_lineage_edge_registration_and_subgraph():
    _reset()
    repo.create_lineage_edge("tenant-default", "ont.x.obj.orders.v1", "ont.x.obj.orders-ads.v1")
    repo.create_lineage_edge("tenant-default", "ont.x.obj.orders-ads.v1", "ont.x.obj.report.v1")
    graph = repo.lineage_graph("tenant-default", "ont.x.obj.orders-ads.v1")
    node_ids = {n["id"] for n in graph["nodes"]}
    assert node_ids == {"ont.x.obj.orders-ads.v1", "ont.x.obj.orders.v1", "ont.x.obj.report.v1"}
    assert len(graph["edges"]) == 2


def test_lineage_tenant_isolation():
    _reset()
    repo.create_lineage_edge("tenant-a", "a.src", "a.dst")
    assert repo.lineage_graph("tenant-b")["edges"] == []
    assert repo.lineage_graph("tenant-a")["edges"] != []


def test_quality_rule_required_pass():
    _reset()
    repo.create_quality_rule(
        "tenant-default", "src-mysql-orders", "amount", "required", {"table": "orders"}
    )
    summary = repo.run_quality_rules("tenant-default")
    assert summary["rules_executed"] == 1
    assert summary["passed"] == 1 and summary["failed"] == 0
    results = repo.list_quality_results("tenant-default")
    assert results[0].passed is True


def test_quality_rule_type_mismatch_fails():
    _reset()
    repo.create_quality_rule(
        "tenant-default",
        "src-mysql-orders",
        "amount",
        "type",
        {"table": "orders", "type": "varchar(8)"},
    )
    summary = repo.run_quality_rules("tenant-default")
    assert summary["failed"] == 1
    result = repo.list_quality_results("tenant-default")[0]
    assert result.passed is False
    assert "varchar(8)" in result.detail


def test_quality_missing_column_fails():
    _reset()
    repo.create_quality_rule(
        "tenant-default", "src-mysql-orders", "ghost_col", "required", {"table": "orders"}
    )
    summary = repo.run_quality_rules("tenant-default")
    assert summary["failed"] == 1
    assert "not found" in repo.list_quality_results("tenant-default")[0].detail


def test_quality_results_persist_across_runs():
    _reset()
    repo.create_quality_rule(
        "tenant-default", "src-mysql-orders", "amount", "required", {"table": "orders"}
    )
    repo.run_quality_rules("tenant-default")
    repo.run_quality_rules("tenant-default")
    assert len(repo.list_quality_results("tenant-default")) == 2


def test_catalog_search_hits_source_and_product():
    _reset()
    items = repo.catalog_search("tenant-default", "orders")
    kinds = {i["kind"] for i in items}
    assert "source" in kinds and "product" in kinds


def test_catalog_search_no_match_returns_empty():
    _reset()
    assert repo.catalog_search("tenant-default", "zzz-no-such-dataset") == []
