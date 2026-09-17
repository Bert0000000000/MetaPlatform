"""B-1 / `MP-RUN-LEASE-01` 的判据：活跃 run 租约、心跳、四条件接管。

三件事分开验，因为它们的失败模式不一样：

1. **纯判据**（:func:`decide_takeover`）—— 四条件缺一不可。用构造出来的时间戳
   验，不依赖 sleep，所以它跑得快也不会 flaky。
2. **租约的原子语义**（PG）—— 并发抢同一轮**恰好一个赢**；换手之后上一任的
   续租/释放**被数据库拒掉**（靠 ``lease_epoch``，不是靠时序运气）。
3. **心跳真的在续命** —— 一条比 TTL 长得多的 run 不会被自己的寿命误判成孤儿；
   而停掉心跳的那条会被接管。这是"长跑不被误接管 / 真崩的孤儿能接管"的分界。
"""

from __future__ import annotations

import asyncio
import time

import pytest
from mate_tech_agent_team.run_lease import (
    InMemoryRunLeases,
    PgRunLeases,
    RunLease,
    decide_takeover,
)

TENANT = "tenant-lease"
RUN = "run-lease-1"
TTL = 30.0
GRACE = 30.0


def _lease(
    *,
    owner: str = "inst-a",
    epoch: int = 1,
    heartbeat_at: float = 0.0,
    expires_at: float = 0.0,
    current_step: str = "",
) -> RunLease:
    return RunLease(
        tenant_id=TENANT,
        run_id=RUN,
        owner_instance=owner,
        lease_epoch=epoch,
        heartbeat_at=heartbeat_at,
        expires_at=expires_at,
        current_step=current_step,
        acquired_at=0.0,
    )


# ── 1. 四条件判据（纯函数）─────────────────────────────────────────────


def test_no_lease_is_an_orphan_and_is_taken_over() -> None:
    """没有租约行却有未完成的检查点 = 孤儿（崩在写租约之前 / 租约行已清）。"""
    decision = decide_takeover(None, now=1000.0, checkpoint_step="step-3", running_invocations=0)
    assert decision.take is True
    assert decision.reason == "orphan_no_lease"


def test_alive_lease_is_not_taken_over() -> None:
    """租约还没过期 —— 有人正拿着，别抢。"""
    lease = _lease(heartbeat_at=990.0, expires_at=1010.0)
    decision = decide_takeover(
        lease, now=1000.0, checkpoint_step="", running_invocations=0, heartbeat_grace=GRACE
    )
    assert decision.take is False
    assert decision.reason == "lease_alive"


def test_expired_but_fresh_heartbeat_is_not_taken_over() -> None:
    """**过期不等于死**：心跳是新的就说明它还在动。"""
    lease = _lease(heartbeat_at=995.0, expires_at=999.0)
    decision = decide_takeover(
        lease, now=1000.0, checkpoint_step="", running_invocations=0, heartbeat_grace=GRACE
    )
    assert decision.take is False
    assert decision.reason == "heartbeat_fresh"


def test_checkpoint_advanced_after_lease_expiry_blocks_takeover() -> None:
    """租约失效之后检查点还在往前 —— 有个没续租的活人在写，抢了就是双跑。"""
    lease = _lease(heartbeat_at=900.0, expires_at=950.0, current_step="step-a")
    decision = decide_takeover(
        lease,
        now=1000.0,
        checkpoint_step="step-b",
        running_invocations=0,
        heartbeat_grace=GRACE,
    )
    assert decision.take is False
    assert decision.reason == "checkpoint_advanced"


def test_checkpoint_not_advanced_but_newer_than_recorded_is_still_taken() -> None:
    """检查点**没越过**租约记下的那一步 → "未进展"成立 → 可以接管。"""
    lease = _lease(heartbeat_at=900.0, expires_at=950.0, current_step="step-b")
    decision = decide_takeover(
        lease,
        now=1000.0,
        checkpoint_step="step-b",
        running_invocations=0,
        heartbeat_grace=GRACE,
    )
    assert decision.take is True
    assert decision.reason == "expired_and_quiet"


def test_in_flight_tool_call_blocks_takeover() -> None:
    """账本里还有 ``running`` 调用 —— 重放可能造成第二次副作用 → 不接管。"""
    lease = _lease(heartbeat_at=900.0, expires_at=950.0, current_step="step-b")
    decision = decide_takeover(
        lease,
        now=1000.0,
        checkpoint_step="step-b",
        running_invocations=1,
        heartbeat_grace=GRACE,
    )
    assert decision.take is False
    assert decision.reason == "tool_in_flight"


def test_lease_without_a_recorded_step_can_still_be_taken_over() -> None:
    """租约刚建就崩（还没心跳过一次）时 ``current_step`` 是空串。

    这时"检查点比它晚"是**必然**的，不该被读成"进展了"——否则孤儿永远接管不了。
    """
    lease = _lease(heartbeat_at=900.0, expires_at=950.0, current_step="")
    decision = decide_takeover(
        lease,
        now=1000.0,
        checkpoint_step="step-b",
        running_invocations=0,
        heartbeat_grace=GRACE,
    )
    assert decision.take is True


def test_all_four_conditions_hold_together() -> None:
    """把四条件写成一张真值表：**任何一条不成立都不接管**。"""
    base = {
        "lease": _lease(heartbeat_at=900.0, expires_at=950.0, current_step="step-b"),
        "now": 1000.0,
        "checkpoint_step": "step-b",
        "running_invocations": 0,
        "heartbeat_grace": GRACE,
    }
    assert decide_takeover(**base).take is True

    variations = [
        {"lease": None},  # 变成孤儿 → 仍然接管（这是唯一放宽的一条）
        {"now": 940.0},  # 租约未过期
        {"lease": _lease(heartbeat_at=990.0, expires_at=950.0, current_step="step-b")},
        {"checkpoint_step": "step-c"},  # 检查点前进
        {"running_invocations": 3},  # 有在途调用
    ]
    for override in variations:
        merged = {**base, **override}
        decision = decide_takeover(**merged)
        if override.get("lease", "missing") is None:
            assert decision.take is True, "无租约的孤儿必须可接管"
        else:
            assert decision.take is False, f"条件被放宽了：{override}"


# ── 2. 租约的原子语义 ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_memory_lease_takes_over_only_after_expiry() -> None:
    leases = InMemoryRunLeases(ttl=0.05)
    first = await leases.acquire(tenant_id=TENANT, run_id=RUN, owner="inst-a", ttl=0.05)
    assert first is not None and first.lease_epoch == 1

    # 还没过期：别人拿不到
    assert await leases.acquire(tenant_id=TENANT, run_id=RUN, owner="inst-b", ttl=0.05) is None

    await asyncio.sleep(0.1)
    second = await leases.acquire(tenant_id=TENANT, run_id=RUN, owner="inst-b", ttl=5.0)
    assert second is not None
    assert second.lease_epoch == 2, "接管必须让 epoch 前进（上一任的延迟写才会被拒）"


@pytest.mark.asyncio
async def test_memory_stale_owner_cannot_renew_or_release_after_takeover() -> None:
    leases = InMemoryRunLeases(ttl=0.05)
    await leases.acquire(tenant_id=TENANT, run_id=RUN, owner="inst-a", ttl=0.05)
    await asyncio.sleep(0.1)
    await leases.acquire(tenant_id=TENANT, run_id=RUN, owner="inst-b", ttl=5.0)

    assert (
        await leases.renew(tenant_id=TENANT, run_id=RUN, owner="inst-a", epoch=1, ttl=5.0) is False
    ), "换手之后上一任的续租必须失败"
    await leases.release(tenant_id=TENANT, run_id=RUN, owner="inst-a", epoch=1)
    still = await leases.get(tenant_id=TENANT, run_id=RUN)
    assert still is not None and still.owner_instance == "inst-b", (
        "上一任的释放把新主人的租约删掉了"
    )


@pytest.mark.asyncio
async def test_pg_concurrent_acquire_has_exactly_one_winner(app_dsn: str, rls_schema: str) -> None:
    """**3 副本并发抢同一轮，恰好一个赢** —— 判据 ⑥ 的同进程版。

    每个副本用**独立连接**并发打同一条 SQL。赢家只有一个这件事由那条
    ``INSERT ... ON CONFLICT ... WHERE ... RETURNING`` 保证，不是靠时序。
    """
    leases = PgRunLeases(app_dsn, schema=rls_schema, ttl=60.0)
    owners = ["replica-1", "replica-2", "replica-3"]
    results = await asyncio.gather(
        *(leases.acquire(tenant_id=TENANT, run_id=RUN, owner=o, ttl=60.0) for o in owners)
    )
    winners = [row for row in results if row is not None]
    assert len(winners) == 1, f"双重认领：{[(w.owner_instance, w.lease_epoch) for w in winners]}"
    assert winners[0].lease_epoch == 1


@pytest.mark.asyncio
async def test_pg_expired_lease_is_taken_over_with_a_new_epoch(
    app_dsn: str, rls_schema: str
) -> None:
    leases = PgRunLeases(app_dsn, schema=rls_schema, ttl=0.05)
    first = await leases.acquire(tenant_id=TENANT, run_id=RUN, owner="replica-1", ttl=0.05)
    assert first is not None
    await asyncio.sleep(0.1)

    second = await leases.acquire(tenant_id=TENANT, run_id=RUN, owner="replica-2", ttl=60.0)
    assert second is not None
    assert second.lease_epoch == first.lease_epoch + 1
    assert second.owner_instance == "replica-2"

    assert (
        await leases.renew(
            tenant_id=TENANT, run_id=RUN, owner="replica-1", epoch=first.lease_epoch, ttl=60.0
        )
        is False
    ), "上一任的延迟续租必须被 epoch 判据拒掉"
    await leases.release(tenant_id=TENANT, run_id=RUN, owner="replica-1", epoch=first.lease_epoch)
    assert (await leases.get(tenant_id=TENANT, run_id=RUN)) is not None, (
        "上一任的延迟释放把新主人的租约删掉了"
    )


@pytest.mark.asyncio
async def test_pg_active_registry_lists_who_is_running(app_dsn: str, rls_schema: str) -> None:
    """**活跃 run 注册表就是这张表**：问得出"此刻谁在跑哪几轮"。"""
    leases = PgRunLeases(app_dsn, schema=rls_schema, ttl=60.0)
    await leases.acquire(tenant_id=TENANT, run_id="run-a", owner="replica-1", ttl=60.0)
    await leases.acquire(tenant_id=TENANT, run_id="run-b", owner="replica-2", ttl=60.0)
    await leases.acquire(tenant_id=TENANT, run_id="run-dead", owner="replica-9", ttl=0.0)

    active = await leases.active(tenant_id=TENANT)
    names = {row.run_id: row.owner_instance for row in active}
    assert names.get("run-a") == "replica-1"
    assert names.get("run-b") == "replica-2"

    # 释放之后不再"活跃"
    await leases.release(tenant_id=TENANT, run_id="run-a", owner="replica-1", epoch=1)
    after = {row.run_id for row in await leases.active(tenant_id=TENANT)}
    assert "run-a" not in after


@pytest.mark.asyncio
async def test_pg_lease_is_tenant_scoped(app_dsn: str, rls_schema: str) -> None:
    """硬规则 3：租约按租户隔离，别家的租约读不到、也抢不走。"""
    leases = PgRunLeases(app_dsn, schema=rls_schema, ttl=60.0)
    await leases.acquire(tenant_id=TENANT, run_id=RUN, owner="replica-1", ttl=60.0)
    assert await leases.get(tenant_id="tenant-other", run_id=RUN) is None
    # 别家连"抢"都抢不走：它在自己的租户上下文里看不到那一行，于是插入的是
    # **自己那行**，而不是接管别人的。
    other = await leases.acquire(tenant_id="tenant-other", run_id=RUN, owner="replica-x", ttl=60.0)
    assert other is not None and other.lease_epoch == 1
    mine = await leases.get(tenant_id=TENANT, run_id=RUN)
    assert mine is not None and mine.owner_instance == "replica-1"


# ── 3. 心跳：长跑不被误接管，停了就被接管 ──────────────────────────────


@pytest.mark.asyncio
async def test_heartbeat_keeps_a_long_run_alive_past_its_ttl(app_dsn: str, rls_schema: str) -> None:
    """**长跑 run 不被误接管**：TTL 很短，但一直续租 → 判据一直说"还活着"。

    这正是"TTL 可配 + 带续租"分开的意义：TTL 只需要盖住一次心跳间隔，
    不需要盖住整轮执行。
    """
    ttl = 0.15
    leases = PgRunLeases(app_dsn, schema=rls_schema, ttl=ttl)
    lease = await leases.acquire(tenant_id=TENANT, run_id=RUN, owner="replica-1", ttl=ttl)
    assert lease is not None

    for _ in range(4):  # 总时长 ≈ 3×TTL
        await asyncio.sleep(ttl / 2)
        ok = await leases.renew(
            tenant_id=TENANT,
            run_id=RUN,
            owner="replica-1",
            epoch=lease.lease_epoch,
            ttl=ttl,
            current_step="step-1",
        )
        assert ok is True

    held = await leases.get(tenant_id=TENANT, run_id=RUN)
    assert held is not None
    decision = decide_takeover(
        held,
        now=time.time(),
        checkpoint_step="step-1",
        running_invocations=0,
        heartbeat_grace=GRACE,
    )
    assert decision.take is False, "一直续租的长跑 run 被当成孤儿了"
    assert decision.reason == "lease_alive"


@pytest.mark.asyncio
async def test_a_run_whose_heartbeat_stopped_is_takeable(app_dsn: str, rls_schema: str) -> None:
    """**真崩的孤儿能接管**：心跳停了、租约过期了、检查点没动 → 接管并拿到下一手。"""
    ttl = 0.05
    leases = PgRunLeases(app_dsn, schema=rls_schema, ttl=ttl)
    lease = await leases.acquire(
        tenant_id=TENANT, run_id=RUN, owner="replica-1", ttl=ttl, current_step="step-1"
    )
    assert lease is not None
    await asyncio.sleep(0.2)  # 心跳停了（进程被杀）

    held = await leases.get(tenant_id=TENANT, run_id=RUN)
    assert held is not None
    decision = decide_takeover(
        held,
        now=time.time(),
        checkpoint_step="step-1",
        running_invocations=0,
        heartbeat_grace=0.0,
    )
    assert decision.take is True

    taken = await leases.acquire(
        tenant_id=TENANT, run_id=RUN, owner="replica-2", ttl=60.0, current_step="step-1"
    )
    assert taken is not None and taken.owner_instance == "replica-2"


# ── 4. 控制面：提交去重 / 恢复只接管该接管的 ────────────────────────────


class _FakeService:
    """够 :class:`RunControl` 用的一小撮：读状态 + 续跑 + 写终态。"""

    def __init__(self, *, status: str = "running") -> None:
        self._status = status
        self.continued: list[str] = []

    async def get(self, *, tenant_id: str, run_id: str):
        return {"run_id": run_id, "status": self._status}

    async def continue_run(self, *, tenant_id: str, run_id: str, should_cancel=None):
        self.continued.append(run_id)
        return {"run_id": run_id, "status": self._status}

    async def mark_terminal(self, *, tenant_id: str, run_id: str, status: str, error: str = ""):
        return {"run_id": run_id, "status": status}


class _FakeIndex:
    def __init__(self, runs) -> None:
        self._runs = runs

    async def unfinished(self, *, statuses):
        del statuses
        return list(self._runs)


def _control(service, leases, *, step="", running=0, tool_ledger=None, grace=0.0):
    from mate_tech_agent_team.api.run_control import RunControl

    if tool_ledger is None and running:
        tool_ledger = _FakeLedger(running)
    return RunControl(
        service,  # type: ignore[arg-type]
        run_index=_FakeIndex([]),
        leases=leases,
        tool_ledger=tool_ledger,
        step_reader=(lambda _t, _r: _async(step)) if step else None,
        instance_id="replica-test",
        heartbeat_interval=0.01,
        # 测试里把"心跳已经停了"的宽限期设成 0：我们要验的是**接管判据本身**，
        # 不是"多久才算停"。那个界限由 test_run_lease 的纯函数用例单独覆盖。
        heartbeat_grace=grace,
    )


class _FakeLedger:
    def __init__(self, running: int) -> None:
        self._running = running

    async def running_invocations(self, *, tenant_id: str, run_id: str) -> int:
        return self._running


async def _async(value):
    return value


@pytest.mark.asyncio
async def test_submit_is_deduplicated_when_another_replica_holds_the_lease() -> None:
    """**第四道幂等**：另一个副本正持着租约 → 本副本不再起第二轮。

    这一道治的是"两边都还没落检查点"的窗口——那时"查检查点"这道幂等判据
    两边都答"没有"，只有租约答得出"有人正在跑"。
    """
    from mate_tech_agent_team.api.run_control import RunControl

    service = _FakeService()
    shared = InMemoryRunLeases(ttl=60.0)
    replica_a = RunControl(service, leases=shared, instance_id="replica-a")  # type: ignore[arg-type]
    replica_b = RunControl(service, leases=shared, instance_id="replica-b")  # type: ignore[arg-type]

    # A 先占住这一轮的租约（模拟它已经开始跑，但还没落检查点）。
    await shared.acquire(tenant_id=TENANT, run_id=RUN, owner="replica-a", ttl=60.0)

    live = replica_b._open(tenant_id=TENANT, run_id=RUN)
    assert await replica_b._claim_lease(tenant_id=TENANT, run_id=RUN, live=live) is None, (
        "另一个副本正持着租约，本副本不该拿到"
    )
    await replica_b._close(tenant_id=TENANT, run_id=RUN, live=live)

    # 反过来：A 自己重入是允许的（续跑自己那轮）。
    live_a = replica_a._open(tenant_id=TENANT, run_id=RUN)
    assert await replica_a._claim_lease(tenant_id=TENANT, run_id=RUN, live=live_a) is not None
    await replica_a._close(tenant_id=TENANT, run_id=RUN, live=live_a)


@pytest.mark.asyncio
async def test_recover_takes_over_an_expired_orphan_and_continues_it() -> None:
    """**真崩的孤儿能接管并继续**：租约过期、心跳停了、检查点没动 → 续跑起来。"""
    from mate_tech_agent_team.checkpoint import UnfinishedRun

    service = _FakeService(status="running")
    leases = InMemoryRunLeases(ttl=0.05)
    await leases.acquire(tenant_id=TENANT, run_id=RUN, owner="dead-replica", ttl=0.05)
    await asyncio.sleep(0.1)

    control = _control(service, leases, step="step-1")
    control._run_index = _FakeIndex([UnfinishedRun(tenant_id=TENANT, run_id=RUN, status="running")])
    claimed = await control.recover()
    assert claimed == [RUN]

    for _ in range(50):
        if service.continued:
            break
        await asyncio.sleep(0.01)
    assert service.continued == [RUN], "接管了却没有接着跑"
    await control.shutdown()


@pytest.mark.asyncio
async def test_recover_does_not_take_over_a_run_that_is_still_held() -> None:
    """**长跑 run 不被误接管**：另一个副本还持着租约 → 本副本扫到也不动它。"""
    from mate_tech_agent_team.checkpoint import UnfinishedRun

    service = _FakeService(status="running")
    leases = InMemoryRunLeases(ttl=60.0)
    await leases.acquire(tenant_id=TENANT, run_id=RUN, owner="healthy-replica", ttl=60.0)

    control = _control(service, leases, step="step-1")
    control._run_index = _FakeIndex([UnfinishedRun(tenant_id=TENANT, run_id=RUN, status="running")])
    assert await control.recover() == []
    assert service.continued == []
    await control.shutdown()


@pytest.mark.asyncio
async def test_recover_refuses_when_a_tool_call_is_still_in_flight() -> None:
    """接管判据第四条：账本里还有 ``running`` 调用 → 不接管，如实记原因。"""
    from mate_tech_agent_team.checkpoint import UnfinishedRun

    service = _FakeService(status="running")
    leases = InMemoryRunLeases(ttl=0.05)
    await leases.acquire(tenant_id=TENANT, run_id=RUN, owner="dead-replica", ttl=0.05)
    await asyncio.sleep(0.1)

    control = _control(service, leases, step="step-1", running=1)
    control._run_index = _FakeIndex([UnfinishedRun(tenant_id=TENANT, run_id=RUN, status="running")])
    assert await control.recover() == [], "有在途工具调用时不该接管（可能重复副作用）"
    assert service.continued == []

    decision = await control._takeover_decision(
        UnfinishedRun(tenant_id=TENANT, run_id=RUN, status="running")
    )
    assert decision.reason == "tool_in_flight"
    await control.shutdown()


@pytest.mark.asyncio
async def test_heartbeat_task_is_started_and_stopped_with_the_run() -> None:
    """心跳随 run 起、随 run 停——不然进程里会攒下一堆没人取消的任务。"""
    service = _FakeService()
    leases = InMemoryRunLeases(ttl=60.0)
    control = _control(service, leases)
    live = control._open(tenant_id=TENANT, run_id=RUN)
    assert await control._claim_lease(tenant_id=TENANT, run_id=RUN, live=live) is not None
    assert live.heartbeat is not None
    assert (await leases.get(tenant_id=TENANT, run_id=RUN)) is not None

    await control._close(tenant_id=TENANT, run_id=RUN, live=live)
    assert live.heartbeat is None
    assert (await leases.get(tenant_id=TENANT, run_id=RUN)) is None, "关闭时必须释放租约"
