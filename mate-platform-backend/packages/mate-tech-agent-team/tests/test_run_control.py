"""1.3 轨 2 · 运行控制面：动态员工入口 + 取消 / 超时 + Run 事件流。

判据（来自 GOAL 轨 2）：

* 建员工 → 重启仍在（且跨租户不可见）
* 取消后落终态；超时后落终态（不是"挂着"）
* SSE 能收到步骤级事件
* 跨租户负例（员工 / run / 事件一律 404，不泄露存在性）

**为什么"落终态"要写进检查点而不是只记在内存**：run 的状态本来就在 langgraph
的检查点里（``GET /runs/{id}`` 读的就是它）。控制面另记一份就等于两个真相，
重启/多副本时立刻互相打脸。

**执行中的 run 也能取消**（1.5 任务 1）：请求还在等它，所以取消不是"外部杀"
——图在**节点边界**自查取消标志，在途的那一波跑完就不再往下走。
"""

from __future__ import annotations

import asyncio
import time
from typing import Any

import httpx
import pytest
import uvicorn
from fastapi import FastAPI
from fastapi.testclient import TestClient
from mate_tech_agent_team import (
    BrainService,
    InMemoryCheckpointerProvider,
    InMemoryTeamTasks,
    ProfileRegistry,
    ProfileStore,
    StaticPlanner,
    SubTask,
    SubTaskResult,
    TeamBus,
)
from mate_tech_agent_team.api.run_control import DEFAULT_TIMEOUT_ENV
from mate_tech_agent_team.audit import AUDIT_SPAWN
from mate_tech_agent_team.main import create_app
from mate_tech_agent_team.profile_store import bootstrap_profiles
from mate_tech_agent_team.profiles import EmployeeProfile

BASE = "/api/v1/agent-team"
TENANT = "tenant-acme"

_JWT_SECRET = "test-secret"


def _token(*, tenant_id: str = TENANT, permissions: list[str] | None = None) -> str:
    import jwt as pyjwt

    now = int(time.time())
    claims: dict[str, Any] = {
        "sub": "u-1",
        "iss": "http://localhost:8080/realms/metaplatform",
        "aud": "metaplatform-backend",
        "azp": "metaplatform-backend",
        "realm_access": {"roles": ["PLATFORM_SUPER_ADMIN"]},
        "roles": ["PLATFORM_SUPER_ADMIN"],
        "tenant_id": tenant_id,
        "iat": now,
        "exp": now + 3600,
    }
    if permissions is not None:
        claims["permissions"] = permissions
    return pyjwt.encode(claims, _JWT_SECRET, algorithm="HS256")


def _headers(tenant_id: str = TENANT, permissions: list[str] | None = None) -> dict[str, str]:
    return {"Authorization": f"Bearer {_token(tenant_id=tenant_id, permissions=permissions)}"}


class _Runtime:
    async def run(self, *, subtask, tenant_id: str) -> SubTaskResult:
        return SubTaskResult(
            task_id=subtask["task_id"],
            team_task_id=subtask.get("team_task_id", ""),
            profile_id=subtask["profile_id"],
            status="ok",
            output=f"{tenant_id}|{subtask['profile_id']}|已处理",
            llm_calls=1,
            source="llm",
        )


class _BlockingRuntime:
    """执行到一半停住，等测试放行 —— 模拟"请求还在等它"的执行中 run。"""

    def __init__(self) -> None:
        self.entered = asyncio.Event()
        self.release = asyncio.Event()
        self.started: list[str] = []

    async def run(self, *, subtask: SubTask, tenant_id: str) -> SubTaskResult:
        self.started.append(subtask["task_id"])
        self.entered.set()
        await self.release.wait()
        return SubTaskResult(
            task_id=subtask["task_id"],
            team_task_id=subtask.get("team_task_id", ""),
            profile_id=subtask["profile_id"],
            status="ok",
            output=f"{tenant_id}|{subtask['profile_id']}|已处理",
            llm_calls=1,
            source="llm",
        )


class _TwoWavePlanner:
    """两波计划：``t1``/``t2`` 并行，``t3`` 依赖 ``t1``（= 第二波）。

    取消要证明的是"**不再推进**"，所以计划必须真有下一波可以不再派出去。
    """

    async def plan(self, *, goal: str, max_parallel: int, tenant_id: str) -> list[SubTask]:
        del goal, max_parallel, tenant_id
        return [
            SubTask(task_id="t1", profile_id="EMP-ANALYST", instruction="a", depends_on=[]),
            SubTask(task_id="t2", profile_id="EMP-AUDITOR", instruction="b", depends_on=[]),
            SubTask(task_id="t3", profile_id="EMP-RESEARCHER", instruction="c", depends_on=["t1"]),
        ]


class _MemoryStore:
    """内存版落库面（**测试替身**）。

    生产只有 PG 一条路（``wiring.build_profile_store`` 缺 DSN 直接启动失败，
    没有静默回落）。不需要真库的用例用它，需要验证"落库 + RLS"的用例注入真的
    ``ProfileStore``。
    """

    def __init__(self) -> None:
        self._rows: dict[tuple[str, str], EmployeeProfile] = {}

    async def upsert(self, tenant_id: str, profile: EmployeeProfile) -> EmployeeProfile:
        if not tenant_id:
            raise ValueError("tenant_id is required")
        self._rows[(tenant_id, profile.profile_id)] = profile
        return profile

    async def get(self, tenant_id: str, profile_id: str) -> EmployeeProfile | None:
        return self._rows.get((tenant_id, profile_id))

    async def list(self, tenant_id: str) -> list[EmployeeProfile]:
        return [p for (tenant, _), p in self._rows.items() if tenant == tenant_id]

    async def delete(self, tenant_id: str, profile_id: str) -> bool:
        return self._rows.pop((tenant_id, profile_id), None) is not None


def _service(
    *,
    store: Any = None,
    bus: TeamBus | None = None,
    checkpointer: Any = None,
    runtime: Any = None,
    planner: Any = None,
) -> tuple[BrainService, TeamBus, Any]:
    store = store if store is not None else _MemoryStore()
    registry = ProfileRegistry(store=store)
    bus = bus if bus is not None else TeamBus(registry=registry, tasks=InMemoryTeamTasks())
    checkpointer = checkpointer if checkpointer is not None else InMemoryCheckpointerProvider()
    service = BrainService(
        planner_for=lambda _ctx: planner if planner is not None else StaticPlanner(),
        runtime_for=lambda _ctx: runtime if runtime is not None else _Runtime(),
        checkpointer=checkpointer,
        team_bus=bus,
    )
    return service, bus, store


def _app_obj(
    *,
    store: Any = None,
    bus: TeamBus | None = None,
    checkpointer: Any = None,
    runtime: Any = None,
    planner: Any = None,
) -> FastAPI:
    """ASGI 应用对象（异步用例要直接喂给 ``httpx.ASGITransport``）。"""
    service, bus, store = _service(
        store=store, bus=bus, checkpointer=checkpointer, runtime=runtime, planner=planner
    )
    return create_app(
        service=service,
        team_bus=bus,
        profile_store=store,
        profile_registry=ProfileRegistry(store=store),
    )


def _app(
    *,
    store: Any = None,
    bus: TeamBus | None = None,
    checkpointer: Any = None,
    runtime: Any = None,
    planner: Any = None,
) -> TestClient:
    return TestClient(
        _app_obj(
            store=store,
            bus=bus,
            checkpointer=checkpointer,
            runtime=runtime,
            planner=planner,
        )
    )


# ── 动态员工入口 ────────────────────────────────────────────────────────


def test_create_profile_returns_it_in_the_roster() -> None:
    client = _app()
    created = client.post(
        f"{BASE}/profiles",
        json={
            "name": "订单分析师",
            "base_role": "ontology",
            "system_prompt": "你是订单分析师。",
            "tools": ["ont_object_query"],
            "skills": ["sk-order-anomaly"],
        },
        headers=_headers(),
    )
    assert created.status_code == 201, created.text
    profile_id = created.json()["profile_id"]
    assert profile_id

    listed = client.get(f"{BASE}/profiles", headers=_headers()).json()["profiles"]
    assert profile_id in [p["profile_id"] for p in listed]

    one = client.get(f"{BASE}/profiles/{profile_id}", headers=_headers())
    assert one.status_code == 200
    assert one.json()["tools"] == ["ont_object_query"]


def test_put_updates_an_existing_profile() -> None:
    client = _app()
    created = client.post(
        f"{BASE}/profiles",
        json={"profile_id": "EMP-CUSTOM", "name": "初版", "base_role": "ontology"},
        headers=_headers(),
    )
    assert created.status_code == 201, created.text

    updated = client.put(
        f"{BASE}/profiles/EMP-CUSTOM",
        json={
            "name": "二版",
            "base_role": "ontology",
            "system_prompt": "改过的提示词",
            "tools": ["ont_list_classes"],
        },
        headers=_headers(),
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["name"] == "二版"
    assert updated.json()["tools"] == ["ont_list_classes"]


def test_profile_creation_requires_auth() -> None:
    client = _app()
    assert (
        client.post(f"{BASE}/profiles", json={"name": "x", "base_role": "ontology"}).status_code
        == 401
    )


def test_creating_a_profile_beyond_the_creator_envelope_is_forbidden() -> None:
    """ADR-0066 §3.7：定义出来的包络必须 ⊆ 创建者包络，否则 403。

    发起用户是管理员（内置能力全集），``a2a_invoke`` 不在其中——定义出来就等于
    绕开包络闸门给员工塞了一个平台没发布的能力。
    """
    client = _app()
    response = client.post(
        f"{BASE}/profiles",
        json={
            "profile_id": "EMP-OVERREACH",
            "name": "越权员工",
            "base_role": "ontology",
            "tools": ["a2a_invoke"],
        },
        headers=_headers(),
    )
    assert response.status_code == 403, response.text
    assert "tools" in response.json()["detail"]["escalations"]

    # 令牌里显式授予该工具后即可定义
    allowed = client.post(
        f"{BASE}/profiles",
        json={
            "profile_id": "EMP-OVERREACH",
            "name": "越权员工",
            "base_role": "ontology",
            "tools": ["a2a_invoke"],
        },
        headers=_headers(permissions=["tool:a2a_invoke"]),
    )
    assert allowed.status_code == 201, allowed.text


# ── 取消 ────────────────────────────────────────────────────────────────


def _start_run(client: TestClient, **extra: Any) -> dict[str, Any]:
    response = client.post(
        f"{BASE}/runs", json={"goal": "分析本月异常订单", **extra}, headers=_headers()
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_cancel_moves_the_run_to_a_terminal_state() -> None:
    client = _app()
    run = _start_run(client)
    assert run["status"] == "awaiting_approval"

    cancelled = client.post(f"{BASE}/runs/{run['run_id']}/cancel", headers=_headers())
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["status"] == "cancelled"

    # 终态是**写进检查点**的：再查一次还是它，且不能再被确认续跑
    again = client.get(f"{BASE}/runs/{run['run_id']}", headers=_headers())
    assert again.json()["status"] == "cancelled"
    approve = client.post(
        f"{BASE}/runs/{run['run_id']}/approve", json={"approved": True}, headers=_headers()
    )
    assert approve.status_code == 409


def test_cancel_is_idempotent() -> None:
    client = _app()
    run = _start_run(client)
    first = client.post(f"{BASE}/runs/{run['run_id']}/cancel", headers=_headers())
    second = client.post(f"{BASE}/runs/{run['run_id']}/cancel", headers=_headers())
    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["status"] == "cancelled"


def test_cancel_from_another_tenant_is_not_found() -> None:
    client = _app()
    run = _start_run(client)
    response = client.post(f"{BASE}/runs/{run['run_id']}/cancel", headers=_headers("tenant-other"))
    assert response.status_code == 404


def test_cancel_does_not_overwrite_an_earlier_terminal_state() -> None:
    """取消幂等，且**不覆盖更早的终态**（1.3 已定语义，1.5 别破）。

    这里用"人工驳回后的 ``failed``"当更早的终态：取消一个已经结束的 run 不该
    把它改写成 ``cancelled``——终态只有一个，谁先到谁说了算。
    """
    client = _app()
    run = _start_run(client)
    rejected = client.post(
        f"{BASE}/runs/{run['run_id']}/approve", json={"approved": False}, headers=_headers()
    )
    assert rejected.json()["status"] == "failed"

    cancelled = client.post(f"{BASE}/runs/{run['run_id']}/cancel", headers=_headers())
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["status"] == "failed"


# ── 执行中的取消（1.5 任务 1）────────────────────────────────────────────


def _spawn_run_id(bus: TeamBus) -> str:
    """从**派活审计行**认领执行中的 run_id。

    ``POST /runs`` 是同步的：run 还在跑的时候，HTTP 那边还没有返回值可用，
    所以测试要从别处认出这轮 run。派活的审计行（硬规则 #9）带 ``run_id``，
    正好是"这一轮已经开始执行"的公开证据。
    """
    rows = bus.audit.records(tenant_id=TENANT, action=AUDIT_SPAWN)
    assert rows, "还没有派活审计行：run 还没执行到派活那一步"
    return rows[-1].run_id


@pytest.mark.asyncio
async def test_cancel_stops_an_executing_run() -> None:
    """执行中的 run 也能取消：图在**节点边界**自查取消标志，落终态 ``cancelled``。

    请求还在等它（``POST /runs`` 同步），所以取消不能靠"外部杀"：在途的那一波
    允许跑完（不硬断），跑完之后图自己不再往下走——第二波一个员工都不派。
    """
    runtime = _BlockingRuntime()
    service, bus, store = _service(runtime=runtime, planner=_TwoWavePlanner())
    app = create_app(
        service=service,
        team_bus=bus,
        profile_store=store,
        profile_registry=ProfileRegistry(store=store),
    )
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        started = asyncio.create_task(
            client.post(f"{BASE}/runs", json={"goal": "分析本月异常订单"}, headers=_headers())
        )
        await asyncio.wait_for(runtime.entered.wait(), 5)
        run_id = _spawn_run_id(bus)

        cancelling = asyncio.create_task(
            client.post(f"{BASE}/runs/{run_id}/cancel", headers=_headers())
        )
        await asyncio.sleep(0.1)  # 让取消请求先落地（置标志）
        runtime.release.set()  # 放行在途调用：允许它跑完，但不再往下走

        cancelled = await asyncio.wait_for(cancelling, 5)
        first = await asyncio.wait_for(started, 5)
        approve = await client.post(
            f"{BASE}/runs/{run_id}/approve", json={"approved": True}, headers=_headers()
        )

    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["status"] == "cancelled"
    # 终态是**图自己写进检查点**的：发起那边看到的也是同一份
    assert first.json()["status"] == "cancelled"
    # 不再推进：第二波（t3）没有被派出去；已完成的第一波不重跑
    assert runtime.started == ["t1", "t2"], runtime.started
    # 终态之后 approve 一律 409（1.3 已定语义）
    assert approve.status_code == 409, approve.text


# ── 超时 ────────────────────────────────────────────────────────────────


def _wait_status(client: TestClient, run_id: str, expected: str, timeout: float = 5.0) -> str:
    """轮询到出现期望状态为止（超时返回最后看到的状态，由调用方断言）。"""
    deadline = time.monotonic() + timeout
    status = ""
    while time.monotonic() < deadline:
        status = client.get(f"{BASE}/runs/{run_id}", headers=_headers()).json()["status"]
        if status == expected:
            return status
        time.sleep(0.02)
    return status


def test_run_times_out_into_a_terminal_state() -> None:
    client = _app()
    run = _start_run(client, timeout_seconds=0.05)

    status = _wait_status(client, run["run_id"], "timeout")
    assert status == "timeout", f"超时后仍停在 {status!r} —— 运行挂着不落终态"
    approve = client.post(
        f"{BASE}/runs/{run['run_id']}/approve", json={"approved": True}, headers=_headers()
    )
    assert approve.status_code == 409


def test_a_run_within_its_deadline_is_left_alone() -> None:
    client = _app()
    run = _start_run(client, timeout_seconds=30)
    assert (
        client.get(f"{BASE}/runs/{run['run_id']}", headers=_headers()).json()["status"]
        == "awaiting_approval"
    )


def test_the_effective_deadline_is_readable_through_the_api() -> None:
    """本轮的有效超时与**绝对**截止时刻是 API 可读的（契约里那两个新字段）。

    没有它，"这轮什么时候会超时"只能靠猜；有了它，重启后是否仍按原值裁决也
    不必翻日志——直接读这一轮的状态。
    """
    client = _app()
    run = _start_run(client, timeout_seconds=30)
    body = client.get(f"{BASE}/runs/{run['run_id']}", headers=_headers()).json()
    assert body["timeout_seconds"] == 30
    assert body["deadline_at"] > time.time(), "截止时刻应当是**绝对**的（未来的某一刻）"


def test_the_receipt_records_attempts_through_the_api() -> None:
    """回执里的 ``attempts``（1.5 契约新增）要真的出得来——一次过手就是 1。"""
    client = _app()
    run = _start_run(client)
    body = client.get(f"{BASE}/runs/{run['run_id']}", headers=_headers()).json()
    assert body["results"]["t1"]["attempts"] == 1


# ── 超时值持久化（1.5 任务 2）───────────────────────────────────────────


def _checkpointer_and_bus() -> tuple[InMemoryCheckpointerProvider, TeamBus]:
    """一套可跨"重启"复用的检查点器 + 闸门（内存版，重启 = 新建一套对象）。"""
    return (
        InMemoryCheckpointerProvider(),
        TeamBus(registry=ProfileRegistry(), tasks=InMemoryTeamTasks()),
    )


def test_a_non_default_timeout_survives_a_restart() -> None:
    """超时值**随 run 落检查点**：换个进程（同一检查点器）来裁决，仍按原值。

    1.3 把每轮的截止时间记在**进程内**，重启后那条记录就没了——运行于是永远
    停在闸门上"挂着"，而不是按本轮定下的截止时间落 ``timeout``。
    """
    checkpointer, bus = _checkpointer_and_bus()
    client = _app(checkpointer=checkpointer, bus=bus)
    run = _start_run(client, timeout_seconds=0.1)

    # 模拟"重启"：全新一套对象，进程内什么都不剩
    restarted = _app(checkpointer=checkpointer, bus=bus)
    status = _wait_status(restarted, run["run_id"], "timeout")
    assert status == "timeout", f"重启后没按本轮记下的超时值裁决，停在 {status!r}"


def test_the_deployment_default_is_recorded_with_the_run(monkeypatch: pytest.MonkeyPatch) -> None:
    """省略 ``timeout_seconds`` 时用的是**开跑那一刻**的部署默认值，它也随 run 落库。

    重启后的进程把默认值调大，不该让已经开跑的这一轮"跟着变长"——那等于本轮
    的截止时间由重启后的配置决定。
    """
    checkpointer, bus = _checkpointer_and_bus()
    monkeypatch.setenv(DEFAULT_TIMEOUT_ENV, "0.1")
    client = _app(checkpointer=checkpointer, bus=bus)
    run = _start_run(client)  # 不带 timeout_seconds → 用部署默认值 0.1

    monkeypatch.setenv(DEFAULT_TIMEOUT_ENV, "30")
    restarted = _app(checkpointer=checkpointer, bus=bus)
    status = _wait_status(restarted, run["run_id"], "timeout", timeout=3.0)
    assert status == "timeout", f"重启后用了新的默认值裁决，停在 {status!r}"


def test_a_restart_does_not_shorten_a_longer_deadline(monkeypatch: pytest.MonkeyPatch) -> None:
    """反向：重启后的默认值**不能覆盖**本轮已记下的（更长）截止时间。"""
    checkpointer, bus = _checkpointer_and_bus()
    client = _app(checkpointer=checkpointer, bus=bus)
    run = _start_run(client, timeout_seconds=30)

    monkeypatch.setenv(DEFAULT_TIMEOUT_ENV, "0.05")
    restarted = _app(checkpointer=checkpointer, bus=bus)
    time.sleep(0.2)  # 足够超过重启后的默认值 0.05s
    assert (
        restarted.get(f"{BASE}/runs/{run['run_id']}", headers=_headers()).json()["status"]
        == "awaiting_approval"
    )


# ── 事件流 ──────────────────────────────────────────────────────────────


def test_events_stream_carries_step_level_events() -> None:
    """回放：终态的 run 连上去，历史步骤一条不少，最后 ``end`` 收流。"""
    client = _app()
    run = _start_run(client)
    # 先让它到终态：回放完就该收流，不然读的是"还在尾随"的那条流
    rejected = client.post(
        f"{BASE}/runs/{run['run_id']}/approve", json={"approved": False}, headers=_headers()
    )
    assert rejected.json()["status"] == "failed"

    response = client.get(f"{BASE}/runs/{run['run_id']}/events", headers=_headers())
    assert response.status_code == 200, response.text
    assert response.headers["content-type"].startswith("text/event-stream")

    body = response.text
    assert "event: step" in body, body[:400]
    # 步骤级 = 每个节点产生的推进各一条（plan / dispatch / worker / gate …）
    for node in ("plan", "worker", "gate"):
        assert node in body, f"{node} 的推进没出现在事件流里：{body[:400]}"
    assert "event: end" in body


def test_events_from_another_tenant_are_not_found() -> None:
    client = _app()
    run = _start_run(client)
    response = client.get(f"{BASE}/runs/{run['run_id']}/events", headers=_headers("tenant-other"))
    assert response.status_code == 404


# ── 事件流尾随（1.5 任务 3）─────────────────────────────────────────────


async def _read_until(lines: Any, needle: str, timeout: float = 8.0) -> str:
    """读到**完整事件**里出现 ``needle`` 为止（整体超时）。返回读到的全部内容。

    以空行为事件边界：只匹配到事件的第一行不算——那会让"plan 到了"变成
    "刚收到 ``event: step``"，等于没读。
    """
    done: list[str] = []
    pending: list[str] = []

    async def _pump() -> None:
        async for line in lines:
            if line:
                pending.append(line)
                continue
            done.append("\n".join(pending))
            pending.clear()
            if needle in "\n".join(done):
                return

    try:
        await asyncio.wait_for(_pump(), timeout)
    except TimeoutError:
        pass
    return "\n".join(done)


@pytest.mark.asyncio
async def test_events_stream_tails_new_steps_until_the_run_is_terminal() -> None:
    """回放 + **尾随**：连上先补历史，之后新步骤自己推过来，终态后关流。

    只回放的话，连上之后发生的推进要靠重连才看得到——那与"步骤级事件流"
    这个名分不符，也做不出"边跑边看"。所以判据是：**连上之后**图又走了几步，
    这些步骤要能在这条流里到达；run 到终态后流自己关掉（``end``），不挂死。

    **必须起真服务**：``ASGITransport`` 会把响应体收完才返回（实测），
    长连接在它那里永远"没完"——那样测不出尾随，只会挂住。
    """
    runtime = _BlockingRuntime()
    service, bus, store = _service(runtime=runtime, planner=_TwoWavePlanner())
    app = create_app(
        service=service,
        team_bus=bus,
        profile_store=store,
        profile_registry=ProfileRegistry(store=store),
    )
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=0, log_level="warning"))
    serve = asyncio.create_task(server.serve())
    try:
        for _ in range(250):  # 等服务真的起来
            if server.started:
                break
            await asyncio.sleep(0.02)
        assert server.started, "uvicorn 没起来"
        port = server.servers[0].sockets[0].getsockname()[1]

        async with httpx.AsyncClient(base_url=f"http://127.0.0.1:{port}") as client:
            started = asyncio.create_task(
                client.post(f"{BASE}/runs", json={"goal": "分析本月异常订单"}, headers=_headers())
            )
            await asyncio.wait_for(runtime.entered.wait(), 5)
            run_id = _spawn_run_id(bus)

            async with client.stream(
                "GET", f"{BASE}/runs/{run_id}/events", headers=_headers()
            ) as response:
                assert response.status_code == 200, response.text
                assert response.headers["content-type"].startswith("text/event-stream")
                lines = response.aiter_lines()

                # 1) 回放：此刻图还卡在第一波里，先补出来的必须是已有历史
                replayed = await _read_until(lines, '"plan"')
                assert "event: step" in replayed and '"plan"' in replayed, replayed[:400]

                # 2) 尾随：放行第一波 → 后续推进应当自己到达这条流
                runtime.release.set()
                tailed = await _read_until(lines, "awaiting_approval")
                assert "awaiting_approval" in tailed, f"后续推进没尾随过来：{tailed[:400]}"
                # 还没终态：这条流**不该**已经收掉（收到 end 就说明只回放不尾随）
                assert "event: end" not in tailed, tailed[-400:]

                # 3) 终态后正常关闭：取消 → 落 cancelled → 流发 end 收流，不挂死
                cancelled = await client.post(f"{BASE}/runs/{run_id}/cancel", headers=_headers())
                assert cancelled.json()["status"] == "cancelled"
                closed = await _read_until(lines, "event: end")
                assert "event: end" in closed, f"终态后没收流：{closed[-400:]}"

            # 发起那条请求是在它停在闸门时返回的；取消发生在之后，所以终态要看**现在**查
            first = await asyncio.wait_for(started, 5)
            assert first.json()["status"] == "awaiting_approval"
            after = await client.get(f"{BASE}/runs/{run_id}", headers=_headers())
            assert after.json()["status"] == "cancelled"
    finally:
        server.should_exit = True
        await asyncio.wait_for(serve, 10)


# ── 落库 + 跨租户（需要 PG）─────────────────────────────────────────────


@pytest.fixture
def profile_schema(pg_dsns: tuple[str, str]) -> Any:
    import psycopg

    admin_dsn, _ = pg_dsns
    schema = "agent_team_profile_test"
    with psycopg.connect(admin_dsn, autocommit=True) as conn:
        conn.execute(f"CREATE SCHEMA IF NOT EXISTS {schema}")
        # 少了这条，mate_app 连 schema 都看不见（报"表不存在"，不是"没权限"）
        conn.execute(f"GRANT USAGE ON SCHEMA {schema} TO mate_app")
        conn.execute(f"SET search_path TO {schema}")
        bootstrap_profiles(conn)
    yield schema
    with psycopg.connect(admin_dsn, autocommit=True) as conn:
        conn.execute(f"DROP SCHEMA IF EXISTS {schema} CASCADE")


def test_created_profile_survives_a_restart(profile_schema: str, pg_dsns: tuple[str, str]) -> None:
    """建出来的员工是**库里的行**：新进程/新副本读得到（1.1 落库的兑现）。"""
    _, app_dsn = pg_dsns
    created = _app(store=ProfileStore(app_dsn, schema=profile_schema)).post(
        f"{BASE}/profiles",
        json={"profile_id": "EMP-PERSIST", "name": "持久员工", "base_role": "ontology"},
        headers=_headers(),
    )
    assert created.status_code == 201, created.text

    # 模拟"重启"：全新一套对象读同一个 schema
    restarted = _app(store=ProfileStore(app_dsn, schema=profile_schema))
    listed = restarted.get(f"{BASE}/profiles", headers=_headers()).json()["profiles"]
    assert "EMP-PERSIST" in [p["profile_id"] for p in listed]


def test_created_profile_is_invisible_to_another_tenant(
    profile_schema: str, pg_dsns: tuple[str, str]
) -> None:
    """隔离由数据库 RLS 强制（``mate_app`` 非超级角色，不是"应用层记得过滤"）。"""
    _, app_dsn = pg_dsns
    client = _app(store=ProfileStore(app_dsn, schema=profile_schema))
    created = client.post(
        f"{BASE}/profiles",
        json={"profile_id": "EMP-PRIVATE", "name": "私密员工", "base_role": "ontology"},
        headers=_headers(),
    )
    assert created.status_code == 201, created.text

    other = client.get(f"{BASE}/profiles", headers=_headers("tenant-other"))
    assert "EMP-PRIVATE" not in [p["profile_id"] for p in other.json()["profiles"]]
    assert (
        client.get(f"{BASE}/profiles/EMP-PRIVATE", headers=_headers("tenant-other")).status_code
        == 404
    )
    # 也不能改别人的员工
    assert (
        client.put(
            f"{BASE}/profiles/EMP-PRIVATE",
            json={"name": "篡改", "base_role": "ontology"},
            headers=_headers("tenant-other"),
        ).status_code
        == 404
    )


@pytest.mark.asyncio
async def test_profile_store_round_trips_the_full_envelope(
    profile_schema: str, pg_dsns: tuple[str, str]
) -> None:
    """包络四维都要落库（缺一维 = 派活闸门少一个约束）。"""
    _, app_dsn = pg_dsns
    store = ProfileStore(app_dsn, schema=profile_schema)
    profile = EmployeeProfile(
        profile_id="EMP-ENV",
        name="包络员工",
        base_role="ontology",
        system_prompt="…",
        tools=("ont_object_query",),
        action_rids=("ont.create_link",),
        kb_ids=("kb-orders",),
        markings=("internal",),
    )
    await store.upsert(TENANT, profile)
    got = await store.get(TENANT, "EMP-ENV")
    assert got is not None
    assert got.envelope() == profile.envelope()


@pytest.mark.asyncio
async def test_cancel_is_visible_to_a_fresh_service_over_the_same_checkpointer() -> None:
    """终态写在**检查点**上，不是记在控制面内存里。

    换一个全新的服务实例（同一个检查点器）来读，读到的还是 ``cancelled``——
    这条成立才谈得上"重启后状态还在"。
    """
    checkpointer = InMemoryCheckpointerProvider()
    bus = TeamBus(registry=ProfileRegistry(), tasks=InMemoryTeamTasks())
    client = _app(checkpointer=checkpointer, bus=bus)
    run = _start_run(client)
    client.post(f"{BASE}/runs/{run['run_id']}/cancel", headers=_headers())

    fresh, _, _ = _service(checkpointer=checkpointer, bus=bus)
    state = await fresh.get(tenant_id=TENANT, run_id=run["run_id"])
    assert state["status"] == "cancelled"
