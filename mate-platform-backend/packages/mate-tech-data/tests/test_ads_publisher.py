"""Tests for the ADS publish workflow (Paimon → Iceberg).

The ``AdsPublisher`` orchestrates the 4-step publish workflow and
delegates the outbound HTTP to an ``IcebergRestAdapter``. In tests
the adapter is replaced with a ``MagicMock(spec=IcebergRestAdapter)``
so no real HTTP traffic is generated. The in-memory data product
store provides deterministic fixtures (via ``create_data_product``
+ ``set_data_product_status`` for status variants).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from mate_tech_data.repositories import in_memory as mem
from mate_tech_data.services.ads_publisher import (
    AdsPublisher,
    AdsPublisherError,
    AdsPublishResult,
)
from mate_tech_data.services.iceberg_rest_adapter import (
    IcebergRestAdapter,
    IcebergRestError,
)

from mate_platform.messaging.outbox import InMemoryOutboxWriter


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(autouse=True)
def _fresh_store() -> None:
    """Reset the in-memory store before each test."""
    mem.reset_store()
    yield
    mem.reset_store()


@pytest.fixture
def adapter() -> MagicMock:
    """Build a ``MagicMock(spec=IcebergRestAdapter)`` wired for happy-path.

    Tests can override ``create_namespace`` / ``register_table``
    side-effects to exercise failure paths.
    """
    mock = MagicMock(spec=IcebergRestAdapter)
    mock.create_namespace = AsyncMock(
        return_value={"namespace": ["iceberg", "ads"]},
    )
    mock.register_table = AsyncMock(return_value={"name": "orders_summary"})
    mock.close = AsyncMock()
    return mock


@pytest.fixture
def outbox() -> InMemoryOutboxWriter:
    """Return a fresh in-memory outbox writer."""
    return InMemoryOutboxWriter()


def _seed_product(
    *,
    tenant_id: str = "tenant-acme",
    status: str = "published",
    target_iceberg_table: str = "iceberg.ads.orders_summary",
    source_paimon_table: str = "paimon.ods.orders",
    modality: str = "structured",
) -> str:
    """Seed a data product for the given tenant; returns the id."""
    product = mem.create_data_product(
        tenant_id,
        name="Orders Summary",
        source_paimon_table=source_paimon_table,
        target_iceberg_table=target_iceberg_table,
        modality=modality,
    )
    # Move the lifecycle forward to the requested status.
    if status != "draft":
        mem.set_data_product_status(tenant_id, product.id, status)
    return product.id


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_publish_happy_path(
    adapter: MagicMock, outbox: InMemoryOutboxWriter,
) -> None:
    """Status=published → namespace + register_table both succeed → result 'published'."""
    product_id = _seed_product(status="published")

    publisher = AdsPublisher(iceberg_adapter=adapter, outbox_writer=outbox)
    result = await publisher.publish("tenant-acme", product_id, trace_id="t-1")

    assert isinstance(result, AdsPublishResult)
    assert result.status == "published"
    assert result.product_id == product_id
    assert result.target_iceberg_table == "iceberg.ads.orders_summary"
    assert result.version >= 2  # bumped from 1
    assert result.rows_published == 0  # mock

    adapter.create_namespace.assert_called_once_with(("iceberg", "ads"))
    adapter.register_table.assert_called_once_with(
        source_table="paimon.ods.orders",
        target_namespace="iceberg.ads",
        target_name="orders_summary",
    )
    assert len(outbox.all_records()) == 1


@pytest.mark.asyncio
async def test_publish_certified_status_succeeds(adapter: MagicMock) -> None:
    """status=certified is also publishable (the strict superset)."""
    product_id = _seed_product(status="certified")

    publisher = AdsPublisher(iceberg_adapter=adapter)
    result = await publisher.publish("tenant-acme", product_id)
    assert result.status == "published"


# ---------------------------------------------------------------------------
# Validation failures
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_publish_rejects_unknown_product(adapter: MagicMock) -> None:
    """404-like: unknown product id → AdsPublisherError status_code=404."""
    publisher = AdsPublisher(iceberg_adapter=adapter)
    with pytest.raises(AdsPublisherError) as exc_info:
        await publisher.publish("tenant-acme", "dp-does-not-exist")
    assert exc_info.value.status_code == 404
    adapter.create_namespace.assert_not_called()
    adapter.register_table.assert_not_called()


@pytest.mark.asyncio
async def test_publish_rejects_draft_status(adapter: MagicMock) -> None:
    """status=draft → AdsPublisherError status_code=422 (not publishable)."""
    product_id = _seed_product(status="draft")

    publisher = AdsPublisher(iceberg_adapter=adapter)
    with pytest.raises(AdsPublisherError) as exc_info:
        await publisher.publish("tenant-acme", product_id)
    assert exc_info.value.status_code == 422
    assert "draft" in str(exc_info.value)


@pytest.mark.asyncio
async def test_publish_rejects_suspended_status(adapter: MagicMock) -> None:
    """status=suspended → AdsPublisherError status_code=422."""
    product_id = _seed_product(status="suspended")

    publisher = AdsPublisher(iceberg_adapter=adapter)
    with pytest.raises(AdsPublisherError) as exc_info:
        await publisher.publish("tenant-acme", product_id)
    assert exc_info.value.status_code == 422
    assert "suspended" in str(exc_info.value)


# ---------------------------------------------------------------------------
# Idempotent namespace creation (409 is swallowed)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_publish_handles_adapter_create_namespace_409(
    adapter: MagicMock, outbox: InMemoryOutboxWriter,
) -> None:
    """create_namespace raising IcebergRestError(409) is treated as success."""
    adapter.create_namespace = AsyncMock(
        side_effect=IcebergRestError(
            "namespace already exists", status_code=409,
        ),
    )
    product_id = _seed_product(status="published")

    publisher = AdsPublisher(iceberg_adapter=adapter, outbox_writer=outbox)
    result = await publisher.publish("tenant-acme", product_id)

    # The 409 was swallowed; register_table still ran.
    assert result.status == "published"
    adapter.create_namespace.assert_called_once_with(("iceberg", "ads"))
    adapter.register_table.assert_called_once()
    assert len(outbox.all_records()) == 1


# ---------------------------------------------------------------------------
# Outbox emission
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_publish_emits_outbox_event_with_product_id_and_version(
    adapter: MagicMock, outbox: InMemoryOutboxWriter,
) -> None:
    """Outbox event payload contains product_id + new version."""
    product_id = _seed_product(status="published")

    publisher = AdsPublisher(iceberg_adapter=adapter, outbox_writer=outbox)
    result = await publisher.publish("tenant-acme", product_id, trace_id="trace-42")

    records = outbox.all_records()
    assert len(records) == 1
    event = records[0].event
    assert event.type == "data.ads.published"
    assert event.tenant_id == "tenant-acme"
    assert event.aggregate_id == product_id
    assert event.trace_id == "trace-42"
    assert event.payload["product_id"] == product_id
    assert event.payload["version"] == result.version
    assert event.payload["target_iceberg_table"] == "iceberg.ads.orders_summary"
    assert event.payload["namespace"] == "iceberg.ads"
    assert event.payload["name"] == "orders_summary"


# ---------------------------------------------------------------------------
# Adapter register-table failure → failed result, no version bump
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_publish_handles_adapter_register_table_failure(
    adapter: MagicMock, outbox: InMemoryOutboxWriter,
) -> None:
    """register_table 5xx → result status='failed'; version unchanged; no outbox."""
    adapter.register_table = AsyncMock(
        side_effect=IcebergRestError(
            "Iceberg REST POST /v1/namespaces/iceberg.ads/register returned 503",
            status_code=503,
            response_body="Service Unavailable",
        ),
    )
    product_id = _seed_product(status="published")
    pre_version = mem.get_data_product("tenant-acme", product_id).version

    publisher = AdsPublisher(iceberg_adapter=adapter, outbox_writer=outbox)
    result = await publisher.publish("tenant-acme", product_id)

    assert result.status == "failed"
    assert result.version == pre_version  # NO version bump
    assert result.rows_published == 0

    # No outbox event was emitted on failure.
    assert outbox.all_records() == []


@pytest.mark.asyncio
async def test_publish_register_table_4xx_raises(adapter: MagicMock) -> None:
    """register_table 4xx (other than 409) → AdsPublisherError status_code=400."""
    adapter.register_table = AsyncMock(
        side_effect=IcebergRestError(
            "Iceberg REST POST /v1/namespaces/iceberg.ads/register returned 400",
            status_code=400,
        ),
    )
    product_id = _seed_product(status="published")

    publisher = AdsPublisher(iceberg_adapter=adapter)
    with pytest.raises(AdsPublisherError) as exc_info:
        await publisher.publish("tenant-acme", product_id)
    assert exc_info.value.status_code == 400


# ---------------------------------------------------------------------------
# Tenant isolation
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_publish_is_tenant_isolated(adapter: MagicMock) -> None:
    """Tenant A's product is invisible to tenant B (get_data_product is tenant-scoped)."""
    product_id = _seed_product(tenant_id="tenant-acme", status="published")

    publisher = AdsPublisher(iceberg_adapter=adapter)
    # Same product id, different tenant — should be invisible.
    with pytest.raises(AdsPublisherError) as exc_info:
        await publisher.publish("tenant-globex", product_id)
    assert exc_info.value.status_code == 404
    adapter.create_namespace.assert_not_called()
    adapter.register_table.assert_not_called()


# ---------------------------------------------------------------------------
# Malformed target_iceberg_table
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_publish_rejects_malformed_target_table(adapter: MagicMock) -> None:
    """target_iceberg_table without a dot → AdsPublisherError status_code=422."""
    product_id = _seed_product(
        status="published",
        target_iceberg_table="orders_summary",  # no namespace!
    )

    publisher = AdsPublisher(iceberg_adapter=adapter)
    with pytest.raises(AdsPublisherError) as exc_info:
        await publisher.publish("tenant-acme", product_id)
    assert exc_info.value.status_code == 422
