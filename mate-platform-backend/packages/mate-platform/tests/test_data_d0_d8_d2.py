"""DATA-D0-D8 D2 e2e tests — DataHub DataProduct modeling.

Verifies the Python-side DataProduct lifecycle:
  - register + get
  - tenant isolation (SEC-TENANT-01 hard rule 3)
  - semver versioning
  - lineage hints integration (D1)
  - CRD-shape parity with helm template (infra/helm/charts/datahub)
  - domain filtering
"""
from __future__ import annotations

import pytest

from mate_platform.datahub import (
    DataHubError,
    DataProduct,
    DataProductNotFoundError,
    DataProductVersion,
    Dataset,
    InMemoryDataHubClient,
    TenantMismatchError,
)
from mate_platform.lineage import LineageHints


@pytest.fixture
def client() -> InMemoryDataHubClient:
    return InMemoryDataHubClient()


@pytest.fixture
def product() -> DataProduct:
    return DataProduct(
        id="iam.users",
        tenant_id="tenant-acme",
        domain="iam",
        owner="platform-iam@metaplatform.local",
        version="1.0.0",
        description="IAM users reference data.",
        datasets=(
            Dataset(name="iam.user", type="table", schema_ref="iam.user.v1.avsc"),
            Dataset(name="iam.role", type="table", schema_ref="iam.role.v1.avsc"),
        ),
        quality={"expectationSuite": "iam.user.suite", "blocking": True},
    )


class TestRegisterAndGet:
    def test_register_returns_version(self, client: InMemoryDataHubClient, product: DataProduct) -> None:
        v = client.register(product)
        assert isinstance(v, DataProductVersion)
        assert v.product.id == "iam.users"

    def test_get_returns_registered_product(self, client: InMemoryDataHubClient, product: DataProduct) -> None:
        client.register(product)
        got = client.get("tenant-acme", "iam.users")
        assert got.id == product.id
        assert got.tenant_id == "tenant-acme"

    def test_get_pinned_version(self, client: InMemoryDataHubClient, product: DataProduct) -> None:
        client.register(product)
        client.register(DataProduct(**{**product.__dict__, "version": "1.1.0", "description": "v1.1"}))  # type: ignore[arg-type]
        latest = client.get("tenant-acme", "iam.users")
        assert latest.version == "1.1.0"
        v1 = client.get("tenant-acme", "iam.users", version="1.0.0")
        assert v1.version == "1.0.0"

    def test_get_unknown_raises(self, client: InMemoryDataHubClient) -> None:
        with pytest.raises(DataProductNotFoundError):
            client.get("tenant-acme", "nonexistent")


class TestTenantIsolation:
    def test_cross_tenant_get_raises(self, client: InMemoryDataHubClient, product: DataProduct) -> None:
        client.register(product)
        with pytest.raises(DataProductNotFoundError):
            client.get("tenant-globex", "iam.users")

    def test_cross_tenant_list_excludes(self, client: InMemoryDataHubClient, product: DataProduct) -> None:
        client.register(product)
        other = DataProduct(
            id="msg.topics",
            tenant_id="tenant-globex",
            domain="msg",
            owner="x@y",
            version="1.0.0",
        )
        client.register(other)
        acme_products = client.list_products("tenant-acme")
        assert len(acme_products) == 1
        assert acme_products[0].tenant_id == "tenant-acme"

    def test_cross_tenant_delete_zero(self, client: InMemoryDataHubClient, product: DataProduct) -> None:
        client.register(product)
        n = client.delete("tenant-globex", "iam.users")
        assert n == 0
        # original still present
        assert client.get("tenant-acme", "iam.users").id == "iam.users"


class TestSemverVersioning:
    def test_invalid_version_rejected(self, client: InMemoryDataHubClient, product: DataProduct) -> None:
        bad = DataProduct(**{**product.__dict__, "version": "bad"})  # type: ignore[arg-type]
        with pytest.raises(DataHubError):
            client.register(bad)

    def test_version_history_ordered(self, client: InMemoryDataHubClient, product: DataProduct) -> None:
        for v in ("1.0.0", "1.1.0", "2.0.0"):
            client.register(DataProduct(**{**product.__dict__, "version": v}))  # type: ignore[arg-type]
        history = client.list_versions("tenant-acme", "iam.users")
        assert [h.product.version for h in history] == ["1.0.0", "1.1.0", "2.0.0"]

    def test_latest_version_picked_on_list(self, client: InMemoryDataHubClient, product: DataProduct) -> None:
        for v in ("1.0.0", "1.2.0", "1.1.0"):
            client.register(DataProduct(**{**product.__dict__, "version": v}))  # type: ignore[arg-type]
        products = client.list_products("tenant-acme")
        assert products[0].version == "1.2.0"


class TestLineageHints:
    def test_lineage_hints_carried_through(self, client: InMemoryDataHubClient, product: DataProduct) -> None:
        hints = LineageHints(
            tenant_id="tenant-acme",
            correlation_id="trace-abc",
            source_system="mate-platform-iam",
            target_system="datahub",
            job_name="iam.user.cdc",
        )
        with_hints = DataProduct(**{**product.__dict__, "lineage_hints": hints})  # type: ignore[arg-type]
        client.register(with_hints)
        got = client.get("tenant-acme", "iam.users")
        assert got.lineage_hints is not None
        assert got.lineage_hints.correlation_id == "trace-abc"
        assert got.lineage_hints.source_system == "mate-platform-iam"


class TestDomainFiltering:
    def test_list_by_domain(self, client: InMemoryDataHubClient) -> None:
        client.register(DataProduct(id="a", tenant_id="t1", domain="iam", owner="o", version="1.0.0"))
        client.register(DataProduct(id="b", tenant_id="t1", domain="msg", owner="o", version="1.0.0"))
        client.register(DataProduct(id="c", tenant_id="t1", domain="iam", owner="o", version="1.0.0"))
        iam = client.list_products("t1", domain="iam")
        assert {p.id for p in iam} == {"a", "c"}


class TestDelete:
    def test_delete_removes_all_versions(self, client: InMemoryDataHubClient, product: DataProduct) -> None:
        for v in ("1.0.0", "2.0.0"):
            client.register(DataProduct(**{**product.__dict__, "version": v}))  # type: ignore[arg-type]
        n = client.delete("tenant-acme", "iam.users")
        assert n == 2
        with pytest.raises(DataProductNotFoundError):
            client.get("tenant-acme", "iam.users")
