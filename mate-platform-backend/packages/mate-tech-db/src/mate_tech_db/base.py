"""SQLAlchemy declarative base + session factory."""
from __future__ import annotations

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


def init_engine(url: str = "sqlite:///./metaplatform.db", echo: bool = False) -> Any:
    """Initialize the global engine + session factory."""
    _state.engine = create_engine(url, echo=echo, future=True)
    _state.session_local = sessionmaker(
        bind=_state.engine, class_=Session, expire_on_commit=False
    )
    return _state.engine


def _session_local_or_init() -> Any:
    """Return the session factory, lazily initializing the engine if needed."""
    if _state.session_local is None:
        init_engine()  # auto-init with default SQLite
    return _state.session_local


def _engine_or_init() -> Any:
    """Return the engine, lazily initializing it if needed."""
    if _state.engine is None:
        init_engine()  # auto-init with default SQLite
    return _state.engine


def get_session() -> Session:
    """Return a new session. Auto-initializes with default SQLite if needed."""
    return _session_local_or_init()()


def create_all() -> None:
    """Create all tables. Call after all models are imported."""
    Base.metadata.create_all(_engine_or_init())
