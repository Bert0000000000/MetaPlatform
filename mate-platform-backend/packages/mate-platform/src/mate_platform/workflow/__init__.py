"""Backend-neutral workflow contracts and Temporal adapter."""
from .config import WorkflowBackend, WorkflowSettings
from .contracts import Plan, PlanStep, WorkflowRun, WorkflowRunStatus
from .executor import (
    InMemoryWorkflowExecutor,
    TemporalWorkflowExecutor,
    WorkflowExecutor,
    build_workflow_executor,
    connect_workflow_executor,
)

__all__ = [
    "InMemoryWorkflowExecutor",
    "Plan",
    "PlanStep",
    "TemporalWorkflowExecutor",
    "WorkflowBackend",
    "WorkflowExecutor",
    "WorkflowRun",
    "WorkflowRunStatus",
    "WorkflowSettings",
    "build_workflow_executor",
    "connect_workflow_executor",
]
