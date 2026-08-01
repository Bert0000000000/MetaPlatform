"""Tests for Alembic migration 0007_outbox_event (G3 hard rule closure).

Verifies the ``outbox_event`` table DDL: columns, constraints, indexes,
server defaults, and the downgrade path. Uses Alembic's command API
against a temporary SQLite file so the full migration chain
(0001 → 0007) is exercised end-to-end.
"""
from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

# mate-platform-backend/ root (parents: tests/ → mate-tech-db/ → packages/ → backend/)
_BACKEND_ROOT = Path(__file__).resolve().parents[3]
_ALEMBIC_INI = _BACKEND_ROOT / "alembic.ini"
_ALEMBIC_DIR = _BACKEND_ROOT / "alembic"

EXPECTED_INDEXES = {
    "ix_outbox_event_tenant_id",
    "ix_outbox_event_event_type",
    "ix_outbox_event_created_at",
    "ix_outbox_event_status",
    "ix_outbox_event_tenant_status",
}


def _make_temp_db(request: pytest.FixtureRequest) -> Path:
    """Create a temp SQLite DB file in the workspace (avoids system temp
    permission issues on Windows)."""
    db_dir = _BACKEND_ROOT / ".tmp"
    db_dir.mkdir(exist_ok=True)
    fd, db_path_str = tempfile.mkstemp(
        suffix=".db",
        prefix=f"outbox_{request.node.name}_",
        dir=str(db_dir),
    )
    os.close(fd)
    return Path(db_path_str)


def _make_config(db_path: Path) -> Config:
    config = Config(str(_ALEMBIC_INI))
    config.set_main_option("script_location", str(_ALEMBIC_DIR))
    config.set_main_option("sqlalchemy.url", f"sqlite:///{db_path}")
    return config


def _make_engine(db_path: Path):
    return create_engine(f"sqlite:///{db_path}")


@pytest.fixture
def alembic_config(request: pytest.FixtureRequest):
    """Alembic Config + DB path pointing at a workspace-relative temp file."""
    db_path = _make_temp_db(request)
    yield _make_config(db_path), db_path
    if db_path.exists():
        db_path.unlink()


@pytest.fixture
def upgraded_engine(alembic_config):
    """Engine after upgrading to head (all migrations applied)."""
    config, db_path = alembic_config
    command.upgrade(config, "head")
    engine = _make_engine(db_path)
    yield engine
    engine.dispose()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_outbox_event_table_exists_after_upgrade(upgraded_engine):
    """outbox_event table is created after upgrading to head."""
    table_names = inspect(upgraded_engine).get_table_names()
    assert "outbox_event" in table_names


def test_outbox_event_tenant_id_not_null(upgraded_engine):
    """tenant_id column is NOT NULL (SEC-TENANT-01 hard rule 3 alignment)."""
    columns = {
        c["name"]: c for c in inspect(upgraded_engine).get_columns("outbox_event")
    }
    assert "tenant_id" in columns
    assert columns["tenant_id"]["nullable"] is False


def test_outbox_event_status_default_pending(upgraded_engine):
    """status column defaults to 'pending' when not explicitly set."""
    with upgraded_engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO outbox_event "
                "(id, tenant_id, aggregate_type, aggregate_id, event_type, payload) "
                "VALUES ('evt-1', 't-1', 'order', 'ord-1', 'order.created', '{}')"
            )
        )
    with upgraded_engine.connect() as conn:
        result = conn.execute(
            text("SELECT status FROM outbox_event WHERE id = 'evt-1'")
        )
        row = result.fetchone()
    assert row is not None
    assert row[0] == "pending"


def test_outbox_event_indexes_present(upgraded_engine):
    """All 5 named indexes exist (4 single-column + 1 composite)."""
    indexes = {
        idx["name"]: idx
        for idx in inspect(upgraded_engine).get_indexes("outbox_event")
    }
    for name in EXPECTED_INDEXES:
        assert name in indexes, f"missing index {name}"
    # composite index covers tenant_id + status
    assert indexes["ix_outbox_event_tenant_status"]["column_names"] == [
        "tenant_id",
        "status",
    ]


def test_outbox_event_lineage_hints_nullable(upgraded_engine):
    """lineage_hints column is nullable (aligns with D1 lineage side-car)."""
    columns = {
        c["name"]: c for c in inspect(upgraded_engine).get_columns("outbox_event")
    }
    assert "lineage_hints" in columns
    assert columns["lineage_hints"]["nullable"] is True


def test_outbox_event_downgrade_drops_table(alembic_config):
    """Downgrading from 0007 to 0006 drops the outbox_event table."""
    config, db_path = alembic_config
    command.upgrade(config, "head")
    engine = _make_engine(db_path)
    assert "outbox_event" in inspect(engine).get_table_names()
    engine.dispose()

    command.downgrade(config, "0006_business_domains")
    engine = _make_engine(db_path)
    assert "outbox_event" not in inspect(engine).get_table_names()
    engine.dispose()
