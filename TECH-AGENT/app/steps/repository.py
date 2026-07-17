"""Data access layer for execution steps, tool calls, and evaluations."""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from threading import RLock
from typing import Any, List, Optional

from app.agents.orm import Base
from app.steps.orm import EvaluationORM, StepORM, ToolCallORM
from app.steps.schemas import (
    EvaluationRecord,
    ExecutionStepRecord,
    StepType,
    ToolCallRecord,
)


def _step_row_to_model(row: StepORM) -> ExecutionStepRecord:
    return ExecutionStepRecord(
        id=row.id,
        execution_id=row.execution_id,
        tenant_id=row.tenant_id,
        step_type=StepType(row.step_type),
        content=row.content,
        order=row.order,
        metadata=dict(row.meta_data) if row.meta_data else None,
        created_at=row.created_at if row.created_at else _now(),
    )


def _tool_call_row_to_model(row: ToolCallORM) -> ToolCallRecord:
    return ToolCallRecord(
        id=row.id,
        execution_id=row.execution_id,
        tenant_id=row.tenant_id,
        tool_name=row.tool_name,
        tool_input=dict(row.tool_input) if row.tool_input else None,
        tool_output=dict(row.tool_output) if row.tool_output else None,
        status=row.status,
        duration_ms=row.duration_ms,
        created_at=row.created_at if row.created_at else _now(),
    )


def _evaluation_row_to_model(row: EvaluationORM) -> EvaluationRecord:
    return EvaluationRecord(
        id=row.id,
        execution_id=row.execution_id,
        tenant_id=row.tenant_id,
        score=row.score,
        feedback=row.feedback or "",
        evaluator=row.evaluator,
        created_at=row.created_at if row.created_at else _now(),
    )


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:24]}"


class StepRepository(ABC):
    """Abstract repository for execution steps."""

    @abstractmethod
    async def add_step(self, step: ExecutionStepRecord) -> ExecutionStepRecord: ...

    @abstractmethod
    async def get_steps(
        self, execution_id: str, tenant_id: str
    ) -> List[ExecutionStepRecord]: ...

    @abstractmethod
    async def add_tool_call(
        self, tool_call: ToolCallRecord
    ) -> ToolCallRecord: ...

    @abstractmethod
    async def get_tool_calls(
        self, execution_id: str, tenant_id: str
    ) -> List[ToolCallRecord]: ...

    @abstractmethod
    async def add_evaluation(
        self, evaluation: EvaluationRecord
    ) -> EvaluationRecord: ...

    @abstractmethod
    async def get_evaluations(
        self, execution_id: str, tenant_id: str
    ) -> List[EvaluationRecord]: ...


class InMemoryStepRepository(StepRepository):
    """Thread-safe in-memory step repository."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._steps: dict[tuple[str, str], list[ExecutionStepRecord]] = {}
        self._tool_calls: dict[tuple[str, str], list[ToolCallRecord]] = {}
        self._evaluations: dict[tuple[str, str], list[EvaluationRecord]] = {}

    async def add_step(self, step: ExecutionStepRecord) -> ExecutionStepRecord:
        with self._lock:
            if not step.id:
                step.id = _new_id("step")
            key = (step.tenant_id, step.execution_id)
            self._steps.setdefault(key, []).append(step)
            return step

    async def get_steps(
        self, execution_id: str, tenant_id: str
    ) -> List[ExecutionStepRecord]:
        with self._lock:
            steps = list(self._steps.get((tenant_id, execution_id), []))
        steps.sort(key=lambda s: s.order)
        return steps

    async def add_tool_call(
        self, tool_call: ToolCallRecord
    ) -> ToolCallRecord:
        with self._lock:
            if not tool_call.id:
                tool_call.id = _new_id("tc")
            key = (tool_call.tenant_id, tool_call.execution_id)
            self._tool_calls.setdefault(key, []).append(tool_call)
            return tool_call

    async def get_tool_calls(
        self, execution_id: str, tenant_id: str
    ) -> List[ToolCallRecord]:
        with self._lock:
            return list(self._tool_calls.get((tenant_id, execution_id), []))

    async def add_evaluation(
        self, evaluation: EvaluationRecord
    ) -> EvaluationRecord:
        with self._lock:
            if not evaluation.id:
                evaluation.id = _new_id("eval")
            key = (evaluation.tenant_id, evaluation.execution_id)
            self._evaluations.setdefault(key, []).append(evaluation)
            return evaluation

    async def get_evaluations(
        self, execution_id: str, tenant_id: str
    ) -> List[EvaluationRecord]:
        with self._lock:
            return list(self._evaluations.get((tenant_id, execution_id), []))

    # -- test helper --

    def clear(self) -> None:
        with self._lock:
            self._steps.clear()
            self._tool_calls.clear()
            self._evaluations.clear()


class SqlAlchemyStepRepository(StepRepository):
    """Async SQLAlchemy 2.0 repository backed by steps tables."""

    def __init__(self, session_factory) -> None:
        self._session_factory = session_factory

    @classmethod
    async def create_all(cls, engine) -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def add_step(self, step: ExecutionStepRecord) -> ExecutionStepRecord:
        if not step.id:
            step.id = _new_id("step")
        row = StepORM(
            id=step.id,
            execution_id=step.execution_id,
            tenant_id=step.tenant_id,
            step_type=step.step_type.value,
            content=step.content,
            order=step.order,
            meta_data=dict(step.metadata) if step.metadata else None,
            created_at=step.created_at,
        )
        async with self._session_factory() as session:
            session.add(row)
            await session.commit()
            return step

    async def get_steps(
        self, execution_id: str, tenant_id: str
    ) -> List[ExecutionStepRecord]:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = (
                select(StepORM)
                .where(
                    StepORM.execution_id == execution_id,
                    StepORM.tenant_id == tenant_id,
                )
                .order_by(StepORM.order)
            )
            rows = (await session.execute(stmt)).scalars().all()
            return [_step_row_to_model(r) for r in rows]

    async def add_tool_call(
        self, tool_call: ToolCallRecord
    ) -> ToolCallRecord:
        if not tool_call.id:
            tool_call.id = _new_id("tc")
        row = ToolCallORM(
            id=tool_call.id,
            execution_id=tool_call.execution_id,
            tenant_id=tool_call.tenant_id,
            tool_name=tool_call.tool_name,
            tool_input=dict(tool_call.tool_input) if tool_call.tool_input else None,
            tool_output=dict(tool_call.tool_output) if tool_call.tool_output else None,
            status=tool_call.status,
            duration_ms=tool_call.duration_ms,
            created_at=tool_call.created_at,
        )
        async with self._session_factory() as session:
            session.add(row)
            await session.commit()
            return tool_call

    async def get_tool_calls(
        self, execution_id: str, tenant_id: str
    ) -> List[ToolCallRecord]:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = select(ToolCallORM).where(
                ToolCallORM.execution_id == execution_id,
                ToolCallORM.tenant_id == tenant_id,
            ).order_by(ToolCallORM.created_at)
            rows = (await session.execute(stmt)).scalars().all()
            return [_tool_call_row_to_model(r) for r in rows]

    async def add_evaluation(
        self, evaluation: EvaluationRecord
    ) -> EvaluationRecord:
        if not evaluation.id:
            evaluation.id = _new_id("eval")
        row = EvaluationORM(
            id=evaluation.id,
            execution_id=evaluation.execution_id,
            tenant_id=evaluation.tenant_id,
            score=evaluation.score,
            feedback=evaluation.feedback,
            evaluator=evaluation.evaluator,
            created_at=evaluation.created_at,
        )
        async with self._session_factory() as session:
            session.add(row)
            await session.commit()
            return evaluation

    async def get_evaluations(
        self, execution_id: str, tenant_id: str
    ) -> List[EvaluationRecord]:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = select(EvaluationORM).where(
                EvaluationORM.execution_id == execution_id,
                EvaluationORM.tenant_id == tenant_id,
            ).order_by(EvaluationORM.created_at)
            rows = (await session.execute(stmt)).scalars().all()
            return [_evaluation_row_to_model(r) for r in rows]
