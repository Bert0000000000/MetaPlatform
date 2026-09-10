"""Sprint 1A M1 live smoke: PlanWorkflow on real Temporal.

Path A: run_function -> HITL gate -> approve -> completed
Path B: run_function -> HITL gate -> reject  -> aborted

TEMPORAL_HOST env overrides the server address (default 127.0.0.1:7233;
set to e.g. temporal:7233 when running inside the docker network).
"""
from __future__ import annotations

import asyncio
import os
import sys

sys.path.insert(0, "packages/mate-tech-orchestrator/src")

from mate_tech_orchestrator.temporal_translation import (
    TASK_QUEUE,
    ReviewSignal,
    WorkflowStep,
    workflow_input_from_steps,
)
from mate_tech_orchestrator.temporal_workflow import PlanWorkflow
from temporalio.client import Client
from temporalio.contrib.pydantic import pydantic_data_converter

TEMPORAL_ADDR = os.environ.get("TEMPORAL_HOST", "127.0.0.1:7233")


async def _run(approved: bool) -> dict:
    client = await Client.connect(TEMPORAL_ADDR, data_converter=pydantic_data_converter)
    steps = [
        WorkflowStep(
            step_id="s1", kind="run_function", target="inline",
            payload={"source": "print('sprint1a-m1-ok')"},
        ),
        WorkflowStep(
            step_id="s2", kind="run_function", target="inline",
            payload={"source": "print('after-hitl')"},
            requires_hitl=True,
        ),
    ]
    inp = workflow_input_from_steps(tenant_id="tenant-default", steps=steps)
    handle = await client.start_workflow(
        PlanWorkflow.run,
        inp.model_dump(mode="json"),
        id=f"plan-smoke-{'approve' if approved else 'reject'}-{id(steps)}",
        task_queue=TASK_QUEUE,
    )
    # poll until the workflow parks on the HITL gate (signal buffers anyway)
    mid = ""
    for _ in range(30):
        await asyncio.sleep(0.5)
        mid = await handle.query(PlanWorkflow.status)
        if str(mid).startswith("hitl_waiting"):
            break
    await handle.signal(PlanWorkflow.review, ReviewSignal(
        step_id="s2", approved=approved,
        feedback="live-smoke", reviewer="acceptance",
    ))
    result = await handle.result()
    return {"mid_status": mid, "final": result}


async def main() -> int:
    a = await _run(True)
    print("APPROVE:", a["mid_status"], "->", a["final"]["status"], a["final"]["plan_id"])
    b = await _run(False)
    print("REJECT: ", b["mid_status"], "->", b["final"]["status"], b["final"]["plan_id"])
    ok = (
        a["mid_status"] == "hitl_waiting:s2" and a["final"]["status"] == "completed"
        and b["mid_status"] == "hitl_waiting:s2" and b["final"]["status"] == "aborted"
    )
    print("SMOKE", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
