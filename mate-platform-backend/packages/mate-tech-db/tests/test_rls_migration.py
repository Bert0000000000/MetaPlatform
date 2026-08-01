"""Tests for Alembic migration 0008_tenant_rls (G6 — DB-layer RLS).

RLS is a PostgreSQL-only feature. Since the dev / CI environment runs
SQLite, these tests verify the **structure of emitted DDL** by running
the migration's ``upgrade()`` against a mocked ``alembic.op`` whose
bind dialect is configured as ``postgresql``. ``op.execute`` calls are
captured and their SQL strings asserted.

A separate test verifies that on SQLite the migration is a safe no-op
(early return, zero DDL emitted).
"""
from __future__ import annotations

import importlib.util
from pathlib import Path
from unittest.mock import MagicMock

import pytest

# mate-platform-backend/ root (parents: tests/ → mate-tech-db/ → packages/ → backend/)
_BACKEND_ROOT = Path(__file__).resolve().parents[3]
_MIGRATION_FILE = _BACKEND_ROOT / "alembic" / "versions" / "20260801_0008_tenant_rls.py"


def _load_migration_module():
    """Dynamically import the migration file as an isolated module."""
    spec = importlib.util.spec_from_file_location("migration_0008_rls", _MIGRATION_FILE)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _run_upgrade_pg() -> list[str]:
    """Execute upgrade() with a mocked PG ``op``; return captured SQL list."""
    mod = _load_migration_module()
    mock_op = MagicMock()
    mock_op.get_bind.return_value.dialect.name = "postgresql"
    mock_op.get_bind.return_value.engine.url.database = "testdb"
    sqls: list[str] = []
    mock_op.execute.side_effect = lambda sql, *a, **kw: sqls.append(str(sql))
    mod.op = mock_op  # type: ignore[attr-defined]
    mod.upgrade()
    return sqls


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_rls_enabled_on_outbox_event():
    """outbox_event gets ENABLE ROW LEVEL SECURITY."""
    sqls = _run_upgrade_pg()
    assert any(
        "ALTER TABLE outbox_event ENABLE ROW LEVEL SECURITY" in s for s in sqls
    ), "outbox_event missing ENABLE RLS"


def test_rls_forced_owner_cannot_bypass():
    """FORCE ROW LEVEL SECURITY is emitted for *every* tenant table so the
    table owner (migration role) is also subject to the policy."""
    mod = _load_migration_module()
    sqls = _run_upgrade_pg()
    TENANT_TABLES = mod.TENANT_TABLES

    forced = {
        s.split("ALTER TABLE ", 1)[1].split(" ", 1)[0]
        for s in sqls
        if "FORCE ROW LEVEL SECURITY" in s
    }
    for table in TENANT_TABLES:
        assert table in forced, f"{table} missing FORCE ROW LEVEL SECURITY"


def test_rls_cross_tenant_blocked():
    """Every policy uses current_setting('app.tenant_id') as the predicate,
    ensuring a session can only see rows for its own tenant."""
    sqls = _run_upgrade_pg()
    policy_sqls = [s for s in sqls if "CREATE POLICY tenant_isolation" in s]
    assert len(policy_sqls) > 0
    for s in policy_sqls:
        assert "current_setting('app.tenant_id')::text" in s, (
            "policy missing current_setting predicate"
        )
        # WITH CHECK prevents INSERT of cross-tenant rows
        assert "WITH CHECK" in s, "policy missing WITH CHECK clause"


def test_rls_set_tenant_id_session_function():
    """ALTER DATABASE ... SET app.tenant_id = '' provides a safe default so
    current_setting never raises (empty → deny-by-default)."""
    sqls = _run_upgrade_pg()
    alter_db = [s for s in sqls if "ALTER DATABASE" in s and "app.tenant_id" in s]
    assert len(alter_db) == 1
    assert "''" in alter_db[0] or "''" in alter_db[0].replace("\\'", "'")
    assert "testdb" in alter_db[0]


def test_rls_disabled_in_sqlite():
    """On SQLite the migration is a safe no-op — zero op.execute calls."""
    mod = _load_migration_module()
    mock_op = MagicMock()
    mock_op.get_bind.return_value.dialect.name = "sqlite"
    mock_op.execute.side_effect = lambda *a, **kw: pytest.fail(
        "op.execute should not be called on non-PostgreSQL dialect"
    )
    mod.op = mock_op  # type: ignore[attr-defined]
    mod.upgrade()  # should early-return without calling execute


def test_rls_policy_created_for_each_table():
    """A tenant_isolation policy is created for all 58 tenant-scoped tables."""
    mod = _load_migration_module()
    sqls = _run_upgrade_pg()
    TENANT_TABLES = mod.TENANT_TABLES

    policy_tables = {
        s.split("CREATE POLICY tenant_isolation ON ", 1)[1].split(" ", 1)[0]
        for s in sqls
        if "CREATE POLICY tenant_isolation" in s
    }
    assert len(TENANT_TABLES) == 58
    for table in TENANT_TABLES:
        assert table in policy_tables, f"{table} missing CREATE POLICY"
