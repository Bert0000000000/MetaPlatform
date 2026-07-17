"""Data access layer for Agent tools."""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from threading import RLock
from typing import Any, List, Optional

from app.agents.orm import Base
from app.tools.orm import ToolORM
from app.tools.schemas import AgentTool, ToolType


def _row_to_model(row: ToolORM) -> AgentTool:
    return AgentTool(
        id=row.id,
        tenant_id=row.tenant_id,
        agent_id=row.agent_id,
        name=row.name,
        description=row.description or "",
        tool_type=ToolType(row.tool_type),
        config=dict(row.config or {}),
        input_schema=dict(row.input_schema) if row.input_schema else None,
        output_schema=dict(row.output_schema) if row.output_schema else None,
        enabled=row.enabled.lower() == "true" if row.enabled else True,
        created_at=row.created_at if row.created_at else _now(),
        updated_at=row.updated_at if row.updated_at else _now(),
    )


def _model_to_row(tool: AgentTool) -> ToolORM:
    return ToolORM(
        id=tool.id,
        tenant_id=tool.tenant_id,
        agent_id=tool.agent_id,
        name=tool.name,
        description=tool.description,
        tool_type=tool.tool_type.value,
        config=dict(tool.config),
        input_schema=dict(tool.input_schema) if tool.input_schema else None,
        output_schema=dict(tool.output_schema) if tool.output_schema else None,
        enabled=str(tool.enabled).lower(),
        created_at=tool.created_at,
        updated_at=tool.updated_at,
    )


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_id() -> str:
    return f"tool-{uuid.uuid4().hex[:24]}"


class ToolRepository(ABC):
    """Abstract repository for agent tools."""

    @abstractmethod
    async def create(self, tool: AgentTool) -> AgentTool: ...

    @abstractmethod
    async def get(self, tool_id: str, tenant_id: str) -> Optional[AgentTool]: ...

    @abstractmethod
    async def list(
        self,
        tenant_id: str,
        agent_id: str,
        *,
        enabled_only: bool = False,
    ) -> List[AgentTool]: ...

    @abstractmethod
    async def update(
        self, tool_id: str, tenant_id: str, fields: dict[str, Any]
    ) -> Optional[AgentTool]: ...

    @abstractmethod
    async def delete(self, tool_id: str, tenant_id: str) -> bool: ...


class InMemoryToolRepository(ToolRepository):
    """Thread-safe in-memory tool repository."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._store: dict[tuple[str, str], AgentTool] = {}

    async def create(self, tool: AgentTool) -> AgentTool:
        with self._lock:
            if not tool.id:
                tool.id = _new_id()
            tool.created_at = _now()
            tool.updated_at = tool.created_at
            self._store[(tool.tenant_id, tool.id)] = tool
            return tool

    async def get(self, tool_id: str, tenant_id: str) -> Optional[AgentTool]:
        with self._lock:
            return self._store.get((tenant_id, tool_id))

    async def list(
        self,
        tenant_id: str,
        agent_id: str,
        *,
        enabled_only: bool = False,
    ) -> List[AgentTool]:
        with self._lock:
            results = [
                t
                for (tid, _), t in self._store.items()
                if tid == tenant_id
                and t.agent_id == agent_id
                and (not enabled_only or t.enabled)
            ]
        results.sort(key=lambda t: t.created_at)
        return results

    async def update(
        self, tool_id: str, tenant_id: str, fields: dict[str, Any]
    ) -> Optional[AgentTool]:
        with self._lock:
            tool = self._store.get((tenant_id, tool_id))
            if tool is None:
                return None
            updated = tool.model_copy(update=fields)
            updated.updated_at = _now()
            self._store[(tenant_id, tool_id)] = updated
            return updated

    async def delete(self, tool_id: str, tenant_id: str) -> bool:
        with self._lock:
            return self._store.pop((tenant_id, tool_id), None) is not None

    # -- test helper --

    def clear(self) -> None:
        with self._lock:
            self._store.clear()


class SqlAlchemyToolRepository(ToolRepository):
    """Async SQLAlchemy 2.0 repository backed by ``agent_tools``."""

    def __init__(self, session_factory) -> None:
        self._session_factory = session_factory

    @classmethod
    async def create_all(cls, engine) -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def create(self, tool: AgentTool) -> AgentTool:
        if not tool.id:
            tool.id = _new_id()
        tool.created_at = _now()
        tool.updated_at = tool.created_at
        row = _model_to_row(tool)
        async with self._session_factory() as session:
            session.add(row)
            await session.commit()
            return tool

    async def get(self, tool_id: str, tenant_id: str) -> Optional[AgentTool]:
        async with self._session_factory() as session:
            row = await session.get(ToolORM, tool_id)
            if row is None or row.tenant_id != tenant_id:
                return None
            return _row_to_model(row)

    async def list(
        self,
        tenant_id: str,
        agent_id: str,
        *,
        enabled_only: bool = False,
    ) -> List[AgentTool]:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = select(ToolORM).where(
                ToolORM.tenant_id == tenant_id,
                ToolORM.agent_id == agent_id,
            )
            if enabled_only:
                stmt = stmt.where(ToolORM.enabled == "true")
            stmt = stmt.order_by(ToolORM.created_at)
            rows = (await session.execute(stmt)).scalars().all()
            return [_row_to_model(r) for r in rows]

    async def update(
        self, tool_id: str, tenant_id: str, fields: dict[str, Any]
    ) -> Optional[AgentTool]:
        async with self._session_factory() as session:
            row = await session.get(ToolORM, tool_id)
            if row is None or row.tenant_id != tenant_id:
                return None
            if "name" in fields:
                row.name = fields["name"]
            if "description" in fields:
                row.description = fields["description"]
            if "tool_type" in fields:
                row.tool_type = fields["tool_type"].value
            if "config" in fields:
                row.config = dict(fields["config"])
            if "input_schema" in fields:
                row.input_schema = (
                    dict(fields["input_schema"])
                    if fields["input_schema"]
                    else None
                )
            if "output_schema" in fields:
                row.output_schema = (
                    dict(fields["output_schema"])
                    if fields["output_schema"]
                    else None
                )
            if "enabled" in fields:
                row.enabled = str(fields["enabled"]).lower()
            row.updated_at = _now()
            await session.commit()
            return _row_to_model(row)

    async def delete(self, tool_id: str, tenant_id: str) -> bool:
        async with self._session_factory() as session:
            row = await session.get(ToolORM, tool_id)
            if row is None or row.tenant_id != tenant_id:
                return False
            await session.delete(row)
            await session.commit()
            return True
