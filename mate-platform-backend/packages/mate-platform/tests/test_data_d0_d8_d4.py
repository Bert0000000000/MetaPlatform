"""DATA-D0-D8 D4 e2e tests — OpenLineage <-> DataHub sync bridge.

Verifies the Python-side LineageSyncClient lifecycle:
  - pull_from_marquez / push_to_datahub / sync_once end-to-end
  - tenant isolation (SEC-TENANT-01 hard rule 3)
  - only COMPLETE events promoted; START / RUNNING skipped; FAIL counted
  - idempotency on runId (re-push is a no-op)
  - correlation_id propagation (D1 integration)
  - DataProduct updated in DataHub after sync (D2 integration)
  - input/output dataset refs preserved
  - empty queue -> zero SyncResult

Per ADR-0016 §3.2 (D4 scope).
"""
from __future__ import annotations

import pytest

from mate_platform.datahub import InMemoryDataHubClient
from mate_platform.lineage_sync import (
    DatasetRef,
    InMemoryLineageSyncClient,
    OpenLineageEvent,
    SyncResult,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture
def bridge() -> InMemoryLineageSyncClient:
    return InMemoryLineageSyncClient()


@pytest.fixture
def bridge_with_datahub() -> tuple[InMemoryLineageSyncClient, InMemoryDataHubClient]:
    dh = InMemoryDataHubClient()
    return InMemoryLineageSyncClient(datahub=dh), dh


def _make_event(
    *,
    tenant_id: str = "tenant-acme",
    event_type: str = "COMPLETE",
    run_id: str = "run-1",
    job: str = "iam.user.cdc",
    correlation_id: str = "trace-abc",
    inputs: tuple[DatasetRef, ...] = (
        DatasetRef(name="iam.user", namespace="metaplatform.tenant-acme", tenant_id="tenant-acme"),
    ),
    outputs: tuple[DatasetRef, ...] = (
        DatasetRef(name="iam.user.processed", namespace="metaplatform.tenant-acme", tenant_id="tenant-acme"),
    ),
) -> OpenLineageEvent:
    return OpenLineageEvent(
        eventType=event_type,  # type: ignore[arg-type]
        runId=run_id,
        jobName=job,
        inputs=inputs,
        outputs=outputs,
        tenant_id=tenant_id,
        correlation_id=correlation_id,
    )


# ---------------------------------------------------------------------------
# Sync lifecycle
# ---------------------------------------------------------------------------
class TestSyncPullsAndPushes:
    def test_sync_pulls_from_lineage_and_pushes_to_datahub(
        self, bridge: InMemoryLineageSyncClient
    ) -> None:
        bridge.enqueue(_make_event(run_id="r1"))
        bridge.enqueue(_make_event(run_id="r2"))
        result = bridge.sync_once("tenant-acme")
        assert result.pulled == 2
        assert result.pushed == 2
        assert result.failed == 0
        assert result.tenant_id == "tenant-acme"

    def test_sync_once_returns_sync_result(
        self, bridge: InMemoryLineageSyncClient
    ) -> None:
        bridge.enqueue(_make_event())
        result = bridge.sync_once("tenant-acme")
        assert isinstance(result, SyncResult)
        assert result.pulled == 1
        assert result.pushed == 1


class TestTenantIsolation:
    def test_tenant_isolation_tenant_a_events_not_synced_by_tenant_b(
        self, bridge: InMemoryLineageSyncClient
    ) -> None:
        bridge.enqueue(_make_event(tenant_id="tenant-acme", run_id="r-a1"))
        bridge.enqueue(_make_event(tenant_id="tenant-globex", run_id="r-b1"))
        # Tenant B syncs — must only see its own events.
        result_b = bridge.sync_once("tenant-globex")
        assert result_b.pulled == 1
        assert result_b.tenant_id == "tenant-globex"
        # Tenant A's queue is untouched.
        assert len(bridge.list_pending("tenant-acme")) == 1
        # Tenant A syncs separately.
        result_a = bridge.sync_once("tenant-acme")
        assert result_a.pulled == 1
        assert result_a.tenant_id == "tenant-acme"

    def test_tenant_isolation_push_rejects_foreign_tenant_event(
        self, bridge: InMemoryLineageSyncClient
    ) -> None:
        foreign = _make_event(tenant_id="tenant-globex", run_id="r-x")
        pushed, failed = bridge.push_to_datahub("tenant-acme", [foreign])
        assert pushed == 0
        assert failed == 1  # counted as failed (cross-tenant)


class TestEventTypeFiltering:
    def test_only_complete_events_synced(
        self, bridge: InMemoryLineageSyncClient
    ) -> None:
        bridge.enqueue(_make_event(event_type="START", run_id="s1"))
        bridge.enqueue(_make_event(event_type="RUNNING", run_id="s2"))
        bridge.enqueue(_make_event(event_type="COMPLETE", run_id="c1"))
        result = bridge.sync_once("tenant-acme")
        # START + RUNNING skipped; only COMPLETE promoted.
        assert result.pulled == 3
        assert result.pushed == 1
        assert result.failed == 0

    def test_failed_events_counted_but_not_pushed(
        self, bridge: InMemoryLineageSyncClient
    ) -> None:
        bridge.enqueue(_make_event(event_type="FAIL", run_id="f1"))
        bridge.enqueue(_make_event(event_type="COMPLETE", run_id="c1"))
        result = bridge.sync_once("tenant-acme")
        assert result.pushed == 1
        assert result.failed == 1


class TestEdgeCases:
    def test_empty_queue_sync_zero(
        self, bridge: InMemoryLineageSyncClient
    ) -> None:
        result = bridge.sync_once("tenant-acme")
        assert result.pulled == 0
        assert result.pushed == 0
        assert result.failed == 0


class TestEventPayload:
    def test_lineage_event_carries_tenant_id(
        self, bridge: InMemoryLineageSyncClient
    ) -> None:
        event = _make_event(tenant_id="tenant-acme")
        bridge.enqueue(event)
        pulled = bridge.list_pending("tenant-acme")
        assert len(pulled) == 1
        assert pulled[0].tenant_id == "tenant-acme"

    def test_empty_tenant_id_rejected_at_construction(self) -> None:
        with pytest.raises(ValueError, match="tenant_id is required"):
            OpenLineageEvent(
                eventType="COMPLETE",
                runId="r1",
                jobName="x",
                tenant_id="",
            )

    def test_input_output_dataset_refs_preserved(
        self, bridge: InMemoryLineageSyncClient
    ) -> None:
        inputs = (
            DatasetRef(name="src.table", namespace="ns.src", tenant_id="tenant-acme"),
        )
        outputs = (
            DatasetRef(name="dst.view", namespace="ns.dst", tenant_id="tenant-acme"),
        )
        event = _make_event(run_id="r-io", inputs=inputs, outputs=outputs)
        bridge.enqueue(event)
        pulled = bridge.pull_from_marquez("tenant-acme")
        assert len(pulled) == 1
        assert pulled[0].inputs == inputs
        assert pulled[0].outputs == outputs


class TestD1D2Integration:
    def test_correlation_id_propagated(
        self, bridge: InMemoryLineageSyncClient
    ) -> None:
        # D1 integration: the correlation_id from the lineage event
        # survives the pull and is present on every pulled event so the
        # bridge can tie the catalog entry back to the OTel trace.
        bridge.enqueue(_make_event(correlation_id="trace-xyz", run_id="r-cid"))
        pulled = bridge.pull_from_marquez("tenant-acme")
        assert len(pulled) == 1
        assert pulled[0].correlation_id == "trace-xyz"

    def test_datahub_data_product_updated_after_sync(
        self,
        bridge_with_datahub: tuple[InMemoryLineageSyncClient, InMemoryDataHubClient],
    ) -> None:
        bridge, dh = bridge_with_datahub
        bridge.enqueue(_make_event(job="iam.user.cdc", correlation_id="trace-d2"))
        bridge.sync_once("tenant-acme")
        # The D2 DataProduct should now exist in the catalog, carrying
        # the lineage hints (correlation_id) from the D1 event.
        product = dh.get("tenant-acme", "iam.user.cdc")
        assert product.tenant_id == "tenant-acme"
        assert product.lineage_hints is not None
        assert product.lineage_hints.correlation_id == "trace-d2"
        assert product.lineage_hints.source_system == "marquez"
        assert product.lineage_hints.target_system == "datahub"
        # Output datasets promoted.
        assert len(product.datasets) == 1
        assert product.datasets[0].name == "iam.user.processed"


class TestIdempotency:
    def test_sync_idempotent_same_runid_not_duplicated(
        self,
        bridge_with_datahub: tuple[InMemoryLineageSyncClient, InMemoryDataHubClient],
    ) -> None:
        bridge, _dh = bridge_with_datahub
        event = _make_event(run_id="r-idem")
        # First push — promoted.
        pushed1, _ = bridge.push_to_datahub("tenant-acme", [event])
        assert pushed1 == 1
        # Second push of the same runId — no-op.
        pushed2, _ = bridge.push_to_datahub("tenant-acme", [event])
        assert pushed2 == 0
        # Ledger records exactly one runId.
        assert bridge.pushed_run_ids("tenant-acme") == ("r-idem",)
