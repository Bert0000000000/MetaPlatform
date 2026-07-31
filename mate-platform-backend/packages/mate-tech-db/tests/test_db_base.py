"""Tests for mate_tech_db.base — engine, session factory, create_all."""
from __future__ import annotations

from sqlalchemy import inspect, select
from sqlalchemy.orm import Mapped, mapped_column

from mate_tech_db.base import Base, create_all, get_session, init_engine
from mate_tech_db.migrations import run_migrations


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
