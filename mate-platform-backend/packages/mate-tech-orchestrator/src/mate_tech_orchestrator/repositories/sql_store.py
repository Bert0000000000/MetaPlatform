"""SQL-backed role store for mate-tech-orchestrator.

Persistence is enabled when ``MATE_DB_URL`` / ``DATABASE_URL`` is set
(production); without a DSN the store is a no-op so dev/test stay
in-memory. ``save`` / ``delete`` / ``load`` mirror the registry's
mutation surface.
"""
from __future__ import annotations

import json
import os
from typing import Any, Protocol

from sqlalchemy import delete as sa_delete
from sqlalchemy import select
from sqlalchemy.orm import Session

from mate_tech_db.base import create_all, get_session

from ..scheduler.role_registry import CapabilityBinding, DigitalEmployeeRole
from . import sql_models as models


class RoleStore(Protocol):
    def save(self, role: DigitalEmployeeRole) -> None: ...
    def delete(self, tenant_id: str, role: str) -> None: ...
    def load(self) -> list[DigitalEmployeeRole]: ...


def _capabilities_to_json(caps: tuple[CapabilityBinding, ...]) -> str:
    return json.dumps(
        [{"name": c.name, "worker_kind": c.worker_kind, "ref": c.ref} for c in caps],
        sort_keys=True,
    )


def _capabilities_from_json(raw: str) -> tuple[CapabilityBinding, ...]:
    try:
        items = json.loads(raw or "[]")
    except ValueError:
        items = []
    return tuple(
        CapabilityBinding(name=str(i.get("name", "")), worker_kind=str(i.get("worker_kind", "local")), ref=str(i.get("ref", "")))
        for i in items
        if isinstance(i, dict)
    )


class SqlRoleStore:
    """Persist digital-employee roles to SQL when a DSN is configured."""

    def __init__(self, *, always_persist: bool = False) -> None:
        self._always = always_persist

    def _enabled(self) -> bool:
        if self._always:
            return True
        return bool(os.environ.get("MATE_DB_URL") or os.environ.get("DATABASE_URL"))

    def _session(self) -> Session:
        create_all()  # ensure tables exist (idempotent)
        return get_session()

    def save(self, role: DigitalEmployeeRole) -> None:
        if not self._enabled():
            return
        with self._session() as session:
            orm = session.get(models.RoleORM, (role.tenant_id, role.role))
            if orm is None:
                orm = models.RoleORM(tenant_id=role.tenant_id, role=role.role)
            orm.name = role.name
            orm.capabilities = _capabilities_to_json(role.capabilities)
            orm.enabled = role.enabled
            orm.created_at = role.created_at
            session.merge(orm)
            session.commit()

    def delete(self, tenant_id: str, role: str) -> None:
        if not self._enabled():
            return
        with self._session() as session:
            session.execute(
                sa_delete(models.RoleORM).where(
                    models.RoleORM.tenant_id == tenant_id,
                    models.RoleORM.role == role,
                )
            )
            session.commit()

    def load(self) -> list[DigitalEmployeeRole]:
        if not self._enabled():
            return []
        with self._session() as session:
            rows = session.execute(select(models.RoleORM)).scalars().all()
        return [
            DigitalEmployeeRole(
                role=r.role,
                tenant_id=r.tenant_id,
                name=r.name or r.role,
                capabilities=_capabilities_from_json(r.capabilities),
                enabled=r.enabled,
                created_at=r.created_at,
            )
            for r in rows
        ]


def default_role_store() -> Any:
    """Lazy singleton store (env-gated)."""
    return SqlRoleStore()
