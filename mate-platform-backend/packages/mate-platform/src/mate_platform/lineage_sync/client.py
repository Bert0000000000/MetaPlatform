"""DATA-D0-D8 D4 — OpenLineage <-> DataHub sync bridge.

This module bridges the two halves of the data platform built by D1
and D2:

  - **D1** emits lineage events into Marquez (OpenLineage wire format).
    Each event is tenant-scoped and carries a ``correlation_id`` so the
    cross-domain chain can be stitched.
  - **D2** models DataProducts in DataHub. A DataProduct carries a
    ``lineage_hints`` reference back to the Marquez job.

D4 closes the loop: it pulls completed OpenLineage events from the
lineage graph (Marquez) and pushes the resulting dataset-level lineage
relationships into the DataHub catalog so the catalog's lineage view
stays in sync with the runtime lineage graph.

Design (per ADR-0016 §3.2 D4):

  - ``OpenLineageEvent`` — the canonical event shape consumed by the
    bridge. Only ``COMPLETE`` (and ``FAIL`` for accounting) events are
    promoted; ``START`` / ``RUNNING`` are transitional and skipped.
  - ``LineageSyncClient`` Protocol — the four-method surface
    (``pull_from_marquez`` / ``push_to_datahub`` / ``sync_once`` /
    ``list_pending``).
  - ``InMemoryLineageSyncClient`` — single-process implementation used
    by tests and local dev; production swaps in the HTTP bridge pod
    (``infra/helm/charts/datahub`` ``lineage.bridge`` values).

Tenant isolation (SEC-TENANT-01 hard rule 3):

  - The pending event queue is partitioned by ``tenant_id``; a tenant
    can never pull another tenant's events.
  - ``push_to_datahub`` re-asserts the tenant on every event before it
    touches the DataHub client.
  - Idempotency: each event has a stable ``runId``; re-pushing the same
    ``runId`` is a no-op (returns 0 pushed) rather than a duplicate.
"""
from __future__ import annotations

import threading
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Literal, Protocol

from ..datahub import DataHubClient, DataProduct, Dataset
from ..lineage import LineageHints

# OpenLineage event types (subset of the spec relevant to the bridge).
EventType = Literal["START", "RUNNING", "COMPLETE", "FAIL"]

# Only COMPLETE events produce stable lineage relationships worth
# promoting to the catalog. FAIL events are counted (for observability)
# but not pushed. START / RUNNING are purely transitional.
_PUSHABLE_TYPES: frozenset[str] = frozenset({"COMPLETE"})


@dataclass(frozen=True, slots=True)
class DatasetRef:
    """A dataset reference on one end of a lineage edge.

    Mirrors the OpenLineage ``InputDataset`` / ``OutputDataset`` name +
    namespace shape, keeping the tenant in the namespace so the
    reference is self-describing.
    """

    name: str
    namespace: str
    tenant_id: str

    def __post_init__(self) -> None:
        if not self.tenant_id:
            raise ValueError(
                "DatasetRef.tenant_id is required (SEC-TENANT-01 hard rule 3)"
            )


@dataclass(frozen=True, slots=True)
class OpenLineageEvent:
    """One event pulled from the Marquez / OpenLineage graph.

    Attributes:
        eventType:  START | RUNNING | COMPLETE | FAIL.
        runId:      Stable run identifier — used as the idempotency key
                    so the same event is never pushed twice.
        jobName:    The OpenLineage job name (e.g. ``iam.user.cdc``).
        inputs:     Input dataset references.
        outputs:    Output dataset references.
        tenant_id:  The tenant boundary this event lives in.
        correlation_id: The cross-domain correlation id (D1). Propagated
                    into the DataHub lineage relationship so catalog
                    lineage ties back to the OTel trace.
    """

    eventType: EventType
    runId: str
    jobName: str
    inputs: tuple[DatasetRef, ...] = field(default_factory=tuple)
    outputs: tuple[DatasetRef, ...] = field(default_factory=tuple)
    tenant_id: str = ""
    correlation_id: str = ""

    def __post_init__(self) -> None:
        if not self.tenant_id:
            raise ValueError(
                "OpenLineageEvent.tenant_id is required (SEC-TENANT-01 hard rule 3)"
            )
        if not self.runId:
            raise ValueError("OpenLineageEvent.runId must not be empty")


@dataclass(frozen=True, slots=True)
class SyncResult:
    """Outcome of a single ``sync_once`` pass for one tenant."""

    tenant_id: str
    pulled: int = 0
    pushed: int = 0
    failed: int = 0
    errors: tuple[str, ...] = field(default_factory=tuple)


class LineageSyncClient(Protocol):
    """OpenLineage <-> DataHub sync bridge surface (D4)."""

    def pull_from_marquez(
        self, tenant_id: str, since: str | None = None
    ) -> list[OpenLineageEvent]:
        """Pull pending lineage events for *one* tenant from Marquez.

        ``since`` is an opaque cursor (e.g. ISO-8601 timestamp or
        Marquez ``after`` marker). Implementations MUST only return
        events whose ``tenant_id`` matches the request — cross-tenant
        pulls are not allowed (SEC-TENANT-01 hard rule 3).
        """
        ...

    def push_to_datahub(
        self, tenant_id: str, events: list[OpenLineageEvent]
    ) -> tuple[int, int]:
        """Push lineage relationships into the DataHub catalog.

        Returns ``(pushed, failed)``. Only ``COMPLETE`` events are
        promoted; ``FAIL`` events are counted as ``failed`` (for
        observability) but not written. ``START`` / ``RUNNING`` events
        are skipped entirely. Idempotent on ``runId``.
        """
        ...

    def sync_once(self, tenant_id: str) -> SyncResult:
        """End-to-end sync for one tenant: pull then push."""
        ...

    def list_pending(self, tenant_id: str) -> list[OpenLineageEvent]:
        """Return the events still pending sync for a tenant.

        Used by the batch scheduler and by tests to assert queue depth
        without mutating state.
        """
        ...


def _lineage_hints_for(event: OpenLineageEvent) -> LineageHints:
    """Build the ``LineageHints`` that ties the catalog entry to D1."""
    return LineageHints(
        tenant_id=event.tenant_id,
        correlation_id=event.correlation_id or event.runId,
        source_system="marquez",
        target_system="datahub",
        job_name=event.jobName,
    )


def _datasets_from_refs(refs: tuple[DatasetRef, ...]) -> tuple[Dataset, ...]:
    """Convert OpenLineage dataset refs to D2 ``Dataset`` objects."""
    return tuple(
        Dataset(name=r.name, type="table", schema_ref=r.namespace)
        for r in refs
    )


class InMemoryLineageSyncClient:
    """In-process ``LineageSyncClient`` implementation.

    Maintains a per-tenant FIFO queue of pending events plus a set of
    already-pushed ``runId``s for idempotency. Thread-safe via a single
    lock.

    Production note: the real bridge runs as a sidecar polling Marquez'
    ``/api/v1`` and writing MCE (MetadataChangeEvent) documents to
    DataHub GMS. The wire shape is identical to what this in-memory
    client accepts; only the transport differs.
    """

    def __init__(
        self,
        *,
        datahub: DataHubClient | None = None,
    ) -> None:
        self._lock = threading.Lock()
        # tenant_id -> [OpenLineageEvent]  (pending queue)
        self._pending: dict[str, list[OpenLineageEvent]] = defaultdict(list)
        # tenant_id -> set[runId]  (idempotency ledger)
        self._pushed: dict[str, set[str]] = defaultdict(set)
        # DataHub client used by push_to_datahub. When None the push is
        # recorded (idempotency ledger + returned count) but no
        # DataProduct is written; tests that assert D2 integration pass
        # a real InMemoryDataHubClient.
        self._datahub = datahub

    # ------------------------------------------------------------------
    # Queue ingestion (test / producer helpers)
    # ------------------------------------------------------------------
    def enqueue(self, event: OpenLineageEvent) -> None:
        """Add an event to the tenant's pending queue.

        Used by tests to seed the bridge. In production events arrive
        via ``pull_from_marquez`` polling.
        """
        if not event.tenant_id:
            raise ValueError(
                "enqueue: event.tenant_id is required (SEC-TENANT-01 hard rule 3)"
            )
        with self._lock:
            self._pending[event.tenant_id].append(event)

    # ------------------------------------------------------------------
    # LineageSyncClient surface
    # ------------------------------------------------------------------
    def pull_from_marquez(
        self, tenant_id: str, since: str | None = None
    ) -> list[OpenLineageEvent]:
        if not tenant_id:
            raise ValueError(
                "pull_from_marquez: tenant_id is required (SEC-TENANT-01 hard rule 3)"
            )
        with self._lock:
            # Return a copy so callers cannot mutate the queue.
            pending = list(self._pending.get(tenant_id, ()))
        # ``since`` is accepted for API compatibility; the in-memory
        # queue is always "everything not yet drained by sync_once".
        _ = since
        return pending

    def push_to_datahub(
        self, tenant_id: str, events: list[OpenLineageEvent]
    ) -> tuple[int, int]:
        if not tenant_id:
            raise ValueError(
                "push_to_datahub: tenant_id is required (SEC-TENANT-01 hard rule 3)"
            )
        pushed = 0
        failed = 0
        with self._lock:
            ledger = self._pushed[tenant_id]
            for event in events:
                # Tenant re-assertion: never let a foreign-tenant event
                # sneak into another tenant's catalog.
                if event.tenant_id != tenant_id:
                    failed += 1
                    continue
                # Idempotency: a runId already promoted is a no-op.
                if event.runId in ledger:
                    continue
                # Only COMPLETE events become catalog lineage.
                if event.eventType not in _PUSHABLE_TYPES:
                    if event.eventType == "FAIL":
                        failed += 1
                    # START / RUNNING are transitional — neither pushed
                    # nor counted as failed.
                    continue
                # Write the DataProduct (when a D2 client is wired).
                if self._datahub is not None:
                    self._write_data_product(tenant_id, event)
                ledger.add(event.runId)
                pushed += 1
        return pushed, failed

    def sync_once(self, tenant_id: str) -> SyncResult:
        if not tenant_id:
            raise ValueError(
                "sync_once: tenant_id is required (SEC-TENANT-01 hard rule 3)"
            )
        events = self.pull_from_marquez(tenant_id)
        pushed, failed = self.push_to_datahub(tenant_id, events)
        # Drain the tenant's queue after a successful pass.
        with self._lock:
            self._pending.pop(tenant_id, None)
        return SyncResult(
            tenant_id=tenant_id,
            pulled=len(events),
            pushed=pushed,
            failed=failed,
        )

    def list_pending(self, tenant_id: str) -> list[OpenLineageEvent]:
        if not tenant_id:
            raise ValueError(
                "list_pending: tenant_id is required (SEC-TENANT-01 hard rule 3)"
            )
        with self._lock:
            return list(self._pending.get(tenant_id, ()))

    # ------------------------------------------------------------------
    # D2 integration
    # ------------------------------------------------------------------
    def _write_data_product(
        self, tenant_id: str, event: OpenLineageEvent
    ) -> None:
        """Promote one COMPLETE event into a DataHub DataProduct.

        The DataProduct id is derived from the job name so repeated
        runs of the same job upgrade the same catalog entry (semver
        bump is the caller's responsibility; here we write ``1.0.0``
        which is idempotent on (tenant, id, version) thanks to D2's
        register semantics).
        """
        if self._datahub is None:
            return
        hints = _lineage_hints_for(event)
        datasets = _datasets_from_refs(event.outputs or event.inputs)
        product = DataProduct(
            id=event.jobName,
            tenant_id=tenant_id,
            domain=event.jobName.split(".", 1)[0] if "." in event.jobName else "data",
            owner="lineage-bridge@metaplatform.local",
            version="1.0.0",
            description=f"Auto-synced from OpenLineage run {event.runId}.",
            datasets=datasets,
            lineage_hints=hints,
        )
        self._datahub.register(product)

    # ------------------------------------------------------------------
    # Test helpers — DO NOT call from production code
    # ------------------------------------------------------------------
    def pushed_run_ids(self, tenant_id: str) -> tuple[str, ...]:
        """Return the runIds already promoted for a tenant."""
        with self._lock:
            return tuple(sorted(self._pushed.get(tenant_id, set())))

    def reset(self) -> None:
        with self._lock:
            self._pending.clear()
            self._pushed.clear()
