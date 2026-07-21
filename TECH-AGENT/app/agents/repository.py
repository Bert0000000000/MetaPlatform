"""Data access layer for agent definitions.

Provides an abstract :class:`AgentRepository` plus two implementations:

* :class:`InMemoryAgentRepository` — thread-safe in-memory store used by tests
  and as the default when no database is configured.
* :class:`SqlAlchemyAgentRepository` — async SQLAlchemy 2.0 implementation
  backed by the ``agent_definition`` table.
"""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from threading import RLock
from typing import Any, Optional

from app.agents.orm import (
    AgentOperationLogORM,
    AgentORM,
    AgentVersionORM,
    Base,
)
from app.agents.schemas import (
    Agent,
    AgentOperationLog,
    AgentStatus,
    AgentVersion,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_id() -> str:
    return f"agt-{uuid.uuid4().hex[:24]}"


def _new_version_id() -> str:
    return f"agv-{uuid.uuid4().hex[:24]}"


def _new_log_id() -> str:
    return f"agl-{uuid.uuid4().hex[:24]}"


def _row_to_model(row: AgentORM) -> Agent:
    return Agent(
        id=row.id,
        tenant_id=row.tenant_id,
        agent_code=row.agent_code,
        name=row.name,
        description=row.description or "",
        model_id=row.model_id,
        system_prompt=row.system_prompt,
        tools=list(row.tools or []),
        rag_scopes=list(row.rag_scopes or []),
        temperature=float(row.temperature) if row.temperature else 0.7,
        max_tokens=int(row.max_tokens) if row.max_tokens else 4096,
        status=AgentStatus(row.status),
        deleted_at=row.deleted_at if row.deleted_at else None,
        created_at=row.created_at if row.created_at else _now(),
        updated_at=row.updated_at if row.updated_at else _now(),
    )


def _model_to_row(agent: Agent) -> AgentORM:
    return AgentORM(
        id=agent.id,
        tenant_id=agent.tenant_id,
        agent_code=agent.agent_code,
        name=agent.name,
        description=agent.description,
        model_id=agent.model_id,
        system_prompt=agent.system_prompt,
        tools=list(agent.tools),
        rag_scopes=list(agent.rag_scopes),
        temperature=str(agent.temperature),
        max_tokens=str(agent.max_tokens),
        status=agent.status.value,
        deleted_at=agent.deleted_at,
        created_at=agent.created_at,
        updated_at=agent.updated_at,
    )


def _version_row_to_model(row: AgentVersionORM) -> AgentVersion:
    return AgentVersion(
        id=row.id,
        tenant_id=row.tenant_id,
        agent_id=row.agent_id,
        version=row.version,
        change_log=row.change_log or "",
        snapshot=dict(row.snapshot) if row.snapshot else None,
        created_by=row.created_by,
        created_at=row.created_at if row.created_at else _now(),
    )


def _log_row_to_model(row: AgentOperationLogORM) -> AgentOperationLog:
    return AgentOperationLog(
        id=row.id,
        tenant_id=row.tenant_id,
        agent_id=row.agent_id,
        actor=row.actor or "system",
        action=row.action,
        resource=row.resource or "agent",
        ip=row.ip,
        status=row.status or "success",
        trace_id=row.trace_id,
        created_at=row.created_at if row.created_at else _now(),
    )


class AgentRepository(ABC):
    """Abstract repository contract."""

    @abstractmethod
    async def create(self, agent: Agent) -> Agent: ...

    @abstractmethod
    async def get(self, agent_id: str, tenant_id: str) -> Optional[Agent]: ...

    @abstractmethod
    async def get_including_deleted(
        self, agent_id: str, tenant_id: str
    ) -> Optional[Agent]:
        """Lookup that bypasses the ``deleted_at`` filter — used by audit endpoints
        (versions/logs) so auditors can still inspect the historical record of a
        soft-deleted Agent."""
        ...

    @abstractmethod
    async def get_by_code(
        self, tenant_id: str, agent_code: str
    ) -> Optional[Agent]: ...

    @abstractmethod
    async def list(
        self,
        tenant_id: str,
        *,
        status: Optional[AgentStatus] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Agent], int]: ...

    @abstractmethod
    async def update(
        self, agent_id: str, tenant_id: str, fields: dict[str, Any]
    ) -> Optional[Agent]: ...

    @abstractmethod
    async def delete(self, agent_id: str, tenant_id: str) -> bool: ...

    @abstractmethod
    async def record_version(self, version: AgentVersion) -> AgentVersion: ...

    @abstractmethod
    async def list_versions(
        self,
        agent_id: str,
        tenant_id: str,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[AgentVersion], int]: ...

    @abstractmethod
    async def record_log(self, log: AgentOperationLog) -> AgentOperationLog: ...

    @abstractmethod
    async def list_logs(
        self,
        agent_id: str,
        tenant_id: str,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[AgentOperationLog], int]: ...


class InMemoryAgentRepository(AgentRepository):
    """Thread-safe in-memory repository (used by tests & default runtime)."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._store: dict[tuple[str, str], Agent] = {}
        self._versions: dict[tuple[str, str], list[AgentVersion]] = {}
        self._logs: dict[tuple[str, str], list[AgentOperationLog]] = {}

    async def create(self, agent: Agent) -> Agent:
        with self._lock:
            if not agent.id:
                agent.id = _new_id()
            agent.created_at = _now()
            agent.updated_at = agent.created_at
            self._store[(agent.tenant_id, agent.id)] = agent
            return agent

    async def get(self, agent_id: str, tenant_id: str) -> Optional[Agent]:
        with self._lock:
            agent = self._store.get((tenant_id, agent_id))
            if agent is None or agent.deleted_at is not None:
                return None
            return agent

    async def get_including_deleted(
        self, agent_id: str, tenant_id: str
    ) -> Optional[Agent]:
        with self._lock:
            return self._store.get((tenant_id, agent_id))

    async def get_by_code(
        self, tenant_id: str, agent_code: str
    ) -> Optional[Agent]:
        with self._lock:
            for (tid, _), agent in self._store.items():
                if (
                    tid == tenant_id
                    and agent.agent_code == agent_code
                    and agent.deleted_at is None
                ):
                    return agent
            return None

    async def list(
        self,
        tenant_id: str,
        *,
        status: Optional[AgentStatus] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Agent], int]:
        with self._lock:
            results = [
                agent
                for (tid, _), agent in self._store.items()
                if tid == tenant_id
                and agent.deleted_at is None
                and (status is None or agent.status == status)
            ]
        results.sort(key=lambda a: a.created_at)
        total = len(results)
        start = (page - 1) * page_size
        end = start + page_size
        return results[start:end], total

    async def update(
        self, agent_id: str, tenant_id: str, fields: dict[str, Any]
    ) -> Optional[Agent]:
        with self._lock:
            agent = self._store.get((tenant_id, agent_id))
            if agent is None or agent.deleted_at is not None:
                return None
            updated = agent.model_copy(update=fields)
            updated.updated_at = _now()
            self._store[(tenant_id, agent_id)] = updated
            return updated

    async def delete(self, agent_id: str, tenant_id: str) -> bool:
        """软删除：标记 deleted_at 而不物理移除记录。"""
        with self._lock:
            agent = self._store.get((tenant_id, agent_id))
            if agent is None or agent.deleted_at is not None:
                return False
            updated = agent.model_copy(update={"deleted_at": _now()})
            updated.updated_at = _now()
            self._store[(tenant_id, agent_id)] = updated
            return True

    async def record_version(self, version: AgentVersion) -> AgentVersion:
        with self._lock:
            if not version.id:
                version.id = _new_version_id()
            version.created_at = _now()
            key = (version.tenant_id, version.agent_id)
            self._versions.setdefault(key, []).append(version)
            return version

    async def list_versions(
        self,
        agent_id: str,
        tenant_id: str,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[AgentVersion], int]:
        with self._lock:
            items = list(self._versions.get((tenant_id, agent_id), []))
        items.sort(key=lambda v: v.created_at, reverse=True)
        total = len(items)
        start = (page - 1) * page_size
        end = start + page_size
        return items[start:end], total

    async def record_log(self, log: AgentOperationLog) -> AgentOperationLog:
        with self._lock:
            if not log.id:
                log.id = _new_log_id()
            log.created_at = _now()
            key = (log.tenant_id, log.agent_id)
            self._logs.setdefault(key, []).append(log)
            return log

    async def list_logs(
        self,
        agent_id: str,
        tenant_id: str,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[AgentOperationLog], int]:
        with self._lock:
            items = list(self._logs.get((tenant_id, agent_id), []))
        items.sort(key=lambda l: l.created_at, reverse=True)
        total = len(items)
        start = (page - 1) * page_size
        end = start + page_size
        return items[start:end], total

    # -- test helpers --------------------------------------------------

    def clear(self) -> None:
        with self._lock:
            self._store.clear()
            self._versions.clear()
            self._logs.clear()


class SqlAlchemyAgentRepository(AgentRepository):
    """Async SQLAlchemy 2.0 repository backed by ``agent_definition``."""

    def __init__(self, session_factory) -> None:
        # ``session_factory`` is an async_sessionmaker.
        self._session_factory = session_factory

    @classmethod
    async def create_all(cls, engine) -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def create(self, agent: Agent) -> Agent:
        if not agent.id:
            agent.id = _new_id()
        agent.created_at = _now()
        agent.updated_at = agent.created_at
        row = _model_to_row(agent)
        async with self._session_factory() as session:
            session.add(row)
            await session.commit()
            return agent

    async def get(self, agent_id: str, tenant_id: str) -> Optional[Agent]:
        async with self._session_factory() as session:
            row = await session.get(AgentORM, agent_id)
            if row is None or row.tenant_id != tenant_id or row.deleted_at is not None:
                return None
            return _row_to_model(row)

    async def get_including_deleted(
        self, agent_id: str, tenant_id: str
    ) -> Optional[Agent]:
        async with self._session_factory() as session:
            row = await session.get(AgentORM, agent_id)
            if row is None or row.tenant_id != tenant_id:
                return None
            return _row_to_model(row)

    async def get_by_code(
        self, tenant_id: str, agent_code: str
    ) -> Optional[Agent]:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = select(AgentORM).where(
                AgentORM.tenant_id == tenant_id,
                AgentORM.agent_code == agent_code,
                AgentORM.deleted_at.is_(None),
            )
            row = (await session.execute(stmt)).scalar_one_or_none()
            return _row_to_model(row) if row else None

    async def list(
        self,
        tenant_id: str,
        *,
        status: Optional[AgentStatus] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Agent], int]:
        from sqlalchemy import func, select

        async with self._session_factory() as session:
            base = select(AgentORM).where(
                AgentORM.tenant_id == tenant_id,
                AgentORM.deleted_at.is_(None),
            )
            count_base = (
                select(func.count())
                .select_from(AgentORM)
                .where(
                    AgentORM.tenant_id == tenant_id,
                    AgentORM.deleted_at.is_(None),
                )
            )
            if status is not None:
                base = base.where(AgentORM.status == status.value)
                count_base = count_base.where(AgentORM.status == status.value)
            total = (await session.execute(count_base)).scalar_one()
            rows = (
                await session.execute(
                    base.order_by(AgentORM.created_at)
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
            ).scalars().all()
            return [_row_to_model(r) for r in rows], total

    async def update(
        self, agent_id: str, tenant_id: str, fields: dict[str, Any]
    ) -> Optional[Agent]:
        async with self._session_factory() as session:
            row = await session.get(AgentORM, agent_id)
            if row is None or row.tenant_id != tenant_id or row.deleted_at is not None:
                return None
            if "agent_code" in fields:
                row.agent_code = fields["agent_code"]
            if "name" in fields:
                row.name = fields["name"]
            if "description" in fields:
                row.description = fields["description"]
            if "model_id" in fields:
                row.model_id = fields["model_id"]
            if "system_prompt" in fields:
                row.system_prompt = fields["system_prompt"]
            if "tools" in fields:
                row.tools = list(fields["tools"])
            if "rag_scopes" in fields:
                row.rag_scopes = list(fields["rag_scopes"])
            if "temperature" in fields:
                row.temperature = str(fields["temperature"])
            if "max_tokens" in fields:
                row.max_tokens = str(fields["max_tokens"])
            if "status" in fields:
                row.status = fields["status"].value
            row.updated_at = _now()
            await session.commit()
            return _row_to_model(row)

    async def delete(self, agent_id: str, tenant_id: str) -> bool:
        """软删除：标记 deleted_at 而不物理移除记录。"""
        async with self._session_factory() as session:
            row = await session.get(AgentORM, agent_id)
            if row is None or row.tenant_id != tenant_id or row.deleted_at is not None:
                return False
            row.deleted_at = _now()
            row.updated_at = _now()
            await session.commit()
            return True

    async def record_version(self, version: AgentVersion) -> AgentVersion:
        if not version.id:
            version.id = _new_version_id()
        version.created_at = _now()
        row = AgentVersionORM(
            id=version.id,
            tenant_id=version.tenant_id,
            agent_id=version.agent_id,
            version=version.version,
            change_log=version.change_log,
            snapshot=dict(version.snapshot) if version.snapshot else None,
            created_by=version.created_by,
            created_at=version.created_at,
        )
        async with self._session_factory() as session:
            session.add(row)
            await session.commit()
            return version

    async def list_versions(
        self,
        agent_id: str,
        tenant_id: str,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[AgentVersion], int]:
        from sqlalchemy import func, select

        async with self._session_factory() as session:
            base = select(AgentVersionORM).where(
                AgentVersionORM.tenant_id == tenant_id,
                AgentVersionORM.agent_id == agent_id,
            )
            count_base = (
                select(func.count())
                .select_from(AgentVersionORM)
                .where(
                    AgentVersionORM.tenant_id == tenant_id,
                    AgentVersionORM.agent_id == agent_id,
                )
            )
            total = (await session.execute(count_base)).scalar_one()
            rows = (
                await session.execute(
                    base.order_by(AgentVersionORM.created_at.desc())
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
            ).scalars().all()
            return [_version_row_to_model(r) for r in rows], total

    async def record_log(self, log: AgentOperationLog) -> AgentOperationLog:
        if not log.id:
            log.id = _new_log_id()
        log.created_at = _now()
        row = AgentOperationLogORM(
            id=log.id,
            tenant_id=log.tenant_id,
            agent_id=log.agent_id,
            actor=log.actor,
            action=log.action,
            resource=log.resource,
            ip=log.ip,
            status=log.status,
            trace_id=log.trace_id,
            created_at=log.created_at,
        )
        async with self._session_factory() as session:
            session.add(row)
            await session.commit()
            return log

    async def list_logs(
        self,
        agent_id: str,
        tenant_id: str,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[AgentOperationLog], int]:
        from sqlalchemy import func, select

        async with self._session_factory() as session:
            base = select(AgentOperationLogORM).where(
                AgentOperationLogORM.tenant_id == tenant_id,
                AgentOperationLogORM.agent_id == agent_id,
            )
            count_base = (
                select(func.count())
                .select_from(AgentOperationLogORM)
                .where(
                    AgentOperationLogORM.tenant_id == tenant_id,
                    AgentOperationLogORM.agent_id == agent_id,
                )
            )
            total = (await session.execute(count_base)).scalar_one()
            rows = (
                await session.execute(
                    base.order_by(AgentOperationLogORM.created_at.desc())
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
            ).scalars().all()
            return [_log_row_to_model(r) for r in rows], total
