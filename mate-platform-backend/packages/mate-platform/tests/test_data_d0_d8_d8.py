"""DATA-D0-D8 D8 e2e tests — cross-domain data federation query.

Verifies:
  - Multi-tenant fan-out + merge
  - Each merged row tagged with _source_tenant_id
  - Per-tenant error handling (partial / failed status)
  - Cross-domain audit event emitted for multi-tenant queries
  - Single-tenant query does NOT emit audit
  - FederationResult fields correct
  - TenantQueryResult carries error + duration
  - Alembic 0012 schema valid
"""
from __future__ import annotations

import pytest

from mate_platform.federation import (
    FederationClient,
    FederationResult,
    InMemoryDataSourceAdapter,
    TenantQueryResult,
)
from mate_platform.observability.xdomain_audit import InMemoryCrossDomainSink


@pytest.fixture
def adapter() -> InMemoryDataSourceAdapter:
    a = InMemoryDataSourceAdapter()
    a.seed("tenant-acme", [{"name": "alice", "role": "admin"}, {"name": "bob", "role": "user"}])
    a.seed("tenant-globex", [{"name": "carol", "role": "user"}])
    return a


@pytest.fixture
def audit_sink() -> InMemoryCrossDomainSink:
    return InMemoryCrossDomainSink()


class TestFederationQuery:
    def test_multi_tenant_merge(
        self, adapter: InMemoryDataSourceAdapter, audit_sink: InMemoryCrossDomainSink
    ) -> None:
        client = FederationClient(adapter, audit_sink=audit_sink)
        result = client.execute(
            actor_user_id="u-admin",
            actor_tenant_id="tenant-acme",
            target_tenants=["tenant-acme", "tenant-globex"],
            query="SELECT * FROM users",
            trace_id="trace-001",
        )
        assert result.status == "completed"
        assert result.total_rows == 3
        # Each row tagged with source tenant
        tenants_in_rows = {r["_source_tenant_id"] for r in result.merged_rows}
        assert tenants_in_rows == {"tenant-acme", "tenant-globex"}

    def test_audit_emitted_for_multi_tenant(
        self, adapter: InMemoryDataSourceAdapter, audit_sink: InMemoryCrossDomainSink
    ) -> None:
        client = FederationClient(adapter, audit_sink=audit_sink)
        client.execute(
            actor_user_id="u-admin",
            actor_tenant_id="t1",
            target_tenants=["t1", "t2"],
            query="SELECT 1",
            trace_id="t",
        )
        events = audit_sink.all()
        assert len(events) == 1
        assert "t2" in events[0].target_tenants

    def test_single_tenant_no_audit(
        self, adapter: InMemoryDataSourceAdapter, audit_sink: InMemoryCrossDomainSink
    ) -> None:
        client = FederationClient(adapter, audit_sink=audit_sink)
        client.execute(
            actor_user_id="u",
            actor_tenant_id="tenant-acme",
            target_tenants=["tenant-acme"],  # single = no audit
            query="SELECT 1",
            trace_id="t",
        )
        assert audit_sink.all() == []

    def test_per_tenant_results_carried(
        self, adapter: InMemoryDataSourceAdapter, audit_sink: InMemoryCrossDomainSink
    ) -> None:
        client = FederationClient(adapter, audit_sink=audit_sink)
        result = client.execute(
            actor_user_id="u",
            actor_tenant_id="t",
            target_tenants=["tenant-acme", "tenant-globex"],
            query="SELECT *",
            trace_id="t",
        )
        assert len(result.per_tenant) == 2
        acme = next(r for r in result.per_tenant if r.tenant_id == "tenant-acme")
        assert acme.success
        assert len(acme.rows) == 2

    def test_result_has_unique_query_id(
        self, adapter: InMemoryDataSourceAdapter, audit_sink: InMemoryCrossDomainSink
    ) -> None:
        client = FederationClient(adapter, audit_sink=audit_sink)
        r1 = client.execute(
            actor_user_id="u", actor_tenant_id="t", target_tenants=["t1", "t2"],
            query="SELECT 1", trace_id="t",
        )
        r2 = client.execute(
            actor_user_id="u", actor_tenant_id="t", target_tenants=["t1", "t2"],
            query="SELECT 1", trace_id="t",
        )
        assert r1.query_id != r2.query_id


class TestErrorHandling:
    def test_partial_when_one_tenant_fails(self, audit_sink: InMemoryCrossDomainSink) -> None:
        class _PartialAdapter:
            def query(self, tenant_id: str, sql: str, trace_id: str = "") -> list:
                if tenant_id == "bad":
                    raise RuntimeError("connection refused")
                return [{"x": 1}]

        client = FederationClient(_PartialAdapter(), audit_sink=audit_sink)  # type: ignore[arg-type]
        result = client.execute(
            actor_user_id="u", actor_tenant_id="t",
            target_tenants=["good", "bad"], query="SELECT 1", trace_id="t",
        )
        assert result.status == "partial"
        assert result.total_rows == 1
        bad_result = next(r for r in result.per_tenant if r.tenant_id == "bad")
        assert not bad_result.success
        assert "connection refused" in bad_result.error  # type: ignore[operator]

    def test_failed_when_all_tenants_fail(self, audit_sink: InMemoryCrossDomainSink) -> None:
        class _FailAdapter:
            def query(self, tenant_id: str, sql: str, trace_id: str = "") -> list:
                raise RuntimeError("total outage")

        client = FederationClient(_FailAdapter(), audit_sink=audit_sink)  # type: ignore[arg-type]
        result = client.execute(
            actor_user_id="u", actor_tenant_id="t",
            target_tenants=["a", "b"], query="SELECT 1", trace_id="t",
        )
        assert result.status == "failed"
        assert result.total_rows == 0

    def test_empty_tenant_returns_zero_rows(
        self, audit_sink: InMemoryCrossDomainSink
    ) -> None:
        adapter = InMemoryDataSourceAdapter()
        adapter.seed("t1", [])  # no rows
        client = FederationClient(adapter, audit_sink=audit_sink)
        result = client.execute(
            actor_user_id="u", actor_tenant_id="t1",
            target_tenants=["t1", "t2"], query="SELECT 1", trace_id="t",
        )
        assert result.status == "completed"
        assert result.total_rows == 0


class TestAlembic0012Schema:
    def test_migration_module_valid(self) -> None:
        import importlib.util
        from pathlib import Path

        migration_path = (
            Path(__file__).resolve().parents[3]
            / "alembic"
            / "versions"
            / "20260801_0012_federation_query.py"
        )
        assert migration_path.is_file(), "alembic 0012 file missing"
        spec = importlib.util.spec_from_file_location("m0012", migration_path)
        assert spec is not None and spec.loader is not None
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        assert mod.revision == "0012_federation_query"
        assert mod.down_revision == "0011_pii_policy"
        assert callable(mod.upgrade)
        assert callable(mod.downgrade)
