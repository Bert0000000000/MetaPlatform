"""Sprint 1A M2 — 5 StepKind live e2e + 长任务 demo（真 Temporal + 容器 worker + 真 ont）。

前置：
  - docker: temporal(:7233) / mate-temporal-worker(:plan-orchestration 队列) /
    mate-api-gateway(8100) / mate-tech-ont（worker 内 ONTOLOGY_URL 直连）
路径：
  1. run_function            —— 内联沙箱执行（无外部依赖）
  2. evaluate_object_set     —— IR 查询真 ont 类型（经网关 token）
  3. propose(create_instance)→ HITL → reject（零落库 negative）
  4. apply_action ≡ propose   —— create_instance → HITL → approve（真实落库 + 状态 applied）
  5. call_agent              —— ONTOLOGY 数字员工经 MCP 中心执行 ont_list_classes
  LT. 长任务 demo              —— HITL 挂起 ≥75s 后 signal 恢复（wait_condition 持久等待）
"""
from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
import time
import urllib.request

sys.path.insert(0, "packages/mate-tech-orchestrator/src")

from temporalio.client import Client
from temporalio.contrib.pydantic import pydantic_data_converter

from mate_tech_orchestrator.temporal_translation import (
    TASK_QUEUE,
    ReviewSignal,
    WorkflowStep,
    workflow_input_from_steps,
)
from mate_tech_orchestrator.temporal_workflow import PlanWorkflow

GW = "http://127.0.0.1:8100"
_TS = int(time.time())


def _props_for(t: dict) -> dict:
    """从类型元数据构造合法 props：PK 唯一值，其余按 type_id 给简单值。"""
    pks = set(t.get("primary_key") or [])
    out: dict = {}
    for p in t.get("properties", []):
        name = p["rid"].rsplit(".", 2)[-2]
        if p["rid"] in pks:
            out[name] = f"e2e-{_TS}"
        elif p.get("type_id") == "integer":
            out[name] = 42
        elif p.get("type_id") == "number":
            out[name] = 4.2
        elif p.get("type_id") == "boolean":
            out[name] = True
        else:
            out[name] = "e2e-val"
    return out


def _post(path: str, body: dict, token: str = "") -> dict:
    req = urllib.request.Request(
        GW + path, data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", **(
            {"Authorization": f"Bearer {token}"} if token else {})},
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())


def _get(path: str, token: str) -> dict:
    req = urllib.request.Request(GW + path, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())


async def _wait_hitl(handle, timeout_s: float = 60.0) -> str:
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        st = await handle.query(PlanWorkflow.status)
        if str(st).startswith("hitl_waiting"):
            return str(st)
        if str(st) in ("completed", "aborted", "failed"):
            raise AssertionError(f"workflow reached terminal {st} before HITL")
        await asyncio.sleep(0.5)
    raise TimeoutError("no HITL within timeout")


async def _run_steps(client, tag: str, steps, token: str, approve: bool | None):
    # 环境绕行：本机 Docker VM 的 gRPC 长轮询会间歇僵死；每个 workflow 前
    # 重启 worker 换新 poller（SMOKE_RESTART_WORKER=1 时启用）。
    if os.environ.get("SMOKE_RESTART_WORKER") == "1":
        subprocess.run(["docker", "restart", "mate-temporal-worker"],
                       check=False, capture_output=True)
        await asyncio.sleep(12)
    inp = workflow_input_from_steps(tenant_id="tenant-default", steps=steps, token=token)
    handle = await client.start_workflow(
        PlanWorkflow.run, inp.model_dump(mode="json"),
        id=f"plan-5k-{tag}-{int(time.time()*1000)}", task_queue=TASK_QUEUE,
    )
    gate = await _wait_hitl(handle)
    if approve is not None:
        await handle.signal(PlanWorkflow.review, ReviewSignal(
            step_id=gate.split(":", 1)[1], approved=approve, reviewer="e2e",
        ))
    result = await handle.result()
    return gate, result


async def main() -> int:
    results: list[tuple[str, str, str]] = []  # (kind, gate, final_status)

    login = _post("/api/v1/iam/auth/login",
                  {"username": "admin", "password": "admin123"})
    token = login["accessToken"]
    types = _get("/api/v1/ont/v2/object-types?limit=50", token)
    target = next(
        (t for t in types if ".obj.employee." in t["rid"]),
        types[0],
    )
    props = _props_for(target)
    print(f"[env] gateway login OK; {len(types)} object types; "
          f"target={target['rid']} props={props}", flush=True)

    client = await Client.connect("127.0.0.1:7233", data_converter=pydantic_data_converter)

    # 1) run_function
    _, r = await _run_steps(client, "runfn", [WorkflowStep(
        step_id="s1", kind="run_function", target="inline",
        payload={"source": "print('five-kinds-e2e')"},
    ), WorkflowStep(step_id="s2", kind="run_function", target="inline",
                    payload={"source": "print('done')"}, requires_hitl=True)],
        token, approve=True)
    results.append(("run_function", "-", r["status"]))

    # 2) evaluate_object_set（真 ont IR 查询）
    _, r = await _run_steps(client, "objset", [WorkflowStep(
        step_id="q1", kind="evaluate_object_set", target=target["rid"],
        payload={"filter": {}, "paging": {"limit": 3}},
    ), WorkflowStep(step_id="s2", kind="run_function", target="inline",
                    payload={"source": "print('q-done')"}, requires_hitl=True)],
        token, approve=True)
    results.append(("evaluate_object_set", "-", r["status"]))

    # 3) propose → reject（零落库）
    _, r = await _run_steps(client, "prop-rej", [WorkflowStep(
        step_id="p1", kind="propose", target=target["rid"],
        payload={"action_kind": "create_instance",
                 "props": props},
    )], token, approve=False)
    results.append(("propose(reject)", "-", r["status"]))

    # 4) apply_action ≡ propose → approve（真实落库）
    _, r = await _run_steps(client, "apply-ok", [WorkflowStep(
        step_id="a1", kind="apply_action", target=target["rid"],
        payload={"action_kind": "create_instance",
                 "props": props},
    )], token, approve=True)
    results.append(("apply_action(approve)", "-", r["status"]))

    # 5) call_agent（ONTOLOGY 员工经 MCP ont_list_classes）
    _, r = await _run_steps(client, "callag", [WorkflowStep(
        step_id="c1", kind="call_agent", target="ontology",
        payload={"capability": "list_classes"},
    ), WorkflowStep(step_id="s2", kind="run_function", target="inline",
                    payload={"source": "print('agent-done')"}, requires_hitl=True)],
        token, approve=True)
    results.append(("call_agent", "-", r["status"]))

    # LT) 长任务：HITL 挂起 ≥75s 再恢复（wait_condition 持久等待）
    inp = workflow_input_from_steps(tenant_id="tenant-default", token=token, steps=[
        WorkflowStep(step_id="lt", kind="run_function", target="inline",
                     payload={"source": "print('long-task-start')"},
                     requires_hitl=True),
    ])
    if os.environ.get("SMOKE_RESTART_WORKER") == "1":
        subprocess.run(["docker", "restart", "mate-temporal-worker"],
                       check=False, capture_output=True)
        await asyncio.sleep(12)
    h = await client.start_workflow(
        PlanWorkflow.run, inp.model_dump(mode="json"),
        id=f"plan-lt-{int(time.time()*1000)}", task_queue=TASK_QUEUE,
    )
    gate = await _wait_hitl(h)
    t0 = time.monotonic()
    await asyncio.sleep(75)  # 模拟长审批窗口：workflow 保持 wait_condition
    mid2 = await h.query(PlanWorkflow.status)
    waited = time.monotonic() - t0
    await h.signal(PlanWorkflow.review, ReviewSignal(
        step_id=gate.split(":", 1)[1], approved=True, reviewer="long-task-demo",
    ))
    lt = await h.result()
    print(f"[LT] gate={gate} waited={waited:.0f}s mid={mid2} final={lt['status']}", flush=True)
    results.append(("long_task(75s)", gate, lt["status"]))

    print("\n=== RESULTS ===")
    for kind, gate, status in results:
        print(f"{kind:28s} {status}", flush=True)
    ok = all(s == "completed" or (k.startswith("propose") and s == "aborted")
             for k, g, s in results)
    print("FIVE-KINDS", "PASS" if ok else "FAIL", flush=True)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
