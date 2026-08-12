"""W5 tests: digital-employee role persistence (cross-restart survival).

Uses a file-based SQLite so save → load round-trips work across
sessions (``:memory:`` gives each connection a fresh DB).
"""
from __future__ import annotations

import pytest
from mate_tech_orchestrator.repositories.sql_store import SqlRoleStore
from mate_tech_orchestrator.scheduler.role_registry import (
    CapabilityBinding,
    RoleRegistry,
)

from mate_tech_db.base import create_all, init_engine, reset_engine

_DB = "./.tmp_test_roles.db"


@pytest.fixture(autouse=True)
def _sqlite(tmp_path):
    db_path = str(tmp_path / "roles.db")
    # init_engine resolves DSN from env when url is None; pass explicitly.
    reset_engine()
    init_engine(f"sqlite:///{db_path}")
    create_all()
    yield db_path
    reset_engine()


def _caps() -> list[CapabilityBinding]:
    return [CapabilityBinding(name="kb_search", worker_kind="mcp", ref="kb_search")]


def test_role_roundtrip_persists(_sqlite) -> None:
    store = SqlRoleStore(always_persist=True)
    reg = RoleRegistry(store=store)
    reg.register(
        tenant_id="tenant-acme",
        role="knowledge",
        name="知识库员工",
        capabilities=_caps(),
    )

    # A fresh registry over the same store restores the persisted role.
    fresh = RoleRegistry(store=store)
    restored = fresh.restore()
    assert restored == 1
    role = fresh.get("tenant-acme", "knowledge")
    assert role is not None
    assert role.name == "知识库员工"
    assert role.capabilities[0].name == "kb_search"
    assert role.capabilities[0].worker_kind == "mcp"


def test_role_unregister_persists(_sqlite) -> None:
    store = SqlRoleStore(always_persist=True)
    reg = RoleRegistry(store=store)
    reg.register(tenant_id="tenant-acme", role="knowledge", capabilities=_caps())
    assert reg.unregister("tenant-acme", "knowledge") is True

    fresh = RoleRegistry(store=store)
    assert fresh.restore() == 0
    assert fresh.get("tenant-acme", "knowledge") is None


def test_restore_is_idempotent(_sqlite) -> None:
    store = SqlRoleStore(always_persist=True)
    reg = RoleRegistry(store=store)
    reg.register(tenant_id="tenant-acme", role="knowledge", capabilities=_caps())
    # Already in memory → restore loads nothing new (idempotent).
    assert reg.restore() == 0
    assert len(reg.list("tenant-acme")) == 1


def test_store_disabled_without_dsn(monkeypatch, _sqlite) -> None:
    monkeypatch.delenv("MATE_DB_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    store = SqlRoleStore()
    assert store.load() == []  # no-op without a configured DSN
    store.save(
        RoleRegistry(store=store).register(
            tenant_id="t", role="knowledge", capabilities=_caps(),
        )
    )
    assert store.load() == []
