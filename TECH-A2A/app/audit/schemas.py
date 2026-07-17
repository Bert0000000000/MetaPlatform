"""Pydantic schemas for Audit records."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class AuditAction(str, Enum):
    AGENT_REGISTERED = "AGENT_REGISTERED"
    AGENT_DEREGISTERED = "AGENT_DEREGISTERED"
    TASK_DELEGATED = "TASK_DELEGATED"
    TASK_RECEIVED = "TASK_RECEIVED"
    TASK_COMPLETED = "TASK_COMPLETED"
    TASK_FAILED = "TASK_FAILED"
    TASK_CANCELLED = "TASK_CANCELLED"
    MESSAGE_SENT = "MESSAGE_SENT"
    MESSAGE_ACKED = "MESSAGE_ACKED"
    API_KEY_GENERATED = "API_KEY_GENERATED"
    API_KEY_REVOKED = "API_KEY_REVOKED"
    CARD_PUBLISHED = "CARD_PUBLISHED"
    ROUTED_TO_AGENT = "ROUTED_TO_AGENT"
    ROUTED_TO_WORKFLOW = "ROUTED_TO_WORKFLOW"


class AuditRecord(BaseModel):
    """An audit record for A2A operations."""

    id: str
    tenant_id: str
    action: AuditAction
    actor_id: str = ""
    target_id: str = ""
    details: Dict[str, Any] = Field(default_factory=dict)
    trace_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AuditStats(BaseModel):
    """Aggregated audit statistics."""

    total_records: int = 0
    by_action: Dict[str, int] = Field(default_factory=dict)
    by_agent: Dict[str, int] = Field(default_factory=dict)
    errors: int = 0
    delegations: int = 0
    collaborations: int = 0


def audit_to_dict(record: AuditRecord) -> dict:
    action_value = record.action.value if isinstance(record.action, AuditAction) else record.action
    return {
        "auditId": record.id,
        "tenantId": record.tenant_id,
        "action": action_value,
        "actorId": record.actor_id,
        "targetId": record.target_id,
        "details": record.details,
        "traceId": record.trace_id,
        "createdAt": record.created_at,
    }
