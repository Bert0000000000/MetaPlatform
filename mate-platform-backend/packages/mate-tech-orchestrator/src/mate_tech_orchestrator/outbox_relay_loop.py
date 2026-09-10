"""outbox_relay_loop — outbox→Temporal 常驻 relay（Sprint 2，ADR-0061 M2 尾巴）。

- :class:`TemporalWorkflowStarter`：把 :class:`OutboxTemporalBridge` 需要的
  ``WorkflowStarter`` 协议适配到 temporalio Client（惰性连接，进程内单例）。
- :class:`RelayLoop`：常驻 asyncio 任务，每 ``interval_s`` 扫一轮 pending
  outbox 事件并启动对应 PlanWorkflow（TRIGGER_RULES 白名单）；幂等——
  workflow id = ``outbox-{event_id}``，Temporal 侧重复启动同 id 会被拒绝，
  桥将失败计入 attempt 留待下轮（at-least-once 语义不变）。

环境：``TEMPORAL_HOST``（容器内默认 temporal:7233）、``RELAY_INTERVAL_S``。
"""
from __future__ import annotations

import asyncio
import os
import pathlib
from typing import Any

import structlog

from .temporal_translation import (
    TASK_QUEUE,
    WorkflowStep,
    workflow_input_from_steps,
)

logger = structlog.get_logger(__name__)


def _default_host() -> str:
    return ("host.docker.internal:7233"
            if pathlib.Path("/.dockerenv").exists() else "127.0.0.1:7233")


class TemporalWorkflowStarter:
    """WorkflowStarter 协议的 temporalio 实现（惰性 client）。"""

    def __init__(self, host: str | None = None) -> None:
        self._host = host or os.environ.get("TEMPORAL_HOST") or _default_host()
        self._client: Any = None

    async def _connect(self) -> Any:
        if self._client is None:
            from temporalio.client import Client
            from temporalio.contrib.pydantic import pydantic_data_converter

            self._client = await Client.connect(
                self._host, data_converter=pydantic_data_converter)
        return self._client

    async def start_plan(
        self, *, workflow_id: str, steps: list[dict[str, Any]],
        tenant_id: str, author_user_id: str, token: str = "",
    ) -> str:
        from mate_tech_orchestrator.temporal_workflow import PlanWorkflow

        client = await self._connect()
        inp = workflow_input_from_steps(
            tenant_id=tenant_id,
            steps=[WorkflowStep.model_validate(s) for s in steps],
            author_user_id=author_user_id, token=token,
        )
        handle = await client.start_workflow(
            PlanWorkflow.run, inp.model_dump(mode="json"),
            id=workflow_id, task_queue=TASK_QUEUE,
        )
        return handle.id


class RelayLoop:
    """常驻 relay 任务。"""

    def __init__(self, bridge: Any, interval_s: float | None = None) -> None:
        self._bridge = bridge
        self._interval = float(
            interval_s or os.environ.get("RELAY_INTERVAL_S", "10"))
        self._task: asyncio.Task | None = None

    async def _tick(self) -> None:
        stats = await self._bridge.relay_once()
        if stats["started"] or stats["failed"]:
            logger.info("outbox.relay.tick", **stats)

    async def _run(self) -> None:
        while True:
            try:
                await self._tick()
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.warning("outbox.relay.error", error=str(exc))
            await asyncio.sleep(self._interval)

    def start(self) -> None:
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def relay_once(self) -> dict[str, int]:
        """手动触发一轮（REST /outbox/relay 用）。"""
        return await self._bridge.relay_once()
