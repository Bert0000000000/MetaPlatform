"""Async SQLAlchemy engine + session factory for TECH-IAM.

Uses SQLite by default for dev convenience. Production deployments can override
``IAM_DATABASE_URL`` to point at PostgreSQL.
"""
from __future__ import annotations

import os
from collections.abc import AsyncIterator
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

DEFAULT_DB_URL = "sqlite+aiosqlite:///{data_dir}/mate_iam.db"


def _build_database_url() -> str:
    explicit = os.getenv("IAM_DATABASE_URL")
    if explicit:
        return explicit
    data_dir = os.getenv("IAM_DATA_DIR", "/data")
    return DEFAULT_DB_URL.format(data_dir=data_dir)


DATABASE_URL = _build_database_url()
_ECHO = os.getenv("IAM_SQL_ECHO", "0") == "1"

engine = create_async_engine(
    DATABASE_URL,
    echo=_ECHO,
    future=True,
    pool_pre_ping=True,
)

AsyncSessionMaker = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency: yield an AsyncSession bound to the request."""
    async with AsyncSessionMaker() as session:
        yield session


async def init_db() -> None:
    """Create tables. Should be called once at startup."""
    # Import inside to ensure SQLModel metadata is fully populated.
    from sqlmodel import SQLModel

    from .domain import (  # noqa: F401  pylint: disable=import-outside-toplevel
        AuditLog,
        EmployeePosition,
        LoginLog,
        Org,
        Permission,
        Position,
        Role,
        RolePermission,
        SystemConfig,
        User,
        UserRole,
    )

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)


async def db_health() -> dict[str, Any]:
    """Light health probe used by /healthz and /readyz."""
    try:
        async with engine.connect() as conn:
            from sqlalchemy import text

            await conn.execute(text("SELECT 1"))
        return {"status": "up", "url": DATABASE_URL.split("@")[-1]}
    except Exception as exc:  # pragma: no cover - defensive
        return {"status": "down", "error": str(exc)}
