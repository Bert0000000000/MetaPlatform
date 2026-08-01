"""Public API for mate_platform.lineage_sync (DATA-D4).

OpenLineage <-> DataHub sync bridge. Pulls completed lineage events
from the Marquez graph (D1) and pushes dataset-level lineage
relationships into the DataHub catalog (D2).

Per ADR-0016 §3.2 (D4 scope).
"""
from .client import (
    DatasetRef,
    EventType,
    InMemoryLineageSyncClient,
    LineageSyncClient,
    OpenLineageEvent,
    SyncResult,
)

__all__ = [
    "DatasetRef",
    "EventType",
    "InMemoryLineageSyncClient",
    "LineageSyncClient",
    "OpenLineageEvent",
    "SyncResult",
]
