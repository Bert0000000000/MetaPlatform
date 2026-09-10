"""mate_tech_orchestrator.temporal_worker — Temporal worker entrypoint.

ADR-0061 Sprint 1A Milestone 1: activities wrap the existing
:class:`PlanRunner` public API (``execute`` / ``review``); the durable
workflow definition lives in :mod:`mate_tech_orchestrator.temporal_workflow`.
Run: ``python -m mate_tech_orchestrator.temporal_worker``.
"""
from __future__ import annotations

import asyncio
import os
from typing import Any

from temporalio import activity
from temporalio.client import Client
from temporalio.contrib.pydantic import pydantic_data_converter
from temporalio.worker import Worker

from .scheduler.ontology_client import OntologyActionClient
from .scheduler.plan_runner import PlanRunner
from .temporal_translation import (
    TASK_QUEUE,
    TEMPORAL_HOST,
    PlanWorkflowInput,
    plan_steps_from_dicts,
    workflow_input_to_plan_steps,
)
from .temporal_workflow import PlanWorkflow, RevertWorkflow

_SERVICE_TOKEN: dict[str, Any] = {"token": "", "exp": 0.0}


def _service_token() -> str:
    """常驻 relay 场景无用户上下文：向 IAM 换取服务 token（dev LEGACY 路径，
    TTL 内缓存；到期前 5 分钟重取）。"""
    import time as _t
    import urllib.request

    now = _t.time()
    if _SERVICE_TOKEN["token"] and now < _SERVICE_TOKEN["exp"] - 300:
        return _SERVICE_TOKEN["token"]
    url = os.environ.get(
        "IAM_LOGIN_URL", "http://host.docker.internal:8100/api/v1/iam/auth/login")
    req = urllib.request.Request(
        url, data=__import__("json").dumps(
            {"username": os.environ.get("IAM_USER", "admin"),
             "password": os.environ.get("IAM_PASS", "admin123")}).encode(),
        headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = __import__("json").loads(resp.read())
    tok = data["accessToken"]
    _SERVICE_TOKEN["token"] = tok
    _SERVICE_TOKEN["exp"] = now + float(data.get("expiresIn", 3600))
    print("[temporal-worker] service token acquired", flush=True)
    return tok


_RUNNER: PlanRunner | None = None


def _build_runner() -> PlanRunner:
    """Process-wide singleton: plan state lives in-memory in PlanRunner, so
    ``orch_start_plan`` and ``orch_review_step`` must share one instance
    (durable workflow state is Temporal history; M1 keeps runner state
    process-local, same as the REST path)."""
    global _RUNNER
    if _RUNNER is None:
        _RUNNER = PlanRunner(
            ontology_client=OntologyActionClient(
                base_url=os.environ.get("ONTOLOGY_URL", "http://localhost:8307"),
            ),
        )
    return _RUNNER


@activity.defn
async def orch_start_plan(inp: dict[str, Any]) -> dict[str, Any]:
    """Activity: submit plan to PlanRunner + execute until HITL/done."""
    parsed = PlanWorkflowInput.model_validate(inp)
    runner = _build_runner()
    plan_steps = plan_steps_from_dicts(workflow_input_to_plan_steps(parsed))
    spec = runner.submit(author_user_id=parsed.author_user_id, steps=plan_steps)
    result = await runner.execute(
        plan_id=spec.plan_id, tenant_id=parsed.tenant_id,
        token=parsed.token or _service_token(),
    )
    return {"plan_id": spec.plan_id, **result}


@activity.defn
async def orch_review_step(inp: dict[str, Any]) -> dict[str, Any]:
    """Activity: resolve one HITL step via PlanRunner.review (合一)."""
    runner = _build_runner()
    from .scheduler.plan_runner import PlanNotFoundError

    try:
        return await runner.review(
            plan_id=str(inp["plan_id"]),
            step_id=str(inp["step_id"]),
            approved=bool(inp["approved"]),
            feedback=str(inp.get("feedback", "")),
            tenant_id=str(inp["tenant_id"]),
            token=str(inp.get("token") or _service_token()),
        )
    except PlanNotFoundError:
        # worker 重启丢了内存 plan 状态：无副作用可续，直接终态而非无限重试
        return {
            "plan_id": str(inp["plan_id"]),
            "status": "aborted",
            "reason": "plan state lost after worker restart",
            "current_step_id": None,
            "results": [],
        }


@activity.defn
async def orch_revert_proposal(inp: dict[str, Any]) -> dict[str, Any]:
    """Activity：调 ont revert（PRD-02 M3 长补偿链）。"""
    runner = _build_runner()
    client = runner._ont  # OntologyActionClient（构造注入）
    if client is None:
        return {"status": "failed", "reason": "ontology client not configured"}
    return await client.revert(
        str(inp["tenant_id"]), str(inp["proposal_id"]),
        token=str(inp.get("token") or _service_token()),
    )


async def _selfheal_watcher(host: str, interval_s: float = 30.0,
                             max_failures: int = 3) -> None:
    """gRPC 长轮询自愈（M3）：周期性 get_system_info 探活。

    本机 Docker VM 会静默掐断 gRPC 长连接（进程存活但 poller 失聪）。
    连续 N 次探活失败即 os._exit(1)，交由 ``--restart unless-stopped``
    拉起新进程换新 poller —— worker 无本地状态（plan 状态在
    PlanRunner/review 终态化已处理丢失场景），重启安全。
    """
    import os as _os

    from temporalio.client import Client as _Client

    failures = 0
    while True:
        await asyncio.sleep(interval_s)
        try:
            c = await _Client.connect(host)
            try:
                await c.workflow_service.get_system_info()
            except TypeError:
                # temporalio ≥1.7 要求 request 参数（旧签名无参会 TypeError）
                from temporalio.api.workflowservice.v1 import (
                    GetSystemInfoRequest,
                )

                await c.workflow_service.get_system_info(GetSystemInfoRequest())
            failures = 0
        except Exception as exc:
            failures += 1
            print(f"[temporal-worker][selfheal] probe failed "
                  f"({failures}/{max_failures}): {exc}", flush=True)
            if failures >= max_failures:
                print("[temporal-worker][selfheal] giving up — exiting for "
                      "restart-policy revival", flush=True)
                _os._exit(1)


async def run_worker() -> None:
    host = os.environ.get("TEMPORAL_HOST", TEMPORAL_HOST)
    if os.environ.get("SEED_ROLES", "0") == "1":
        try:
            from .bootstrap import seed_default_roles

            seeded = seed_default_roles()
            print(f"[temporal-worker] seeded roles: {seeded}")
        except Exception as exc:  # pragma: no cover - defensive
            print(f"[temporal-worker] role seeding failed (non-fatal): {exc}")
    client = await Client.connect(host, data_converter=pydantic_data_converter)
    watcher = asyncio.create_task(_selfheal_watcher(host))
    worker = Worker(
        client,
        task_queue=TASK_QUEUE,
        workflows=[PlanWorkflow, RevertWorkflow],
        activities=[orch_start_plan, orch_review_step, orch_revert_proposal],
    )
    try:
        await worker.run()
    finally:
        watcher.cancel()


if __name__ == "__main__":
    asyncio.run(run_worker())

