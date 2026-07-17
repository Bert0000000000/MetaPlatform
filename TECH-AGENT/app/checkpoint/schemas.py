"""Pydantic schemas for checkpoint mechanism (execution state persistence)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class CheckpointState(BaseModel):
    """Serializable execution state for checkpoint persistence."""

    node_states: Dict[str, Any] = Field(default_factory=dict)
    intermediate_results: List[Dict[str, Any]] = Field(default_factory=list)
    conversation_context: List[Dict[str, Any]] = Field(default_factory=list)
    current_node: str = ""
    iteration: int = 0
    metadata: Optional[Dict[str, Any]] = None


class Checkpoint(BaseModel):
    """A persisted checkpoint of an execution."""

    checkpoint_id: str
    execution_id: str
    agent_id: str
    tenant_id: str
    state: CheckpointState
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SaveCheckpointRequest(BaseModel):
    agentId: str = Field(min_length=1)
    state: CheckpointState


def checkpoint_to_dict(checkpoint: Checkpoint) -> dict:
    return {
        "checkpointId": checkpoint.checkpoint_id,
        "executionId": checkpoint.execution_id,
        "agentId": checkpoint.agent_id,
        "tenantId": checkpoint.tenant_id,
        "state": checkpoint.state.model_dump(mode="json"),
        "createdAt": checkpoint.created_at,
    }
