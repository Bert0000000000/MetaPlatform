"""mate_tech_etl.clients — outbound client for real ETL engine integration.

The ``AsyncEtlClient`` delegates to pluggable engine adapters:

* ``SparkSubmitEngine`` — submits Spark jobs via the ``spark-submit``
  CLI (``asyncio.subprocess``).
* ``FlinkSubmitEngine`` — submits Flink jobs via the JobManager REST
  API (``httpx.AsyncClient``).

Both engines follow the ADR-0014 step 4 ACL Client pattern: configuration
is read from environment variables, HTTP calls carry auth headers, and
every outbound call is bounded by a timeout.

The client shape (``base_url`` + ``timeout_seconds``) is preserved from
the P2-W7 reserved interface; new engine methods are additive.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any

from .services.flink_engine import FlinkJobResult, FlinkSubmitEngine, FlinkSubmitError
from .services.spark_engine import SparkSubmissionResult, SparkSubmitEngine, SparkSubmitError


@dataclass
class AsyncEtlClient:
    """Outbound client for the ETL task control plane.

    The client owns two engine adapters (Spark + Flink) and delegates
    ``run_task`` / ``stop_task`` / ``get_status`` calls to the
    appropriate engine based on the ``engine`` parameter.

    Engines are lazily initialized from environment variables on first
    access if not explicitly provided (dependency injection for tests).
    """

    base_url: str
    timeout_seconds: float = 30.0
    spark_engine: SparkSubmitEngine | None = None
    flink_engine: FlinkSubmitEngine | None = None

    def __post_init__(self) -> None:
        if not self.base_url:
            raise ValueError("base_url is required")
        if self.spark_engine is None:
            self.spark_engine = SparkSubmitEngine.from_env(
                timeout_seconds=self.timeout_seconds,
            )
        if self.flink_engine is None:
            self.flink_engine = FlinkSubmitEngine.from_env(
                timeout_seconds=self.timeout_seconds,
            )

    # -----------------------------------------------------------------
    # Task operations — dispatch to Spark or Flink
    # -----------------------------------------------------------------
    async def run_task(
        self,
        task_id: str,
        *,
        engine: str = "spark",
        **kwargs: Any,
    ) -> SparkSubmissionResult | FlinkJobResult:
        """Submit an ETL task to the underlying engine.

        Args:
            task_id: The platform task identifier.
            engine: ``"spark"`` or ``"flink"``.
            **kwargs: Engine-specific arguments (e.g. ``script_path``
                for Spark, ``jar_id`` for Flink).

        Raises:
            ValueError: If the engine name is not recognized.
            SparkSubmitError / FlinkSubmitError: On engine failures.
        """
        engine_lower = engine.lower()
        if engine_lower == "spark":
            assert self.spark_engine is not None
            return await self.spark_engine.run_task(task_id, **kwargs)
        if engine_lower == "flink":
            assert self.flink_engine is not None
            return await self.flink_engine.run_task(task_id, **kwargs)
        raise ValueError(
            f"Unknown ETL engine '{engine}'. Supported: spark, flink."
        )

    async def stop_task(
        self,
        task_id: str,
        engine_job_id: str,
        *,
        engine: str = "spark",
    ) -> SparkSubmissionResult | FlinkJobResult:
        """Stop a running ETL task on the underlying engine."""
        engine_lower = engine.lower()
        if engine_lower == "spark":
            assert self.spark_engine is not None
            return await self.spark_engine.stop_task(task_id, engine_job_id)
        if engine_lower == "flink":
            assert self.flink_engine is not None
            return await self.flink_engine.stop_task(task_id, engine_job_id)
        raise ValueError(
            f"Unknown ETL engine '{engine}'. Supported: spark, flink."
        )

    async def get_status(
        self,
        task_id: str,
        engine_job_id: str,
        *,
        engine: str = "spark",
    ) -> SparkSubmissionResult | FlinkJobResult:
        """Get the status of an ETL task on the underlying engine."""
        engine_lower = engine.lower()
        if engine_lower == "spark":
            assert self.spark_engine is not None
            return await self.spark_engine.get_status(task_id, engine_job_id)
        if engine_lower == "flink":
            assert self.flink_engine is not None
            return await self.flink_engine.get_status(task_id, engine_job_id)
        raise ValueError(
            f"Unknown ETL engine '{engine}'. Supported: spark, flink."
        )

    async def close(self) -> None:
        """Release resources held by the engine adapters."""
        if self.flink_engine is not None:
            await self.flink_engine.close()
