"""DATA-D0-D8 D6 e2e tests — retention + GDPR right-to-be-forgotten.

Verifies:
  - GDPR request marks tenant soft-deleted
  - is_tenant_soft_deleted blocks subsequent checks
  - Periodic retention cleanup deletes stale rows
  - GDPR hard-delete deletes ALL tenant rows (except audit_log)
  - find_ready_hard_deletes correctly filters by time window
  - Retention policy with retention_days=0 is a no-op
  - CleanupResult captures errors without crashing
  - Alembic 0010 schema is valid
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest

from mate_platform.auth import (
    InMemoryRetentionStore,
    RetentionPolicy,
    request_gdpr_forget,
    is_tenant_soft_deleted,
)
from mate_platform.auth.retention_cleanup import (
    CleanupResult,
    DEFAULT_BUSINESS_TABLES,
    find_ready_hard_deletes,
    run_gdpr_hard_delete,
    run_retention_cleanup,
)
from mate_platform.auth.retention import SoftDeleteRecord


@pytest.fixture
def store() -> InMemoryRetentionStore:
    return InMemoryRetentionStore()


class _MockConn:
    """Mock CleanupConnection for tests."""

    def __init__(self, table_counts: dict[str, int] | None = None) -> None:
        self._counts = table_counts or {}
        self.calls: list[tuple[str, dict[str, Any]]] = []

    def execute(self, sql: str, params: dict[str, Any] | None = None) -> int:
        self.calls.append((sql, params or {}))
        # Return the row count for the first matching table.
        for table in self._counts:
            if table in sql:
                return self._counts[table]
        return 0


class TestGDPRRequest:
    def test_gdpr_marks_tenant_soft_deleted(
        self, store: InMemoryRetentionStore
    ) -> None:
        rec = request_gdpr_forget(
            tenant_id="tenant-acme",
            requested_by="admin@metaplatform.io",
            store=store,
        )
        assert rec.tenant_id == "tenant-acme"
        assert is_tenant_soft_deleted("tenant-acme", store=store)

    def test_gdpr_hard_delete_window_in_future(
        self, store: InMemoryRetentionStore
    ) -> None:
        rec = request_gdpr_forget(
            tenant_id="t1",
            requested_by="u",
            policy=RetentionPolicy(hardDeleteAfterDays=30),
            store=store,
        )
        now = datetime.now(UTC)
        hard_delete_at = datetime.fromisoformat(rec.hard_delete_at)
        assert hard_delete_at > now + timedelta(days=29)

    def test_gdpr_empty_tenant_rejected(
        self, store: InMemoryRetentionStore
    ) -> None:
        with pytest.raises(ValueError, match="tenant_id is required"):
            request_gdpr_forget(
                tenant_id="", requested_by="u", store=store
            )

    def test_gdpr_negative_window_rejected(
        self, store: InMemoryRetentionStore
    ) -> None:
        with pytest.raises(ValueError, match="hardDeleteAfterDays"):
            request_gdpr_forget(
                tenant_id="t1",
                requested_by="u",
                policy=RetentionPolicy(hardDeleteAfterDays=-1),
                store=store,
            )


class TestRetentionCleanup:
    def test_retention_zero_days_is_noop(self) -> None:
        conn = _MockConn({"outbox_event": 5})
        result = run_retention_cleanup(
            tenant_id="t1",
            policy=RetentionPolicy(retentionDays=0),
            conn=conn,
        )
        assert result.rows_deleted == 0
        assert result.tables_processed == 0
        assert conn.calls == []

    def test_retention_deletes_old_rows(self) -> None:
        conn = _MockConn({"outbox_event": 10, "audit_log": 3})
        result = run_retention_cleanup(
            tenant_id="t1",
            policy=RetentionPolicy(retentionDays=90),
            conn=conn,
        )
        assert result.tables_processed == 2
        assert result.rows_deleted == 13
        assert result.success

    def test_retention_captures_errors(self) -> None:
        class _ErrorConn:
            def execute(self, sql: str, params: dict | None = None) -> int:
                raise RuntimeError("connection lost")

        result = run_retention_cleanup(
            tenant_id="t1",
            policy=RetentionPolicy(retentionDays=7),
            conn=_ErrorConn(),  # type: ignore[arg-type]
        )
        assert not result.success
        assert len(result.errors) > 0
        assert "connection lost" in result.errors[0]


class TestGDPRHardDelete:
    def test_hard_delete_removes_all_tenant_rows(self) -> None:
        conn = _MockConn({"outbox_event": 50, "audit_log": 5})
        result = run_gdpr_hard_delete(
            tenant_id="tenant-gone",
            conn=conn,
            tables=("outbox_event", "audit_log"),
        )
        # outbox_event deleted (50), audit_log excluded
        assert result.rows_deleted == 50
        assert result.tables_processed == 1
        assert result.mode == "gdpr_hard_delete"

    def test_hard_delete_excludes_audit_log(self) -> None:
        conn = _MockConn({"outbox_event": 10, "audit_log": 99})
        result = run_gdpr_hard_delete(
            tenant_id="t",
            conn=conn,
        )
        # audit_log must NOT appear in DELETE calls
        for sql, _ in conn.calls:
            assert "audit_log" not in sql

    def test_hard_delete_result_is_frozen(self) -> None:
        result = run_gdpr_hard_delete(
            tenant_id="t",
            conn=_MockConn({}),
        )
        with pytest.raises(Exception):
            result.rows_deleted = 999  # type: ignore[misc]


class TestFindReadyHardDeletes:
    def test_finds_expired_records(self) -> None:
        now = datetime.now(UTC)
        records = [
            SoftDeleteRecord(
                tenant_id="t-expired",
                requested_by="u",
                requested_at=(now - timedelta(days=31)).isoformat(),
                hard_delete_at=(now - timedelta(days=1)).isoformat(),
                policy=RetentionPolicy.default(),
            ),
            SoftDeleteRecord(
                tenant_id="t-pending",
                requested_by="u",
                requested_at=now.isoformat(),
                hard_delete_at=(now + timedelta(days=29)).isoformat(),
                policy=RetentionPolicy.default(),
            ),
        ]
        ready = find_ready_hard_deletes(records, now=now)
        assert len(ready) == 1
        assert ready[0].tenant_id == "t-expired"

    def test_empty_list_returns_empty(self) -> None:
        assert find_ready_hard_deletes([]) == []


class TestAlembic0010Schema:
    def test_migration_module_valid(self) -> None:
        import importlib.util
        from pathlib import Path

        migration_path = (
            Path(__file__).resolve().parents[3]
            / "alembic"
            / "versions"
            / "20260801_0010_retention.py"
        )
        assert migration_path.is_file(), "alembic 0010 file missing"
        spec = importlib.util.spec_from_file_location("m0010", migration_path)
        assert spec is not None and spec.loader is not None
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        assert mod.revision == "0010_retention"
        assert mod.down_revision == "0009_audit_log"
        assert callable(mod.upgrade)
        assert callable(mod.downgrade)
