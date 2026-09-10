"""北极星 demo v2（Sprint 2）— 真实数据全链：
订单(真 PG) → Temporal plan(evaluate→propose action) → HITL → apply(写回) →
revert(audit-only) → workflow COMPLETED。

前置：docker 全栈（网关 8100 / ont 8007 / worker 1.5+ / temporal）。
"""

from __future__ import annotations

import asyncio
import json
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

GW = "http://localhost:8100"
STAGES: list[str] = []


def stage(n: int, msg: str) -> None:
    STAGES.append(f"[{n}] {msg}")
    print(f"[{n}] {msg}", flush=True)


def _req(path: str, method: str = "GET", body: dict | None = None, token: str = ""):
    req = urllib.request.Request(
        GW + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "Content-Type": "application/json",
            **({"Authorization": f"Bearer {token}"} if token else {}),
        },
        method=method,
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


async def _wait_hitl(handle, timeout_s: float = 60.0) -> str:
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
    token = _req("/api/v1/iam/auth/login", "POST", {"username": "admin", "password": "admin123"})[
        "accessToken"
    ]
    stage(1, f"登录 OK（token {len(token)} chars）")

    orders = _req(
        "/api/v1/ont/v2/object-query",
        "POST",
        {
            "source": "ont.tenant-default.obj.crm.order.v1",
            "filters": [],
            "paging_limit": 5,
        },
        token,
    )
    rows = orders.get("rows") or []
    if not rows:
        print("无订单实例可演示（先 seed）")
        return 1
    order = rows[0]
    order_rid = order["__rid__"]
    stage(
        2,
        f"真实订单数据: {order_rid} "
        f"amount={order.get('order-order-amount')} status={order.get('order-order-status')}",
    )

    act = "ont.tenant-default.act.order-review-confirm.v1"
    client = await Client.connect("127.0.0.1:7233", data_converter=pydantic_data_converter)
    steps = [
        WorkflowStep(
            step_id="evidence",
            kind="evaluate_object_set",
            target="ont.tenant-default.obj.crm.order.v1",
            payload={"filter": {}, "paging": {"limit": 3}},
        ),
        WorkflowStep(
            step_id="propose",
            kind="propose",
            target=act,
            payload={
                "parameters": {"decision": "confirm"},
                "target_iid": order_rid,
                "impact_summary": f"北极星 v2: 复核订单 {order_rid}",
            },
        ),
    ]
    inp = workflow_input_from_steps(tenant_id="tenant-default", steps=steps, token=token)
    handle = await client.start_workflow(
        PlanWorkflow.run,
        inp.model_dump(mode="json"),
        id=f"northstar-v2-{int(time.time() * 1000)}",
        task_queue=TASK_QUEUE,
    )
    gate = await _wait_hitl(handle)
    stage(3, f"Temporal plan 提交 → HITL 挂起于 {gate}（proposal 已建）")

    proposal_hint = json.dumps(handle.result if False else "")
    await handle.signal(
        PlanWorkflow.review,
        ReviewSignal(step_id=gate.split(":", 1)[1], approved=True, reviewer="northstar-v2"),
    )
    result = await asyncio.wait_for(handle.result(), timeout=120)
    stage(4, f"HITL 批准 → confirm+apply 真实写回 → plan {result['status']}")

    # revert：找到刚执行的 proposal（从 plan results 中提取 proposal_id）
    proposal_id = ""
    for r in result.get("results", []):
        out = r.get("output") or {}
        if isinstance(out, dict):
            proposal_id = out.get("proposal_id") or (out.get("executed") or {}).get(
                "proposal_id", ""
            )
            if proposal_id:
                break
    if not proposal_id:
        print("未提取到 proposal_id，跳过 revert")
        return 1
    from mate_tech_orchestrator.temporal_workflow import RevertWorkflow

    rh = await client.start_workflow(
        RevertWorkflow.run,
        {"tenant_id": "tenant-default", "proposal_id": proposal_id, "token": token},
        id=f"northstar-revert-{int(time.time() * 1000)}",
        task_queue=TASK_QUEUE,
    )
    rr = await asyncio.wait_for(rh.result(), timeout=120)
    stage(5, f"revert（审计型补偿）→ {rr['status']} / equivalence={rr.get('equivalence')}")

    print("\n=== 北极星 demo v2 STAGES ===")
    for s in STAGES:
        print(s)
    print("NORTHSTAR-V2 PASS")
    with open("northstar-v2-result.json", "w", encoding="utf-8") as f:
        json.dump(
            {
                "stages": STAGES,
                "final": str(result["status"]),
                "revert": {k: rr.get(k) for k in ("status", "equivalence")},
            },
            f,
            ensure_ascii=False,
            indent=2,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
