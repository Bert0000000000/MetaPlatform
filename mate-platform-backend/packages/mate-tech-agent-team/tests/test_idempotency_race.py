"""1.9 任务 3 · 幂等跨副本竞态。

**现状**（1.7 自述："幂等的跨进程面靠确定性 run_id + 查检查点，进程内靠同一张
``_live`` 表占坑……跨副本的**同时**提交有极小竞态"）：两个副本同时提交同一个
``Idempotency-Key`` 时，两边都先算出了同一个 run_id，然后**都**去查检查点——
都还没查到对方写的那一份，于是**都开跑**。键收敛到同一个地址（这部分本来就对），
但**跑了两轮**：拆图解两次、员工派两遍、账上两轮。

**怎么治**：进程内那张 ``_live`` 占坑表的跨副本版本——一个**共享的认领**
（:mod:`mate_tech_agent_team.coordination` 的 ``RunClaims``）。谁先认领到谁跑，
另一个原样回同一个 ``run_id`` 并置 ``deduplicated``。认领是**有寿命**的：
占坑随执行结束释放，崩溃留下的孤儿坑在 TTL 之后可以被人接管——不然一次硬崩
就把那一把钥匙永久锁死了（比竞态更糟）。

**判据**：并发同 ``Idempotency-Key`` → **只产生一个 run**；跨副本同样成立。
"""

from __future__ import annotations

import asyncio
import time
from typing import Any

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
from mate_tech_agent_team.api.run_control import RunControl, run_id_for
from mate_tech_agent_team.brain import RunNotFound
from mate_tech_agent_team.coordination import InMemoryRunClaims, PgRunClaims

TENANT = "tenant-acme"
OTHER_TENANT = "tenant-other"

SETTLED = frozenset({"awaiting_approval", "completed", "failed", "cancelled", "timeout"})


class _Runtime:
    def __init__(self) -> None:
        self.started: list[str] = []

    async def run(self, *, subtask: SubTask, tenant_id: str) -> SubTaskResult:
        self.started.append(subtask["task_id"])
        return SubTaskResult(
            task_id=subtask["task_id"],
            team_task_id=subtask.get("team_task_id", ""),
            profile_id=subtask["profile_id"],
            status="ok",
            output=f"{tenant_id}|{subtask['profile_id']}|已处理",
            llm_calls=1,
            source="llm",
        )


class _CountingPlanner(StaticPlanner):
    """数 ``plan()`` 被调了几次 —— "只跑了一轮"的可读证据。"""

    def __init__(self, counter: list[int]) -> None:
        self._counter = counter

    async def plan(self, *, goal: str, max_parallel: int, tenant_id: str) -> list[SubTask]:
        self._counter[0] += 1
        return await super().plan(goal=goal, max_parallel=max_parallel, tenant_id=tenant_id)


def _service(*, counter: list[int] | None = None):
    counts = counter if counter is not None else [0]
    runtime = _Runtime()
    service = BrainService(
        planner_for=lambda _ctx: _CountingPlanner(counts),
        runtime_for=lambda _ctx: runtime,
        checkpointer=InMemoryCheckpointerProvider(),
        team_bus=TeamBus(registry=ProfileRegistry(), tasks=InMemoryTeamTasks()),
        artifacts=InMemoryArtifacts(),
    )
    return service, runtime, counts


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


# ── 主判据：并发同键只产生一个 run ──────────────────────────────────────


def test_two_replicas_submitting_the_same_key_at_once_produce_exactly_one_run(
    admin_token,
) -> None:
    """**主判据**：两个副本（两个控制面实例、共享认领）同时提交同一个键。

    验四件事：① 两边算出**同一个** run_id（确定性地址，1.7 就成立）；② 只有一边
    是"新起的那一轮"（``deduplicated=False``），另一边如实回执"没新起"；
    ③ 图**只跑了一轮**——拆解一次、员工各派一次；④ 落库的也是这一轮。
    """

    async def _scenario() -> None:
        service, runtime, counts = _service()
        claims = InMemoryRunClaims()
        replica_a = RunControl(service, claims=claims)
        replica_b = RunControl(service, claims=claims)
        key = "k-race"

        a, b = await asyncio.gather(
            replica_a.submit(
                tenant_id=TENANT,
                goal="分析本月异常订单",
                user_token=admin_token,
                idempotency_key=key,
            ),
            replica_b.submit(
                tenant_id=TENANT,
                goal="分析本月异常订单",
                user_token=admin_token,
                idempotency_key=key,
            ),
        )

        # ① 同一个地址。
        assert a["run_id"] == b["run_id"] == run_id_for(TENANT, key)
        # ② 只有一边是新起的那一轮。
        firsts = [r for r in (a, b) if not r["deduplicated"]]
        assert len(firsts) == 1, f"两边都当自己是第一个：{a} / {b}"

        body = await _settle(service, a["run_id"])
        # ③ 只跑了一轮：拆解一次，员工各派一次、没有重派。
        assert counts[0] == 1, f"图跑了 {counts[0]} 轮 —— 同一把钥匙起了两轮"
        assert len(set(runtime.started)) == len(runtime.started), (
            f"有员工被派了多次：{runtime.started}"
        )
        # ④ 落库的也是这一轮。
        assert body["run_id"] == a["run_id"]
        assert body["goal"] == "分析本月异常订单"

    asyncio.run(_scenario())


def test_the_same_key_on_one_replica_is_also_exactly_once(admin_token) -> None:
    """同进程并发（同一张 ``_live`` 占坑）本来就精确幂等——本批不许把它改坏。"""

    async def _scenario() -> None:
        service, _runtime, counts = _service()
        control = RunControl(service, claims=InMemoryRunClaims())
        a, b = await asyncio.gather(
            control.submit(
                tenant_id=TENANT,
                goal="分析本月异常订单",
                user_token=admin_token,
                idempotency_key="k-1",
            ),
            control.submit(
                tenant_id=TENANT,
                goal="分析本月异常订单",
                user_token=admin_token,
                idempotency_key="k-1",
            ),
        )
        assert a["run_id"] == b["run_id"]
        assert sorted(r["deduplicated"] for r in (a, b)) == [False, True]
        await _settle(service, a["run_id"])
        assert counts[0] == 1, f"图跑了 {counts[0]} 轮"

    asyncio.run(_scenario())


def test_a_different_key_still_starts_its_own_run(admin_token) -> None:
    """负面：认领是**按钥匙**的——别把"同键去重"做成"只准跑一轮"。"""

    async def _scenario() -> None:
        service, _runtime, counts = _service()
        control = RunControl(service, claims=InMemoryRunClaims())
        a = await control.submit(
            tenant_id=TENANT,
            goal="分析本月异常订单",
            user_token=admin_token,
            idempotency_key="k-1",
        )
        b = await control.submit(
            tenant_id=TENANT,
            goal="盘点本月库存",
            user_token=admin_token,
            idempotency_key="k-2",
        )
        assert a["run_id"] != b["run_id"]
        assert a["deduplicated"] is False and b["deduplicated"] is False
        await _settle(service, a["run_id"])
        await _settle(service, b["run_id"])
        assert counts[0] == 2, f"两把不同的钥匙应当各起一轮，实际 {counts[0]}"

    asyncio.run(_scenario())


def test_the_same_key_in_two_tenants_is_two_runs(admin_token) -> None:
    """负面：租户进摘要也进认领——两家的同一把钥匙本来就该是两轮。"""

    async def _scenario() -> None:
        service, _runtime, counts = _service()
        control = RunControl(service, claims=InMemoryRunClaims())
        a = await control.submit(
            tenant_id=TENANT,
            goal="分析本月异常订单",
            user_token=admin_token,
            idempotency_key="shared-key",
        )
        b = await control.submit(
            tenant_id=OTHER_TENANT,
            goal="分析本月异常订单",
            user_token=admin_token,
            idempotency_key="shared-key",
        )
        assert a["run_id"] != b["run_id"]
        assert a["deduplicated"] is False and b["deduplicated"] is False

    asyncio.run(_scenario())


def test_a_key_that_already_ran_elsewhere_is_not_started_again(admin_token) -> None:
    """换一个副本重提一把已经跑过的钥匙：不新起一轮。

    副本 B 是**另一个实例**（连认领表都是它自己的，等价于"重启之后的新副本"），
    所以它抢得到坑——但抢到之后还要再过一道"查检查点"，于是照样去重。这一道是
    1.7 就有的，本批不许丢：认领只负责"同时"那一个窗口，不负责"已经跑过"。
    """

    async def _scenario() -> None:
        service, _runtime, counts = _service()
        key = "k-replayed"
        replica_a = RunControl(service, claims=InMemoryRunClaims())
        first = await replica_a.submit(
            tenant_id=TENANT,
            goal="分析本月异常订单",
            user_token=admin_token,
            idempotency_key=key,
        )
        await _settle(service, first["run_id"])

        replica_b = RunControl(service, claims=InMemoryRunClaims())
        again = await replica_b.submit(
            tenant_id=TENANT,
            goal="分析本月异常订单",
            user_token=admin_token,
            idempotency_key=key,
        )
        assert again["run_id"] == first["run_id"]
        assert again["deduplicated"] is True
        assert counts[0] == 1, f"重放起了第二轮（plan 共 {counts[0]} 次）"

    asyncio.run(_scenario())


def test_a_finished_run_hands_its_claim_back(admin_token) -> None:
    """跑完的那一轮把认领**还回去**。

    不还的话，这张表会随"用过的键的个数"一直涨——而不是随"同时在途的轮数"。
    崩掉/被拆掉时这一步可能没跑成，那时靠认领的寿命兜（见下一条用例）。
    """

    async def _scenario() -> None:
        service, _runtime, _counts = _service()
        claims = InMemoryRunClaims()
        control = RunControl(service, claims=claims)
        key = "k-handed-back"
        run_id = (
            await control.submit(
                tenant_id=TENANT,
                goal="分析本月异常订单",
                user_token=admin_token,
                idempotency_key=key,
            )
        )["run_id"]
        await _settle(service, run_id)

        async def _free() -> bool:
            """拿"能不能认领到"当探针；拿到就立刻还回去（不改状态）。"""
            if await claims.claim(tenant_id=TENANT, key=key, run_id=run_id):
                await claims.release(tenant_id=TENANT, key=key)
                return True
            return False

        assert await _until(_free, timeout=2.0), "跑完的 run 没有把认领还回去"

    asyncio.run(_scenario())


# ── 认领本身 ────────────────────────────────────────────────────────────


def test_the_claim_store_is_shared_and_keyed_by_tenant_and_key() -> None:
    """认领在**共享存储**里，键是 ``(租户, 钥匙)``——不是进程内存，也不是全局锁。"""

    async def _scenario() -> None:
        claims = InMemoryRunClaims()
        assert await claims.claim(tenant_id=TENANT, key="k", run_id="r1") is True
        # 同一把钥匙：第二个人拿不到（而且要等到它被释放或过期）。
        assert await claims.claim(tenant_id=TENANT, key="k", run_id="r1") is False
        # 别的钥匙、别的租户各归各的。
        assert await claims.claim(tenant_id=TENANT, key="k2", run_id="r2") is True
        assert await claims.claim(tenant_id=OTHER_TENANT, key="k", run_id="r3") is True
        # 释放之后可以重新认领。
        await claims.release(tenant_id=TENANT, key="k")
        assert await claims.claim(tenant_id=TENANT, key="k", run_id="r1") is True

    asyncio.run(_scenario())


def test_a_stale_claim_is_taken_over_so_a_crash_does_not_wedge_the_key() -> None:
    """硬崩留下的孤儿坑**有寿命**：过了 TTL 可以被接管。

    没有这一条，一次"领了坑就崩"会把那把钥匙**永久**锁死——重提只会被去重到一个
    根本没有检查点的 run_id（查它永远是 404）。那比原来那个竞态更糟。
    """

    async def _scenario() -> None:
        claims = InMemoryRunClaims(ttl=0.05)
        assert await claims.claim(tenant_id=TENANT, key="k", run_id="r1") is True
        assert await claims.claim(tenant_id=TENANT, key="k", run_id="r1") is False
        await asyncio.sleep(0.1)
        assert await claims.claim(tenant_id=TENANT, key="k", run_id="r1") is True, (
            "崩溃留下的占坑把这一把钥匙永久锁死了"
        )

    asyncio.run(_scenario())


def test_a_wedged_key_recovers_once_the_claim_goes_stale(admin_token) -> None:
    """端到端形态：占坑被抢走且没有检查点 → TTL 之后这一轮**真的**跑起来。"""

    async def _scenario() -> None:
        service, runtime, counts = _service()
        claims = InMemoryRunClaims(ttl=0.05)
        control = RunControl(service, claims=claims)
        key = "k-crash"

        # 模拟"上一个副本领了坑、还没落检查点就没了"。
        assert await claims.claim(tenant_id=TENANT, key=key, run_id=run_id_for(TENANT, key)) is True
        blocked = await control.submit(
            tenant_id=TENANT,
            goal="分析本月异常订单",
            user_token=admin_token,
            idempotency_key=key,
        )
        assert blocked["deduplicated"] is True, "别人的新鲜占坑应当把这一轮挡下"
        assert counts[0] == 0, "被挡下的那一次不该起图"

        await asyncio.sleep(0.1)  # 占坑过期
        resumed = await control.submit(
            tenant_id=TENANT,
            goal="分析本月异常订单",
            user_token=admin_token,
            idempotency_key=key,
        )
        assert resumed["deduplicated"] is False, "过期占坑应当可以被接管"
        body = await _settle(service, resumed["run_id"])
        assert body["status"] == "awaiting_approval", body
        assert counts[0] == 1, f"接管之后应当真跑一轮，实际 {counts[0]}"
        assert runtime.started, "接管之后一个员工都没被派出去"

    asyncio.run(_scenario())


# ── 真库：认领的原子性 ──────────────────────────────────────────────────


def test_pg_run_claims_are_atomic_across_connections(
    pg_dsns: tuple[str, str], rls_schema: str
) -> None:
    """真库上验原子性：N 条**独立连接**同时抢同一把钥匙，**有且只有一个**抢到。

    内存实现证的是"控制面用对了共享认领"；这一条证的是"认领本身在真部署里是原子
    的"——``INSERT ... ON CONFLICT DO UPDATE ... WHERE`` 落在数据库里，而不是
    "先查一次再写一次"那种读后写窗口。
    """

    async def _scenario() -> None:
        _, app_dsn = pg_dsns
        stores = [PgRunClaims(app_dsn, schema=rls_schema) for _ in range(8)]
        wins = await asyncio.gather(
            *(store.claim(tenant_id=TENANT, key="k-race", run_id="r-race") for store in stores)
        )
        assert sum(wins) == 1, f"同一把钥匙被 {sum(wins)} 个副本同时抢到：{wins}"

        # 别的钥匙 / 别的租户不受影响。
        assert await stores[0].claim(tenant_id=TENANT, key="k-other", run_id="r2") is True
        assert await stores[0].claim(tenant_id=OTHER_TENANT, key="k-race", run_id="r3") is True
        # 释放之后可以重新认领。
        await stores[0].release(tenant_id=TENANT, key="k-race")
        assert await stores[1].claim(tenant_id=TENANT, key="k-race", run_id="r-race") is True

    asyncio.run(_scenario())


def test_pg_run_claims_take_over_a_stale_row(pg_dsns: tuple[str, str], rls_schema: str) -> None:
    """真库上验寿命：过期那一行能被接管（WHERE 写在 UPDATE 上，不是应用层判的）。"""

    async def _scenario() -> None:
        _, app_dsn = pg_dsns
        stale = PgRunClaims(app_dsn, schema=rls_schema, ttl=0.0)
        fresh = PgRunClaims(app_dsn, schema=rls_schema, ttl=600.0)

        assert await fresh.claim(tenant_id=TENANT, key="k-stale", run_id="r-1") is True
        assert await stale.claim(tenant_id=TENANT, key="k-stale", run_id="r-1") is True, (
            "ttl=0 的那一侧应当接管过期行"
        )
        assert await fresh.claim(tenant_id=TENANT, key="k-stale", run_id="r-1") is False

    asyncio.run(_scenario())
