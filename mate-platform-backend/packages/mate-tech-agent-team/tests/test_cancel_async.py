"""B-3 / `MP-RUN-CANCEL-01` 的判据：取消改**受理制**、中间态可观测、信号归档。

B-3 之前的取消是**同步阻塞**的：``cancel()`` 里 ``await live.finished.wait()``
之后才落终态、回 200。这条只在单副本下成立——跨副本时 B 没有 A 的 live 记录，
它要么永远等下去，要么回一个自己都不该保证的话（"回话那刻图已经停了"）。

改完之后有三件事要**可判定**：

1. 收到信号、还没落终态 → ``GET /runs/{id}`` 报 **``cancelling``**（中间态可观
   测），并且它**不是**检查点里的第二个状态，而是推出来的；
2. 有活跃租约时，取消方**绝不代庖**落终态（那正是 1.5 起"B 写了终态、在途的图
   下一步又盖回去"的 bug）；没人跑时才由本请求落；
3. 终态之后那格信号被**归档**——清的时机是"这一轮已经不可能再有人问它了"。
"""

from __future__ import annotations

import asyncio
import time

import pytest
from mate_tech_agent_team.api.run_control import CANCELLING, RunControl
from mate_tech_agent_team.coordination import InMemoryCancelSignals
from mate_tech_agent_team.run_lease import InMemoryRunLeases

TENANT = "tenant-cancel"
RUN = "run-cancel-1"
SETTLED = frozenset({"completed", "failed", "cancelled", "timeout"})


class _Service:
    """够控制面用：状态在内存里，`mark_terminal` 记一笔。"""

    def __init__(self, *, status: str = "running") -> None:
        self.status = status
        self.terminals: list[str] = []

    async def get(self, *, tenant_id: str, run_id: str):
        return {"run_id": run_id, "status": self.status}

    async def history(self, *, tenant_id: str, run_id: str, limit: int = 100):
        return [{"step": 1, "status": self.status}]

    async def mark_terminal(self, *, tenant_id: str, run_id: str, status: str, error: str = ""):
        self.status = status
        self.terminals.append(status)
        return {"run_id": run_id, "status": status}

    async def continue_run(self, *, tenant_id: str, run_id: str, should_cancel=None):
        return {"run_id": run_id, "status": self.status}


async def _until(predicate, *, timeout: float = 8.0, interval: float = 0.01):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        value = await predicate()
        if value:
            return value
        await asyncio.sleep(interval)
    return None


# ── 1. 受理制 + 中间态可观测 ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_cancel_returns_a_receipt_instead_of_waiting_for_the_graph() -> None:
    """**受理回执**：没有人跑时，取消方自己把它落了终态并如实回 ``cancelled``。"""
    service = _Service(status="awaiting_approval")
    control = RunControl(service, signals=InMemoryCancelSignals(), leases=InMemoryRunLeases())
    receipt = await control.cancel(tenant_id=TENANT, run_id=RUN)
    assert receipt["status"] == "cancelled"
    assert receipt["cancel_requested"] is True
    assert service.terminals == ["cancelled"]


@pytest.mark.asyncio
async def test_a_held_lease_means_we_do_not_settle_it_ourselves() -> None:
    """**有活跃租约时绝不代庖** —— 这是 B-3 与 B-1 的交界，也是 1.5 那个 bug 的根。

    B 副本取消时，A 副本上图还在跑。B 若顺手写一个 ``cancelled``，A 下一步就会用
    自己那份状态盖回去（"取消被复活"）。正确做法是：只放信号，回 ``cancelling``。
    """
    service = _Service(status="running")
    leases = InMemoryRunLeases(ttl=60.0)
    await leases.acquire(tenant_id=TENANT, run_id=RUN, owner="replica-a", ttl=60.0)
    control = RunControl(
        service,
        signals=InMemoryCancelSignals(),
        leases=leases,
        cancel_wait=0.0,  # 不等：本进程没有 live 记录（= 跨副本那一侧）
    )
    receipt = await control.cancel(tenant_id=TENANT, run_id=RUN)
    assert receipt["status"] == CANCELLING
    assert service.terminals == [], "有活跃租约时取消方写了终态——图下一步会把它盖回去"


@pytest.mark.asyncio
async def test_the_intermediate_state_is_observable_while_the_graph_is_still_running() -> None:
    """**中间态可观测**：信号已置、图还在跑 → ``GET`` 报 ``cancelling``。

    它不在检查点里（那一轮的状态仍是 ``running``），是 ``refresh`` **推**出来的
    ——所以不会出现"检查点说 running、信号表说取消"这种两处打架。
    """
    service = _Service(status="running")
    signals = InMemoryCancelSignals()
    control = RunControl(service, signals=signals, leases=InMemoryRunLeases(), cancel_wait=0.0)
    await signals.request(tenant_id=TENANT, run_id=RUN)

    state = await control.refresh(tenant_id=TENANT, run_id=RUN)
    assert state["status"] == CANCELLING
    # 检查点里那一轮的状态**没有**被改写（真相源仍只有一个）
    assert (await service.get(tenant_id=TENANT, run_id=RUN))["status"] == "running"


@pytest.mark.asyncio
async def test_a_live_run_settles_within_the_bounded_wait() -> None:
    """本进程那一轮在宽限内停下 → 回执直接是 ``cancelled``（不必让客户端再等）。"""
    service = _Service(status="running")
    control = RunControl(
        service, signals=InMemoryCancelSignals(), leases=InMemoryRunLeases(), cancel_wait=5.0
    )
    live = control._open(tenant_id=TENANT, run_id=RUN)

    async def _finish_soon() -> None:
        await asyncio.sleep(0.05)
        live.finished.set()
        await service.mark_terminal(tenant_id=TENANT, run_id=RUN, status="cancelled")

    task = asyncio.create_task(_finish_soon())
    receipt = await control.cancel(tenant_id=TENANT, run_id=RUN)
    await task
    assert receipt["status"] == "cancelled"


# ── 2. 跨副本：信号传播 + 最终落终态 ────────────────────────────────────


@pytest.mark.asyncio
async def test_a_cancel_from_another_replica_propagates_through_the_shared_channel() -> None:
    """**跨副本传播**：B 放信号，A 上那一轮在波边界看到它并落终态。

    这条把 B-3 的两个依赖都串起来：共享信号通道（1.9）回答"要不要停"，
    活跃租约（B-1）回答"有没有人在跑"——**B 不需要 A 的 live 记录**。
    """
    service = _Service(status="running")
    signals = InMemoryCancelSignals()
    leases = InMemoryRunLeases(ttl=60.0)
    replica_a = RunControl(service, signals=signals, leases=leases, cancel_wait=0.0)
    replica_b = RunControl(service, signals=signals, leases=leases, cancel_wait=0.0)

    await leases.acquire(tenant_id=TENANT, run_id=RUN, owner="replica-a", ttl=60.0)

    receipt = await replica_b.cancel(tenant_id=TENANT, run_id=RUN)
    assert receipt["status"] == CANCELLING

    # A 上那一轮在"波边界"看到标志（这里用 is_requested 直接代表那一刻）
    assert await signals.is_requested(tenant_id=TENANT, run_id=RUN) is True
    assert await replica_a.refresh(tenant_id=TENANT, run_id=RUN) is not None

    # 图自己落终态（A 那一侧的收尾）
    await service.mark_terminal(tenant_id=TENANT, run_id=RUN, status="cancelled")
    settled = await replica_b.refresh(tenant_id=TENANT, run_id=RUN)
    assert settled["status"] == "cancelled"


@pytest.mark.asyncio
async def test_a_cross_replica_cancel_reaches_a_terminal_state_well_inside_ten_seconds() -> None:
    """**判据 ⑧**：跨副本取消在 10 秒内进入终态（或明确的等待态）。

    这里用"另一副本持续观察"来代表客户端的等待：它要么看到终态，要么看到
    ``cancelling``（明确等待状态）——**不允许一直是 `running` 而没有任何交待**，
    那正是 B-3 之前"取消了但看不出来"的样子。
    """
    service = _Service(status="running")
    signals = InMemoryCancelSignals()
    leases = InMemoryRunLeases(ttl=60.0)
    owner = RunControl(service, signals=signals, leases=leases, cancel_wait=0.0)
    observer = RunControl(service, signals=signals, leases=leases, cancel_wait=0.0)
    await leases.acquire(tenant_id=TENANT, run_id=RUN, owner="replica-a", ttl=60.0)

    started = time.monotonic()
    await observer.cancel(tenant_id=TENANT, run_id=RUN)

    # 用户看着的是 GET /runs/{id}。先从信号通道看到"正在取消"……
    seen = await _until(lambda: _status(observer, expect=CANCELLING), timeout=10.0)
    assert seen == CANCELLING, "取消已经受理，但客户端看不到任何交待"
    elapsed_cancelling = time.monotonic() - started

    # ……然后 owner 那一侧收敛，用户看到终态。
    await service.mark_terminal(tenant_id=TENANT, run_id=RUN, status="cancelled")
    settled = await _until(lambda: _status(observer, expect="cancelled"), timeout=10.0)
    elapsed = time.monotonic() - started

    assert settled == "cancelled"
    assert elapsed < 10.0, f"跨副本取消 {elapsed:.2f}s 才落终态（判据是 10s 内）"
    assert elapsed_cancelling < 10.0


async def _status(control: RunControl, *, expect: str) -> str | None:
    state = await control.refresh(tenant_id=TENANT, run_id=RUN)
    status = str(state.get("status", ""))
    return status if status == expect else None


# ── 3. 信号归档 ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_the_signal_is_archived_once_the_run_is_terminal() -> None:
    """**归档时机 = 终态之后**（不是"多久之后"）：这一轮已经不可能再有人问它了。

    信号"只置不清"本身是对的（置清之间的窗口里，另一副本的图正好走到边界就
    看不到它）；但轮子跑完还留着，这张表就会随"被取消过的 run 数"一直涨。
    """
    service = _Service(status="running")
    signals = InMemoryCancelSignals()
    control = RunControl(service, signals=signals, leases=InMemoryRunLeases(), cancel_wait=0.0)

    await signals.request(tenant_id=TENANT, run_id=RUN)
    assert await signals.is_requested(tenant_id=TENANT, run_id=RUN) is True

    # 还没终态：不许清（清了，正在跑的图下一步就看不到它）
    await control.refresh(tenant_id=TENANT, run_id=RUN)
    assert await signals.is_requested(tenant_id=TENANT, run_id=RUN) is True

    await service.mark_terminal(tenant_id=TENANT, run_id=RUN, status="cancelled")
    state = await control.refresh(tenant_id=TENANT, run_id=RUN)
    assert state["status"] == "cancelled"
    assert await signals.is_requested(tenant_id=TENANT, run_id=RUN) is False, (
        "终态之后信号没被归档，这张表会只增不减"
    )


@pytest.mark.asyncio
async def test_cancel_never_overwrites_an_earlier_terminal_state() -> None:
    """幂等：取消一个已经结束的 run **原样回它**，不覆盖更早的终态（1.3 语义不破）。"""
    service = _Service(status="failed")
    control = RunControl(service, signals=InMemoryCancelSignals(), leases=InMemoryRunLeases())
    receipt = await control.cancel(tenant_id=TENANT, run_id=RUN)
    assert receipt["status"] == "failed"
    assert service.terminals == [], "取消把更早的终态改写了"


def test_settled_set_matches_the_service_expectations() -> None:
    """``SETTLED`` 是测试自用的判据集；顺手确认它没有把自己写成空集。"""
    assert SETTLED and CANCELLING not in SETTLED
