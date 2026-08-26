"""Composition root for the real Temporal workflow worker."""
from __future__ import annotations

import asyncio
from typing import Any

from mate_tech_orchestrator.workflow_actions import build_order_review_action_executor

from mate_platform.workflow import WorkflowSettings
from mate_tech_db.base import init_engine

from .temporal_worker import connect_temporal_worker


def build_worker_action_executor() -> Any:
    """Load the domain action port used by the Temporal activity worker."""
    return build_order_review_action_executor()


async def run_worker() -> None:
    """Connect to Temporal, then run the worker until shutdown."""
    settings = WorkflowSettings.from_env()
    init_engine()
    worker = await connect_temporal_worker(
        settings,
        action_executor=build_worker_action_executor(),
    )
    await worker.run()


def main() -> None:
    """CLI entry point for ``python -m mate_app_wfe.worker_main``."""
    asyncio.run(run_worker())


if __name__ == "__main__":
    main()
