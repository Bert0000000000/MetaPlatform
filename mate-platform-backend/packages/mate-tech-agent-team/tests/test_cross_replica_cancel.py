"""1.9 任务 2 · 取消信号跨副本。

**现状**（1.5 自述的边界 1）：控制面"不持有任何 run 历史"，取消标志放在
``RunControl._live`` 里 —— **进程内存**。副本 A 起的 run，副本 B 取消不到：
B 那侧没有 live 记录，于是它只往检查点写一个终态就回话；而**在途的图**攥着
自己那份状态继续跑，下一步就把那个终态覆盖回去。实测的结果是取消被"复活"成
``awaiting_approval``，且下一波员工照派。

**怎么治**：把取消标志从进程内存挪到一个**可共享的信号通道**
（:mod:`mate_tech_agent_team.coordination` 的 ``CancelSignals``）。控制面的其余
部分一个字不动——信号仍然只是"此刻要不要停"，不是 run 的历史；图仍然在
**波边界**自查，在途那一波允许跑完（不硬断，1.5 语义不破）。

**判据**：模拟多副本（两个控制面实例共享检查点 **+ 共享信号通道**）→ 在另一
副本取消，**生效**；停闸门的语义不变。

**边界登记**：取消信号是**粘性**的（只置不清）。它能被清掉才是错的——置清之间
的窗口里，另一副本的图正好走到边界就看不到它。代价是一张只增不减的小表
（量级 = 被取消过的 run 数），随 run 终态自然失去意义。
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
    SubTask,
    SubTaskResult,
    TeamBus,
)
from mate_tech_agent_team.api.run_control import RunControl
from mate_tech_agent_team.brain import RunNotFound
from mate_tech_agent_team.coordination import (
    InMemoryCancelSignals,
    PgCancelSignals,
    bootstrap_coordination,
)
from mate_tech_agent_team.main import create_app
from mate_tech_agent_team.run_lease import InMemoryRunLeases

BASE = "/api/v1/agent-team"
TENANT = "tenant-acme"
OTHER_TENANT = "tenant-other"

SETTLED = frozenset({"awaiting_approval", "completed", "failed", "cancelled", "timeout"})


class _BlockingRuntime:
    """员工调用停在中途等测试放行 —— 模拟"图正在执行、请求还在等它"。"""

    def __init__(self) -> None:
        self.entered = asyncio.Event()
        self.release = asyncio.Event()
        self.started: list[str] = []

    async def run(self, *, subtask: SubTask, tenant_id: str) -> SubTaskResult:
        # 按 ``team_task_id``（``<run 前8位>-<计划内标签>``）记，两轮同时在途也分得开。
        self.started.append(subtask.get("team_task_id", subtask["task_id"]))
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


_clients: ExitStack = ExitStack()


@pytest.fixture(autouse=True)
def _close_test_clients() -> Iterator[None]:
    yield
    _clients.close()


def _service(*, runtime: Any = None, planner: Any = None):
    rt = runtime if runtime is not None else _Runtime()
    plan = planner if planner is not None else _TwoWavePlanner()
    service = BrainService(
        planner_for=lambda _ctx: plan,
        runtime_for=lambda _ctx: rt,
        checkpointer=InMemoryCheckpointerProvider(),
        team_bus=TeamBus(registry=ProfileRegistry(), tasks=InMemoryTeamTasks()),
        artifacts=InMemoryArtifacts(),
    )
    return service, rt


async def _until(predicate, *, timeout: float = 8.0, interval: float = 0.01):
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


def _of_run(started: list[str], run_id: str) -> list[str]:
    """某一轮真的跑过哪几件（``team_task_id`` 带 run 前缀）。"""
    prefix = f"{run_id[:8]}-"
    return sorted(task.split("-", 1)[1] for task in started if task.startswith(prefix))


# ── 主判据：另一副本取消得到 ────────────────────────────────────────────


def test_a_replica_that_did_not_start_the_run_can_still_cancel_it(admin_token) -> None:
    """**主判据**：两个副本共享检查点 **+ 共享信号通道**，在另一副本取消**生效**。

    副本 B 没有这一轮的 live 记录，所以它取消不掉"进程里的那张表"；它能做的只有
    把信号放进共享通道，让**正在跑的图**在下一个波边界自己看到。三件事一起验：
    ① 落终态 ``cancelled``；② 下一波一个员工都不派（不是"取消了但还在跑"）；
    ③ 这个终态是**图自己写进检查点**的，换个读路径看到的也是它。
    """

    async def _scenario() -> None:
        runtime = _BlockingRuntime()
        service, _rt = _service(runtime=runtime)
        signals = InMemoryCancelSignals()
        replica_a = RunControl(service, signals=signals)
        replica_b = RunControl(service, signals=signals)

        run_id = (
            await replica_a.submit(
                tenant_id=TENANT, goal="分析本月异常订单", user_token=admin_token
            )
        )["run_id"]
        # 等图真的进到员工调用里，再去取消它。
        await asyncio.wait_for(runtime.entered.wait(), 5)

        cancelling = asyncio.create_task(replica_b.cancel(tenant_id=TENANT, run_id=run_id))
        await asyncio.sleep(0.1)
        runtime.release.set()  # 放行在途那一波：允许跑完，但不再往下走
        cancelled = await asyncio.wait_for(cancelling, 5)

        # ① 落终态。
        assert cancelled["status"] == "cancelled", cancelled
        # ② 不再推进：第二波（t3）没被派出去；已完成的第一波不重跑（波边界语义）。
        assert _of_run(runtime.started, run_id) == ["t1", "t2"], runtime.started
        # ③ 终态在检查点里：换个读路径（不经控制面）看到的也是同一份。
        settled = await service.get(tenant_id=TENANT, run_id=run_id)
        assert settled["status"] == "cancelled", settled

    asyncio.run(_scenario())


def test_cancelling_one_run_does_not_stop_its_neighbour(admin_token) -> None:
    """取消是**按轮**的，不是"把控制面全停了"。

    共享通道最坏的一种退化是把取消做成全局开关——那样一个租户取消一轮就会顺带
    停掉别人的在途 run。这条用例把两轮**同时**置于在途，只取消其中一轮。
    """

    async def _scenario() -> None:
        runtime = _BlockingRuntime()
        service, _rt = _service(runtime=runtime)
        signals = InMemoryCancelSignals()
        replica_a = RunControl(service, signals=signals)
        replica_b = RunControl(service, signals=signals)

        doomed = (
            await replica_a.submit(
                tenant_id=TENANT, goal="分析本月异常订单", user_token=admin_token
            )
        )["run_id"]
        spared = (
            await replica_a.submit(tenant_id=TENANT, goal="盘点本月库存", user_token=admin_token)
        )["run_id"]
        await asyncio.wait_for(runtime.entered.wait(), 5)

        async def _both_started() -> bool:
            return bool(_of_run(runtime.started, doomed)) and bool(_of_run(runtime.started, spared))

        await _until(_both_started)

        cancelling = asyncio.create_task(replica_b.cancel(tenant_id=TENANT, run_id=doomed))
        await asyncio.sleep(0.1)
        runtime.release.set()
        await asyncio.wait_for(cancelling, 5)

        assert (await _settle(service, doomed))["status"] == "cancelled"
        neighbour = await _settle(service, spared)
        assert neighbour["status"] == "awaiting_approval", neighbour
        # 邻居的第二波照派：它没被顺手停掉。
        assert _of_run(runtime.started, spared) == ["t1", "t2", "t3"], runtime.started

    asyncio.run(_scenario())


# ── 停闸门的语义不变（1.3 / 1.5）────────────────────────────────────────


def test_a_run_parked_at_the_gate_is_cancelled_by_another_replica(admin_token) -> None:
    """停在闸门上的 run **跨副本**取消仍然有效，而且不会被图推回去。

    闸门上的 run 没有人在跑它，所以这条路径不靠信号——终态直接落在检查点上。
    它是 1.3 就有的语义，本批不许把它改坏。
    """

    async def _scenario() -> None:
        service, _rt = _service()
        signals = InMemoryCancelSignals()
        replica_a = RunControl(service, signals=signals)
        replica_b = RunControl(service, signals=signals)

        run_id = (
            await replica_a.submit(
                tenant_id=TENANT, goal="分析本月异常订单", user_token=admin_token
            )
        )["run_id"]
        parked = await _settle(service, run_id)
        assert parked["status"] == "awaiting_approval", parked

        cancelled = await replica_b.cancel(tenant_id=TENANT, run_id=run_id)
        assert cancelled["status"] == "cancelled", cancelled
        # 等一会儿再看：图不会把它推回 running / awaiting_approval。
        await asyncio.sleep(0.2)
        again = await service.get(tenant_id=TENANT, run_id=run_id)
        assert again["status"] == "cancelled", again

    asyncio.run(_scenario())


def test_cancelling_from_another_tenant_is_still_not_found(admin_token) -> None:
    """跨租户 / 不存在同码 404：信号通道**不提供**一条绕过租户隔离的探测路径。"""

    async def _scenario() -> None:
        service, _rt = _service()
        signals = InMemoryCancelSignals()
        replica_a = RunControl(service, signals=signals)
        replica_b = RunControl(service, signals=signals)

        run_id = (
            await replica_a.submit(
                tenant_id=TENANT, goal="分析本月异常订单", user_token=admin_token
            )
        )["run_id"]
        await _settle(service, run_id)

        for tenant in (OTHER_TENANT, "no-such-tenant"):
            try:
                await replica_b.cancel(tenant_id=tenant, run_id=run_id)
            except RunNotFound:
                pass
            else:  # pragma: no cover - 走到这里就是隔离漏了
                raise AssertionError(f"跨租户取消没有被拒：{tenant}")
            # 别人的租户也没把信号置进本租户的名下。
            assert await signals.is_requested(tenant_id=TENANT, run_id=run_id) is False

    asyncio.run(_scenario())


# ── 信号通道本身 ────────────────────────────────────────────────────────


def test_the_signal_store_is_shared_and_keyed_by_tenant_and_run() -> None:
    """信号存在**共享存储**里，键是 ``(租户, run)``——不是进程内存、不是全局开关。"""

    async def _scenario() -> None:
        signals = InMemoryCancelSignals()
        assert await signals.is_requested(tenant_id=TENANT, run_id="r1") is False

        await signals.request(tenant_id=TENANT, run_id="r1")
        assert await signals.is_requested(tenant_id=TENANT, run_id="r1") is True
        # 别人的 run、别的租户都不受影响。
        assert await signals.is_requested(tenant_id=TENANT, run_id="r2") is False
        assert await signals.is_requested(tenant_id=OTHER_TENANT, run_id="r1") is False

        # 重复置位是幂等的（取消本来就幂等）。
        await signals.request(tenant_id=TENANT, run_id="r1")
        assert await signals.is_requested(tenant_id=TENANT, run_id="r1") is True

    asyncio.run(_scenario())


def test_the_signal_is_sticky_until_terminal_and_archived_after(admin_token) -> None:
    """信号**只置不清**（在途期间），终态之后被**归档**。

    两半各治一个毛病，缺一不可：

    * **没终态就清掉** → 置清之间正好走到边界的图就看不到它（1.9 立这条的理由，
      仍然成立）；
    * **终态之后还留着** → 这张表会随"被取消过的 run 数"一直涨（B-3 加的归档）。

    所以这里断言的是**时机**：在途时不动它，落终态后下一次读把它清掉。
    （B-3 起清只发生在读路径看到终态时，`cancel` 自己只置。）
    """

    async def _scenario() -> None:
        service, _rt = _service()
        signals = InMemoryCancelSignals()
        #: 显式给租约表：下面要**等它释放**再取消（见「前提」那句）。
        leases = InMemoryRunLeases(ttl=30.0)
        control = RunControl(service, signals=signals, leases=leases)

        run_id = (await control.submit(tenant_id=TENANT, goal="分析本月异常订单"))["run_id"]
        await _settle(service, run_id)

        # **前提**：这一轮此刻没有人在跑（租约已释放）。
        # 不显式等它的话会踩一个真的竞态：`service.get` 先看到 `awaiting_approval`
        # 而后台任务的 finally 还没跑完（租约还没归还），于是取消走"有人在跑"
        # 那条支路、回 `cancelling`——那是**对的行为遇到错的测试前提**。
        async def _lease_released() -> bool:
            return await leases.get(tenant_id=TENANT, run_id=run_id) is None

        assert await _until(_lease_released, timeout=5.0) is not None, (
            "这一轮迟迟不释放租约，后面的断言前提不成立"
        )

        # ① 在途（还没落终态）：信号**只置不清**
        await signals.request(tenant_id=TENANT, run_id=run_id)
        probe = await control.refresh(tenant_id=TENANT, run_id=run_id)
        assert probe["status"] == "cancelling", "中间态应该可观测"
        assert await signals.is_requested(tenant_id=TENANT, run_id=run_id) is True, (
            "还没落终态就把信号清掉了——置清之间走到边界的图会看不到它"
        )

        # ② 落终态之后：下一次读把它归档掉
        await control.cancel(tenant_id=TENANT, run_id=run_id)
        settled = await control.refresh(tenant_id=TENANT, run_id=run_id)
        assert settled["status"] == "cancelled"
        assert await signals.is_requested(tenant_id=TENANT, run_id=run_id) is False, (
            "终态之后信号没被归档，这张表会只增不减"
        )

    asyncio.run(_scenario())


# ── 既有 HTTP 面不回归 ──────────────────────────────────────────────────


def test_the_http_cancel_surface_still_settles_the_same_way() -> None:
    service, _rt = _service()
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

    cancelled = client.post(f"{BASE}/runs/{run_id}/cancel", headers=_headers())
    # B-3 起取消回 **202**（受理制），body 里是**观察到的**状态。
    assert cancelled.status_code == 202, cancelled.text
    assert cancelled.json()["status"] == "cancelled"


# ── 真库：共享通道跨连接可见（= 真·多副本）─────────────────────────────


def test_pg_cancel_signals_are_visible_across_connections(
    pg_dsns: tuple[str, str], rls_schema: str
) -> None:
    """真库上验共享通道：两条独立连接（= 两个副本）互相看得见，且按租户隔离。

    内存实现证的是"控制面用对了通道"；这一条证的是"通道本身在真部署里共享得
    起来"——两条连接之间没有任何进程内状态可依赖。
    """

    async def _scenario() -> None:
        _, app_dsn = pg_dsns
        a = PgCancelSignals(app_dsn, schema=rls_schema)
        b = PgCancelSignals(app_dsn, schema=rls_schema)

        await a.request(tenant_id=TENANT, run_id="run-1")
        assert await b.is_requested(tenant_id=TENANT, run_id="run-1") is True
        assert await b.is_requested(tenant_id=TENANT, run_id="run-2") is False
        # 跨租户看不见：RLS 的 ``app.tenant_id`` 没设成对方时读不到（fail-closed）。
        assert await b.is_requested(tenant_id=OTHER_TENANT, run_id="run-1") is False
        # 幂等：重复置位不报错。
        await b.request(tenant_id=TENANT, run_id="run-1")
        assert await a.is_requested(tenant_id=TENANT, run_id="run-1") is True

    asyncio.run(_scenario())


def test_bootstrap_coordination_installs_the_signal_table_with_rls(
    pg_dsns: tuple[str, str], rls_schema: str
) -> None:
    """建表入口是幂等的，且表带 RLS（缺了它，"隔离"就不是数据库说的）。"""

    import psycopg

    admin_dsn, app_dsn = pg_dsns
    with psycopg.connect(admin_dsn, autocommit=True) as conn:
        conn.execute(f"SET search_path TO {rls_schema}")
        bootstrap_coordination(conn, app_role="mate_app")  # 再建一次：幂等
    with psycopg.connect(app_dsn, autocommit=True) as conn:
        # 按 **schema 过滤**，别只按 relname 查。
        #
        # `pg_class` 是**全库**系统目录，`SET search_path` 对它无效 —— 只写
        # `WHERE relname = 'cancel_signals'` 等于在断言"**全库**只有这一张"。
        # 开发机上只要跑过真服务（启动引导会在自己的 schema 建同名表），
        # 这里就会数到 2 而失败，且现象与本用例要验的东西毫无关系。
        # CI 用全新 PG 所以一直没暴露 —— 别把它留成"只有本地才炸"的陷阱。
        rows = conn.execute(
            """
            SELECT c.relrowsecurity
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = 'cancel_signals' AND n.nspname = %s
            """,
            (rls_schema,),
        ).fetchall()
    assert rows == [(True,)], rows


def _headers(tenant_id: str = TENANT) -> dict[str, str]:
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
        "test-secret",
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}
