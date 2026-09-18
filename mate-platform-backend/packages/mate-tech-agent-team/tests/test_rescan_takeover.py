"""C-3 补 · 周期接管扫描的判据：**接管要有观察者**。

真集群实测（`scripts/ci/agent_team_pod_kill_takeover.sh`）暴露的那个缺陷：杀进程
之后 **166 秒零接管**，`lease_epoch` 一直是 1、检查点冻住；只有人为
`rollout restart`（让某个进程重新走启动扫描）才在 5.2 秒内接管成功。

根因不是接管判据写错了——四条件判据、原子抢租约、epoch 前进全都是对的（那部分
2.1-B 已验）。根因是 **`recover()` 只在进程启动时跑一次**：副本 A 被杀时，幸存的
B、C 在它们各自的启动时刻已经扫过一遍，之后再也不会看。判据写着"30 秒内被接管"，
而代码里根本没有那个 30 秒内的**观察者**。

所以这里验的是"观察者存在且真的在看"，不是再接一遍接管判据（那条已有专门的用例）。
"""

from __future__ import annotations

import asyncio

import pytest
from mate_tech_agent_team.checkpoint import UnfinishedRun
from mate_tech_agent_team.run_lease import (
    DEFAULT_HEARTBEAT_GRACE_SECONDS,
    HEARTBEAT_GRACE_ENV,
    LEASE_TTL_ENV,
    InMemoryRunLeases,
    configured_heartbeat_grace,
    configured_lease_ttl,
)

TENANT = "tenant-rescan"
RUN = "run-rescan-1"


class _FakeService:
    """只够 :meth:`RunControl._is_resumable` 与 :meth:`_continue` 用。"""

    def __init__(self, status: str = "running") -> None:
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
    def __init__(self, runs: list[UnfinishedRun]) -> None:
        self._runs = runs
        self.scans = 0

    async def unfinished(self, *, statuses):
        del statuses
        self.scans += 1
        return list(self._runs)


def _control(*, index, leases, rescan_interval, service=None):
    from mate_tech_agent_team.api.run_control import RunControl

    return RunControl(
        service or _FakeService(),  # type: ignore[arg-type]
        run_index=index,
        leases=leases,
        instance_id="replica-test",
        heartbeat_interval=0.01,
        heartbeat_grace=0.0,  # 判据本身另有专测；这里只验"有没有人在看"
        rescan_interval=rescan_interval,
    )


# ── 配置 ────────────────────────────────────────────────────────────────


def test_heartbeat_grace_follows_the_lease_ttl_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    """宽限默认跟着 TTL 走，**不是**固定 30。

    固定 30 在 TTL=30 时看不出问题，但把 TTL 调小就露馅：想让接管更快
    （TTL=15）的人会发现宽限仍压在 30 —— 比不改还慢。这条钉住两者联动。
    """
    monkeypatch.setenv(LEASE_TTL_ENV, "15")
    monkeypatch.delenv(HEARTBEAT_GRACE_ENV, raising=False)
    assert configured_lease_ttl() == 15.0
    assert configured_heartbeat_grace() == 15.0

    monkeypatch.setenv(HEARTBEAT_GRACE_ENV, "7.5")
    assert configured_heartbeat_grace() == 7.5

    monkeypatch.setenv(HEARTBEAT_GRACE_ENV, "not-a-number")
    assert configured_heartbeat_grace() == 15.0, "坏配置回默认，不是崩"


def test_heartbeat_grace_falls_back_when_ttl_is_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(LEASE_TTL_ENV, "0")
    monkeypatch.delenv(HEARTBEAT_GRACE_ENV, raising=False)
    assert configured_heartbeat_grace() == DEFAULT_HEARTBEAT_GRACE_SECONDS


def test_rescan_interval_env(monkeypatch: pytest.MonkeyPatch) -> None:
    from mate_tech_agent_team.api.run_control import (
        DEFAULT_RESCAN_SECONDS,
        configured_rescan_interval,
    )

    monkeypatch.delenv("MATE_AGENT_TEAM_RESCAN_SECONDS", raising=False)
    assert configured_rescan_interval() == DEFAULT_RESCAN_SECONDS
    monkeypatch.setenv("MATE_AGENT_TEAM_RESCAN_SECONDS", "2")
    assert configured_rescan_interval() == 2.0
    # 坏配置**回默认**而不是回 0：静默关掉接管是最坏的方向
    monkeypatch.setenv("MATE_AGENT_TEAM_RESCAN_SECONDS", "oops")
    assert configured_rescan_interval() == DEFAULT_RESCAN_SECONDS


# ── 开关 ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_rescanner_refuses_without_an_index_or_an_interval() -> None:
    """没有索引就没有"别处的 run"可接管，开了是纯空转；间隔 0 是显式关闭。"""
    leases = InMemoryRunLeases(ttl=60.0)
    assert _control(index=None, leases=leases, rescan_interval=10.0).start_rescanner() is False
    assert (
        _control(index=_FakeIndex([]), leases=leases, rescan_interval=0.0).start_rescanner()
        is False
    )


@pytest.mark.asyncio
async def test_rescanner_starts_once_and_stops_idempotently() -> None:
    control = _control(
        index=_FakeIndex([]), leases=InMemoryRunLeases(ttl=60.0), rescan_interval=5.0
    )
    assert control.start_rescanner() is True
    assert control.start_rescanner() is True, "重复开不该起第二个循环"
    await control.stop_rescanner()
    await control.stop_rescanner()  # 幂等：再停一次不炸


@pytest.mark.asyncio
async def test_shutdown_stops_the_rescanner() -> None:
    """收尾顺序：先停扫描再拆任务——反过来会把刚取消的 run 又认领回来。"""
    control = _control(
        index=_FakeIndex([]), leases=InMemoryRunLeases(ttl=60.0), rescan_interval=5.0
    )
    control.start_rescanner()
    assert control._rescan_task is not None
    await control.shutdown()
    assert control._rescan_task is None, "shutdown 必须把周期扫描收掉"


# ── 行为：真的会在下几个周期里接管 ──────────────────────────────────────


class _RecordingLeases(InMemoryRunLeases):
    """记下每次成功 acquire 的 epoch。

    "接管发生过"最直接的证据不是"租约现在在谁手上"——续跑在这个 harness 里会
    瞬间跑完并把租约**释放**掉（真实续跑是分钟级，这里不是）。所以证据取
    **抢租约这个动作本身**：epoch 从 1 走到 2，说明是接管而不是首次获取。
    """

    def __init__(self, *, ttl: float) -> None:
        super().__init__(ttl=ttl)
        self.acquired_epochs: list[int] = []

    async def acquire(self, **kwargs):  # type: ignore[override]
        row = await super().acquire(**kwargs)
        if row is not None:
            self.acquired_epochs.append(row.lease_epoch)
        return row


@pytest.mark.asyncio
async def test_rescan_takes_over_an_expired_run_without_a_restart() -> None:
    """**这条是本批的核心判据**：不重启任何进程，孤儿 run 也会被接管。

    构造：一条过期租约（持有者已死）+ 一个说"这一轮还没跑完"的索引。开扫描，
    等几个周期，断言发生了**接管**（抢到的租约 epoch ≥2）并且**续跑被发起**。

    没有这个观察者时，一模一样的构造**永远不会**被接管——那正是真集群里
    166 秒零接管的样子。
    """
    service = _FakeService(status="running")
    leases = _RecordingLeases(ttl=0.05)
    # 死掉的持有者留下的租约（ttl 很短，几毫秒后就过期）。
    await leases.acquire(tenant_id=TENANT, run_id=RUN, owner="dead-replica", ttl=0.05)
    assert leases.acquired_epochs == [1], "先手是 epoch 1"
    index = _FakeIndex([UnfinishedRun(tenant_id=TENANT, run_id=RUN, status="running")])

    control = _control(index=index, leases=leases, rescan_interval=0.02, service=service)
    assert control.start_rescanner() is True
    try:
        for _ in range(200):  # 最多等 ~2s（100 个周期）
            await asyncio.sleep(0.01)
            if service.continued:
                break
    finally:
        await control.stop_rescanner()

    assert service.continued == [RUN], "扫描必须真的把这一轮接着跑起来"
    assert 2 in leases.acquired_epochs, (
        "接管必须让 epoch 前进（上一任的延迟写才挡得住）——只出现在 acquire 里说明是接管"
    )
    assert index.scans >= 1, "索引至少要被动过一次"


@pytest.mark.asyncio
async def test_rescan_keeps_going_after_a_failing_scan() -> None:
    """一个周期扫不动不代表永远扫不动——不能因为一次索引故障就静默停摆。"""

    class _FlakyIndex:
        def __init__(self) -> None:
            self.calls = 0

        async def unfinished(self, *, statuses):
            del statuses
            self.calls += 1
            if self.calls == 1:
                raise RuntimeError("索引这一下查不动")
            return []

    index = _FlakyIndex()
    control = _control(index=index, leases=InMemoryRunLeases(ttl=60.0), rescan_interval=0.02)
    control.start_rescanner()
    try:
        for _ in range(200):
            await asyncio.sleep(0.01)
            if index.calls >= 3:
                break
        assert index.calls >= 3, "第一次抛异常之后必须继续扫"
    finally:
        await control.stop_rescanner()
