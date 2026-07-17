"""Audit service: record and query A2A operations, compute statistics."""

from __future__ import annotations

from collections import Counter
from typing import Any, Optional

from app.audit.repository import AuditRepository
from app.audit.schemas import (
    AuditAction,
    AuditRecord,
    AuditStats,
    audit_to_dict,
)


class AuditService:
    def __init__(self, repository: AuditRepository) -> None:
        self._repo = repository

    async def record_audit(
        self,
        tenant_id: str,
        action: AuditAction,
        *,
        actor_id: str = "",
        target_id: str = "",
        details: Optional[dict[str, Any]] = None,
        trace_id: Optional[str] = None,
    ) -> AuditRecord:
        record = AuditRecord(
            id="",
            tenant_id=tenant_id,
            action=action,
            actor_id=actor_id,
            target_id=target_id,
            details=details or {},
            trace_id=trace_id,
        )
        return await self._repo.create(record)

    async def list_audit(
        self,
        tenant_id: str,
        *,
        action: Optional[AuditAction] = None,
        actor_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[AuditRecord], int]:
        return await self._repo.list(
            tenant_id,
            action=action,
            actor_id=actor_id,
            page=page,
            page_size=page_size,
        )

    async def get_collaboration_stats(self, tenant_id: str) -> dict:
        """Statistics on agent collaborations (messages + co-task participation)."""
        records = await self._repo.list_all(tenant_id)
        collab_actions = {
            AuditAction.MESSAGE_SENT,
            AuditAction.MESSAGE_ACKED,
            AuditAction.TASK_DELEGATED,
            AuditAction.TASK_RECEIVED,
        }
        collaboration_count = sum(1 for r in records if r.action in collab_actions)
        unique_pairs: set[tuple[str, str]] = set()
        for r in records:
            if r.actor_id and r.target_id:
                pair = tuple(sorted([r.actor_id, r.target_id]))
                unique_pairs.add(pair)
        return {
            "totalCollaborations": collaboration_count,
            "uniqueAgentPairs": len(unique_pairs),
            "pairs": [list(p) for p in sorted(unique_pairs)],
        }

    async def get_delegation_stats(self, tenant_id: str) -> dict:
        """Statistics on task delegations."""
        records = await self._repo.list_all(tenant_id)
        deleg_actions = {
            AuditAction.TASK_DELEGATED,
            AuditAction.TASK_RECEIVED,
            AuditAction.TASK_COMPLETED,
            AuditAction.TASK_FAILED,
            AuditAction.TASK_CANCELLED,
        }
        deleg_records = [r for r in records if r.action in deleg_actions]
        by_action: dict[str, int] = {}
        for r in deleg_records:
            by_action[r.action.value] = by_action.get(r.action.value, 0) + 1
        return {
            "totalDelegations": sum(1 for r in deleg_records if r.action == AuditAction.TASK_DELEGATED),
            "completed": by_action.get(AuditAction.TASK_COMPLETED.value, 0),
            "failed": by_action.get(AuditAction.TASK_FAILED.value, 0),
            "cancelled": by_action.get(AuditAction.TASK_CANCELLED.value, 0),
            "byAction": by_action,
        }

    async def get_error_stats(self, tenant_id: str) -> dict:
        """Statistics on errors."""
        records = await self._repo.list_all(tenant_id)
        error_records = [r for r in records if r.action == AuditAction.TASK_FAILED]
        by_agent: dict[str, int] = {}
        for r in error_records:
            by_agent[r.actor_id] = by_agent.get(r.actor_id, 0) + 1
        return {
            "totalErrors": len(error_records),
            "byAgent": by_agent,
        }

    async def get_agent_stats(self, tenant_id: str) -> dict:
        """Statistics per agent."""
        records = await self._repo.list_all(tenant_id)
        by_agent: dict[str, dict[str, int]] = {}
        for r in records:
            agent = r.actor_id or "unknown"
            if agent not in by_agent:
                by_agent[agent] = Counter()
            by_agent[agent][r.action.value] += 1
        return {
            "agents": {k: dict(v) for k, v in sorted(by_agent.items())},
        }

    async def export_report(self, tenant_id: str) -> dict:
        """Export a full audit report."""
        records = await self._repo.list_all(tenant_id)
        return {
            "tenantId": tenant_id,
            "totalRecords": len(records),
            "records": [audit_to_dict(r) for r in records],
            "collaborationStats": await self.get_collaboration_stats(tenant_id),
            "delegationStats": await self.get_delegation_stats(tenant_id),
            "errorStats": await self.get_error_stats(tenant_id),
            "agentStats": await self.get_agent_stats(tenant_id),
        }
