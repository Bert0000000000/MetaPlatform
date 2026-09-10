"""temporal_rest — orchestrator REST 的 Temporal 双轨网关（Sprint 1A M3）。

`POST /api/v1/orchestrator/plans?engine=temporal` 走本模块（ADR-0061 双轨开关）；
默认（缺省 / engine=legacy）仍走内存 PlanRunner 老路径，语义不变。

设计边界：
- temporalio **lazy import** —— 未装 SDK 的环境（旧镜像 / 单测）import 本模块
  无副作用；`is_available()` 返回 False，路由层回 503。
- plan_id 即 workflow id（加 ``twf-`` 前缀区分 legacy plan）。
- submit 即 start（Temporal 语义里提交即持久执行），review 发 signal 后等终态。
"""
from __future__ import annotations

import asyncio
import os
from typing import Any

from .temporal_translation import (
    TASK_QUEUE,
    ReviewSignal,
    WorkflowStep,
    workflow_input_from_steps,
)

_ID_PREFIX = "twf-"
_client: Any = None


def is_available() -> bool:
    try:
        import temporalio  # noqa: F401
    except ImportError:
        return False
    return True


def engine_from(env_default: str | None, param: str | None) -> str:
    """解析生效引擎：显式参数 > 环境默认 > legacy。"""
    eng = (param or env_default or os.getenv("WORKFLOW_ENGINE", "legacy")).lower()
    return "temporal" if eng == "temporal" else "legacy"


def is_temporal_plan(plan_id: str) -> bool:
    return plan_id.startswith(_ID_PREFIX)


async def _get_client() -> Any:
    global _client
    if _client is None:
        import pathlib as _pl

        from temporalio.client import Client
        from temporalio.contrib.pydantic import pydantic_data_converter

        _default = ("host.docker.internal:7233"
                    if _pl.Path("/.dockerenv").exists() else "127.0.0.1:7233")
        host = os.environ.get("TEMPORAL_HOST", _default)
        _client = await Client.connect(
            host, data_converter=pydantic_data_converter,
        )
    return _client


async def submit_and_run(
    *, tenant_id: str, token: str, author_user_id: str,
    raw_steps: list[dict[str, Any]],
) -> dict[str, Any]:
    """提交并启动 PlanWorkflow（执行到首个 HITL 闸或终态）。"""
    from .temporal_workflow import PlanWorkflow

    client = await _get_client()
    steps = [WorkflowStep.model_validate(s) for s in raw_steps]
    inp = workflow_input_from_steps(
        tenant_id=tenant_id, steps=steps, author_user_id=author_user_id,
        token=token,
    )
    import time as _t

    wf_id = f"{_ID_PREFIX}{int(_t.time() * 1000)}-{_t.time_ns() % 100000:03d}"
    handle = await client.start_workflow(
        PlanWorkflow.run, inp.model_dump(mode="json"),
        id=wf_id, task_queue=TASK_QUEUE,
    )
    # 等到首个 HITL（或短平快直接终态）再返回，贴近 legacy submit+execute 语义
    for _ in range(60):
        st = await handle.query(PlanWorkflow.status)
        if str(st).startswith("hitl_waiting") or str(st) in (
            "completed", "aborted", "failed",
        ):
            break
        await asyncio.sleep(0.5)
    return {
        "plan_id": wf_id,
        "status": str(st),
        "engine": "temporal",
        "step_count": len(raw_steps),
    }


async def status(plan_id: str) -> dict[str, Any]:
    from .temporal_workflow import PlanWorkflow

    client = await _get_client()
    handle = client.get_workflow_handle(plan_id)
    desc = await handle.describe()
    # desc.status 为 proto int 枚举（1=RUNNING 2=COMPLETED 3=FAILED …）
    _STATUSES = {1: "running", 2: "completed", 3: "failed", 4: "cancelled",
                 5: "terminated", 6: "continued_as_new", 7: "timed_out"}
    raw = _STATUSES.get(int(getattr(desc, "status", 1)), "running")
    if raw != "running":
        return {"plan_id": plan_id, "status": raw, "engine": "temporal"}
    st = await handle.query(PlanWorkflow.status)
    cur = str(st).split(":", 1)[1] if ":" in str(st) else None
    return {"plan_id": plan_id, "status": str(st), "current_step_id": cur,
            "engine": "temporal"}


async def review(
    *, plan_id: str, step_id: str, approved: bool, feedback: str,
    wait_timeout_s: float = 60.0,
) -> dict[str, Any]:
    from .temporal_workflow import PlanWorkflow

    client = await _get_client()
    handle = client.get_workflow_handle(plan_id)
    await handle.signal(PlanWorkflow.review, ReviewSignal(
        step_id=step_id, approved=approved, feedback=feedback, reviewer="rest",
    ))
    try:
        result = await asyncio.wait_for(handle.result(), timeout=wait_timeout_s)
    except TimeoutError:
        st = await handle.query(PlanWorkflow.status)
        return {"plan_id": plan_id, "status": str(st), "engine": "temporal",
                "note": "review signaled; terminal state pending"}
    return {"plan_id": plan_id, "engine": "temporal", **{
        k: v for k, v in result.items() if k != "plan_id"
    }}
