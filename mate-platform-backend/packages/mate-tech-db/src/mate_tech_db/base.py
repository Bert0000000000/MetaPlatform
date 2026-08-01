"""SQLAlchemy declarative base + session factory.

Production profile (``MATE_PROFILE=production``) requires a real
PostgreSQL DSN via ``MATE_DB_URL`` / ``DATABASE_URL``; SQLite is
rejected with a startup guard (硬规则 5: no legacy fallback in prod).

Dev/test falls back to in-process SQLite so unit tests stay fast.
"""
from __future__ import annotations

import os
from typing import Any

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    pass


class _State:
    """Mutable holder for the singleton engine + session factory."""

    engine: Any = None
    session_local: Any = None


_state = _State()

# ---------------------------------------------------------------------------
# DSN resolution
# ---------------------------------------------------------------------------
_SQLITE_DEFAULT = "sqlite:///./metaplatform.db"


def _resolve_dsn(url: str | None = None) -> str:
    """Resolve the database DSN from arg, env, or default.

    Priority: explicit ``url`` arg > ``MATE_DB_URL`` env > ``DATABASE_URL`` env
    > SQLite default (dev only).

    In production profile (``MATE_PROFILE=production``) SQLite is rejected.
    """
    profile = os.environ.get("MATE_PROFILE", "dev")
    dsn = url or os.environ.get("MATE_DB_URL") or os.environ.get("DATABASE_URL")

    if dsn is None:
        if profile == "production":
            raise RuntimeError(
                "MATE_PROFILE=production but MATE_DB_URL is not set. "
                "SQLite fallback is forbidden in production (硬规则 5)."
            )
        dsn = _SQLITE_DEFAULT

    if profile == "production" and dsn.startswith("sqlite"):
        raise RuntimeError(
            "MATE_PROFILE=production rejects SQLite DSN. "
            "Set MATE_DB_URL to a PostgreSQL DSN (硬规则 5)."
        )

    return dsn


def init_engine(url: str | None = None, echo: bool = False) -> Any:
    """Initialize the global engine + session factory.

    If ``url`` is None, resolves from env vars (MATE_DB_URL / DATABASE_URL).
    In production profile, SQLite is rejected.
    """
    dsn = _resolve_dsn(url)
    _state.engine = create_engine(dsn, echo=echo, future=True)
    _state.session_local = sessionmaker(
        bind=_state.engine, class_=Session, expire_on_commit=False
    )
    return _state.engine


def _session_local_or_init() -> Any:
    """Return the session factory, lazily initializing the engine if needed."""
    if _state.session_local is None:
        init_engine()
    return _state.session_local


def _engine_or_init() -> Any:
    """Return the engine, lazily initializing it if needed."""
    if _state.engine is None:
        init_engine()
    return _state.engine


def get_session() -> Session:
    """Return a new session. Auto-initializes with resolved DSN if needed."""
    return _session_local_or_init()()


def get_engine() -> Any:
    """Return the global engine. Auto-initializes if needed."""
    return _engine_or_init()


def create_all() -> None:
    """Create all tables. Call after all models are imported."""
    Base.metadata.create_all(_engine_or_init())


def reset_engine() -> None:
    """Dispose the current engine + session factory (for tests)."""
    if _state.engine is not None:
        _state.engine.dispose()
    _state.engine = None
    _state.session_local = None
