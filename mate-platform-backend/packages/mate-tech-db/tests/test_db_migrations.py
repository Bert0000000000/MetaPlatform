"""Tests for mate_tech_db.migrations — initial schema tables + indexes."""
from __future__ import annotations

from sqlalchemy import inspect

from mate_tech_db.base import get_session, init_engine
from mate_tech_db.migrations import run_migrations

COPILOT_TABLES = [
    "copilot_conversations",
    "copilot_queries",
    "copilot_plans",
    "copilot_intents",
    "copilot_templates",
    "copilot_actions",
    "copilot_datasources",
    "copilot_knowledge_bases",
    "copilot_models",
    "copilot_assets",
]


def test_migrations_create_copilot_tables() -> None:
    """run_migrations creates all 10 tenant-scoped copilot tables."""
    engine = init_engine("sqlite:///:memory:")
    session = get_session()
    run_migrations(session)
    session.close()

    table_names = inspect(engine).get_table_names()
    for table in COPILOT_TABLES:
        assert table in table_names, f"missing table {table}"
    assert len(COPILOT_TABLES) == 10


def test_migrations_create_indexes() -> None:
    """Each copilot table has a tenant_id index after run_migrations."""
    engine = init_engine("sqlite:///:memory:")
    session = get_session()
    run_migrations(session)
    session.close()

    inspector = inspect(engine)
    for table in COPILOT_TABLES:
        index_columns = [idx["column_names"] for idx in inspector.get_indexes(table)]
        assert ["tenant_id"] in index_columns, f"missing tenant_id index on {table}"
