"""mate_tech_scheduler.clients — outbound client for real scheduler engine integration.

The ``AsyncSchedulerClient`` delegates to pluggable engine adapters:

* ``AirflowEngine`` — manages DAGs via the Airflow REST API
  (``httpx.AsyncClient``).
* ``DagsterEngine`` — manages runs via the Dagster GraphQL API
  (``httpx.AsyncClient``).

Both engines follow the ADR-0014 step 4 ACL Client pattern: configuration
is read from environment variables, HTTP calls carry auth headers, and
every outbound call is bounded by a timeout.

The client shape (``base_url`` + ``timeout_seconds``) is preserved from
the P2-W7 reserved interface; new engine methods are additive.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

from .services.airflow_engine import AirflowEngine, AirflowEngineError, AirflowTaskResult
from .services.dagster_engine import DagsterEngine, DagsterEngineError, DagsterRunResult


@dataclass
class AsyncSchedulerClient:
    """Outbound client for the DAG scheduling control plane.

    The client owns two engine adapters (Airflow + Dagster) and
    delegates ``pause_task`` / ``trigger_task`` / ``get_dag`` calls to
    the appropriate engine based on the ``engine`` parameter.

    Engines are lazily initialized from environment variables on
    construction if not explicitly provided (dependency injection
    for tests).
    """

    base_url: str
    timeout_seconds: float = 30.0
    airflow_engine: AirflowEngine | None = None
    dagster_engine: DagsterEngine | None = None

    def __post_init__(self) -> None:
        if not self.base_url:
            raise ValueError("base_url is required")
        if self.airflow_engine is None:
            self.airflow_engine = AirflowEngine.from_env(
                timeout_seconds=self.timeout_seconds,
            )
        if self.dagster_engine is None:
            self.dagster_engine = DagsterEngine.from_env(
                timeout_seconds=self.timeout_seconds,
            )

    # -----------------------------------------------------------------
    # Task operations — dispatch to Airflow or Dagster
    # -----------------------------------------------------------------
    async def pause_task(
        self,
        task_id: str,
        engine_dag_id: str,
        *,
        engine: str = "airflow",
    ) -> AirflowTaskResult | DagsterRunResult:
        """Pause a scheduling task on the underlying engine."""
        engine_lower = engine.lower()
        if engine_lower == "airflow":
            assert self.airflow_engine is not None
            return await self.airflow_engine.pause_task(task_id, engine_dag_id)
        if engine_lower == "dagster":
            # Dagster doesn't have a "pause" concept per se; we cancel
            # the latest run instead.
            assert self.dagster_engine is not None
            return await self.dagster_engine.cancel_run(task_id, engine_dag_id)
        raise ValueError(
            f"Unknown scheduler engine '{engine}'. Supported: airflow, dagster."
        )

    async def trigger_task(
        self,
        task_id: str,
        engine_dag_id: str,
        *,
        engine: str = "airflow",
        conf: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> AirflowTaskResult | DagsterRunResult:
        """Trigger a scheduling task on the underlying engine."""
        engine_lower = engine.lower()
        if engine_lower == "airflow":
            assert self.airflow_engine is not None
            return await self.airflow_engine.trigger_task(
                task_id, engine_dag_id, conf=conf,
            )
        if engine_lower == "dagster":
            assert self.dagster_engine is not None
            return await self.dagster_engine.trigger_task(
                task_id, **kwargs,
            )
        raise ValueError(
            f"Unknown scheduler engine '{engine}'. Supported: airflow, dagster."
        )

    async def get_dag(
        self,
        task_id: str,
        engine_dag_id: str,
        *,
        engine: str = "airflow",
    ) -> AirflowTaskResult | DagsterRunResult:
        """Get the status of a scheduling task on the underlying engine."""
        engine_lower = engine.lower()
        if engine_lower == "airflow":
            assert self.airflow_engine is not None
            return await self.airflow_engine.get_dag(task_id, engine_dag_id)
        if engine_lower == "dagster":
            assert self.dagster_engine is not None
            return await self.dagster_engine.get_run_status(task_id, engine_dag_id)
        raise ValueError(
            f"Unknown scheduler engine '{engine}'. Supported: airflow, dagster."
        )

    async def close(self) -> None:
        """Release resources held by the engine adapters."""
        if self.airflow_engine is not None:
            await self.airflow_engine.close()
        if self.dagster_engine is not None:
            await self.dagster_engine.close()
