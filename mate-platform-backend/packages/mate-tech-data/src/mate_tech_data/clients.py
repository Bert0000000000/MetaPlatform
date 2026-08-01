"""mate_tech_data.clients — outbound client for real CDC engine integration.

The ``AsyncDataClient`` delegates to the ``DebeziumEngine`` adapter
which manages CDC connectors via the Kafka Connect REST API
(``httpx.AsyncClient``).

The engine reads its configuration from environment variables
(ADR-0014 step 4). The client shape (``base_url`` +
``timeout_seconds``) is preserved from the P2-W6 reserved interface;
new engine methods are additive.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

from .services.debezium_engine import CdcTaskResult, DebeziumEngine, DebeziumEngineError


@dataclass
class AsyncDataClient:
    """Outbound client for the data platform control plane.

    The client owns a ``DebeziumEngine`` adapter and delegates
    ``start_cdc_task`` / ``stop_cdc_task`` / ``get_status`` /
    ``test_connection`` / ``discover_source_schema`` calls to it.

    The engine is lazily initialized from environment variables on
    construction if not explicitly provided (dependency injection
    for tests).
    """

    base_url: str
    timeout_seconds: float = 30.0
    debezium_engine: DebeziumEngine | None = None

    def __post_init__(self) -> None:
        if not self.base_url:
            raise ValueError("base_url is required")
        if self.debezium_engine is None:
            self.debezium_engine = DebeziumEngine.from_env(
                timeout_seconds=self.timeout_seconds,
            )

    # -----------------------------------------------------------------
    # CDC task lifecycle
    # -----------------------------------------------------------------
    async def start_cdc_task(
        self,
        task_id: str,
        *,
        connector_name: str,
        connector_class: str,
        config: dict[str, Any],
    ) -> CdcTaskResult:
        """Create and start a Debezium CDC connector."""
        assert self.debezium_engine is not None
        return await self.debezium_engine.start_cdc_task(
            task_id,
            connector_name=connector_name,
            connector_class=connector_class,
            config=config,
        )

    async def stop_cdc_task(
        self, task_id: str, connector_name: str,
    ) -> CdcTaskResult:
        """Delete (stop) a Debezium CDC connector."""
        assert self.debezium_engine is not None
        return await self.debezium_engine.stop_cdc_task(task_id, connector_name)

    async def pause_cdc_task(
        self, task_id: str, connector_name: str,
    ) -> CdcTaskResult:
        """Pause a Debezium CDC connector."""
        assert self.debezium_engine is not None
        return await self.debezium_engine.pause_cdc_task(task_id, connector_name)

    async def resume_cdc_task(
        self, task_id: str, connector_name: str,
    ) -> CdcTaskResult:
        """Resume a paused Debezium CDC connector."""
        assert self.debezium_engine is not None
        return await self.debezium_engine.resume_cdc_task(task_id, connector_name)

    async def get_cdc_status(
        self, task_id: str, connector_name: str,
    ) -> CdcTaskResult:
        """Get the status of a Debezium CDC connector."""
        assert self.debezium_engine is not None
        return await self.debezium_engine.get_status(task_id, connector_name)

    # -----------------------------------------------------------------
    # Data source operations
    # -----------------------------------------------------------------
    async def test_connection(
        self,
        task_id: str,
        *,
        connector_class: str,
        config: dict[str, Any],
    ) -> dict[str, Any]:
        """Test a source connection via a temporary Debezium connector."""
        assert self.debezium_engine is not None
        return await self.debezium_engine.test_connection(
            task_id,
            connector_class=connector_class,
            config=config,
        )

    async def discover_source_schema(
        self, task_id: str, connector_name: str,
    ) -> dict[str, Any]:
        """Discover the schema of a source via its connector config."""
        assert self.debezium_engine is not None
        return await self.debezium_engine.discover_source_schema(
            task_id, connector_name,
        )

    async def close(self) -> None:
        """Release resources held by the engine adapter."""
        if self.debezium_engine is not None:
            await self.debezium_engine.close()
