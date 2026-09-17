"""跨副本协作面：控制面那两样**即时信号**的共享通道（1.9 任务 2）。

控制面刻意**不持有 run 历史**——run 状态只在检查点里（``GET /runs/{id}`` 读的
就是它）。但它确实持有两样**即时信号**，而这两样原先都只在"单进程"前提下成立：

* **取消标志**（1.5 起）—— 放在 ``RunControl._live`` 里，也就是进程内存。
  副本 A 起的 run，副本 B 取消不到：B 那侧没有 live 记录，只往检查点写了个终态
  就回话；而在途的图攥着自己那份状态继续跑，下一步就把终态覆盖回去。
* **幂等占坑**（1.7 起）—— 进程内靠 ``_live`` 占坑（无 await，原子），跨进程靠
  "确定性 run_id + 查检查点"。两个副本**同时**提交同一个键时，两边都还没查到
  对方写的检查点，于是都开跑（1.7 自述的"极小竞态"）。

这两样的性质一样：**都不是 run 的历史，而是"此刻要不要停 / 谁先来"的信号**，
也都必须**跨副本可见**。所以它们共用一个形态：一个可注入的存储 + 一个进程内
实现（单副本与测试的默认）+ 一个 PG 实现（真·多副本）。生产由 ``wiring`` 按
``MATE_AGENT_TEAM_DSN`` 装配 PG 实现；不给就是进程内实现——单副本部署的行为与
加这个模块之前逐字一致。

**租户隔离**：PG 实现走 **app DSN + ``app.tenant_id`` GUC**，两张表都开 RLS 且
``FORCE ROW LEVEL SECURITY``，建表由 admin 角色做（表 owner 默认绕过 RLS，见
:mod:`mate_tech_agent_team.checkpoint` 的同一条教训）。上下文没设时
``tenant_id = NULL`` 恒为 NULL → 一行都读写不到（fail-closed）。

**粘性**：取消信号只置不清。它能被清掉才是错的——置清之间的窗口里，另一副本的图
正好走到边界就看不到它。代价是一张只增不减的小表（量级 = 被取消过的 run 数），
随 run 落终态自然失去意义。
"""

from __future__ import annotations

import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any, Protocol

import psycopg

SCHEMA = "agent_team"
CANCEL_TABLE = "cancel_signals"

_CANCEL_DDL = f"""
CREATE TABLE IF NOT EXISTS {CANCEL_TABLE} (
    tenant_id    TEXT NOT NULL,
    run_id       TEXT NOT NULL,
    requested_at DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (tenant_id, run_id)
)
"""

#: 与 ``team_task`` / ``artifact`` 用的是**同一套**策略写法：按 ``tenant_id`` 列
#: 直接比 GUC（不用 thread_id 前缀——这张表不是 langgraph 的表）。
_RLS_DDL = """
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
ALTER TABLE {table} FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_iso ON {table};
CREATE POLICY tenant_iso ON {table}
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON {table} TO {app_role};
"""


def bootstrap_coordination(conn: psycopg.Connection[Any], app_role: str = "mate_app") -> None:
    """建协作面的表 + RLS 策略（幂等）。``conn`` 必须是 **admin** 连接。"""
    conn.execute(_CANCEL_DDL)
    conn.execute(_RLS_DDL.format(table=CANCEL_TABLE, app_role=app_role))


class CancelSignals(Protocol):
    """取消信号的共享通道。

    ``request`` 只置不清（幂等）；``is_requested`` 是图在**波边界**问的那一句。
    两个方法都按 ``(租户, run)`` 定位——取消是**按轮**的，不是全局开关。
    """

    async def request(self, *, tenant_id: str, run_id: str) -> None: ...

    async def is_requested(self, *, tenant_id: str, run_id: str) -> bool: ...


class InMemoryCancelSignals:
    """进程内实现：单副本部署与测试的默认。

    两个 ``RunControl`` 实例**共享同一个它**时，就等于"两个副本共享一个信号
    通道"——多副本用例就是这么模拟的。
    """

    def __init__(self) -> None:
        self._requested: set[tuple[str, str]] = set()

    async def request(self, *, tenant_id: str, run_id: str) -> None:
        self._requested.add((tenant_id, run_id))

    async def is_requested(self, *, tenant_id: str, run_id: str) -> bool:
        return (tenant_id, run_id) in self._requested


class PgCancelSignals:
    """PG 实现：真·多副本共享。连接随每次调用开闭（信号是低频操作）。"""

    def __init__(self, dsn: str, schema: str = SCHEMA) -> None:
        self._dsn = dsn
        self._schema = schema

    @asynccontextmanager
    async def _conn(self, tenant_id: str) -> AsyncIterator[psycopg.AsyncConnection[Any]]:
        conn = await psycopg.AsyncConnection.connect(self._dsn, autocommit=True)
        try:
            await conn.execute(f"SET search_path TO {self._schema}")
            # set_config() 而非 SET x = %s：后者不接受参数绑定。
            await conn.execute("select set_config('app.tenant_id', %s, false)", (tenant_id,))
            yield conn
        finally:
            await conn.close()

    async def request(self, *, tenant_id: str, run_id: str) -> None:
        """置位（幂等）：**不覆盖**更早的时刻——先到的那个才是"什么时候想停的"。"""
        async with self._conn(tenant_id) as conn:
            await conn.execute(
                f"INSERT INTO {CANCEL_TABLE} (tenant_id, run_id, requested_at)"
                " VALUES (%s, %s, %s) ON CONFLICT (tenant_id, run_id) DO NOTHING",
                (tenant_id, run_id, time.time()),
            )

    async def is_requested(self, *, tenant_id: str, run_id: str) -> bool:
        async with self._conn(tenant_id) as conn:
            cur = await conn.execute(
                f"SELECT 1 FROM {CANCEL_TABLE} WHERE tenant_id = %s AND run_id = %s",
                (tenant_id, run_id),
            )
            return await cur.fetchone() is not None


__all__ = [
    "CANCEL_TABLE",
    "CancelSignals",
    "InMemoryCancelSignals",
    "PgCancelSignals",
    "bootstrap_coordination",
]
