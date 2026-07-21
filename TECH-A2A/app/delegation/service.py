"""Task Delegation service: outbound JSON-RPC tasks/send and lifecycle management."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from app.audit.schemas import AuditAction
from app.audit.service import AuditService
from app.clients.agent_client import AgentClient
from app.delegation.repository import DelegationRepository
from app.delegation.schemas import (
    CreateDelegationRequest,
    DelegatedTask,
    DelegateTaskRequest,
    DelegationCallbackRequest,
    StatusHistoryEntry,
    TaskArtifact,
    TaskStatus,
    UpdateTimeoutRequest,
)
from app.events.schemas import EventType
from app.events.outbox import OutboxService
from app.common.errors import InvalidParamError, TaskAlreadyCompletedError, TaskNotFoundError


# V14-06: 委托任务状态机（submitted → working → input-required → completed/failed/canceled）
_DELEGATION_TRANSITIONS: dict[TaskStatus, set[TaskStatus]] = {
    TaskStatus.SUBMITTED: {
        TaskStatus.WORKING,
        TaskStatus.INPUT_REQUIRED,
        TaskStatus.COMPLETED,
        TaskStatus.FAILED,
        TaskStatus.CANCELED,
    },
    TaskStatus.WORKING: {
        TaskStatus.INPUT_REQUIRED,
        TaskStatus.COMPLETED,
        TaskStatus.FAILED,
        TaskStatus.CANCELED,
    },
    TaskStatus.INPUT_REQUIRED: {
        TaskStatus.WORKING,
        TaskStatus.COMPLETED,
        TaskStatus.FAILED,
        TaskStatus.CANCELED,
    },
    TaskStatus.COMPLETED: set(),
    TaskStatus.FAILED: set(),
    TaskStatus.CANCELED: set(),
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_callback_status(value: str) -> TaskStatus:
    mapping = {
        "submitted": TaskStatus.SUBMITTED,
        "working": TaskStatus.WORKING,
        "input-required": TaskStatus.INPUT_REQUIRED,
        "input_required": TaskStatus.INPUT_REQUIRED,
        "completed": TaskStatus.COMPLETED,
        "failed": TaskStatus.FAILED,
        "canceled": TaskStatus.CANCELED,
        "cancelled": TaskStatus.CANCELLED,
    }
    lower = value.lower()
    if lower in mapping:
        return mapping[lower]
    return TaskStatus(value.upper())


class DelegationService:
    def __init__(
        self,
        repository: DelegationRepository,
        agent_client: AgentClient,
        outbox_service: OutboxService,
        audit_service: Optional[AuditService] = None,
    ) -> None:
        self._repo = repository
        self._agent_client = agent_client
        self._outbox = outbox_service
        # 审计服务可选；为空时失败回写审计静默跳过（保持向后兼容）
        self._audit = audit_service

    async def delegate_task(
        self,
        tenant_id: str,
        request: DelegateTaskRequest,
        *,
        trace_id: Optional[str] = None,
    ) -> DelegatedTask:
        """Delegate a task to an external agent via JSON-RPC tasks/send."""

        task = DelegatedTask(
            id="",
            tenant_id=tenant_id,
            source_agent_id=request.sourceAgentId,
            target_agent_id=request.targetAgentId,
            task_type=request.taskType,
            payload=dict(request.payload),
            status=TaskStatus.PENDING,
            trace_id=trace_id,
            timeout=request.timeout,
            callback_url=request.callbackUrl,
            status_history=[
                StatusHistoryEntry(status=TaskStatus.PENDING, detail="Task created"),
            ],
        )
        task = await self._repo.create(task)

        # Publish event
        await self._outbox.publish_event(
            EventType.AGENT_DELEGATED,
            {
                "taskId": task.id,
                "sourceAgentId": task.source_agent_id,
                "targetAgentId": task.target_agent_id,
                "taskType": task.task_type,
            },
            trace_id=trace_id,
        )

        # Send to external agent
        try:
            result = await self._agent_client.send_task(
                target_endpoint=f"agents/{request.targetAgentId}/jsonrpc",
                task_id=task.id,
                task_type=task.task_type,
                payload=task.payload,
                trace_id=trace_id,
            )
            status = TaskStatus(result.get("status", "COMPLETED"))
            update_fields: dict[str, Any] = {
                "status": status,
            }
            if status == TaskStatus.COMPLETED:
                # 兼容真实 Agent 路径：result 内可能缺少 artifacts 字段，
                # 兜底写入空列表，保证 data.result.artifacts 始终存在
                inner_result = dict(result.get("result") or {})
                inner_result.setdefault("artifacts", [])
                update_fields["result"] = inner_result
                update_fields["completed_at"] = _now()
            elif status == TaskStatus.FAILED:
                update_fields["error"] = result.get("error")
                update_fields["completed_at"] = _now()

            update_fields["status_history"] = task.status_history + [
                StatusHistoryEntry(status=status, detail="Task sent to target agent")
            ]

            task = await self._repo.update(task.id, tenant_id, update_fields)
            if task is None:
                raise TaskNotFoundError(
                    f"Task 不存在: taskId={task.id}",
                )

            # Publish completion/failure event
            if status == TaskStatus.COMPLETED:
                await self._outbox.publish_event(
                    EventType.AGENT_COMPLETED,
                    {"taskId": task.id, "result": task.result},
                    trace_id=trace_id,
                )
            elif status == TaskStatus.FAILED:
                await self._outbox.publish_event(
                    EventType.AGENT_FAILED,
                    {"taskId": task.id, "error": task.error},
                    trace_id=trace_id,
                )

            return task
        except Exception:
            # Mark as FAILED if sending fails
            update_fields = {
                "status": TaskStatus.FAILED,
                "error": "Failed to send task to target agent",
                "completed_at": _now(),
                "status_history": task.status_history + [
                    StatusHistoryEntry(status=TaskStatus.FAILED, detail="Failed to send task")
                ],
            }
            task = await self._repo.update(task.id, tenant_id, update_fields)
            await self._outbox.publish_event(
                EventType.AGENT_FAILED,
                {"taskId": task.id if task else "", "error": "Send failed"},
                trace_id=trace_id,
            )
            # 失败回写 TASK_FAILED 审计，使 TASK_DELEGATED/TASK_FAILED 双记录成对出现
            if self._audit is not None and task is not None:
                await self._audit.record_audit(
                    tenant_id,
                    AuditAction.TASK_FAILED,
                    actor_id=task.source_agent_id,
                    target_id=task.target_agent_id,
                    details={"taskId": task.id, "reason": "Send failed"},
                    trace_id=trace_id,
                )
            if task is None:
                raise TaskNotFoundError(f"Task 不存在")
            return task

    # --------------------------------------------------- V14-06 delegations

    async def create_delegation(
        self,
        tenant_id: str,
        request: CreateDelegationRequest,
        *,
        trace_id: Optional[str] = None,
    ) -> DelegatedTask:
        """Create an async A2A delegation and wait for external callback."""

        task = DelegatedTask(
            id="",
            tenant_id=tenant_id,
            source_agent_id=request.sourceAgentId,
            target_agent_id=request.targetAgentId,
            task_type=request.taskType,
            payload=dict(request.payload),
            status=TaskStatus.SUBMITTED,
            trace_id=trace_id,
            timeout=request.timeout,
            callback_url=request.callbackUrl,
            status_history=[
                StatusHistoryEntry(status=TaskStatus.SUBMITTED, detail="Delegation submitted"),
            ],
        )
        task = await self._repo.create(task)

        await self._outbox.publish_event(
            EventType.AGENT_DELEGATED,
            {
                "taskId": task.id,
                "sourceAgentId": task.source_agent_id,
                "targetAgentId": task.target_agent_id,
                "taskType": task.task_type,
            },
            trace_id=trace_id,
        )
        return task

    async def apply_callback(
        self,
        tenant_id: str,
        task_id: str,
        request: DelegationCallbackRequest,
        *,
        trace_id: Optional[str] = None,
    ) -> DelegatedTask:
        """Apply an external agent callback with a state-machine guard."""

        task = await self.get_task(tenant_id, task_id)
        try:
            new_status = _parse_callback_status(request.status)
        except ValueError as exc:
            raise InvalidParamError(
                f"不支持的回调状态: {request.status}",
                data={"allowed": [s.value for s in TaskStatus]},
            ) from exc

        # 对 V14-06 委托状态机路径做转校验
        if task.status in _DELEGATION_TRANSITIONS:
            allowed = _DELEGATION_TRANSITIONS[task.status]
            if new_status not in allowed:
                raise InvalidParamError(
                    f"非法状态转换: {task.status.value} -> {new_status.value}",
                    data={"from": task.status.value, "to": new_status.value},
                )

        update_fields: dict[str, Any] = {
            "status": new_status,
            "status_history": task.status_history + [
                StatusHistoryEntry(
                    status=new_status,
                    detail=f"Callback received: {new_status.value}",
                )
            ],
        }
        if request.result is not None:
            result = dict(request.result)
            result.setdefault("artifacts", [])
            update_fields["result"] = result
        if request.error is not None:
            update_fields["error"] = request.error
        if request.artifacts is not None:
            update_fields["artifacts"] = task.artifacts + list(request.artifacts)
        if new_status in (TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELED):
            update_fields["completed_at"] = _now()

        updated = await self._repo.update(task_id, tenant_id, update_fields)
        if updated is None:
            raise TaskNotFoundError(
                f"Task 不存在: taskId={task_id}",
                data={"taskId": task_id},
            )

        if new_status == TaskStatus.COMPLETED:
            await self._outbox.publish_event(
                EventType.AGENT_COMPLETED,
                {"taskId": task_id, "result": updated.result},
                trace_id=trace_id,
            )
        elif new_status in (TaskStatus.FAILED, TaskStatus.CANCELED):
            await self._outbox.publish_event(
                EventType.AGENT_FAILED,
                {"taskId": task_id, "error": updated.error},
                trace_id=trace_id,
            )

        return updated

    async def cancel_delegation(
        self,
        tenant_id: str,
        task_id: str,
        *,
        trace_id: Optional[str] = None,
    ) -> DelegatedTask:
        """Cancel a delegation that has not reached a terminal state."""

        task = await self.get_task(tenant_id, task_id)
        if task.status in (TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELED, TaskStatus.CANCELLED):
            raise TaskAlreadyCompletedError(
                f"委托已终态，无法取消: taskId={task_id}, status={task.status.value}",
                data={"taskId": task_id, "status": task.status.value},
            )

        update_fields = {
            "status": TaskStatus.CANCELED,
            "completed_at": _now(),
            "status_history": task.status_history + [
                StatusHistoryEntry(status=TaskStatus.CANCELED, detail="Delegation canceled")
            ],
        }
        updated = await self._repo.update(task_id, tenant_id, update_fields)
        if updated is None:
            raise TaskNotFoundError(
                f"Task 不存在: taskId={task_id}",
                data={"taskId": task_id},
            )

        await self._outbox.publish_event(
            EventType.TASK_CANCELLED,
            {"taskId": task_id},
            trace_id=trace_id,
        )
        return updated

    async def get_task(self, tenant_id: str, task_id: str) -> DelegatedTask:
        task = await self._repo.get(task_id, tenant_id)
        if task is None:
            raise TaskNotFoundError(
                f"Task 不存在: taskId={task_id}",
                data={"taskId": task_id},
            )
        return task

    async def list_tasks(
        self,
        tenant_id: str,
        *,
        status: Optional[TaskStatus] = None,
        source_agent_id: Optional[str] = None,
        target_agent_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[DelegatedTask], int]:
        return await self._repo.list(
            tenant_id,
            status=status,
            source_agent_id=source_agent_id,
            target_agent_id=target_agent_id,
            page=page,
            page_size=page_size,
        )

    async def get_task_status(self, tenant_id: str, task_id: str) -> TaskStatus:
        task = await self.get_task(tenant_id, task_id)
        return task.status

    async def get_task_result(self, tenant_id: str, task_id: str) -> Optional[dict]:
        task = await self.get_task(tenant_id, task_id)
        return task.result

    async def cancel_task(
        self,
        tenant_id: str,
        task_id: str,
        *,
        trace_id: Optional[str] = None,
    ) -> DelegatedTask:
        task = await self.get_task(tenant_id, task_id)
        if task.status in (TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED):
            raise TaskAlreadyCompletedError(
                f"Task 已终态，无法取消: taskId={task_id}, status={task.status.value}",
                data={"taskId": task_id, "status": task.status.value},
            )

        update_fields = {
            "status": TaskStatus.CANCELLED,
            "completed_at": _now(),
            "status_history": task.status_history + [
                StatusHistoryEntry(status=TaskStatus.CANCELLED, detail="Task cancelled")
            ],
        }
        updated = await self._repo.update(task_id, tenant_id, update_fields)
        if updated is None:
            raise TaskNotFoundError(
                f"Task 不存在: taskId={task_id}",
                data={"taskId": task_id},
            )

        await self._outbox.publish_event(
            EventType.TASK_CANCELLED,
            {"taskId": task_id},
            trace_id=trace_id,
        )
        return updated

    async def update_timeout(
        self,
        tenant_id: str,
        task_id: str,
        request: UpdateTimeoutRequest,
    ) -> DelegatedTask:
        task = await self.get_task(tenant_id, task_id)
        updated = await self._repo.update(task_id, tenant_id, {"timeout": request.timeout})
        if updated is None:
            raise TaskNotFoundError(
                f"Task 不存在: taskId={task_id}",
                data={"taskId": task_id},
            )
        return updated

    async def get_status_history(self, tenant_id: str, task_id: str) -> list:
        task = await self.get_task(tenant_id, task_id)
        # 按 timestamp 升序返回，确保消费方拿到稳定的时间线
        return sorted(task.status_history, key=lambda e: e.timestamp)

    async def get_artifacts(self, tenant_id: str, task_id: str) -> list:
        task = await self.get_task(tenant_id, task_id)
        return task.artifacts

    async def add_artifact(
        self,
        tenant_id: str,
        task_id: str,
        artifact: TaskArtifact,
    ) -> DelegatedTask:
        task = await self.get_task(tenant_id, task_id)
        new_artifacts = task.artifacts + [artifact]
        updated = await self._repo.update(task_id, tenant_id, {"artifacts": new_artifacts})
        if updated is None:
            raise TaskNotFoundError(
                f"Task 不存在: taskId={task_id}",
                data={"taskId": task_id},
            )
        return updated

    async def update_task_status(
        self,
        tenant_id: str,
        task_id: str,
        status: TaskStatus,
        *,
        result: Optional[dict] = None,
        error: Optional[str] = None,
        trace_id: Optional[str] = None,
    ) -> DelegatedTask:
        """Internal method to update task status (used by inbound/routing)."""
        task = await self.get_task(tenant_id, task_id)
        update_fields: dict[str, Any] = {
            "status": status,
            "status_history": task.status_history + [
                StatusHistoryEntry(status=status, detail=f"Status updated to {status.value}")
            ],
        }
        if result is not None:
            update_fields["result"] = result
        if error is not None:
            update_fields["error"] = error
        if status in (TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED):
            update_fields["completed_at"] = _now()

        updated = await self._repo.update(task_id, tenant_id, update_fields)
        if updated is None:
            raise TaskNotFoundError(
                f"Task 不存在: taskId={task_id}",
                data={"taskId": task_id},
            )

        if status == TaskStatus.COMPLETED:
            await self._outbox.publish_event(
                EventType.AGENT_COMPLETED,
                {"taskId": task_id, "result": result},
                trace_id=trace_id,
            )
        elif status == TaskStatus.FAILED:
            await self._outbox.publish_event(
                EventType.AGENT_FAILED,
                {"taskId": task_id, "error": error},
                trace_id=trace_id,
            )

        return updated
