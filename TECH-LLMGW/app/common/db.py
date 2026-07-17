"""Database configuration and async SQLAlchemy 2.0 setup.

Provides the shared declarative base, async engine, and session factory.
Modules register their ORM models against :data:`Base`; ``init_db`` creates
all tables on startup when a real database is configured.
"""

from __future__ import annotations

from typing import Optional

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


class Base(DeclarativeBase):
    """Shared declarative base for all TECH-LLMGW ORM models."""

    pass


_async_engine: Optional[AsyncEngine] = None
_async_session_factory: Optional[async_sessionmaker[AsyncSession]] = None


def get_engine() -> AsyncEngine:
    """Lazily create and return the global async engine."""

    global _async_engine
    if _async_engine is None:
        _async_engine = create_async_engine(
            settings.database_url,
            echo=False,
            future=True,
        )
    return _async_engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Lazily create and return the global async session factory."""

    global _async_session_factory
    if _async_session_factory is None:
        _async_session_factory = async_sessionmaker(
            get_engine(),
            expire_on_commit=False,
            class_=AsyncSession,
        )
    return _async_session_factory


async def init_db() -> None:
    """Create all tables registered against :data:`Base`.

    Call this once during application startup after all ORM modules have
    been imported (so their models are registered on ``Base.metadata``).
    """

    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def dispose_db() -> None:
    """Dispose the engine and clean up connections."""

    global _async_engine, _async_session_factory
    if _async_engine is not None:
        await _async_engine.dispose()
        _async_engine = None
        _async_session_factory = None
