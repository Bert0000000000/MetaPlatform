"""Workflow backend configuration and production safety checks."""
from __future__ import annotations

import os
from dataclasses import dataclass
from enum import StrEnum

from mate_platform.runtime import is_production_profile, runtime_profile


class WorkflowBackend(StrEnum):
    """Supported workflow execution backends."""

    LOCAL = "local"
    TEMPORAL = "temporal"


@dataclass(frozen=True, slots=True)
class WorkflowSettings:
    """Resolved workflow settings shared by API and worker processes."""

    profile: str
    backend: WorkflowBackend
    temporal_address: str
    namespace: str
    task_queue: str

    @property
    def is_deployed_profile(self) -> bool:
        return self.profile in {"production", "prod", "staging"}

    @classmethod
    def from_env(cls) -> WorkflowSettings:
        profile = runtime_profile()
        raw_backend = os.getenv("MATE_WORKFLOW_BACKEND", "local").strip().lower()
        try:
            backend = WorkflowBackend(raw_backend)
        except ValueError as exc:
            raise RuntimeError(
                f"unsupported MATE_WORKFLOW_BACKEND {raw_backend!r}; "
                "expected 'temporal' or 'local'"
            ) from exc

        address = os.getenv("TEMPORAL_ADDRESS", "").strip()
        settings = cls(
            profile=profile,
            backend=backend,
            temporal_address=address,
            namespace=os.getenv("TEMPORAL_NAMESPACE", "default").strip() or "default",
            task_queue=os.getenv("TEMPORAL_TASK_QUEUE", "mate-platform").strip()
            or "mate-platform",
        )
        settings.validate()
        return settings

    def validate(self) -> None:
        if self.is_deployed_profile and self.backend is not WorkflowBackend.TEMPORAL:
            raise RuntimeError(
                f"Temporal backend is required in {self.profile} profile; "
                "local workflow execution is disabled"
            )
        if self.backend is WorkflowBackend.TEMPORAL and not self.temporal_address:
            raise RuntimeError("TEMPORAL_ADDRESS is required for the Temporal backend")
        if is_production_profile() and self.profile != runtime_profile():
            raise RuntimeError("workflow profile changed while settings were being validated")
