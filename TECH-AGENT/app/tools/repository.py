"""Data access layer for Agent tools."""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from threading import RLock
from typing import Any, List, Optional

from app.tools.schemas import AgentTool, ToolType


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
