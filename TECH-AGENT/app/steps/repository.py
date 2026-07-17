"""Data access layer for execution steps, tool calls, and evaluations."""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from threading import RLock
from typing import Any, List, Optional

from app.steps.schemas import (
    EvaluationRecord,
    ExecutionStepRecord,
    ToolCallRecord,
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
