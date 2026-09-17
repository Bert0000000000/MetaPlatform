"""工具调用级幂等账本（A-3 / `MP-TOOL-IDEMPOTENCY-01`）。

**要解决的问题**：1.9 只做到 **run 级**幂等（同一把 Idempotency-Key 只产生一个 run）。
但一轮 run 里员工要调很多次工具；进程死在"工具**已经真的执行了**、回执还没落"的
窗口里时，续跑会把**整个子任务**再跑一遍——那一次工具有了第二个副作用。
``api/run_control.py`` 的边界自述写的正是这件事（"那一波整体重跑"）。

**做法**：每次工具调用**先落一条意图**，执行完再落回执。幂等键固定为
``run_id + task_id + tool_call_id``（roadmap 锁死的口径，不另发明一套）::

    ToolInvocation
    ├─ invocation_id = (tenant_id, run_id, task_id, tool_call_id)
    ├─ tool_name / input_digest
    ├─ status                              ← running / completed / failed
    ├─ result / result_digest
    └─ lease_owner / lease_expires_at

**"最多一次"是怎么成立的**：``begin()`` 在**执行之前**落 ``running``。于是历史里
只要有一条这个键的行，就说明"这一次调用已经开始了"。恢复时：

* ``completed`` → **回放**记下的结果，不再执行（常态，也是"重放不重复"）；
* ``running`` → **不执行**。进程在跑它的时候死了，我们**无法知道**副作用落没落；
  再执行一次就是把"可能已经发生的一次"变成"可能发生两次"。上限锁在 1。
  代价是这一条可能一次都没发生——**这正是 at-most-once 的定义**，不是妥协。
* 没有行 → 真执行。

**``tool_call_id`` 是算出来的，不是框架给的**：LangChain 那枚 id 由模型这一轮的
生成决定，重启后重跑会**换一个新的**——拿它当键，账本永远记不中，而本模块存在的
理由恰恰是跨重启。所以取 ``sha256(工具名 + 规范化参数)``：同一个意图在任何一轮、
任何进程里都是同一个键。代价如实写在这里：**同一个子任务里两次完全相同的调用会被
当成同一次**（回放同一份回执）——这是幂等的代价，也是幂等的定义。

**``failed`` 不挡重试**：工具抛错 = 这一次没落地，重试是应当的。它是"这一条没成"，
不是"这一条已经发生过"。
"""

from __future__ import annotations

import hashlib
import json
import time
import uuid
from collections.abc import AsyncIterator, Mapping
from contextlib import asynccontextmanager
from dataclasses import dataclass, replace
from typing import Any, Protocol

import psycopg

from .tenant_db import TenantConnections, tenant_connections

SCHEMA = "agent_team"
TOOL_INVOCATIONS_TABLE = "tool_invocations"

RUNNING = "running"
COMPLETED = "completed"
FAILED = "failed"

#: 独占租约的默认寿命（秒）。**只用于"另一个副本正在跑它"的判定**，不用于
#: 决定要不要重跑：`running` 一律不重跑（见模块注释）。到期只影响"谁可以写回执"。
DEFAULT_LEASE_SECONDS = 60.0


def call_id(tool_name: str, arguments: Mapping[str, Any] | None) -> str:
    """``tool_call_id``：``sha256(工具名 ‖ 规范化参数)``。

    ``sort_keys=True`` 让"参数一样但键序不同"算出同一个 id——模型两次生成同一
    意图时键序不保证一致，那不该被当成两次调用。
    """
    canonical = json.dumps(
        {"tool": tool_name, "arguments": dict(arguments or {})},
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        default=str,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:32]


def digest_result(result: Any) -> str:
    """结果的摘要（回执可检：回放的那一份与当初那一次是不是同一次）。"""
    try:
        canonical = json.dumps(result, sort_keys=True, separators=(",", ":"), default=str)
    except (TypeError, ValueError):
        canonical = repr(result)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:32]


@dataclass(frozen=True, slots=True)
class ToolInvocation:
    """一次工具调用的账本行。``invocation_id`` 是四元组，不是单列。"""

    tenant_id: str
    run_id: str
    task_id: str
    tool_call_id: str
    tool_name: str = ""
    input_digest: str = ""
    status: str = RUNNING
    result: Any = None
    result_digest: str = ""
    error: str = ""
    lease_owner: str = ""
    lease_expires_at: float = 0.0
    started_at: float = 0.0
    finished_at: float = 0.0

    @property
    def invocation_id(self) -> str:
        """可读的幂等键（``run_id + task_id + tool_call_id`` 的拼写形态）。"""
        return f"{self.run_id}:{self.task_id}:{self.tool_call_id}"

    def to_dict(self) -> dict[str, Any]:
        return {
            "invocation_id": self.invocation_id,
            "run_id": self.run_id,
            "task_id": self.task_id,
            "tool_call_id": self.tool_call_id,
            "tool_name": self.tool_name,
            "input_digest": self.input_digest,
            "status": self.status,
            "result_digest": self.result_digest,
            "error": self.error,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
        }


@dataclass(frozen=True, slots=True)
class ToolCallAdmission:
    """``begin()`` 的结论：**能不能真执行**。

    ``execute=False`` 时 ``reuse`` 是要回放的结果（``completed`` 才有），
    ``reason`` 说明为什么不让执行（``already_completed`` / ``in_flight``）。
    """

    execute: bool
    reason: str = ""
    invocation: ToolInvocation | None = None
    reuse: Any = None

    def to_log_entry(self) -> dict[str, Any]:
        """进 ``SubTaskResult.tool_calls`` 的那一条（可查）。"""
        return {
            "execute": self.execute,
            "reason": self.reason,
            "invocation_id": self.invocation.invocation_id if self.invocation else "",
            "status": self.invocation.status if self.invocation else "",
        }


class ToolLedger(Protocol):
    """工具调用账本面。三个方法都是 async——PG 实现在请求路径上。"""

    async def begin(
        self,
        *,
        tenant_id: str,
        run_id: str,
        task_id: str,
        tool_call_id: str,
        tool_name: str,
        arguments: Mapping[str, Any] | None = None,
        owner: str = "",
    ) -> ToolCallAdmission: ...

    async def complete(
        self, *, tenant_id: str, invocation: ToolInvocation, result: Any
    ) -> None: ...

    async def fail(self, *, tenant_id: str, invocation: ToolInvocation, error: str) -> None: ...

    async def running_invocations(self, *, tenant_id: str, run_id: str) -> int:
        """这一轮里**还挂着**的 ``running`` 调用数（B-1 接管判定要用）。

        为什么要单开一个查询而不是复用 ``rows()``：接管是**每个没跑完的 run
        都要问一次**的判定，把整本账拉回来再在 Python 里数，代价随该 run 的
        调用数线性涨；这里只要一个计数。

        **注意 ``lease_expires_at`` 不参与这个判定。** 它不是"过期了就可以重跑"
        ——`running` 一律不重跑是 A-3 的判据（at-most-once）。这里的用途恰恰相反：
        有一条在途调用，**就不该接管这一轮**（见
        :func:`mate_tech_agent_team.run_lease.decide_takeover`）。
        """


def _admission_for(existing: ToolInvocation) -> ToolCallAdmission:
    """已有一行时的结论：**一律不执行**（这就是 at-most-once 的落点）。"""
    if existing.status == COMPLETED:
        return ToolCallAdmission(
            execute=False, reason="already_completed", invocation=existing, reuse=existing.result
        )
    if existing.status == FAILED:
        # 失败 = 这一次没落地：允许重来（它是"没成"，不是"已经发生过"）。
        return ToolCallAdmission(execute=True, reason="retry_after_failure", invocation=existing)
    return ToolCallAdmission(execute=False, reason="in_flight", invocation=existing)


class InMemoryToolLedger:
    """进程内实现：单副本与测试的默认。"""

    def __init__(self, *, lease: float = DEFAULT_LEASE_SECONDS) -> None:
        self._lease = max(0.0, lease)
        self._rows: dict[tuple[str, str, str, str], ToolInvocation] = {}

    async def begin(
        self,
        *,
        tenant_id: str,
        run_id: str,
        task_id: str,
        tool_call_id: str,
        tool_name: str,
        arguments: Mapping[str, Any] | None = None,
        owner: str = "",
    ) -> ToolCallAdmission:
        key = (tenant_id, run_id, task_id, tool_call_id)
        existing = self._rows.get(key)
        if existing is not None:
            return _admission_for(existing)
        now = time.time()
        row = ToolInvocation(
            tenant_id=tenant_id,
            run_id=run_id,
            task_id=task_id,
            tool_call_id=tool_call_id,
            tool_name=tool_name,
            input_digest=call_id(tool_name, arguments),
            status=RUNNING,
            lease_owner=owner,
            lease_expires_at=now + self._lease if self._lease > 0 else 0.0,
            started_at=now,
        )
        self._rows[key] = row
        return ToolCallAdmission(execute=True, reason="fresh", invocation=row)

    async def complete(self, *, tenant_id: str, invocation: ToolInvocation, result: Any) -> None:
        self._rows[(tenant_id, invocation.run_id, invocation.task_id, invocation.tool_call_id)] = (
            _completed(invocation, result)
        )

    async def fail(self, *, tenant_id: str, invocation: ToolInvocation, error: str) -> None:
        self._rows[(tenant_id, invocation.run_id, invocation.task_id, invocation.tool_call_id)] = (
            _failed(invocation, error)
        )

    async def rows(self, *, tenant_id: str, run_id: str = "") -> list[ToolInvocation]:
        return [
            row
            for key, row in self._rows.items()
            if key[0] == tenant_id and (not run_id or key[1] == run_id)
        ]

    async def running_invocations(self, *, tenant_id: str, run_id: str) -> int:
        return sum(
            1
            for (tid, rid, _, _), row in self._rows.items()
            if tid == tenant_id and rid == run_id and row.status == RUNNING
        )


def _completed(invocation: ToolInvocation, result: Any) -> ToolInvocation:
    return replace(
        invocation,
        status=COMPLETED,
        result=result,
        result_digest=digest_result(result),
        finished_at=time.time(),
    )


def _failed(invocation: ToolInvocation, error: str) -> ToolInvocation:
    return replace(invocation, status=FAILED, error=error, finished_at=time.time())


# ── PG 实现 ──────────────────────────────────────────────────────────────

_TABLE_DDL = f"""
CREATE TABLE IF NOT EXISTS {TOOL_INVOCATIONS_TABLE} (
    tenant_id        TEXT   NOT NULL,
    run_id           TEXT   NOT NULL,
    task_id          TEXT   NOT NULL,
    tool_call_id     TEXT   NOT NULL,
    tool_name        TEXT   NOT NULL DEFAULT '',
    input_digest     TEXT   NOT NULL DEFAULT '',
    status           TEXT   NOT NULL,
    result           JSONB,
    result_digest    TEXT   NOT NULL DEFAULT '',
    error            TEXT   NOT NULL DEFAULT '',
    lease_owner      TEXT   NOT NULL DEFAULT '',
    lease_expires_at DOUBLE PRECISION NOT NULL DEFAULT 0,
    started_at       DOUBLE PRECISION NOT NULL DEFAULT 0,
    finished_at      DOUBLE PRECISION NOT NULL DEFAULT 0,
    PRIMARY KEY (tenant_id, run_id, task_id, tool_call_id)
)
"""

_RLS_DDL = """
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
ALTER TABLE {table} FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_iso ON {table};
CREATE POLICY tenant_iso ON {table}
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE ON {table} TO {app_role};
"""

#: **抢坑的那一条 SQL**：没有就插（插进去才返回行 = 我抢到了）、有就让位。
#: 与 ``RunClaims`` 用的是同一个模式——"先查再插"会把窗口还回去。
_CLAIM_SQL = f"""
INSERT INTO {TOOL_INVOCATIONS_TABLE} (
    tenant_id, run_id, task_id, tool_call_id, tool_name, input_digest,
    status, lease_owner, lease_expires_at, started_at
) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (tenant_id, run_id, task_id, tool_call_id) DO NOTHING
RETURNING started_at
"""

_SELECT_SQL = f"""
SELECT tenant_id, run_id, task_id, tool_call_id, tool_name, input_digest, status,
       result, result_digest, error, lease_owner, lease_expires_at, started_at, finished_at
  FROM {TOOL_INVOCATIONS_TABLE}
 WHERE tenant_id = %s AND run_id = %s AND task_id = %s AND tool_call_id = %s
"""

_UPDATE_SQL = f"""
UPDATE {TOOL_INVOCATIONS_TABLE}
   SET status = %s, result = %s::jsonb, result_digest = %s, error = %s, finished_at = %s
 WHERE tenant_id = %s AND run_id = %s AND task_id = %s AND tool_call_id = %s
"""

#: 接管判定要的那一个数：这一轮还有几条 ``running``（B-1）。
_RUNNING_COUNT_SQL = (
    f"SELECT count(*) FROM {TOOL_INVOCATIONS_TABLE}"
    " WHERE tenant_id = %s AND run_id = %s AND status = %s"
)


def bootstrap_tool_ledger(conn: psycopg.Connection[Any], app_role: str = "mate_app") -> None:
    """建工具调用账本表 + RLS（幂等）。``conn`` 必须是 **admin** 连接。"""
    conn.execute(_TABLE_DDL)
    conn.execute(_RLS_DDL.format(table=TOOL_INVOCATIONS_TABLE, app_role=app_role))


class PgToolLedger:
    """PG 实现：跨副本、跨重启共读同一本账。"""

    def __init__(
        self,
        dsn: str | TenantConnections,
        schema: str = SCHEMA,
        *,
        lease: float = DEFAULT_LEASE_SECONDS,
    ) -> None:
        self._conns = tenant_connections(dsn, schema=schema)
        self._lease = max(0.0, lease)

    @asynccontextmanager
    async def _conn(self, tenant_id: str) -> AsyncIterator[psycopg.AsyncConnection[Any]]:
        # 租户上下文走 tenant_db：**事务级** GUC + 归还前 RESET（B-5）。
        async with self._conns.for_tenant(tenant_id) as conn:
            yield conn

    async def begin(
        self,
        *,
        tenant_id: str,
        run_id: str,
        task_id: str,
        tool_call_id: str,
        tool_name: str,
        arguments: Mapping[str, Any] | None = None,
        owner: str = "",
    ) -> ToolCallAdmission:
        if not tenant_id:
            raise ValueError("工具调用账本必须带租户上下文（硬规则 3）")
        now = time.time()
        row = ToolInvocation(
            tenant_id=tenant_id,
            run_id=run_id,
            task_id=task_id,
            tool_call_id=tool_call_id,
            tool_name=tool_name,
            input_digest=call_id(tool_name, arguments),
            status=RUNNING,
            lease_owner=owner,
            lease_expires_at=now + self._lease if self._lease > 0 else 0.0,
            started_at=now,
        )
        async with self._conn(tenant_id) as conn:
            cur = await conn.execute(
                _CLAIM_SQL,
                (
                    tenant_id,
                    run_id,
                    task_id,
                    tool_call_id,
                    tool_name,
                    row.input_digest,
                    RUNNING,
                    owner,
                    row.lease_expires_at,
                    now,
                ),
            )
            if await cur.fetchone() is not None:
                return ToolCallAdmission(execute=True, reason="fresh", invocation=row)
            existing = await self._select(conn, tenant_id, run_id, task_id, tool_call_id)
        if existing is None:  # 竞态里对方刚删掉（不该发生）——退回"不执行"
            return ToolCallAdmission(execute=False, reason="unknown")
        return _admission_for(existing)

    async def _select(
        self,
        conn: psycopg.AsyncConnection[Any],
        tenant_id: str,
        run_id: str,
        task_id: str,
        tool_call_id: str,
    ) -> ToolInvocation | None:
        cur = await conn.execute(_SELECT_SQL, (tenant_id, run_id, task_id, tool_call_id))
        row = await cur.fetchone()
        return _row_to_invocation(row) if row else None

    async def complete(self, *, tenant_id: str, invocation: ToolInvocation, result: Any) -> None:
        await self._finish(tenant_id=tenant_id, invocation=invocation, result=result, error="")

    async def fail(self, *, tenant_id: str, invocation: ToolInvocation, error: str) -> None:
        await self._finish(tenant_id=tenant_id, invocation=invocation, result=None, error=error)

    async def _finish(
        self, *, tenant_id: str, invocation: ToolInvocation, result: Any, error: str
    ) -> None:
        status = COMPLETED if not error else FAILED
        async with self._conn(tenant_id) as conn:
            await conn.execute(
                _UPDATE_SQL,
                (
                    status,
                    json.dumps(result, ensure_ascii=False, default=str)
                    if result is not None
                    else None,
                    digest_result(result) if result is not None else "",
                    error,
                    time.time(),
                    tenant_id,
                    invocation.run_id,
                    invocation.task_id,
                    invocation.tool_call_id,
                ),
            )

    async def rows(self, *, tenant_id: str, run_id: str = "") -> list[ToolInvocation]:
        sql = (
            "SELECT tenant_id, run_id, task_id, tool_call_id, tool_name, input_digest, status,"
            " result, result_digest, error, lease_owner, lease_expires_at, started_at, finished_at"
            f" FROM {TOOL_INVOCATIONS_TABLE} WHERE tenant_id = %s"
        )
        params: list[Any] = [tenant_id]
        if run_id:
            sql += " AND run_id = %s"
            params.append(run_id)
        sql += " ORDER BY started_at"
        async with self._conn(tenant_id) as conn:
            cur = await conn.execute(sql, tuple(params))
            rows = await cur.fetchall()
        return [_row_to_invocation(row) for row in rows]

    async def running_invocations(self, *, tenant_id: str, run_id: str) -> int:
        async with self._conn(tenant_id) as conn:
            cur = await conn.execute(_RUNNING_COUNT_SQL, (tenant_id, run_id, RUNNING))
            row = await cur.fetchone()
        return int(row[0]) if row else 0


def _row_to_invocation(row: tuple[Any, ...]) -> ToolInvocation:
    return ToolInvocation(
        tenant_id=str(row[0]),
        run_id=str(row[1]),
        task_id=str(row[2]),
        tool_call_id=str(row[3]),
        tool_name=str(row[4]),
        input_digest=str(row[5]),
        status=str(row[6]),
        result=row[7],
        result_digest=str(row[8]),
        error=str(row[9]),
        lease_owner=str(row[10]),
        lease_expires_at=float(row[11] or 0.0),
        started_at=float(row[12] or 0.0),
        finished_at=float(row[13] or 0.0),
    )


def new_lease_owner() -> str:
    """本进程的租约归属标识（只用于可读性，不参与判定）。"""
    return uuid.uuid4().hex[:8]


__all__ = [
    "COMPLETED",
    "DEFAULT_LEASE_SECONDS",
    "FAILED",
    "RUNNING",
    "TOOL_INVOCATIONS_TABLE",
    "InMemoryToolLedger",
    "PgToolLedger",
    "ToolCallAdmission",
    "ToolInvocation",
    "ToolLedger",
    "bootstrap_tool_ledger",
    "call_id",
    "digest_result",
    "new_lease_owner",
]
