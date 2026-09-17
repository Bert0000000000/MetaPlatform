"""Run 事件日志 + 推送（B-2 / `MP-RUN-EVENTS-01`）。

**真相源只有一个**（roadmap 锁死的口径，反复强调）：**检查点管执行恢复，event log
只作产品观察**。这两者不是两个冲突的事实源——

* ``run_event`` 丢了 → 受影响的只有"事件流回放得全不全"，**续跑一个字都不少**；
* 检查点丢了 → 那才是真的丢了这一轮。

所以 :meth:`RunControl.events` 回放走 event log，而 :meth:`RunControl.recover`
**完全不看它**。别把两者当同一份东西维护。

**为什么要有这张表**（B-2 之前的代价）：SSE 是"回放 + 尾随检查点"，
``DEFAULT_POLL_INTERVAL = 0.25`` → 每个连接**每秒读 4 次检查点历史**，而
``aget_state_history`` 要把图建起来读整份快照。连接数一上来，代价是
``连接数 × 4/秒 × 整份历史``。而且 ``seq`` 是**每流内存计数**，流一断就归零
——断线重连必然丢事件。

**现在**：

* 追加式 ``run_event``（``(tenant, run, sequence)`` 主键 + RLS），写入走**平台既有
  Outbox**（可选）并 ``NOTIFY`` 一个通道；
* SSE 连上先按 ``sequence`` 补发（``Last-Event-ID`` 就是游标），之后由
  **NOTIFY 唤醒**，只在没通知时兜底轮询一次；
* ``sequence`` 是**这一轮的**单调序号，由 ``pg_advisory_xact_lock`` 串行化分配。
  **不能拿审计账本的 ``sequence`` 当 SSE 游标**——那是审计**哈希链**的序号，
  跨租户全局成链，与"这一轮流到第几条事件"根本不是一回事（见 ``audit.py``）。

**保留期**：``MATE_AGENT_TEAM_RUN_EVENT_RETENTION_SECONDS``（默认 7 天）。
:meth:`RunEventStore.prune` 删过期行；调用点是启动扫描（低频、不需要后台定时器
——定时器在进程重启后消失，反而制造"有时管用"的错觉，与运行级超时同一条教训）。
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import os
import time
from collections.abc import AsyncIterator, Mapping
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from typing import Any, Protocol

import psycopg

from .tenant_db import TenantConnections, tenant_connections

SCHEMA = "agent_team"
RUN_EVENTS_TABLE = "run_event"

#: NOTIFY 通道名。PG 的通道是**库级**的，所以负载里带 ``租户|run``，
#: 订阅方自己筛——PG 不支持按通道参数化，这是它唯一的做法。
NOTIFY_CHANNEL = "agent_team_run_event"

#: 事件保留期（秒）。0 = 不清理（自己管）。
DEFAULT_RETENTION_SECONDS = 7 * 24 * 3600.0
RETENTION_ENV = "MATE_AGENT_TEAM_RUN_EVENT_RETENTION_SECONDS"

#: 兜底轮询间隔（秒）。**只在没有 NOTIFY 到达时用**——它是"推送通道坏了也还能
#: 走"的退路，不是主路径。比 B-2 之前的 0.25s 宽一个量级。
DEFAULT_FALLBACK_POLL_SECONDS = 2.0
FALLBACK_POLL_ENV = "MATE_AGENT_TEAM_EVENT_FALLBACK_POLL_SECONDS"

#: 单次补发/拉取的上限（条）。防一次断线重连把整轮历史拉爆。
DEFAULT_BATCH = 500


def configured_retention() -> float:
    try:
        return max(0.0, float(os.getenv(RETENTION_ENV, str(DEFAULT_RETENTION_SECONDS))))
    except ValueError:
        return DEFAULT_RETENTION_SECONDS


def configured_fallback_poll() -> float:
    try:
        return max(0.05, float(os.getenv(FALLBACK_POLL_ENV, str(DEFAULT_FALLBACK_POLL_SECONDS))))
    except ValueError:
        return DEFAULT_FALLBACK_POLL_SECONDS


@dataclass(frozen=True, slots=True)
class RunEvent:
    """``run_event`` 的一行。``sequence`` 是**这一轮内**的单调序号。"""

    tenant_id: str
    run_id: str
    sequence: int
    event_type: str
    payload: Mapping[str, Any] = field(default_factory=dict)
    checkpoint_id: str = ""
    created_at: float = 0.0

    def to_sse(self) -> dict[str, str]:
        """SSE 帧的字段。``id`` 是**续传游标**（浏览器断线后自己带回来）。"""
        return {"id": str(self.sequence), "event": self.event_type}

    def to_dict(self) -> dict[str, Any]:
        return {
            "sequence": self.sequence,
            "run_id": self.run_id,
            "event_type": self.event_type,
            "payload": dict(self.payload),
            "checkpoint_id": self.checkpoint_id,
            "created_at": self.created_at,
        }


class RunEventStore(Protocol):
    """事件日志面。**只追加**，不更新、不删除单行（清理走 :meth:`prune`）。"""

    async def append(
        self,
        *,
        tenant_id: str,
        run_id: str,
        event_type: str,
        payload: Mapping[str, Any] | None = None,
        checkpoint_id: str = "",
    ) -> RunEvent: ...

    async def since(
        self, *, tenant_id: str, run_id: str, after: int = 0, limit: int = DEFAULT_BATCH
    ) -> list[RunEvent]: ...

    async def latest_sequence(self, *, tenant_id: str, run_id: str) -> int: ...

    def wakeups(
        self, *, tenant_id: str, run_id: str, fallback_interval: float
    ) -> AsyncIterator[None]:
        """订阅这一轮的"有新事件了"信号，**最长** ``fallback_interval`` 空转一次。

        实现各不一样（PG 用 LISTEN/NOTIFY，内存实现用队列），但契约是同一条：
        **它是"最努力"的送达**，所以订阅方**必须**把每次醒来当成"可能有新事件"
        去看一眼表，而不是"一定有"。反过来，兜底间隔保证最坏情况也不会静静卡死。
        """
        ...

    async def start(self) -> None:
        """起共享的推送连接（幂等）。内存实现是 no-op。"""
        ...

    async def aclose(self) -> None:
        """收尾（应用关停时调）。内存实现是 no-op。"""
        ...

    async def prune(self, *, tenant_id: str, run_id: str = "", older_than: float) -> int: ...


class InMemoryRunEvents:
    """进程内实现：单副本与不接 PG 的测试形态。

    两个 ``RunControl`` 共享同一个它 = "两个副本共享一条事件流"（同进程模拟）。
    """

    def __init__(self) -> None:
        self._rows: dict[tuple[str, str], list[RunEvent]] = {}
        self._waiters: dict[tuple[str, str], asyncio.Queue[None]] = {}

    async def append(
        self,
        *,
        tenant_id: str,
        run_id: str,
        event_type: str,
        payload: Mapping[str, Any] | None = None,
        checkpoint_id: str = "",
    ) -> RunEvent:
        key = (tenant_id, run_id)
        rows = self._rows.setdefault(key, [])
        event = RunEvent(
            tenant_id=tenant_id,
            run_id=run_id,
            sequence=(rows[-1].sequence + 1) if rows else 1,
            event_type=event_type,
            payload=dict(payload or {}),
            checkpoint_id=checkpoint_id,
            created_at=time.time(),
        )
        rows.append(event)
        queue = self._waiters.get(key)
        if queue is not None:
            queue.put_nowait(None)
        return event

    async def wakeups(
        self, *, tenant_id: str, run_id: str, fallback_interval: float
    ) -> AsyncIterator[None]:
        """内存实现：一个队列 + 兜底超时。契约与 PG 那条完全一致（见 Protocol）。"""
        await self.start()
        key = (tenant_id, run_id)
        queue: asyncio.Queue[None] = self._waiters.setdefault(key, asyncio.Queue())
        try:
            while True:
                try:
                    await asyncio.wait_for(queue.get(), timeout=fallback_interval)
                except TimeoutError:
                    pass
                yield
        finally:
            self._waiters.pop(key, None)

    async def start(self) -> None:
        """内存实现没有要起的东西（接口一致而已）。"""

    async def aclose(self) -> None:
        """内存实现没有要收的东西。"""

    async def since(
        self, *, tenant_id: str, run_id: str, after: int = 0, limit: int = DEFAULT_BATCH
    ) -> list[RunEvent]:
        rows = self._rows.get((tenant_id, run_id), [])
        return [row for row in rows if row.sequence > after][:limit]

    async def latest_sequence(self, *, tenant_id: str, run_id: str) -> int:
        rows = self._rows.get((tenant_id, run_id), [])
        return rows[-1].sequence if rows else 0

    async def prune(self, *, tenant_id: str, run_id: str = "", older_than: float) -> int:
        removed = 0
        for key, rows in list(self._rows.items()):
            if key[0] != tenant_id or (run_id and key[1] != run_id):
                continue
            keep = [row for row in rows if row.created_at >= older_than]
            removed += len(rows) - len(keep)
            self._rows[key] = keep
        return removed


# ── PG 实现 ─────────────────────────────────────────────────────────────

_TABLE_DDL = f"""
CREATE TABLE IF NOT EXISTS {RUN_EVENTS_TABLE} (
    tenant_id     TEXT NOT NULL,
    run_id        TEXT NOT NULL,
    sequence      INTEGER NOT NULL,
    event_type    TEXT NOT NULL,
    payload       JSONB NOT NULL DEFAULT '{{}}'::jsonb,
    checkpoint_id TEXT NOT NULL DEFAULT '',
    created_at    DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (tenant_id, run_id, sequence)
)
"""

_TABLE_INDEX = (
    f"CREATE INDEX IF NOT EXISTS {RUN_EVENTS_TABLE}_created_idx ON {RUN_EVENTS_TABLE} (created_at)"
)

_RLS_DDL = """
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
ALTER TABLE {table} FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_iso ON {table};
CREATE POLICY tenant_iso ON {table}
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, DELETE ON {table} TO {app_role};
"""

_INSERT_SQL = f"""
INSERT INTO {RUN_EVENTS_TABLE}
    (tenant_id, run_id, sequence, event_type, payload, checkpoint_id, created_at)
VALUES (%s, %s, %s, %s, %s::jsonb, %s, %s)
RETURNING sequence, created_at
"""

_SELECT_SQL = (
    "SELECT sequence, event_type, payload, checkpoint_id, created_at"
    f" FROM {RUN_EVENTS_TABLE} WHERE tenant_id = %s AND run_id = %s AND sequence > %s"
    " ORDER BY sequence LIMIT %s"
)

_MAX_SQL = (
    f"SELECT coalesce(max(sequence), 0) FROM {RUN_EVENTS_TABLE}"
    " WHERE tenant_id = %s AND run_id = %s"
)

_PRUNE_SQL = f"DELETE FROM {RUN_EVENTS_TABLE} WHERE tenant_id = %s AND created_at < %s"


async def _pump_notifications(
    conn: psycopg.AsyncConnection[Any], prefix: str, queue: asyncio.Queue[None]
) -> None:
    """（保留：仅供测试/诊断使用）单连接、单队列的通知泵。"""
    async for notify in conn.notifies():
        if isinstance(notify.payload, str) and notify.payload.startswith(prefix):
            queue.put_nowait(None)


def bootstrap_run_events(conn: psycopg.Connection[Any], app_role: str = "mate_app") -> None:
    """建事件表 + RLS（幂等）。``conn`` 必须是 **admin** 连接。"""
    conn.execute(_TABLE_DDL)
    conn.execute(_TABLE_INDEX)
    conn.execute(_RLS_DDL.format(table=RUN_EVENTS_TABLE, app_role=app_role))


class PgRunEvents:
    """PG 实现：跨副本共读一条流，靠 NOTIFY 推送。"""

    def __init__(self, dsn: str | TenantConnections, schema: str = SCHEMA) -> None:
        self._conns = tenant_connections(dsn, schema=schema)
        #: 进程级的 LISTEN 连接与读泵（见 :meth:`start`）。**一条**，不是每条
        #: 订阅一条——否则连接数会随 SSE 连接数线性涨，正是本批要消掉的东西。
        self._listener: psycopg.AsyncConnection[Any] | None = None
        self._pump: asyncio.Task[None] | None = None
        self._subscribers: dict[tuple[str, str], set[asyncio.Queue[None]]] = {}

    @asynccontextmanager
    async def _conn(self, tenant_id: str) -> AsyncIterator[psycopg.AsyncConnection[Any]]:
        async with self._conns.for_tenant(tenant_id) as conn:
            yield conn

    async def append(
        self,
        *,
        tenant_id: str,
        run_id: str,
        event_type: str,
        payload: Mapping[str, Any] | None = None,
        checkpoint_id: str = "",
    ) -> RunEvent:
        created = time.time()
        async with self._conn(tenant_id) as conn:
            # 序号分配的原子性：同一轮的并发 append 被 advisory lock 串行化，
            # 于是"读 max → 插 max+1"之间没有窗口（与审计成链同一个手法）。
            # 锁键用 ``|`` 拼：``tenant_id`` 里不可能有它（``tenant_db`` 挡了），
            # run_id 是定长 hex，不会撞。**别用 NUL 拼**——PG 的 text 参数不接受
            # 0x00，实测直接 ``DataError``（这条是测试抓出来的）。
            await conn.execute(
                "SELECT pg_advisory_xact_lock(hashtext(%s))", (f"{tenant_id}|{run_id}",)
            )
            cur = await conn.execute(_MAX_SQL, (tenant_id, run_id))
            row = await cur.fetchone()
            sequence = int(row[0] if row else 0) + 1
            await conn.execute(
                _INSERT_SQL,
                (
                    tenant_id,
                    run_id,
                    sequence,
                    event_type,
                    json.dumps(dict(payload or {}), ensure_ascii=False, default=str),
                    checkpoint_id,
                    created,
                ),
            )
            # 通知在**同一事务**里发：提交才送达（PG 的 NOTIFY 本来就是事务性的），
            # 于是"订阅方被唤醒"与"那行真的可见"是同一个事实。
            await conn.execute(
                "SELECT pg_notify(%s, %s)", (NOTIFY_CHANNEL, f"{tenant_id}|{run_id}|{sequence}")
            )
        return RunEvent(
            tenant_id=tenant_id,
            run_id=run_id,
            sequence=sequence,
            event_type=event_type,
            payload=dict(payload or {}),
            checkpoint_id=checkpoint_id,
            created_at=created,
        )

    async def since(
        self, *, tenant_id: str, run_id: str, after: int = 0, limit: int = DEFAULT_BATCH
    ) -> list[RunEvent]:
        async with self._conn(tenant_id) as conn:
            cur = await conn.execute(_SELECT_SQL, (tenant_id, run_id, after, limit))
            rows = await cur.fetchall()
        return [
            RunEvent(
                tenant_id=tenant_id,
                run_id=run_id,
                sequence=int(row[0]),
                event_type=str(row[1]),
                payload=dict(row[2] or {}),
                checkpoint_id=str(row[3] or ""),
                created_at=float(row[4] or 0.0),
            )
            for row in rows
        ]

    async def latest_sequence(self, *, tenant_id: str, run_id: str) -> int:
        async with self._conn(tenant_id) as conn:
            cur = await conn.execute(_MAX_SQL, (tenant_id, run_id))
            row = await cur.fetchone()
        return int(row[0]) if row else 0

    async def prune(self, *, tenant_id: str, run_id: str = "", older_than: float) -> int:
        del run_id  # 保留期是按时间清的；按轮清是运维的另一件事（没这个需求）
        async with self._conn(tenant_id) as conn:
            cur = await conn.execute(_PRUNE_SQL, (tenant_id, older_than))
            return cur.rowcount if cur.rowcount and cur.rowcount > 0 else 0

    async def wakeups(
        self, *, tenant_id: str, run_id: str, fallback_interval: float
    ) -> AsyncIterator[None]:
        """订阅本轮的 NOTIFY；``fallback_interval`` 内没等到通知就空转一次。

        **为什么要兜底轮询**：LISTEN/NOTIFY 是"最努力"的送达——连接断了、
        通知在断的那几毫秒里发了，它就永远不来了。没有兜底的话，SSE 会**静静地
        卡死**，而客户端以为自己在看实时流。兜底给的是"最坏晚这么久"的界。

        **LISTEN 连接是进程级共享的**（:meth:`start` 里那一条），不是每条订阅
        自己开一条：LISTEN 是连接级状态，订阅各自的连接会让连接数随 SSE 连接数
        线性涨——那正是本批要消掉的东西。这里订阅的只是一个**进程内队列**，
        清理是纯内存操作（generator 被关掉时不会去 await 网络）。
        """
        key = (tenant_id, run_id)
        queue: asyncio.Queue[None] = asyncio.Queue()
        await self.start()
        self._subscribers.setdefault(key, set()).add(queue)
        try:
            while True:
                try:
                    await asyncio.wait_for(queue.get(), timeout=fallback_interval)
                except TimeoutError:
                    pass  # 兜底：没通知也去看一眼
                yield
        finally:
            # **纯同步**的清理：generator 收尾时不该再 await 网络（GeneratorExit
            # 下 await 会让关闭路径变得又长又脆，实测踩过）。
            subs = self._subscribers.get(key)
            if subs is not None:
                subs.discard(queue)
                if not subs:
                    self._subscribers.pop(key, None)

    async def start(self) -> None:
        """起进程级的 LISTEN 连接与读泵（幂等）。不在事件循环里时是 no-op。"""
        if self._pump is not None:
            return
        conn = await psycopg.AsyncConnection.connect(self._conns.dsn, autocommit=True)
        await conn.execute(f"LISTEN {NOTIFY_CHANNEL}")
        self._listener = conn
        self._pump = asyncio.create_task(self._read_notifications(conn))

    async def _read_notifications(self, conn: psycopg.AsyncConnection[Any]) -> None:
        """把 socket 上的通知读出来、派给登记的订阅队列。

        **这个泵不是可选的**：psycopg 的异步连接只在被使用（执行语句 / 显式
        迭代 ``notifies()``）时才把通知从 socket 取出来。没有它，通知就一直躺在
        内核缓冲里——表现为"NOTIFY 发了但没人醒"，只能靠兜底轮询，
        "实时"两个字就没了（实测踩过）。
        """
        async for notify in conn.notifies():
            payload = notify.payload
            if not isinstance(payload, str):
                continue
            tenant_id, _, rest = payload.partition("|")
            run_id, _, _seq = rest.partition("|")
            for queue in list(self._subscribers.get((tenant_id, run_id), ())):
                queue.put_nowait(None)

    async def aclose(self) -> None:
        """收尾：停泵、关连接。**应用关停时要调**（没调则连接随进程消失）。

        抑制里**必须带 ``CancelledError``**：泵是被我们取消的，``await`` 它抛的
        就是它——而它是 ``BaseException``，``suppress(Exception)`` 拦不住
        （实测：关停时会冒出来，看着像"哪都没错却报 CancelledError"）。
        """
        pump, listener = self._pump, self._listener
        self._pump, self._listener = None, None
        if pump is not None:
            pump.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await pump
        if listener is not None:
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await listener.close()


__all__ = [
    "DEFAULT_BATCH",
    "DEFAULT_FALLBACK_POLL_SECONDS",
    "DEFAULT_RETENTION_SECONDS",
    "FALLBACK_POLL_ENV",
    "InMemoryRunEvents",
    "NOTIFY_CHANNEL",
    "PgRunEvents",
    "RETENTION_ENV",
    "RUN_EVENTS_TABLE",
    "RunEvent",
    "RunEventStore",
    "bootstrap_run_events",
    "configured_fallback_poll",
    "configured_retention",
]
