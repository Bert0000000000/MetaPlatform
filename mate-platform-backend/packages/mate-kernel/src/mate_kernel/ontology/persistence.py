"""MODEL-02: Persistent ClassRef / Version / Property 模型层。

KERNEL-01 是 dataclass + in-memory；MODEL-02 引入 SQLAlchemy / Alembic 持久化。
本文件仅起骨架：model Protocol + Identity/Property 表 schema + 仓库实现（PG）。

PG schema（dev）:
    ont_class_ref      (rid text PK, tenant_id text, kind text, rest text)
    ont_version        (rid text PK, class_ref text FK, parent_rid text NULL,
                        created_at timestamptz, author text, change_set jsonb)
    ont_property       (rid text PK, type_id text, nullable bool, primary_key bool,
                        title text, format text)

后续（M2+）：ObjectType / LinkType / ActionType / Interface 表 + K8s Job 迁移。
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Iterable, Protocol, runtime_checkable

from .identity import ClassRef, Version
from .types import Property, PropertyFormat


@dataclass(frozen=True, slots=True)
class ClassRefRow:
    rid: str
    tenant_id: str
    kind: str
    rest: str

    @classmethod
    def from_class_ref(cls, c: ClassRef) -> "ClassRefRow":
        # rid 形如 ont.<tenant>.<kind>.<rest...>
        parts = c.rid.split(".", 3)
        if len(parts) < 4:
            raise ValueError(f"invalid rid for ClassRefRow: {c.rid!r}")
        return cls(
            rid=c.rid,
            tenant_id=parts[1],
            kind=parts[2],
            rest=parts[3],
        )

    def to_class_ref(self) -> ClassRef:
        return ClassRef(self.rid)


@dataclass(frozen=True, slots=True)
class VersionRow:
    rid: str
    class_ref: str
    parent_rid: str | None
    created_at: datetime
    author: str
    change_set: tuple[str, ...]

    @classmethod
    def from_version(cls, v: Version) -> "VersionRow":
        return cls(
            rid=v.rid,
            class_ref=v.class_ref.rid,
            parent_rid=v.parent_rid,
            created_at=v.created_at,
            author=v.author,
            change_set=v.change_set,
        )

    def to_version(self) -> Version:
        return Version(
            rid=self.rid,
            class_ref=ClassRef(self.class_ref),
            parent_rid=self.parent_rid,
            created_at=self.created_at,
            author=self.author,
            change_set=self.change_set,
        )


@dataclass(frozen=True, slots=True)
class PropertyRow:
    rid: str
    type_id: str
    nullable: bool
    primary_key: bool
    title: str
    format: str

    @classmethod
    def from_property(cls, p: Property) -> "PropertyRow":
        return cls(
            rid=p.rid.rid,
            type_id=p.type_id,
            nullable=p.nullable,
            primary_key=p.primary_key,
            title=p.title,
            format=p.format.value,
        )

    def to_property(self) -> Property:
        return Property(
            rid=ClassRef(self.rid),
            type_id=self.type_id,
            nullable=self.nullable,
            primary_key=self.primary_key,
            title=self.title,
            format=PropertyFormat(self.format),
        )


@runtime_checkable
class PersistentOntologyRepository(Protocol):
    """PG-backed repo —— SQLAlchemy session 由 runtime 注入。"""

    def upsert_class_ref(self, row: ClassRefRow) -> None: ...
    def get_class_ref(self, rid: str) -> ClassRefRow: ...

    def upsert_property(self, row: PropertyRow) -> None: ...
    def get_property(self, rid: str) -> PropertyRow: ...
    def list_properties(self, type_id: str | None = None) -> Iterable[PropertyRow]: ...

    def insert_version(self, row: VersionRow) -> None: ...
    def list_versions(self, class_ref: str) -> list[VersionRow]: ...


# SQL DDL — 给后续 alembic 迁移用
DDL_STATEMENTS: tuple[str, ...] = (
    """
    CREATE TABLE IF NOT EXISTS ont_class_ref (
        rid        TEXT PRIMARY KEY,
        tenant_id  TEXT NOT NULL,
        kind       TEXT NOT NULL,
        rest       TEXT NOT NULL
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_ont_class_ref_tenant_kind
    ON ont_class_ref (tenant_id, kind)
    """,
    """
    CREATE TABLE IF NOT EXISTS ont_version (
        rid          TEXT PRIMARY KEY,
        class_ref    TEXT NOT NULL REFERENCES ont_class_ref(rid),
        parent_rid   TEXT REFERENCES ont_version(rid),
        created_at   TIMESTAMPTZ NOT NULL,
        author       TEXT NOT NULL,
        change_set   JSONB NOT NULL DEFAULT '[]'::jsonb
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS ont_property (
        rid          TEXT PRIMARY KEY,
        type_id      TEXT NOT NULL,
        nullable     BOOLEAN NOT NULL,
        primary_key  BOOLEAN NOT NULL,
        title        TEXT NOT NULL,
        format       TEXT NOT NULL
    )
    """,
)


__all__ = [
    "ClassRefRow",
    "VersionRow",
    "PropertyRow",
    "PersistentOntologyRepository",
    "DDL_STATEMENTS",
]