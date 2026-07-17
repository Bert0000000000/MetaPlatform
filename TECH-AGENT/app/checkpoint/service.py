"""Checkpoint service: save, load, list, delete execution state."""

from __future__ import annotations

from typing import List, Optional

from app.checkpoint.repository import CheckpointRepository
from app.checkpoint.schemas import Checkpoint, CheckpointState


class CheckpointService:
    def __init__(self, repository: CheckpointRepository) -> None:
        self._repo = repository

    async def save_checkpoint(
        self,
        tenant_id: str,
        execution_id: str,
        agent_id: str,
        state: CheckpointState,
    ) -> Checkpoint:
        return await self._repo.save(execution_id, agent_id, tenant_id, state)

    async def load_checkpoint(
        self,
        tenant_id: str,
        execution_id: str,
    ) -> Optional[Checkpoint]:
        return await self._repo.load(execution_id, tenant_id)

    async def list_checkpoints(
        self,
        tenant_id: str,
        agent_id: str,
    ) -> List[Checkpoint]:
        return await self._repo.list_by_agent(agent_id, tenant_id)

    async def delete_checkpoint(
        self,
        tenant_id: str,
        execution_id: str,
    ) -> bool:
        return await self._repo.delete(execution_id, tenant_id)
