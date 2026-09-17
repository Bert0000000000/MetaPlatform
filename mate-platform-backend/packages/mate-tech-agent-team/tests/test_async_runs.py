"""1.7 任务 1 · `POST /runs` 受理制（202 + run_id）+ 提交幂等。

**为什么要改**（1.6 浏览器验证抓出的两个真问题）：起一轮运行要拆图 + 并行派活，
实测量级是**分钟**，而前端 axios 默认 30s、网关读超时 60s。同步返回时客户端
拿到的是超时/504，**而这一轮其实已经建好了**——重试一次就多跑一轮。

**改法**：提交立刻返回 `202` + `run_id`，终态**只能**从 `GET /runs/{run_id}`
或事件流取；带 `Idempotency-Key` 时同一个键（同租户内）永远映射到同一轮运行，
重试原样回同一个 `run_id` 且不会再起一轮。

这些用例全部针对 **HTTP 面**（不是服务层）：判据本来就是"提交立刻回 run_id"，
只有从路由上看才算数。
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import Iterator
from contextlib import ExitStack
from typing import Any

import pytest
from fastapi.testclient import TestClient
from mate_tech_agent_team import (
    BrainService,
    InMemoryArtifacts,
    InMemoryCheckpointerProvider,
    InMemoryTeamTasks,
    ProfileRegistry,
    StaticPlanner,
    SubTask,
    SubTaskResult,
    TeamBus,
)
from mate_tech_agent_team.main import create_app

BASE = "/api/v1/agent-team"
TENANT = "tenant-acme"

#: run 停下来的状态：闸门（等人）或任何终态。轮询到其中之一就算"settle"。
SETTLED = frozenset({"awaiting_approval", "completed", "failed", "cancelled", "timeout"})

_JWT_SECRET = "test-secret"


def _headers(tenant_id: str = TENANT, **extra: str) -> dict[str, str]:
    import jwt as pyjwt

    now = int(time.time())
    token = pyjwt.encode(
        {
            "sub": "u-1",
            "iss": "http://localhost:8080/realms/metaplatform",
            "aud": "metaplatform-backend",
            "azp": "metaplatform-backend",
            "realm_access": {"roles": ["PLATFORM_SUPER_ADMIN"]},
            "roles": ["PLATFORM_SUPER_ADMIN"],
            "tenant_id": tenant_id,
            "iat": now,
            "exp": now + 3600,
        },
        _JWT_SECRET,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}", **extra}


class _Runtime:
    async def run(self, *, subtask: SubTask, tenant_id: str) -> SubTaskResult:
        return SubTaskResult(
            task_id=subtask["task_id"],
            team_task_id=subtask.get("team_task_id", ""),
            profile_id=subtask["profile_id"],
            status="ok",
            output=f"{tenant_id}|{subtask['profile_id']}|已处理",
            llm_calls=1,
            source="llm",
        )


class _SlowRuntime(_Runtime):
    """每次员工调用睡 0.45s —— 把"同步等图"与"受理即回"的差值放大。

    同步版：POST 至少要等完这一波（≈0.45s，三个子任务并行）。
    受理版：POST 只等到**第一次落检查点**（毫秒级），不等员工。
    """

    #: 员工真正开跑的标记 —— "POST 回来时它还没开跑"的可读证据
    def __init__(self) -> None:
        self.started: list[str] = []

    async def run(self, *, subtask: SubTask, tenant_id: str) -> SubTaskResult:
        self.started.append(subtask["task_id"])
        await asyncio.sleep(0.45)
        return await super().run(subtask=subtask, tenant_id=tenant_id)


class _CountingPlanner(StaticPlanner):
    """数 `plan()` 被调了几次 —— "重复提交没有多起一轮"的可读证据。

    数在 ``plan()`` 而不是构造函数上：图在**每次读写 run**（get / history /
    mark_terminal）时都会现构一次 planner，构造次数与"跑了几轮"无关。
    """

    def __init__(self, counter: list[int]) -> None:
        self._counter = counter

    async def plan(self, *, goal: str, max_parallel: int, tenant_id: str) -> list[SubTask]:
        self._counter[0] += 1
        return await super().plan(goal=goal, max_parallel=max_parallel, tenant_id=tenant_id)


_clients: ExitStack = ExitStack()


@pytest.fixture(autouse=True)
def _close_test_clients() -> Iterator[None]:
    """测试结束后关掉本轮开出去的 TestClient。

    **必须用 ``with`` 进 TestClient**：不带上下文管理器时，Starlette 会为**每个
    请求**现起一个事件循环、请求一完就关——``POST /runs`` 里 ``create_task`` 出去
    的后台执行会在响应返回的瞬间被拆掉，run 于是永远停在 ``running``。带上下文时
    事件循环跨请求存活，后台任务才跑得下去（生产里 uvicorn 本来就是一个常驻循环）。
    """
    yield
    _clients.close()


def _app(*, runtime: Any = None, counter: list[int] | None = None) -> TestClient:
    counts = counter if counter is not None else [0]
    service = BrainService(
        planner_for=lambda _ctx: _CountingPlanner(counts),
        runtime_for=lambda _ctx: runtime if runtime is not None else _Runtime(),
        checkpointer=InMemoryCheckpointerProvider(),
        team_bus=TeamBus(registry=ProfileRegistry(), tasks=InMemoryTeamTasks()),
        artifacts=InMemoryArtifacts(),
    )
    return _clients.enter_context(TestClient(create_app(service=service)))


def _post(client: TestClient, *, headers: dict[str, str], goal: str = "分析本月异常订单"):
    return client.post(f"{BASE}/runs", json={"goal": goal}, headers=headers)


def _settle(client: TestClient, run_id: str, *, timeout: float = 8.0) -> dict[str, Any]:
    """轮询到 run 停下来（闸门或终态）为止。超时返回最后看到的那份状态。"""
    deadline = time.monotonic() + timeout
    body: dict[str, Any] = {}
    while time.monotonic() < deadline:
        body = client.get(f"{BASE}/runs/{run_id}", headers=_headers()).json()
        if body.get("status") in SETTLED:
            return body
        time.sleep(0.02)
    return body


# ── 受理制 ──────────────────────────────────────────────────────────────


def test_post_runs_is_accepted_immediately_instead_of_waiting_for_the_graph() -> None:
    """提交**立刻**回 202 + run_id —— 不在请求里等图跑完。

    判据的量化方式：员工每次调用睡 0.45s。同步版 POST 至少要等完这一波；受理版
    只等第一次落检查点，所以耗时远小于一个员工调用。
    """
    runtime = _SlowRuntime()
    client = _app(runtime=runtime)
    started = time.monotonic()
    response = _post(client, headers=_headers())
    elapsed = time.monotonic() - started

    assert response.status_code == 202, response.text
    assert elapsed < 0.4, f"POST 等了 {elapsed:.2f}s —— 图还是在请求里跑的"
    body = response.json()
    assert body["run_id"], body
    assert body["tenant_id"] == TENANT
    assert body["deduplicated"] is False
    # 受理回执**不是**运行结果：任务的图与回执不在里面
    assert "subtasks" not in body and "results" not in body, body


def test_the_accepted_run_is_queryable_right_away() -> None:
    """202 回执里的 run_id **立刻可查**（订阅方不该先撞一次 404）。"""
    client = _app(runtime=_SlowRuntime())
    run_id = _post(client, headers=_headers()).json()["run_id"]

    response = client.get(f"{BASE}/runs/{run_id}", headers=_headers())
    assert response.status_code == 200, "受理回执给的 run_id 查不到，等于没受理"
    assert response.json()["run_id"] == run_id


def test_the_run_still_settles_into_the_same_states_as_before() -> None:
    """1.3~1.6 的语义没变：照旧停在人工确认闸门，图与回执都在。"""
    client = _app()
    run_id = _post(client, headers=_headers()).json()["run_id"]
    body = _settle(client, run_id)

    assert body["status"] == "awaiting_approval", body
    assert len(body["subtasks"]) == 3
    assert len(body["results"]) == 3
    assert body["hitl_reason"]


def test_a_cross_tenant_subscriber_still_gets_404() -> None:
    """跨租户与不存在同码 —— 受理制不放松隔离。"""
    client = _app()
    run_id = _post(client, headers=_headers()).json()["run_id"]
    assert client.get(f"{BASE}/runs/{run_id}", headers=_headers("tenant-other")).status_code == 404


# ── 提交幂等（根治 1.6 那个"重试多跑一轮"）────────────────────────────────


def test_the_same_idempotency_key_does_not_start_a_second_run() -> None:
    """同一个键重复提交：同一个 run_id，且**图只被拆了一次**。"""
    counter = [0]
    client = _app(counter=counter)
    key = "submit-once"

    first = _post(client, headers=_headers(**{"Idempotency-Key": key}))
    second = _post(client, headers=_headers(**{"Idempotency-Key": key}))

    assert first.status_code == 202, first.text
    assert second.status_code == 202, second.text
    assert first.json()["run_id"] == second.json()["run_id"]
    assert first.json()["deduplicated"] is False
    assert second.json()["deduplicated"] is True
    assert counter[0] == 1, f"plan() 跑了 {counter[0]} 次 —— 重复提交多起了轮"


def test_a_retry_after_the_run_settled_maps_back_to_the_same_run() -> None:
    """1.6 那个坑的正面回归：第一次其实成功了、客户端没拿到 run_id 就重试。

    同步版里这一重试会**多跑一轮**，而且两轮都停在同一道闸门上。受理制 + 幂等键
    下，重试必须回到同一轮。
    """
    counter = [0]
    client = _app(counter=counter)
    key = "retry-after-timeout"

    first = _post(client, headers=_headers(**{"Idempotency-Key": key})).json()
    _settle(client, first["run_id"])

    retry = _post(client, headers=_headers(**{"Idempotency-Key": key}))
    assert retry.status_code == 202, retry.text
    assert retry.json()["run_id"] == first["run_id"]
    assert retry.json()["deduplicated"] is True
    assert counter[0] == 1, f"重试多跑了一轮：plan() 共 {counter[0]} 次"


def test_without_an_idempotency_key_every_submit_starts_a_new_run() -> None:
    """不带幂等键就不受幂等保护 —— 每次提交都是新的一轮（1.0 起的既有行为）。"""
    client = _app()
    first = _post(client, headers=_headers()).json()["run_id"]
    second = _post(client, headers=_headers()).json()["run_id"]
    assert first != second


def test_the_idempotency_key_is_scoped_to_one_tenant() -> None:
    """同一个键在**另一个租户**下是另一把钥匙 —— 不跨租户串轮。"""
    client = _app()
    key = {"Idempotency-Key": "same-key"}
    mine = _post(client, headers=_headers(TENANT, **key)).json()
    theirs = _post(client, headers=_headers("tenant-other", **key)).json()

    assert mine["run_id"] != theirs["run_id"]
    assert mine["tenant_id"] == TENANT
    assert theirs["tenant_id"] == "tenant-other"
