"""Tenant-level retention + GDPR right-to-be-forgotten (DATA-D0-D8 D6).

Per ADR-0016 D6: every tenant has a configurable retention policy
that drives periodic cleanup of stale data, plus a one-shot
GDPR right-to-be-forgotten workflow that:
  1. Marks the tenant_id for soft-delete (no new writes).
  2. Schedules a hard-delete job N days later (default 30).
  3. Emits an audit event so the security team can review.

The hard-delete is eventually consistent: it's the calling
service's responsibility to perform the actual row deletion in
the business tables, using the tenant_id we record here.
"""
from __future__ import annotations

import logging
import threading
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from enum import Enum
from typing import Any, Protocol

logger = logging.getLogger("metaplatform.retention")


class RetentionAction(str, Enum):
    HARD_DELETE = "hard_delete"
    SOFT_DELETE = "soft_delete"
    ANONYMIZE = "anonymize"


@dataclass(frozen=True, slots=True)
class RetentionPolicy:
    """Per-tenant retention configuration.

    hardDeleteAfterDays: how long until data is hard-deleted
                          after a soft-delete (GDPR window).
    retentionDays:        how long data lives before the periodic
                          cleanup; 0 = forever.
    """

    hardDeleteAfterDays: int = 30
    retentionDays: int = 0  # 0 = forever

    @classmethod
    def default(cls) -> RetentionPolicy:
        return cls(hardDeleteAfterDays=30, retentionDays=0)


@dataclass(frozen=True, slots=True)
class SoftDeleteRecord:
    """Audit-friendly record of a soft-delete request.

    Carries the timestamp + the policy used so a background
    job can later perform the hard-delete.
    """

    tenant_id: str
    requested_by: str
    requested_at: str
    hard_delete_at: str
    policy: RetentionPolicy
    record_id: str = field(default_factory=lambda: str(uuid.uuid4()))

    def to_dict(self) -> dict[str, Any]:
        return {
            "record_id": self.record_id,
            "tenant_id": self.tenant_id,
            "requested_by": self.requested_by,
            "requested_at": self.requested_at,
            "hard_delete_at": self.hard_delete_at,
            "policy": {
                "hardDeleteAfterDays": self.policy.hardDeleteAfterDays,
                "retentionDays": self.policy.retentionDays,
            },
        }


class RetentionStore(Protocol):
    def record(self, rec: SoftDeleteRecord) -> None: ...
    def list_pending(self) -> list[SoftDeleteRecord]: ...
    def is_soft_deleted(self, tenant_id: str) -> bool: ...


class InMemoryRetentionStore:
    """In-memory store; the production version writes to PG.

    In D6 the storage is opaque — only the workflow contract
    matters here; the real implementation is in the schema
    migration that lands in the next batch.
    """

    def __init__(self) -> None:
        self._records: dict[str, SoftDeleteRecord] = {}
        self._lock = threading.Lock()

    def record(self, rec: SoftDeleteRecord) -> None:
        with self._lock:
            self._records[rec.tenant_id] = rec

    def list_pending(self) -> list[SoftDeleteRecord]:
        with self._lock:
            return [r for r in self._records.values() if r.hard_delete_at > datetime.now(UTC).isoformat()]

    def is_soft_deleted(self, tenant_id: str) -> bool:
        with self._lock:
            return tenant_id in self._records


def request_gdpr_forget(
    *,
    tenant_id: str,
    requested_by: str,
    policy: RetentionPolicy | None = None,
    store: RetentionStore | None = None,
) -> SoftDeleteRecord:
    """GDPR right-to-be-forgotten workflow.

    Marks the tenant for soft-delete and schedules a hard-delete
    `hardDeleteAfterDays` later. The business tables are NOT
    touched here — the calling service (or a background job in
    D6's schema migration) does the actual deletion.
    """
    if not tenant_id:
        raise ValueError("tenant_id is required")
    p = policy or RetentionPolicy.default()
    if p.hardDeleteAfterDays < 0:
        raise ValueError("hardDeleteAfterDays must be >= 0")
    now = datetime.now(UTC)
    hard_delete_at = (now + timedelta(days=p.hardDeleteAfterDays)).isoformat()
    rec = SoftDeleteRecord(
        tenant_id=tenant_id,
        requested_by=requested_by,
        requested_at=now.isoformat(),
        hard_delete_at=hard_delete_at,
        policy=p,
    )
    s = store or InMemoryRetentionStore()
    s.record(rec)
    logger.info(
        "retention.gdpr_forget.requested",
        extra=rec.to_dict(),
    )
    return rec


def is_tenant_soft_deleted(
    tenant_id: str,
    store: RetentionStore | None = None,
) -> bool:
    """Check whether a tenant is currently soft-deleted.

    Per ADR-0012 + SEC-TENANT-01: this is the gate the business
    handlers check before accepting new writes for the tenant.
    """
    s = store or InMemoryRetentionStore()
    return s.is_soft_deleted(tenant_id)
