"""Tests for mate_tech_db.base — engine, session factory, create_all, DSN resolution.

Extended in P3-W1 for production profile guard + env-var DSN resolution.
"""
from __future__ import annotations

import os

import pytest
from sqlalchemy import inspect, select
from sqlalchemy.orm import Mapped, mapped_column

from mate_tech_db.base import (
    Base,
    create_all,
    get_engine,
    get_session,
    init_engine,
    reset_engine,
)
from mate_tech_db.migrations import run_migrations


# ---------------------------------------------------------------------------
# Existing tests (updated to reset engine between tests)
# ---------------------------------------------------------------------------
@pytest.fixture(autouse=True)
def _clean_engine() -> None:
    """Reset the global engine before each test to avoid cross-test bleed."""
    reset_engine()
    yield
    reset_engine()


def test_init_engine_creates_tables() -> None:
    """init_engine + a mapped model + create_all yields the table in the DB."""
    engine = init_engine("sqlite:///:memory:", echo=False)

    class Sample(Base):
        __tablename__ = "sample_things"
        id: Mapped[str] = mapped_column(primary_key=True)

    create_all()
    table_names = inspect(engine).get_table_names()
    assert "sample_things" in table_names


def test_get_session_works() -> None:
    """get_session returns a session that can insert + query a row."""
    init_engine("sqlite:///:memory:")

    class Widget(Base):
        __tablename__ = "widgets"
        id: Mapped[str] = mapped_column(primary_key=True)
        value: Mapped[int] = mapped_column(default=0)

    create_all()
    session = get_session()
    session.add(Widget(id="w-1", value=42))
    session.commit()
    fetched = session.execute(select(Widget).where(Widget.id == "w-1")).scalar_one()
    assert fetched.value == 42
    session.close()


def test_run_migrations_idempotent() -> None:
    """Running run_migrations twice does not raise (CREATE ... IF NOT EXISTS)."""
    init_engine("sqlite:///:memory:")
    session = get_session()
    run_migrations(session)
    run_migrations(session)
    session.close()


# ---------------------------------------------------------------------------
# P3-W1: DSN resolution + production profile guard (硬规则 5)
# ---------------------------------------------------------------------------
def test_default_dsn_is_sqlite() -> None:
    """Without env vars, the default DSN is SQLite (dev mode)."""
    # Clear env to ensure no leakage
    for key in ("MATE_DB_URL", "DATABASE_URL", "MATE_PROFILE"):
        os.environ.pop(key, None)
    engine = init_engine()
    assert "sqlite" in str(engine.url)


def test_blank_env_dsn_is_treated_as_unconfigured() -> None:
    """Compose's explicit empty DB variables must keep the dev fallback."""
    os.environ["MATE_DB_URL"] = ""
    os.environ["DATABASE_URL"] = "   "
    try:
        engine = init_engine()
        assert "sqlite" in str(engine.url)
    finally:
        os.environ.pop("MATE_DB_URL", None)
        os.environ.pop("DATABASE_URL", None)


def test_env_dsn_takes_priority() -> None:
    """MATE_DB_URL env var overrides the default SQLite."""
    os.environ["MATE_DB_URL"] = "sqlite:///./test_priority.db"
    try:
        engine = init_engine()
        assert "test_priority" in str(engine.url)
    finally:
        os.environ.pop("MATE_DB_URL", None)
        os.remove("./test_priority.db") if os.path.exists("./test_priority.db") else None


def test_production_profile_rejects_sqlite() -> None:
    """硬规则 5: production profile rejects SQLite fallback."""
    os.environ["MATE_PROFILE"] = "production"
    os.environ.pop("MATE_DB_URL", None)
    os.environ.pop("DATABASE_URL", None)
    try:
        with pytest.raises(RuntimeError, match="production"):
            init_engine()
    finally:
        os.environ.pop("MATE_PROFILE", None)


def test_production_profile_rejects_sqlite_dsn() -> None:
    """硬规则 5: production profile rejects explicit SQLite DSN."""
    os.environ["MATE_PROFILE"] = "production"
    try:
        with pytest.raises(RuntimeError, match="SQLite"):
            init_engine("sqlite:///./prod.db")
    finally:
        os.environ.pop("MATE_PROFILE", None)


def test_production_profile_accepts_pg_dsn() -> None:
    """Production profile accepts a PostgreSQL DSN."""
    os.environ["MATE_PROFILE"] = "production"
    os.environ["MATE_DB_URL"] = "postgresql://meta:meta@localhost:5432/metaplatform"
    try:
        # This will try to create an engine but not connect
        engine = init_engine()
        assert "postgresql" in str(engine.url)
    finally:
        os.environ.pop("MATE_PROFILE", None)
        os.environ.pop("MATE_DB_URL", None)


def test_get_engine_returns_initialized_engine() -> None:
    """get_engine returns the same engine that init_engine created."""
    engine = init_engine("sqlite:///:memory:")
    assert get_engine() is engine


def test_reset_engine_clears_state() -> None:
    """reset_engine disposes the engine and clears the singleton."""
    init_engine("sqlite:///:memory:")
    reset_engine()
    # After reset, a new engine is created on next access
    new_engine = get_engine()
    assert new_engine is not None
