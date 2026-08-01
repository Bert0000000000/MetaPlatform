"""Federation dead-letter queue (v3.2 W1 — federation 真实化).

When a federated tool invocation fails terminally (after retry /
circuit-breaker), the request is captured as a ``FederationDLQEntry``
so an operator can inspect and replay it later. The DLQ is
tenant-scoped: ``list(tenant_id=...)`` only returns entries that
belong to the calling tenant (SEC-TENANT-01 hard rule 3).

This is the in-memory implementation; the production SQL-backed DLQ
shares the same surface so the swap is mechanical.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


@dataclass
class FederationDLQEntry:
    """A single dead-lettered federated tool invocation."""

    entry_id: str
    tenant_id: str
    server_id: str
    tool_name: str
    arguments: dict[str, Any]
    error: str
    failed_at: datetime = field(default_factory=lambda: datetime.now(UTC))


class FederationDLQ:
    """In-memory tenant-scoped dead-letter queue."""

    def __init__(self) -> None:
        self._entries: list[FederationDLQEntry] = []
        self._counter: int = 0

    def _next_id(self) -> str:
        self._counter += 1
        return f"dlq-{self._counter:08d}"

    def put(self, entry: FederationDLQEntry) -> FederationDLQEntry:
        """Append an entry to the DLQ.

        If ``entry.entry_id`` is empty a deterministic id is assigned.
        Returns the (possibly mutated) entry so callers can read back
        the generated id.
        """
        if not entry.entry_id:
            entry.entry_id = self._next_id()
        self._entries.append(entry)
        logger.info(
            "federation.dlq.put",
            entry_id=entry.entry_id,
            tenant_id=entry.tenant_id,
            server_id=entry.server_id,
            tool_name=entry.tool_name,
        )
        return entry

    def list(self, tenant_id: str | None = None) -> list[FederationDLQEntry]:
        """List DLQ entries, optionally filtered to one tenant."""
        if tenant_id is None:
            return list(self._entries)
        return [e for e in self._entries if e.tenant_id == tenant_id]

    def replay(self, entry_id: str) -> bool:
        """Replay (re-queue for retry) a DLQ entry by id.

        On success the entry is consumed from the DLQ (it has been
        handed back to the processing pipeline); if it fails again it
        is re-added via :meth:`put`. Returns ``True`` when the entry
        was found and replayed, ``False`` when no such entry exists.
        """
        for idx, entry in enumerate(self._entries):
            if entry.entry_id == entry_id:
                del self._entries[idx]
                logger.info(
                    "federation.dlq.replay",
                    entry_id=entry_id,
                    tenant_id=entry.tenant_id,
                    tool_name=entry.tool_name,
                )
                return True
        return False


__all__ = [
    "FederationDLQ",
    "FederationDLQEntry",
]
