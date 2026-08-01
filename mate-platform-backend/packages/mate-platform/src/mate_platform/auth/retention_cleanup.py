"""DATA-D6 retention cleanup executor.

Implements the periodic cleanup + GDPR hard-delete execution that
operates on top of the ``retention_policy`` and ``gdpr_soft_delete``
tables (Alembic 0010).

Two modes:
  1. **Periodic retention cleanup**: for tenants with
     ``retention_days > 0``, delete rows older than the retention
     window from a configurable table list.
  2. **GDPR hard-delete**: when a soft-delete record's
     ``hard_delete_at`` has passed, delete ALL rows for that
     ``tenant_id`` across all business tables and mark the record
     as ``executed``.

Design:
  - The executor is a **pure function** that receives a table list
    + a connection-like object; it does not import SQLAlchemy
    engine directly (testability + dialect-agnostic).
  - In production, a CronJob / Airflow DAG calls
    ``run_retention_cleanup`` + ``run_gdpr_hard_deletes`` on a
    schedule (default: daily at 02:00).
  - Per SEC-TENANT-01: the executor only touches rows matching
    the target ``tenant_id``; it never deletes across tenants.

Per ADR-0016 §3.3 D6.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Protocol

from .retention import RetentionPolicy, SoftDeleteRecord

logger = logging.getLogger("metaplatform.retention.cleanup")


@dataclass(frozen=True, slots=True)
class CleanupResult:
    """Result of a single cleanup run."""

    tenant_id: str
    mode: str  # "retention" | "gdpr_hard_delete"
    tables_processed: int
    rows_deleted: int
    errors: tuple[str, ...] = field(default_factory=tuple)
    executed_at: str = field(
        default_factory=lambda: datetime.now(UTC).isoformat()
    )

    @property
    def success(self) -> bool:
        return len(self.errors) == 0


class CleanupConnection(Protocol):
    """Minimal DB connection protocol for the cleanup executor.

    Production wires a SQLAlchemy connection; tests use a mock.
    """

    def execute(self, sql: str, params: dict[str, Any] | None = None) -> int:
        """Execute a DML statement; return rows affected."""
        ...


# Default business tables that carry tenant_id (Alembic 0001-0008).
DEFAULT_BUSINESS_TABLES: tuple[str, ...] = (
    "outbox_event",
    "audit_log",
)


def run_retention_cleanup(
    *,
    tenant_id: str,
    policy: RetentionPolicy,
    conn: CleanupConnection,
    tables: tuple[str, ...] = DEFAULT_BUSINESS_TABLES,
    now: datetime | None = None,
) -> CleanupResult:
    """Periodic retention cleanup for one tenant.

    Deletes rows older than ``policy.retention_days`` from the
    specified tables. If ``retention_days == 0``, no-op (forever).
    """
    if policy.retentionDays <= 0:
        return CleanupResult(
            tenant_id=tenant_id,
            mode="retention",
            tables_processed=0,
            rows_deleted=0,
        )

    cutoff = (now or datetime.now(UTC)).timestamp() - (
        policy.retentionDays * 86400
    )
    cutoff_str = datetime.fromtimestamp(cutoff, tz=UTC).isoformat()

    total_deleted = 0
    tables_done = 0
    errors: list[str] = []

    for table in tables:
        try:
            # Parameterized DELETE: only tenant + older than cutoff.
            # The created_at column name is consistent across all
            # Alembic 0001-0008 business tables.
            n = conn.execute(
                f"DELETE FROM {table} "
                "WHERE tenant_id = :tenant_id "
                "AND created_at < :cutoff",
                {"tenant_id": tenant_id, "cutoff": cutoff_str},
            )
            total_deleted += n
            tables_done += 1
        except Exception as exc:
            errors.append(f"{table}: {exc}")

    return CleanupResult(
        tenant_id=tenant_id,
        mode="retention",
        tables_processed=tables_done,
        rows_deleted=total_deleted,
        errors=tuple(errors),
    )


def run_gdpr_hard_delete(
    *,
    tenant_id: str,
    conn: CleanupConnection,
    tables: tuple[str, ...] = DEFAULT_BUSINESS_TABLES,
) -> CleanupResult:
    """GDPR right-to-be-forgotten: hard-delete ALL rows for a tenant.

    This is irreversible. Called by the background job when the
    soft-delete window expires.

    Per ADR-0012: the tenant's data is removed from every business
    table. The audit_log is preserved (security team needs the
    trail of who requested deletion and when).
    """
    # audit_log is excluded from GDPR hard-delete — the security
    # team needs the audit trail even after the tenant is gone.
    gdpr_tables = tuple(t for t in tables if t != "audit_log")

    total_deleted = 0
    tables_done = 0
    errors: list[str] = []

    for table in gdpr_tables:
        try:
            n = conn.execute(
                f"DELETE FROM {table} WHERE tenant_id = :tenant_id",
                {"tenant_id": tenant_id},
            )
            total_deleted += n
            tables_done += 1
        except Exception as exc:
            errors.append(f"{table}: {exc}")

    logger.info(
        "retention.gdpr_hard_delete.executed",
        extra={
            "tenant_id": tenant_id,
            "tables_processed": tables_done,
            "rows_deleted": total_deleted,
            "errors": list(errors),
        },
    )

    return CleanupResult(
        tenant_id=tenant_id,
        mode="gdpr_hard_delete",
        tables_processed=tables_done,
        rows_deleted=total_deleted,
        errors=tuple(errors),
    )


def find_ready_hard_deletes(
    records: list[SoftDeleteRecord],
    now: datetime | None = None,
) -> list[SoftDeleteRecord]:
    """Return soft-delete records whose hard-delete window has passed.

    Pure function; the caller queries ``gdpr_soft_delete`` table
    to get the records, then passes them here for filtering.
    """
    current = now or datetime.now(UTC)
    ready: list[SoftDeleteRecord] = []
    for rec in records:
        try:
            hard_delete_at = datetime.fromisoformat(rec.hard_delete_at)
        except (ValueError, TypeError):
            continue
        if hard_delete_at <= current:
            ready.append(rec)
    return ready
