"""1.8 轨 1 · 后台执行可恢复：进程重启后，在途 run 续跑到停下的那一刻。

**为什么要有这个**：1.7 把起一轮运行改成**受理制**——``POST /runs`` 立刻回
``run_id``，图由 ``asyncio.create_task`` 在本进程的事件循环里跑。好处是提交不再
被网关 60s 读超时打断；代价是**这一轮活在这个进程里**：进程一重启，在途的 run
就永远停在 ``running``，客户端会一直等下去。

**怎么治**：run 的状态本来就在检查点里（``GET /runs/{id}`` 读的就是它），所以
"哪些 run 没跑完"不用另立一张表——**扫检查点**即可。启动时扫出还在执行中的
run，用 ``ainvoke(None, cfg)`` 从**它自己的检查点**续跑。

``ainvoke(None, ...)`` 与 ``ainvoke({...}, ...)`` 的差别是实跑确认过的，不是
猜的：前者**从检查点的 ``next`` 续跑**（已完成的节点一个都不重跑），后者把输入
当成新一轮、从 START 重来（``plan`` 会重跑、``results`` 会被清掉）。所以续跑
**只能**用 ``None``——用重投输入"接着跑"等于把这一轮从头再跑一遍。

**边界登记（诚实说清）**：

1. 续跑是**从检查点接着跑**，不是"什么都不重跑"。检查点写在**超步边界**上：
   进程死在某一波员工在途时，那一波会被重跑（已完成的前面几波不会）。这就是
   "已完成的不重跑"的准确含义。
2. 发起用户的令牌**刻意不进状态**（状态会落库），但**链根会**——1.9 任务 1 把
   它发成一份与令牌分离的 per-run 派活授权随 run 落库，续跑读它当链根。所以
   重启后续跑**能真跑**；令牌本身仍然一个字节不落库。开跑时就没有令牌的那一轮
   拿到的是一份空包络授权，续跑照样 fail-closed 转提案（见 test_delegation.py）。
3. ``submit()`` 与"图写下第检查点"之间有一个**微秒级窗口**：死在这个窗口里的
   run 没有任何检查点，也就没有任何痕迹可续（"状态以检查点为准"的必然结果）。
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
from mate_tech_agent_team.api.run_control import RESUMABLE_STATUSES, RunControl
from mate_tech_agent_team.brain import TERMINAL_STATUSES, RunNotFound
from mate_tech_agent_team.checkpoint import (
    PgCheckpointerProvider,
    UnfinishedRun,
    list_unfinished,
)
from mate_tech_agent_team.main import create_app

BASE = "/api/v1/agent-team"
TENANT = "tenant-acme"

#: run 停下来的状态：闸门（等人）或任何终态。
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


class _SlowRuntime:
    """每次员工调用睡一会儿 —— 给"死在员工波次在途"制造一个稳定的窗口。"""

    def __init__(self, delay: float = 0.3) -> None:
        self.delay = delay
        self.started: list[str] = []

    async def run(self, *, subtask: SubTask, tenant_id: str) -> SubTaskResult:
        self.started.append(subtask["task_id"])
        await asyncio.sleep(self.delay)
        return SubTaskResult(
            task_id=subtask["task_id"],
            team_task_id=subtask.get("team_task_id", ""),
            profile_id=subtask["profile_id"],
            status="ok",
            output=f"{tenant_id}|{subtask['profile_id']}|已处理",
            llm_calls=1,
            source="llm",
        )


class _ChainPlanner(StaticPlanner):
    """两件**串成一条链**（t2 依赖 t1）—— 造出一个可确定复现的崩溃点：
    第一波（t1）已经跑完、第二波（t2）在途。这正是"已完成的不重跑"要验的时刻。
    """

    def __init__(self, counter: list[int]) -> None:
        self._counter = counter

    async def plan(self, *, goal: str, max_parallel: int, tenant_id: str) -> list[SubTask]:
        del max_parallel, tenant_id
        self._counter[0] += 1
        return [
            SubTask(
                task_id="t1", profile_id="EMP-ANALYST", instruction=f"分析：{goal}", depends_on=[]
            ),
            SubTask(
                task_id="t2",
                profile_id="EMP-AUDITOR",
                instruction=f"复核：{goal}",
                depends_on=["t1"],
            ),
        ]


class _CountingPlanner(StaticPlanner):
    """数 ``plan()`` 被调了几次 —— "已完成的不重跑"的可读证据。"""

    def __init__(self, counter: list[int]) -> None:
        self._counter = counter

    async def plan(self, *, goal: str, max_parallel: int, tenant_id: str) -> list[SubTask]:
        self._counter[0] += 1
        return await super().plan(goal=goal, max_parallel=max_parallel, tenant_id=tenant_id)


class _SlowPlanner(_CountingPlanner):
    """拆解慢一点 —— 给"死在拆解这一步"制造一个干净的取消点。

    刻意选在**节点执行中**而不是节点之间：检查点写在超步边界上，节点跑着的这段
    时间里没有在途的写。取消落在超步边界的写操作里，会让 langgraph 的异步游标
    半途被丢掉（真库上表现为 "bound to a different event loop" 的收尾噪音）。
    """

    def __init__(self, counter: list[int], delay: float) -> None:
        super().__init__(counter)
        self._delay = delay

    async def plan(self, *, goal: str, max_parallel: int, tenant_id: str) -> list[SubTask]:
        # 先计数再睡：被中断的那一次也算"发起过"，否则看不出续跑时它被重跑了。
        self._counter[0] += 1
        await asyncio.sleep(self._delay)
        return await StaticPlanner.plan(
            self, goal=goal, max_parallel=max_parallel, tenant_id=tenant_id
        )


class _FakeIndex:
    """假索引：直接报"哪些 run 没跑完"，把 PG 扫描挡在用例之外。

    真索引（:class:`mate_tech_agent_team.api.run_control.PgRunIndex`）要去读
    ``checkpoints`` 表；这里只验**控制面拿到清单之后做了什么**。
    """

    def __init__(self, runs: list[tuple[str, str]]) -> None:
        self._runs = runs
        self.calls = 0
        self.seen_statuses: list[frozenset[str]] = []

    async def unfinished(self, *, statuses: frozenset[str]) -> list[UnfinishedRun]:
        self.calls += 1
        self.seen_statuses.append(statuses)
        return [UnfinishedRun(tenant_id=tenant, run_id=run_id) for tenant, run_id in self._runs]


_clients: ExitStack = ExitStack()


@pytest.fixture(autouse=True)
def _close_test_clients() -> Iterator[None]:
    yield
    _clients.close()


def _service(
    *, runtime: Any = None, counter: list[int] | None = None, planner: Any = None
) -> tuple[BrainService, Any, list[int]]:
    """``planner`` 给的是**类**（拿计数器现建），这样用例还能数到 ``plan()`` 次数。"""
    counts = counter if counter is not None else [0]
    rt = runtime if runtime is not None else _SlowRuntime()
    plan = planner(counts) if planner is not None else _CountingPlanner(counts)
    service = BrainService(
        planner_for=lambda _ctx: plan,
        runtime_for=lambda _ctx: rt,
        checkpointer=InMemoryCheckpointerProvider(),
        team_bus=TeamBus(registry=ProfileRegistry(), tasks=InMemoryTeamTasks()),
        artifacts=InMemoryArtifacts(),
    )
    return service, rt, counts


async def _until(predicate, *, timeout: float = 8.0, interval: float = 0.01):
    """轮询到谓词为真（或超时）—— 用于等"检查点落到某一刻"。"""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        value = await predicate()
        if value:
            return value
        await asyncio.sleep(interval)
    return None


async def _settle(service: BrainService, run_id: str, *, timeout: float = 8.0) -> dict[str, Any]:
    async def _done():
        try:
            state = await service.get(tenant_id=TENANT, run_id=run_id)
        except RunNotFound:
            return None
        return state if str(state.get("status", "")) in SETTLED else None

    return await _until(_done, timeout=timeout) or await service.get(
        tenant_id=TENANT, run_id=run_id
    )


# ── 续跑 ────────────────────────────────────────────────────────────────


def test_an_in_flight_run_is_continued_from_its_checkpoint_after_a_restart(admin_token) -> None:
    """**轨 1 主判据**：起 run → 执行中重启 → 续跑；**已完成的不重跑**。

    "重启"在这里是忠实的模拟：``shutdown()`` 拆掉在途的后台任务（= 进程没了），
    检查点留着（= PG 还在），再拿一个**新的控制面实例**做启动扫描。

    用例刻意用**串成一条链**的两件（t2 依赖 t1），好把崩溃点钉在"第一波已经
    跑完、第二波在途"这一刻——"已完成的不重跑"才有东西可验。整轮三件事：
    ① 不再卡在 ``running``；② 已完成的拆解与员工一个都不重跑；③ 续跑那一波
    **真的跑完了**（回执 ``ok`` + 有产出）。

    第 ③ 条在 1.8 时是反过来的：那时续跑没有链根包络，需要授权的那一步
    fail-closed 转成待授权提案。1.9 任务 1 把链根发成一份**与令牌分离**的
    per-run 授权随 run 落库（:mod:`mate_tech_agent_team.delegation`），于是
    续跑有链根可用、真能跑完；令牌本身仍然一个字节都不落库。"无令牌那一轮
    重启后照样 fail-closed"由 test_delegation.py 的负例守着。
    """

    async def _scenario() -> None:
        runtime = _SlowRuntime()
        service, _runtime, counts = _service(runtime=runtime, planner=_ChainPlanner)
        before = RunControl(service)
        accepted = await before.submit(
            tenant_id=TENANT, goal="分析本月异常订单", user_token=admin_token
        )
        run_id = accepted["run_id"]

        # 等第一波（t1）跑完 —— 此刻第二波（t2）在途。
        first_wave = await _until(lambda: _has_result(service, run_id, "t1"))
        assert first_wave, "第一波没有落检查点，用例前提不成立"

        # 进程没了：在途的后台任务被拆掉，检查点留在原地。
        await before.shutdown()
        stuck = await service.get(tenant_id=TENANT, run_id=run_id)
        assert stuck["status"] == "running", "该死在这一轮的执行中，而不是别的状态"
        assert stuck["results"]["t1"]["status"] == "ok", stuck["results"]
        t1_output = stuck["results"]["t1"]["output"]

        # 新进程启动：扫出没跑完的 run，从它自己的检查点接着跑。
        index = _FakeIndex([(TENANT, run_id)])
        after = RunControl(service, run_index=index)
        resumed = await after.recover()
        assert resumed == [run_id], f"启动扫描没有认领这一轮：{resumed}"
        assert index.calls == 1
        # 筛的是"要什么"而不是"不要什么"——索引只该去捞"正在跑"的。
        assert index.seen_statuses == [RESUMABLE_STATUSES]

        body = await _settle(service, run_id)
        # ① 不再卡住：这一轮走到了它的落脚点。
        assert body["status"] == "awaiting_approval", body
        # ② 已完成的不重跑：拆解一次，t1 也只跑了一次、产出原样。
        assert counts[0] == 1, f"plan() 跑了 {counts[0]} 次 —— 已完成的节点被重跑了"
        assert body["results"]["t1"]["output"] == t1_output, "已完成的那件被重跑了"
        assert runtime.started.count("t1") == 1, f"t1 被跑了多次：{runtime.started}"
        # ③ 续跑那一波**真的跑完了**：本轮的派活授权随 run 落库，链根还在。
        assert body["results"]["t2"]["status"] == "ok", body["results"]["t2"]
        assert body["results"]["t2"]["output"].strip(), "回了 ok 却没有产出（假回执）"
        assert "t2" in runtime.started, f"员工根本没被调起来：{runtime.started}"

    asyncio.run(_scenario())


def test_a_run_interrupted_before_any_worker_finishes_still_leaves_running(
    admin_token,
) -> None:
    """死在第一波在途（还没有任何回执）时，续跑同样把它带出 ``running``。

    这一条对应"没有任何已完成的产出可保留"的极端：图上没有断点可续，于是整波
    重派。**关键是它不再永远停在 ``running``** —— 那正是受理制留下的坑。有了
    随 run 落库的派活授权（1.9 任务 1），重派的这一波还真能跑完。
    """

    async def _scenario() -> None:
        service, _runtime, counts = _service()
        before = RunControl(service)
        run_id = (
            await before.submit(tenant_id=TENANT, goal="分析本月异常订单", user_token=admin_token)
        )["run_id"]
        assert await _until(lambda: _has_subtasks(service, run_id))
        await before.shutdown()
        assert (await service.get(tenant_id=TENANT, run_id=run_id))["status"] == "running"

        after = RunControl(service, run_index=_FakeIndex([(TENANT, run_id)]))
        assert await after.recover() == [run_id]
        body = await _settle(service, run_id)

        assert body["status"] == "awaiting_approval", body
        assert len(body["results"]) == 3, "续跑没有把该派的那一波派出去"
        assert counts[0] == 1, f"已完成的拆解被重跑了 {counts[0]} 次"

    asyncio.run(_scenario())


def test_a_settled_run_is_not_touched_by_the_startup_scan(admin_token) -> None:
    """停在闸门上的 run 是**等人**，不是没跑完 —— 扫描不许把它再推一遍。"""

    async def _scenario() -> None:
        service, _runtime, counts = _service()
        before = RunControl(service)
        run_id = (
            await before.submit(tenant_id=TENANT, goal="分析本月异常订单", user_token=admin_token)
        )["run_id"]
        settled = await _settle(service, run_id)
        assert settled["status"] == "awaiting_approval", settled

        index = _FakeIndex([(TENANT, run_id)])
        after = RunControl(service, run_index=index)
        assert await after.recover() == []
        assert counts[0] == 1, f"停在闸门的 run 被重拆了一次（plan 共 {counts[0]} 次）"

        still = await service.get(tenant_id=TENANT, run_id=run_id)
        assert still["status"] == "awaiting_approval"
        assert still["results"] == settled["results"]

    asyncio.run(_scenario())


def test_the_scan_skips_runs_that_are_already_live_in_this_process(admin_token) -> None:
    """同进程内已经在跑的那一轮不许被扫描再认领一次（否则一波员工派两遍）。"""

    async def _scenario() -> None:
        service, _runtime, _counts = _service()
        control = RunControl(service, run_index=_FakeIndex([(TENANT, "whatever")]))
        run_id = (
            await control.submit(tenant_id=TENANT, goal="分析本月异常订单", user_token=admin_token)
        )["run_id"]
        # 把索引换成"确实报这一轮没跑完"，再扫一次：它正活着，应当跳过。
        control._run_index = _FakeIndex([(TENANT, run_id)])
        assert await control.recover() == []
        await _settle(service, run_id)

    asyncio.run(_scenario())


def test_recovery_is_skipped_when_no_index_is_configured() -> None:
    """没配索引 = 不做恢复（本地/测试的默认形态），不是报错。"""

    async def _scenario() -> None:
        service, _runtime, _counts = _service()
        control = RunControl(service)
        assert await control.recover() == []

    asyncio.run(_scenario())


def test_a_run_that_vanished_from_the_checkpoints_is_skipped_quietly() -> None:
    """索引报了但检查点里查不到（跨进程竞态）：跳过，不把启动打断。"""

    async def _scenario() -> None:
        service, _runtime, _counts = _service()
        control = RunControl(service, run_index=_FakeIndex([(TENANT, "ghost-run")]))
        assert await control.recover() == []

    asyncio.run(_scenario())


def test_shutdown_cancels_the_in_flight_background_work(admin_token) -> None:
    """``shutdown()`` 是"进程收尾"的正面入口：在途任务被拆掉、不再推进。"""

    async def _scenario() -> None:
        service, runtime, _counts = _service()
        control = RunControl(service)
        run_id = (
            await control.submit(tenant_id=TENANT, goal="分析本月异常订单", user_token=admin_token)
        )["run_id"]
        await _until(lambda: _has_subtasks(service, run_id), timeout=5.0)
        await control.shutdown()
        # 收尾之后这一轮不再推进：员工不再被调起来。
        seen = len(runtime.started)
        await asyncio.sleep(0.2)
        assert len(runtime.started) == seen, "shutdown 之后还有员工被派起来"

    asyncio.run(_scenario())


async def _has_subtasks(service: BrainService, run_id: str) -> bool:
    try:
        state = await service.get(tenant_id=TENANT, run_id=run_id)
    except RunNotFound:
        return False
    return bool(state.get("subtasks"))


async def _has_result(service: BrainService, run_id: str, task_id: str) -> bool:
    """某个子任务是不是已经落回执了 —— 用来把崩溃点钉在"某一波已跑完"。"""
    try:
        state = await service.get(tenant_id=TENANT, run_id=run_id)
    except RunNotFound:
        return False
    return task_id in (state.get("results") or {})


async def _checkpoint_exists(service: BrainService, run_id: str) -> bool:
    """这一轮在检查点里有没有落脚（= 进程死了之后还找不找得回它）。"""
    try:
        await service.get(tenant_id=TENANT, run_id=run_id)
    except RunNotFound:
        return False
    return True


# ── 重启后从 HTTP 面看到的仍是同一轮（不另建真相）──────────────────────


def test_the_run_id_from_before_the_restart_still_addresses_the_same_run(admin_token) -> None:
    """受理回执给的 run_id 在重启后**仍然是那一轮**——状态只有一个来源。"""

    async def _scenario() -> None:
        service, _runtime, _counts = _service()
        before = RunControl(service)
        accepted = await before.submit(
            tenant_id=TENANT,
            goal="分析本月异常订单",
            user_token=admin_token,
            idempotency_key="k-restart",
        )
        run_id = accepted["run_id"]
        await _until(lambda: _has_subtasks(service, run_id))
        await before.shutdown()

        after = RunControl(service, run_index=_FakeIndex([(TENANT, run_id)]))
        await after.recover()
        body = await _settle(service, run_id)
        assert body["run_id"] == run_id
        assert body["status"] == "awaiting_approval"

        # 幂等键在重启后仍映射回同一轮（确定性 run_id + 查检查点）。
        again = await after.submit(
            tenant_id=TENANT,
            goal="分析本月异常订单",
            user_token=admin_token,
            idempotency_key="k-restart",
        )
        assert again["run_id"] == run_id
        assert again["deduplicated"] is True

    asyncio.run(_scenario())


def test_the_terminal_state_set_covers_every_status_the_graph_can_park_on() -> None:
    """恢复只认"执行中"——这份清单就是判据，别在别处再写第二份。"""

    assert "running" not in TERMINAL_STATUSES
    assert "awaiting_approval" not in TERMINAL_STATUSES
    for status in ("completed", "failed", "rejected", "cancelled", "timeout"):
        assert status in TERMINAL_STATUSES
    # 认领集与终态集**不相交**：解析出终态来的那一轮不该被再推一遍。
    assert frozenset() == RESUMABLE_STATUSES & TERMINAL_STATUSES


def test_list_unfinished_reads_the_checkpoint_table_by_status(
    pg_dsns, rls_schema, admin_token
) -> None:
    """真库上验扫描本身：JSONB 取状态、每个 thread 只取最新一条、前缀拆租户。

    PG 不可用时 skip（见 conftest）。这条用例是"扫描 SQL 真的对"的唯一证据——
    上面的用例走的是假索引，验的是控制面拿到清单之后做了什么。

    全部跑在**同一个事件循环**里：``AsyncPostgresSaver`` 内部的锁在首次获取时
    绑定当时的事件循环，跨 ``asyncio.run`` 复用会炸 "bound to a different event
    loop"。生产里本来就只有一个常驻循环。
    """
    admin_dsn, app_dsn = pg_dsns
    counts = [0]

    def _build(*, plan_delay: float, run_delay: float) -> BrainService:
        return BrainService(
            planner_for=lambda _ctx: _SlowPlanner(counts, plan_delay),
            runtime_for=lambda _ctx: _SlowRuntime(delay=run_delay),
            checkpointer=PgCheckpointerProvider(app_dsn, schema=rls_schema),
            team_bus=TeamBus(registry=ProfileRegistry(), tasks=InMemoryTeamTasks()),
            artifacts=InMemoryArtifacts(),
        )

    async def _scenario() -> None:
        # ① 起一轮、死在拆解这一步 —— 检查点留在库里，调度没了。
        #    死在这一步而不是员工波次里，是为了让"取消"落在一个干净的边界上
        #    （见 :class:`_SlowPlanner`）。
        first_service = _build(plan_delay=1.0, run_delay=0.0)
        control = RunControl(first_service)
        run_id = (
            await control.submit(tenant_id=TENANT, goal="分析本月异常订单", user_token=admin_token)
        )["run_id"]
        assert await _until(lambda: _checkpoint_exists(first_service, run_id), timeout=10.0)
        await control.shutdown()

        stuck = await first_service.get(tenant_id=TENANT, run_id=run_id)
        assert stuck["status"] == "running", stuck

        running = list_unfinished(admin_dsn, statuses=RESUMABLE_STATUSES, schema=rls_schema)
        assert [r.run_id for r in running] == [run_id]
        assert running[0].tenant_id == TENANT
        assert running[0].status == "running"

        # 停在闸门上的那一类不在里面（那是等人，不是没跑完）。
        assert list_unfinished(admin_dsn, statuses={"awaiting_approval"}, schema=rls_schema) == []

        # ② 新进程续跑 → 落到"等人"，于是下一次扫描不再认领它。
        resumed_service = _build(plan_delay=0.0, run_delay=0.0)
        after = RunControl(resumed_service, run_index=_FakeIndex([(TENANT, run_id)]))
        assert await after.recover() == [run_id]
        landed = await _settle(resumed_service, run_id)
        assert landed["status"] == "awaiting_approval", landed
        assert counts[0] == 2, (
            f"plan() 共 {counts[0]} 次：拆解**没跑完**，续跑就该重跑它一次"
            "（'已完成的不重跑'的另一面）"
        )
        assert list_unfinished(admin_dsn, statuses=RESUMABLE_STATUSES, schema=rls_schema) == []
        await after.shutdown()

    asyncio.run(_scenario())


def test_the_http_surface_still_settles_the_same_way() -> None:
    """既有链路不回归：受理制 + 闸门语义原样。"""
    service, _runtime, _counts = _service()
    client = _clients.enter_context(TestClient(create_app(service=service)))
    response = client.post(f"{BASE}/runs", json={"goal": "分析本月异常订单"}, headers=_headers())
    assert response.status_code == 202, response.text
    run_id = response.json()["run_id"]

    deadline = time.monotonic() + 8.0
    body: dict[str, Any] = {}
    while time.monotonic() < deadline:
        body = client.get(f"{BASE}/runs/{run_id}", headers=_headers()).json()
        if body.get("status") in SETTLED:
            break
        time.sleep(0.02)
    assert body["status"] == "awaiting_approval", body
