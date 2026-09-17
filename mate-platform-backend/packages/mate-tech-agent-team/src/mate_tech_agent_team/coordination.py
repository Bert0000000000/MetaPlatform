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

import os
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any, Protocol

import psycopg

from .tenant_db import TenantConnections, tenant_connections

SCHEMA = "agent_team"
CANCEL_TABLE = "cancel_signals"
CLAIMS_TABLE = "run_claims"

#: 认领的寿命（秒）：超过它的占坑可以被接管。0 = 立刻可接管。
#:
#: 为什么要有寿命：占坑随执行结束释放，但**硬崩**（进程被杀）时那条释放语句根本
#: 没机会跑。没有寿命的话，那把钥匙就被永久锁死了——重提只会被去重到一个压根
#: 没有检查点的 run_id（查它永远是 404），比原来那个竞态更糟。
#:
#: 默认 30 秒：它只需要盖住"受理 → 第一次落检查点"那段窗口（实测毫秒级，
#: ``DEFAULT_READY_TIMEOUT`` 也才等 5 秒）。认领过期**不会**让同一把钥匙起第二轮
#: ——到期接管之后还要再过一道"查检查点"，真跑过的那一轮照样被去重。
DEFAULT_CLAIM_TTL_SECONDS = 30.0
CLAIM_TTL_ENV = "MATE_AGENT_TEAM_CLAIM_TTL_SECONDS"


def configured_claim_ttl() -> float:
    try:
        return max(0.0, float(os.getenv(CLAIM_TTL_ENV, str(DEFAULT_CLAIM_TTL_SECONDS))))
    except ValueError:
        return DEFAULT_CLAIM_TTL_SECONDS


_CANCEL_DDL = f"""
CREATE TABLE IF NOT EXISTS {CANCEL_TABLE} (
    tenant_id    TEXT NOT NULL,
    run_id       TEXT NOT NULL,
    requested_at DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (tenant_id, run_id)
)
"""

_CLAIMS_DDL = f"""
CREATE TABLE IF NOT EXISTS {CLAIMS_TABLE} (
    tenant_id       TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    run_id          TEXT NOT NULL,
    claimed_at      DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (tenant_id, idempotency_key)
)
"""

#: 抢坑的那**一条**语句：没有就插、过期就接管、新鲜就让位，全在一次往返里完成。
#: 条件是挂在 ``DO UPDATE`` 上的——不成立时那一行**既不更新也不返回**，于是
#: ``RETURNING`` 空手而归 = 别人正占着。写成"先 SELECT 再 INSERT"就会把窗口还
#: 回去，而这个模块存在的理由正是堵住它。
_CLAIM_SQL = (
    f"INSERT INTO {CLAIMS_TABLE} (tenant_id, idempotency_key, run_id, claimed_at)"
    " VALUES (%s, %s, %s, %s)"
    " ON CONFLICT (tenant_id, idempotency_key) DO UPDATE"
    "   SET run_id = EXCLUDED.run_id, claimed_at = EXCLUDED.claimed_at"
    f"   WHERE {CLAIMS_TABLE}.claimed_at < %s"
    " RETURNING run_id"
)

#: 与 ``team_task`` / ``artifact`` 用的是**同一套**策略写法：按 ``tenant_id`` 列
#: 直接比 GUC（不用 thread_id 前缀——这两张表不是 langgraph 的表）。
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
    conn.execute(_CLAIMS_DDL)
    for table in (CANCEL_TABLE, CLAIMS_TABLE):
        conn.execute(_RLS_DDL.format(table=table, app_role=app_role))


class CancelSignals(Protocol):
    """取消信号的共享通道。

    ``request`` 只置不清（幂等）；``is_requested`` 是图在**波边界**问的那一句。
    两个方法都按 ``(租户, run)`` 定位——取消是**按轮**的，不是全局开关。
    """

    async def request(self, *, tenant_id: str, run_id: str) -> None: ...

    async def is_requested(self, *, tenant_id: str, run_id: str) -> bool: ...

    async def clear(self, *, tenant_id: str, run_id: str) -> None:
        """**归档**：只在该轮已落终态之后调用（B-3）。

        信号"只置不清"是对的——置清之间的窗口里，另一副本的图正好走到边界就
        看不到它。但轮子跑完之后它就没有意义了，留着会让这张表随"被取消过的
        run 数"一直涨。清的条件因此不是"多久之后"，而是"**这一轮已经不可能
        再有人问它了**"（终态）。
        """
        ...


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

    async def clear(self, *, tenant_id: str, run_id: str) -> None:
        self._requested.discard((tenant_id, run_id))


class PgCancelSignals:
    """PG 实现：真·多副本共享。连接随每次调用开闭（信号是低频操作）。"""

    def __init__(self, dsn: str | TenantConnections, schema: str = SCHEMA) -> None:
        self._conns = tenant_connections(dsn, schema=schema)

    @asynccontextmanager
    async def _conn(self, tenant_id: str) -> AsyncIterator[psycopg.AsyncConnection[Any]]:
        # 租户上下文走 tenant_db：**事务级** GUC + 归还前 RESET（B-5）。
        async with self._conns.for_tenant(tenant_id) as conn:
            yield conn

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

    async def clear(self, *, tenant_id: str, run_id: str) -> None:
        """归档一行的信号（**只在那一轮已落终态之后调**，见 Protocol 的说明）。"""
        async with self._conn(tenant_id) as conn:
            await conn.execute(
                f"DELETE FROM {CANCEL_TABLE} WHERE tenant_id = %s AND run_id = %s",
                (tenant_id, run_id),
            )


class RunClaims(Protocol):
    """幂等认领的共享通道：谁先认领到 ``(租户, 幂等键)``，谁负责真去跑那一轮。

    ``claim`` 必须是**原子**的：先查一次再写一次会留一个读后写窗口，两个副本
    正好都在窗口里就都拿到了——那正是这个模块要治的东西。
    """

    async def claim(self, *, tenant_id: str, key: str, run_id: str) -> bool: ...

    async def release(self, *, tenant_id: str, key: str) -> None: ...


class InMemoryRunClaims:
    """进程内实现：单副本部署与测试的默认。

    两个 ``RunControl`` 实例**共享同一个它**时，就等于"两个副本共享一把锁"——
    多副本用例就是这么模拟的。
    """

    def __init__(self, ttl: float = DEFAULT_CLAIM_TTL_SECONDS) -> None:
        self._ttl = max(0.0, ttl)
        self._rows: dict[tuple[str, str], float] = {}

    async def claim(self, *, tenant_id: str, key: str, run_id: str) -> bool:
        del run_id  # 认领只回答"谁先来"；地址由确定性 run_id 单独保证
        now = time.time()
        held_since = self._rows.get((tenant_id, key))
        if held_since is not None and now - held_since < self._ttl:
            return False
        self._rows[(tenant_id, key)] = now
        return True

    async def release(self, *, tenant_id: str, key: str) -> None:
        self._rows.pop((tenant_id, key), None)


class PgRunClaims:
    """PG 实现：真·多副本共享，认领的原子性由**那一条 SQL** 保证。"""

    def __init__(
        self,
        dsn: str | TenantConnections,
        schema: str = SCHEMA,
        ttl: float = DEFAULT_CLAIM_TTL_SECONDS,
    ):
        self._conns = tenant_connections(dsn, schema=schema)
        self._ttl = max(0.0, ttl)

    @asynccontextmanager
    async def _conn(self, tenant_id: str) -> AsyncIterator[psycopg.AsyncConnection[Any]]:
        # 租户上下文走 tenant_db：**事务级** GUC + 归还前 RESET（B-5）。
        async with self._conns.for_tenant(tenant_id) as conn:
            yield conn

    async def claim(self, *, tenant_id: str, key: str, run_id: str) -> bool:
        """抢坑（原子）。返回 ``True`` = 这一个副本负责真去跑那一轮。"""
        now = time.time()
        async with self._conn(tenant_id) as conn:
            cur = await conn.execute(_CLAIM_SQL, (tenant_id, key, run_id, now, now - self._ttl))
            return await cur.fetchone() is not None

    async def release(self, *, tenant_id: str, key: str) -> None:
        async with self._conn(tenant_id) as conn:
            await conn.execute(
                f"DELETE FROM {CLAIMS_TABLE} WHERE tenant_id = %s AND idempotency_key = %s",
                (tenant_id, key),
            )


__all__ = [
    "CANCEL_TABLE",
    "CLAIMS_TABLE",
    "CLAIM_TTL_ENV",
    "DEFAULT_CLAIM_TTL_SECONDS",
    "CancelSignals",
    "InMemoryCancelSignals",
    "InMemoryRunClaims",
    "PgCancelSignals",
    "PgRunClaims",
    "RunClaims",
    "bootstrap_coordination",
    "configured_claim_ttl",
]
