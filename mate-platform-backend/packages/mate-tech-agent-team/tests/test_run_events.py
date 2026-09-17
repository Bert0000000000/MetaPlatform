"""B-2 / `MP-RUN-EVENTS-01` 的判据：事件日志、SSE 续传、订阅方不再读检查点。

三条各自对应准出里的一条：

* **① 断线重连不丢事件** —— 按 ``sequence`` 补发，游标就是 ``Last-Event-ID``。
  每条用例都断言"从游标之后**一条不多一条不少**"。
* **⑤ 高并发 SSE 不再按连接数 × 每秒 4 次读检查点** —— 用**计数桩**量它：
  订阅方数量涨了，检查点历史读次数**不动**。
* **真相源只有一个** —— 事件日志清空/丢失都不影响 ``recover()``：它只读检查点。

``sequence`` 是**这一轮内**的单调序号（由 advisory lock 串行化分配），
不是审计哈希链的那个 ``sequence``——那条链是跨租户全局成链的，拿来当 SSE
游标必然串台。
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest
from mate_tech_agent_team.api.run_control import RunControl
from mate_tech_agent_team.checkpoint import UnfinishedRun
from mate_tech_agent_team.run_events import (
    InMemoryRunEvents,
    PgRunEvents,
)

TENANT = "tenant-events"
RUN = "run-events-1"


# ── 计数桩：这一轮跑过哪几步、被读过几次 ────────────────────────────────


class _CountingService:
    """够控制面用的假服务。**history 的调用次数就是判据 ⑤ 的量**。"""

    def __init__(self, *, steps: list[dict[str, Any]] | None = None) -> None:
        self._steps = steps if steps is not None else []
        self.history_calls = 0
        self.continued: list[str] = []

    def push(self, **step: Any) -> None:
        self._steps.append(dict(step))

    async def history(self, *, tenant_id: str, run_id: str, limit: int = 100):
        self.history_calls += 1
        return list(self._steps)

    async def get(self, *, tenant_id: str, run_id: str):
        status = str(self._steps[-1].get("status", "")) if self._steps else "running"
        return {"run_id": run_id, "status": status}

    async def continue_run(self, *, tenant_id: str, run_id: str, should_cancel=None):
        self.continued.append(run_id)
        return {"run_id": run_id, "status": "running"}

    async def mark_terminal(self, *, tenant_id: str, run_id: str, status: str, error: str = ""):
        return {"run_id": run_id, "status": status}


class _StepReader:
    """检查点 id 的桩：每次读返回当前值，可被测试推着往前走。"""

    def __init__(self) -> None:
        self.value = ""

    async def __call__(self, tenant_id: str, run_id: str) -> str:
        return self.value


async def _drain_frames(agen, *, limit: int = 40) -> list[str]:
    frames: list[str] = []
    async for frame in agen:
        frames.append(frame)
        if frame.startswith("event: end") or len(frames) >= limit:
            break
    return frames


def _ids(frames: list[str]) -> list[int]:
    return [
        int(line[4:]) for frame in frames for line in frame.splitlines() if line.startswith("id: ")
    ]


# ── 1. 事件日志本身 ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_memory_log_assigns_monotonic_sequences_per_run() -> None:
    log = InMemoryRunEvents()
    first = await log.append(tenant_id=TENANT, run_id=RUN, event_type="step", payload={"step": 1})
    second = await log.append(tenant_id=TENANT, run_id=RUN, event_type="step", payload={"step": 2})
    assert (first.sequence, second.sequence) == (1, 2)
    # 另一轮自己从 1 开始：序号是**这一轮内**的，不是全局的。
    other = await log.append(tenant_id=TENANT, run_id="run-2", event_type="step")
    assert other.sequence == 1


@pytest.mark.asyncio
async def test_memory_log_since_is_exclusive_and_bounded() -> None:
    log = InMemoryRunEvents()
    for i in range(5):
        await log.append(tenant_id=TENANT, run_id=RUN, event_type="step", payload={"i": i})
    got = await log.since(tenant_id=TENANT, run_id=RUN, after=2)
    assert [row.sequence for row in got] == [3, 4, 5]
    assert [
        row.sequence for row in await log.since(tenant_id=TENANT, run_id=RUN, after=2, limit=1)
    ] == [3]
    assert await log.since(tenant_id=TENANT, run_id=RUN, after=5) == []


@pytest.mark.asyncio
async def test_pg_log_is_tenant_scoped_and_ordered(app_dsn: str, rls_schema: str) -> None:
    log = PgRunEvents(app_dsn, schema=rls_schema)
    for i in range(3):
        await log.append(
            tenant_id=TENANT, run_id=RUN, event_type="step", payload={"i": i}, checkpoint_id=f"c{i}"
        )
    got = await log.since(tenant_id=TENANT, run_id=RUN, after=1)
    assert [row.sequence for row in got] == [2, 3]
    assert got[-1].checkpoint_id == "c2"
    assert await log.latest_sequence(tenant_id=TENANT, run_id=RUN) == 3
    # 硬规则 3：别家的流读不到
    assert await log.since(tenant_id="tenant-other", run_id=RUN) == []


@pytest.mark.asyncio
async def test_pg_log_pushes_a_notify_that_the_subscriber_sees(
    app_dsn: str, rls_schema: str
) -> None:
    """**推送通道是活的**：append 之后订阅方在兜底间隔内被唤醒。

    这条验的是 LISTEN/NOTIFY 本身（而不是 SSE 的组装）——没有它，事件流就只剩
    兜底轮询，"实时"两个字就没了。
    """
    log = PgRunEvents(app_dsn, schema=rls_schema)
    wakeups = log.wakeups(tenant_id=TENANT, run_id=RUN, fallback_interval=5.0)
    priming = asyncio.create_task(_first_tick(wakeups))
    try:
        # 先让 LISTEN 生效（async generator 到第一个 yield 之前的代码是要跑的）
        await asyncio.sleep(0.3)
        await log.append(tenant_id=TENANT, run_id=RUN, event_type="step")
        assert await asyncio.wait_for(priming, 3) is True, "NOTIFY 没把订阅方叫醒"
    finally:
        await wakeups.aclose()
        await log.aclose()


async def _first_tick(wakeups) -> bool:
    async for _tick in wakeups:
        return True
    return False


@pytest.mark.asyncio
async def test_prune_removes_only_rows_past_retention() -> None:
    log = InMemoryRunEvents()
    await log.append(tenant_id=TENANT, run_id=RUN, event_type="step")
    old = log._rows[(TENANT, RUN)][0]
    import dataclasses

    log._rows[(TENANT, RUN)][0] = dataclasses.replace(old, created_at=0.0)
    await log.append(tenant_id=TENANT, run_id=RUN, event_type="step")

    removed = await log.prune(tenant_id=TENANT, older_than=1.0)
    assert removed == 1
    assert [row.sequence for row in await log.since(tenant_id=TENANT, run_id=RUN)] == [2]


# ── 2. SSE 续传（判据 ①）──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_reconnect_resumes_from_last_event_id_on_the_log_path() -> None:
    """有事件日志：``Last-Event-ID=2`` → 第一条补发的是 3，一条不多一条不少。"""
    service = _CountingService()
    log = InMemoryRunEvents()
    control = RunControl(service, run_events=log)  # type: ignore[arg-type]
    for i in range(1, 5):
        await log.append(
            tenant_id=TENANT,
            run_id=RUN,
            event_type="step",
            payload={"step": i, "status": "running"},
        )
    await log.append(
        tenant_id=TENANT, run_id=RUN, event_type="step", payload={"step": 5, "status": "completed"}
    )

    frames = await _drain_frames(control.events(tenant_id=TENANT, run_id=RUN, last_event_id=2))
    assert _ids(frames) == [3, 4, 5], "重连补发的区间不对"
    assert frames[-1].startswith("event: end")


@pytest.mark.asyncio
async def test_reconnect_resumes_from_last_event_id_on_the_checkpoint_path() -> None:
    """**没有**事件日志的退路也按游标补发：老路径同样不该丢事件。

    B-2 之前这里 ``seq`` 从 0 起（内存计数），重连会把整轮历史重发一遍；
    现在从 ``Last-Event-ID`` 起。
    """
    service = _CountingService(
        steps=[{"step": i, "status": "running"} for i in range(1, 5)]
        + [{"step": 5, "status": "completed"}]
    )
    control = RunControl(service)  # type: ignore[arg-type]
    frames = await _drain_frames(control.events(tenant_id=TENANT, run_id=RUN, last_event_id=3))
    assert _ids(frames) == [4, 5]


@pytest.mark.asyncio
async def test_a_bad_cursor_starts_from_the_beginning_instead_of_failing() -> None:
    """坏游标（负数 / 超出范围）当 0 处理——不该让订阅彻底失败。"""
    service = _CountingService(
        steps=[{"step": 1, "status": "completed"}],
    )
    control = RunControl(service)  # type: ignore[arg-type]
    frames = await _drain_frames(control.events(tenant_id=TENANT, run_id=RUN, last_event_id=-5))
    assert _ids(frames) == [1]


# ── 3. 订阅方不再读检查点（判据 ⑤）────────────────────────────────────


@pytest.mark.asyncio
async def test_subscribers_do_not_read_the_checkpoint_when_the_log_is_used() -> None:
    """**判据 ⑤**：订阅方从 1 个涨到 3 个，检查点历史读次数**一动不动**。

    这是 B-2 之前真正的代价：每个 SSE 连接每秒读 4 次 ``aget_state_history``
    （要把图建起来读整份快照）。现在写日志的是**每轮一个**记录器，订阅方只读
    日志——所以三个订阅方的开销是三个"读表"游标，而不是三倍的检查点读。
    """
    service = _CountingService()
    log = InMemoryRunEvents()
    reader = _StepReader()
    control = RunControl(service, run_events=log, step_reader=reader)  # type: ignore[arg-type]

    # 记录器写一轮（这一步会读一次检查点历史，且只读一次）
    service.push(step=1, status="completed")
    reader.value = "c1"
    live = control._open(tenant_id=TENANT, run_id=RUN)
    await control._record_once(tenant_id=TENANT, run_id=RUN, live=live)
    after_recording = service.history_calls
    assert after_recording >= 1

    frames_per_subscriber = await asyncio.gather(
        *(_drain_frames(control.events(tenant_id=TENANT, run_id=RUN)) for _ in range(3))
    )
    assert service.history_calls == after_recording, "订阅方又去读检查点了——事件日志这条路没走通"
    assert len({tuple(_ids(frames)) for frames in frames_per_subscriber}) == 1, (
        "三个订阅方看到的事件序列不一致"
    )
    assert _ids(frames_per_subscriber[0]) == [1]


@pytest.mark.asyncio
async def test_the_recorder_writes_each_step_once_even_with_many_subscribers() -> None:
    """记录器**每轮一个**：多订阅方不产生重复事件。"""
    service = _CountingService()
    log = InMemoryRunEvents()
    reader = _StepReader()
    control = RunControl(service, run_events=log, step_reader=reader)  # type: ignore[arg-type]

    live = control._open(tenant_id=TENANT, run_id=RUN)
    service.push(step=1, status="running")
    reader.value = "c1"
    assert await control._record_once(tenant_id=TENANT, run_id=RUN, live=live) is False
    # 同一个检查点再记一次：**不该**重复写
    assert await control._record_once(tenant_id=TENANT, run_id=RUN, live=live) is False
    service.push(step=2, status="completed")
    reader.value = "c2"
    assert await control._record_once(tenant_id=TENANT, run_id=RUN, live=live) is True

    events = await log.since(tenant_id=TENANT, run_id=RUN)
    assert [row.sequence for row in events] == [1, 2]
    assert [row.payload["step"] for row in events] == [1, 2]


# ── 4. 真相源只有一个：丢了事件日志不影响续跑 ───────────────────────────


@pytest.mark.asyncio
async def test_losing_the_event_log_does_not_affect_recovery() -> None:
    """事件日志**空了也不影响续跑** —— ``recover()`` 根本不看它。

    这一条是"检查点管恢复，event log 只作观察"的可执行版本：把日志换成什么都
    不记的桩，恢复照样把该接的轮接起来。
    """
    service = _CountingService()

    class _FakeIndex:
        async def unfinished(self, *, statuses):
            del statuses
            return [UnfinishedRun(tenant_id=TENANT, run_id=RUN, status="running")]

    log = InMemoryRunEvents()  # 空日志：一条事件都没有
    control = RunControl(
        service,  # type: ignore[arg-type]
        run_index=_FakeIndex(),  # type: ignore[arg-type]
        run_events=log,
        instance_id="replica-test",
        heartbeat_interval=0.01,
        heartbeat_grace=0.0,
    )
    claimed = await control.recover()
    assert claimed == [RUN]
    for _ in range(50):
        if service.continued:
            break
        await asyncio.sleep(0.01)
    assert service.continued == [RUN], "事件日志空着，续跑就不做了？"
    await control.shutdown()
