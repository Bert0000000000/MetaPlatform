"""M2 收尾：只跑 call_agent + LT 长任务（其余 4 kind 已在 5k3 全过）。"""
from __future__ import annotations

import asyncio
import json
import subprocess
import sys
import time
import urllib.request

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

GW = "http://127.0.0.1:8100"


def _login() -> str:
    req = urllib.request.Request(
        GW + "/api/v1/iam/auth/login",
        data=json.dumps({"username": "admin", "password": "admin123"}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())["accessToken"]


async def _fresh_worker() -> None:
    subprocess.run(["docker", "restart", "mate-temporal-worker"],
                   check=False, capture_output=True)
    await asyncio.sleep(14)


async def _wait_hitl(handle, timeout_s: float = 90.0) -> str:
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        st = str(await handle.query(PlanWorkflow.status))
        if st.startswith("hitl_waiting"):
            return st
        if st in ("completed", "aborted", "failed"):
            raise AssertionError(f"terminal {st} before HITL")
        await asyncio.sleep(0.5)
    raise TimeoutError("no HITL")


async def main() -> int:
    token = _login()
    client = await Client.connect("127.0.0.1:7233",
                                  data_converter=pydantic_data_converter)

    # 5) call_agent
    await _fresh_worker()
    steps = [
        WorkflowStep(step_id="c1", kind="call_agent", target="ontology",
                     payload={"capability": "list_classes"}),
        WorkflowStep(step_id="s2", kind="run_function", target="inline",
                     payload={"source": "print('agent-done')"},
                     requires_hitl=True),
    ]
    inp = workflow_input_from_steps(tenant_id="tenant-default", steps=steps, token=token)
    h = await client.start_workflow(
        PlanWorkflow.run, inp.model_dump(mode="json"),
        id=f"plan-callag-{int(time.time()*1000)}", task_queue=TASK_QUEUE)
    gate = await _wait_hitl(h)
    await h.signal(PlanWorkflow.review, ReviewSignal(
        step_id=gate.split(":", 1)[1], approved=True, reviewer="e2e"))
    r5 = await h.result()
    print(f"call_agent: {gate} -> {r5['status']}", flush=True)

    # LT) 长任务 ≥75s
    await _fresh_worker()
    lt_steps = [WorkflowStep(
        step_id="lt", kind="run_function", target="inline",
        payload={"source": "print('long-task-start')"}, requires_hitl=True)]
    inp = workflow_input_from_steps(tenant_id="tenant-default", steps=lt_steps, token=token)
    h2 = await client.start_workflow(
        PlanWorkflow.run, inp.model_dump(mode="json"),
        id=f"plan-lt-{int(time.time()*1000)}", task_queue=TASK_QUEUE)
    gate2 = await _wait_hitl(h2)
    t0 = time.monotonic()
    await asyncio.sleep(75)
    mid = str(await h2.query(PlanWorkflow.status))
    waited = time.monotonic() - t0
    await h2.signal(PlanWorkflow.review, ReviewSignal(
        step_id=gate2.split(":", 1)[1], approved=True, reviewer="long-task-demo"))
    rlt = await h2.result()
    print(f"long_task: {gate2} waited={waited:.0f}s mid={mid} -> {rlt['status']}",
          flush=True)

    ok = r5["status"] == "completed" and rlt["status"] == "completed"
    print("CALLAG+LT", "PASS" if ok else "FAIL", flush=True)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
