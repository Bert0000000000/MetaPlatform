"""Agent task service: create, assign, list, update status, statistics."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, List, Optional

from app.common.errors import InvalidParamError
from app.tasks.repository import TaskRepository
from app.tasks.schemas import (
    AgentTask,
    CreateTaskRequest,
    TaskPriority,
    TaskStatistics,
    TaskStatus,
    UpdateTaskStatusRequest,
)


class TaskService:
    def __init__(self, repository: TaskRepository) -> None:
        self._repo = repository

    async def create(
        self,
        tenant_id: str,
        request: CreateTaskRequest,
    ) -> AgentTask:
        task = AgentTask(
            id="",
            tenant_id=tenant_id,
            agent_id=request.agentId,
            title=request.title,
            description=request.description,
            priority=request.priority,
            assigned_to=request.assignedTo,
            input=request.input,
        )
        if request.assignedTo:
            task.status = TaskStatus.ASSIGNED
        return await self._repo.create(task)

    async def get(self, tenant_id: str, task_id: str) -> AgentTask:
        task = await self._repo.get(task_id, tenant_id)
        if task is None:
            raise InvalidParamError(
                f"任务不存在: taskId={task_id}",
                data={"taskId": task_id},
            )
        return task

    async def list(
        self,
        tenant_id: str,
        *,
        agent_id: Optional[str] = None,
        status: Optional[TaskStatus] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[List[AgentTask], int]:
        return await self._repo.list(
            tenant_id,
            agent_id=agent_id,
            status=status,
            page=page,
            page_size=page_size,
        )

    async def assign(
        self,
        tenant_id: str,
        task_id: str,
        assigned_to: str,
    ) -> AgentTask:
        task = await self.get(tenant_id, task_id)
        if task.status in (TaskStatus.COMPLETED, TaskStatus.CANCELLED):
            raise InvalidParamError(
                f"无法分配已结束的任务: status={task.status.value}",
                data={"taskId": task_id, "status": task.status.value},
            )
        fields: dict[str, Any] = {
            "assigned_to": assigned_to,
            "status": TaskStatus.ASSIGNED,
        }
        updated = await self._repo.update(task_id, tenant_id, fields)
        assert updated is not None
        return updated

    async def update_status(
        self,
        tenant_id: str,
        task_id: str,
        request: UpdateTaskStatusRequest,
    ) -> AgentTask:
        task = await self.get(tenant_id, task_id)
        fields: dict[str, Any] = {"status": request.status}

        now = datetime.now(timezone.utc)
        if request.status == TaskStatus.RUNNING and task.started_at is None:
            fields["started_at"] = now
        if request.status in (TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED):
            fields["completed_at"] = now
        if request.output is not None:
            fields["output"] = request.output
        if request.errorMessage is not None:
            fields["error_message"] = request.errorMessage

        updated = await self._repo.update(task_id, tenant_id, fields)
        assert updated is not None
        return updated

    async def get_task_result(
        self,
        tenant_id: str,
        task_id: str,
    ) -> Optional[dict]:
        task = await self.get(tenant_id, task_id)
        return task.output

    async def get_statistics(
        self,
        tenant_id: str,
        agent_id: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> TaskStatistics:
        tasks = await self._repo.list_for_stats(
            tenant_id, agent_id, start_time, end_time
        )
        total = len(tasks)
        completed = sum(1 for t in tasks if t.status == TaskStatus.COMPLETED)
        failed = sum(1 for t in tasks if t.status == TaskStatus.FAILED)
        running = sum(1 for t in tasks if t.status == TaskStatus.RUNNING)
        pending = sum(
            1
            for t in tasks
            if t.status in (TaskStatus.PENDING, TaskStatus.ASSIGNED)
        )

        durations: list[float] = []
        for t in tasks:
            if t.status == TaskStatus.COMPLETED and t.started_at and t.completed_at:
                durations.append(
                    (t.completed_at - t.started_at).total_seconds() * 1000
                )
        avg_duration = sum(durations) / len(durations) if durations else 0.0

        return TaskStatistics(
            total=total,
            completed=completed,
            failed=failed,
            running=running,
            pending=pending,
            avg_duration_ms=round(avg_duration, 2),
        )
