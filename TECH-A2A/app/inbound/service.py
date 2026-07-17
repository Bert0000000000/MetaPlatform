"""Inbound Task service: receive external JSON-RPC tasks/send."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from app.delegation.schemas import TaskStatus
from app.events.outbox import OutboxService
from app.events.schemas import EventType
from app.inbound.schemas import InboundTask, inbound_task_to_dict


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_id() -> str:
    return f"inb-{uuid.uuid4().hex[:24]}"


class InboundService:
    """Service for receiving and managing inbound A2A tasks."""

    def __init__(self, outbox_service: OutboxService) -> None:
        self._outbox = outbox_service
        self._store: dict[tuple[str, str], InboundTask] = {}

    async def receive_task(
        self,
        tenant_id: str,
        source_agent_id: str,
        target_agent_id: str,
        task_type: str,
        payload: dict[str, Any],
        *,
        trace_id: Optional[str] = None,
        jsonrpc_id: Optional[str] = None,
    ) -> InboundTask:
        """Accept an incoming JSON-RPC tasks/send request."""

        task = InboundTask(
            id=_new_id(),
            tenant_id=tenant_id,
            source_agent_id=source_agent_id,
            target_agent_id=target_agent_id,
            task_type=task_type,
            payload=dict(payload),
            status=TaskStatus.PENDING,
            trace_id=trace_id,
            jsonrpc_id=jsonrpc_id,
        )
        self._store[(tenant_id, task.id)] = task

        await self._outbox.publish_event(
            EventType.TASK_RECEIVED,
            {
                "taskId": task.id,
                "sourceAgentId": source_agent_id,
                "targetAgentId": target_agent_id,
                "taskType": task_type,
            },
            trace_id=trace_id,
        )
        return task

    async def get_task(self, tenant_id: str, task_id: str) -> InboundTask:
        task = self._store.get((tenant_id, task_id))
        if task is None:
            from app.common.errors import TaskNotFoundError
            raise TaskNotFoundError(
                f"Inbound Task 不存在: taskId={task_id}",
                data={"taskId": task_id},
            )
        return task

    async def update_task_status(
        self,
        tenant_id: str,
        task_id: str,
        status: TaskStatus,
        *,
        result: Optional[dict] = None,
        error: Optional[str] = None,
        trace_id: Optional[str] = None,
    ) -> InboundTask:
        task = await self.get_task(tenant_id, task_id)
        task.status = status
        task.updated_at = _now()
        if result is not None:
            task.result = result
        if error is not None:
            task.error = error
        if status in (TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED):
            task.completed_at = _now()
        self._store[(tenant_id, task_id)] = task

        if status == TaskStatus.COMPLETED:
            await self._outbox.publish_event(
                EventType.TASK_COMPLETED,
                {"taskId": task_id, "result": result},
                trace_id=trace_id,
            )
        elif status == TaskStatus.FAILED:
            await self._outbox.publish_event(
                EventType.TASK_FAILED,
                {"taskId": task_id, "error": error},
                trace_id=trace_id,
            )
        elif status == TaskStatus.CANCELLED:
            await self._outbox.publish_event(
                EventType.TASK_CANCELLED,
                {"taskId": task_id},
                trace_id=trace_id,
            )
        return task

    async def cancel_task(
        self,
        tenant_id: str,
        task_id: str,
        *,
        trace_id: Optional[str] = None,
    ) -> InboundTask:
        return await self.update_task_status(
            tenant_id, task_id, TaskStatus.CANCELLED, trace_id=trace_id
        )

    async def list_tasks(
        self,
        tenant_id: str,
        *,
        status: Optional[TaskStatus] = None,
    ) -> list[InboundTask]:
        results = []
        for (tid, _), task in self._store.items():
            if tid != tenant_id:
                continue
            if status is not None and task.status != status:
                continue
            results.append(task)
        results.sort(key=lambda t: t.created_at)
        return results

    def clear(self) -> None:
        self._store.clear()
