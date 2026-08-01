"""ont domain ORM models (SQLAlchemy 2.0) — P3-W4 TD-5.

Mirrors the frozen dataclasses in in_memory.py. Dict fields
(``properties`` / ``metadata``) are stored as JSON TEXT.

Table names are prefixed with ``ont_``.
"""
from __future__ import annotations

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from mate_tech_db.base import Base


class OntologyORM(Base):
    __tablename__ = "ont_ontologies"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    namespace: Mapped[str] = mapped_column(String(64), default="default")
    description: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[str] = mapped_column(String(64), default="")
    updated_at: Mapped[str] = mapped_column(String(64), default="")


class OntologyClassORM(Base):
    __tablename__ = "ont_classes"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    ontology_id: Mapped[str] = mapped_column(String(64), default="")
    namespace: Mapped[str] = mapped_column(String(64), default="default")
    label: Mapped[str] = mapped_column(String(256), default="")
    parent: Mapped[str | None] = mapped_column(String(64), nullable=True, default=None)
    properties: Mapped[str] = mapped_column(Text, default="{}")  # JSON
    created_at: Mapped[str] = mapped_column(String(64), default="")


class OntologyInstanceORM(Base):
    __tablename__ = "ont_instances"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    class_id: Mapped[str] = mapped_column(String(64), default="")
    namespace: Mapped[str] = mapped_column(String(64), default="default")
    properties: Mapped[str] = mapped_column(Text, default="{}")  # JSON
    created_at: Mapped[str] = mapped_column(String(64), default="")


class OntologyRelationORM(Base):
    __tablename__ = "ont_relations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(64), default="")
    src_id: Mapped[str] = mapped_column(String(64), default="")
    dst_id: Mapped[str] = mapped_column(String(64), default="")
    properties: Mapped[str] = mapped_column(Text, default="{}")  # JSON
    created_at: Mapped[str] = mapped_column(String(64), default="")


class OntologyVersionORM(Base):
    __tablename__ = "ont_versions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    ontology_id: Mapped[str] = mapped_column(String(64), default="")
    version: Mapped[str] = mapped_column(String(64), default="")
    parent: Mapped[str | None] = mapped_column(String(64), nullable=True, default=None)
    ver_meta: Mapped[str] = mapped_column(Text, default="{}")  # JSON (avoids reserved 'metadata')
    created_at: Mapped[str] = mapped_column(String(64), default="")
