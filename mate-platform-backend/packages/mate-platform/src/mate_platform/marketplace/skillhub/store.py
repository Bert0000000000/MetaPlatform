"""SkillHub store — public/private skill registry (marketplace skill kind).

Skills are first-class marketplace artifacts (``kind="skill"``): public
skills are discoverable by any tenant; a tenant's private skills are
visible only to the owning tenant. Storage is SQL (``skillhub_skills``)
with an in-memory fallback when no DSN is configured (dev/test).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import Integer, String, Text, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from mate_tech_db.base import Base, create_all, get_session


@dataclass(frozen=True, slots=True)
class Skill:
    """A skill artifact in the hub."""

    id: str
    name: str
    description: str
    version: str
    author_tenant: str
    visibility: str  # "public" | "private"
    content: str  # the skill payload (SKILL.md / markdown / yaml)
    installs: int = 0
    created_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())


class SkillORM(Base):
    __tablename__ = "skillhub_skills"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    version: Mapped[str] = mapped_column(String(32), default="v1")
    author_tenant: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    visibility: Mapped[str] = mapped_column(String(16), default="public")
    content: Mapped[str] = mapped_column(Text, default="")
    installs: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[str] = mapped_column(String(64), default="")


class SkillInstallORM(Base):
    """Per-tenant installed-skill records (who installed what)."""

    __tablename__ = "skillhub_installs"

    skill_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    installed_at: Mapped[str] = mapped_column(String(64), default="")


class _MemoryStore:
    """In-memory fallback (no DSN configured)."""

    def __init__(self) -> None:
        self._rows: dict[str, Skill] = {}
        self._installs: set[tuple[str, str]] = set()  # (skill_id, tenant_id)

    def create(self, skill: Skill) -> Skill:
        self._rows[skill.id] = skill
        return skill

    def list(self, tenant_id: str) -> list[Skill]:
        return [s for s in self._rows.values() if s.visibility == "public" or s.author_tenant == tenant_id]

    def get(self, skill_id: str) -> Skill | None:
        return self._rows.get(skill_id)

    def update_installs(self, skill_id: str, count: int) -> None:
        if skill_id in self._rows:
            s = self._rows[skill_id]
            self._rows[skill_id] = Skill(
                id=s.id, name=s.name, description=s.description, version=s.version,
                author_tenant=s.author_tenant, visibility=s.visibility,
                content=s.content, installs=count, created_at=s.created_at,
            )

    def record_install(self, tenant_id: str, skill_id: str) -> None:
        self._installs.add((skill_id, tenant_id))

    def installed_skill_ids(self, tenant_id: str) -> set[str]:
        return {sid for sid, tid in self._installs if tid == tenant_id}

    def delete(self, skill_id: str) -> bool:
        gone = self._rows.pop(skill_id, None) is not None
        if gone:
            self._installs = {(sid, tid) for sid, tid in self._installs if sid != skill_id}
        return gone


class SkillHubStore:
    """Skill registry. SQL when a DSN is set; in-memory otherwise."""

    def __init__(self, *, memory: bool = False) -> None:
        self._mem = _MemoryStore() if memory else None

    def _use_sql(self) -> bool:
        return self._mem is None

    def _session(self) -> Session:
        create_all()
        return get_session()

    # -- CRUD -----------------------------------------------------------
    def create(self, skill: Skill) -> Skill:
        if not self._use_sql():
            return self._mem.create(skill)
        with self._session() as session:
            orm = SkillORM(
                id=skill.id, name=skill.name, description=skill.description,
                version=skill.version, author_tenant=skill.author_tenant,
                visibility=skill.visibility, content=skill.content,
                installs=skill.installs, created_at=skill.created_at,
            )
            session.merge(orm)
            session.commit()
        return skill

    def list(self, tenant_id: str) -> list[Skill]:
        if not self._use_sql():
            return self._mem.list(tenant_id)
        with self._session() as session:
            rows = session.execute(
                select(SkillORM).where(
                    (SkillORM.visibility == "public") | (SkillORM.author_tenant == tenant_id)
                )
            ).scalars().all()
        return [self._row(s) for s in rows]

    def get(self, skill_id: str) -> Skill | None:
        if not self._use_sql():
            return self._mem.get(skill_id)
        with self._session() as session:
            orm = session.get(SkillORM, skill_id)
        return self._row(orm) if orm is not None else None

    def increment_installs(self, skill_id: str) -> int:
        skill = self.get(skill_id)
        if skill is None:
            return 0
        new_count = skill.installs + 1
        if not self._use_sql():
            self._mem.update_installs(skill_id, new_count)
            return new_count
        with self._session() as session:
            orm = session.get(SkillORM, skill_id)
            if orm is None:
                return 0
            orm.installs = new_count
            session.commit()
        return new_count

    def install(self, tenant_id: str, skill_id: str) -> int:
        """Increment install count AND record the per-tenant install."""
        count = self.increment_installs(skill_id)
        if count == 0:
            return 0
        if not self._use_sql():
            self._mem.record_install(tenant_id, skill_id)
            return count
        from datetime import UTC, datetime

        with self._session() as session:
            orm = SkillInstallORM(
                skill_id=skill_id,
                tenant_id=tenant_id,
                installed_at=datetime.now(UTC).isoformat(),
            )
            session.merge(orm)
            session.commit()
        return count

    def installed_skill_ids(self, tenant_id: str) -> set[str]:
        if not self._use_sql():
            return self._mem.installed_skill_ids(tenant_id)
        with self._session() as session:
            rows = session.execute(
                select(SkillInstallORM.skill_id).where(SkillInstallORM.tenant_id == tenant_id)
            ).scalars().all()
        return set(rows)

    def is_installed(self, tenant_id: str, skill_id: str) -> bool:
        return skill_id in self.installed_skill_ids(tenant_id)

    def delete(self, skill_id: str) -> bool:
        if not self._use_sql():
            return self._mem.delete(skill_id)
        with self._session() as session:
            orm = session.get(SkillORM, skill_id)
            if orm is None:
                return False
            session.delete(orm)
            session.commit()
        return True

    # -- installer hand-off (kind="skill") ------------------------------
    async def register_skill(self, *, artifact: dict[str, Any], blob: bytes) -> dict[str, Any]:
        """Installer integration: store a skill artifact from the marketplace flow.

        Returns ``{instance_uid, registered_digest}`` (硬规则 #14).
        """
        import hashlib
        import uuid

        content = blob.decode("utf-8", errors="replace")
        digest = hashlib.sha256(blob).hexdigest()
        skill = Skill(
            id=str(uuid.uuid4())[:12],
            name=str(artifact.get("name", "unnamed-skill")),
            description=str(artifact.get("description", "")),
            version=str(artifact.get("version", "v1")),
            author_tenant=str(artifact.get("tenant_id", "")),
            visibility="public" if artifact.get("visibility", "public") == "public" else "private",
            content=content,
        )
        self.create(skill)
        return {"instance_uid": skill.id, "registered_digest": digest}

    @staticmethod
    def _row(orm: Any) -> Skill:
        return Skill(
            id=orm.id, name=orm.name, description=orm.description,
            version=orm.version, author_tenant=orm.author_tenant,
            visibility=orm.visibility, content=orm.content,
            installs=orm.installs, created_at=orm.created_at,
        )


_default_store: SkillHubStore | None = None


def get_skillhub_store() -> SkillHubStore:
    global _default_store
    if _default_store is None:
        _default_store = SkillHubStore()
    return _default_store


def set_skillhub_store(store: SkillHubStore | None) -> None:
    global _default_store
    _default_store = store
