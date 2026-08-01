"""Alembic environment for Mate Platform.

Resolves the DSN from env vars (MATE_DB_URL / DATABASE_URL / sqlite default),
imports all ORM models so autogenerate can detect schema changes, and
runs migrations in online (real DB) or offline (SQL script) mode.

Model registration: imports all ``sql_models`` modules from packages
that have them (arch / copilot / a2a / + future domains as they get
SQL-ized in TD-5 waves).
"""
from __future__ import annotations

import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# Ensure all package src dirs are on sys.path so model imports work
_PREPEND = [
    "packages/mate-tech-db/src",
    "packages/mate-app-arch/src",
    "packages/mate-app-copilot/src",
    "packages/mate-app-a2a/src",
    "packages/mate-platform/src",
]
for _p in _PREPEND:
    _abs = os.path.join(os.path.dirname(__file__), "..", _p)
    if _abs not in sys.path:
        sys.path.insert(0, os.path.abspath(_abs))

# Import Base + all ORM models so autogenerate sees the full metadata
from mate_tech_db.base import Base  # noqa: E402

# Import ORM model modules — each module registers tables on Base.metadata
try:
    from mate_app_arch.repositories import sql_models as _arch_models  # noqa: F401
except ImportError:
    pass

try:
    from mate_app_copilot.repositories import sql_models as _copilot_models  # noqa: F401
except ImportError:
    pass

try:
    from mate_app_a2a.repositories import sql_models as _a2a_models  # noqa: F401
except ImportError:
    pass

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Resolve DSN: env > alembic.ini
_dsn = (
    os.environ.get("MATE_DB_URL")
    or os.environ.get("DATABASE_URL")
    or config.get_main_option("sqlalchemy.url")
)
config.set_main_option("sqlalchemy.url", _dsn)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (emit SQL to a script)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode (connect to real DB)."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
