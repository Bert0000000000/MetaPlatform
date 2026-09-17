"""活跃 run 租约 / 心跳 / 接管（B-1 / `MP-RUN-LEASE-01`）。

**要解决的问题**：2.1-A 之前，"哪一轮正在跑"只活在**进程内存**（``RunControl._live``）。
单副本时这没问题；多副本时它意味着两件事同时失效：

1. **谁在跑没人知道**——副本 B 看不到副本 A 的名字，于是"接管"无从谈起；
2. **硬崩的 run 永远卡住**——进程被杀时释放语句根本没机会跑，占坑就锁死了。

**做法**：一张 ``active_run_lease`` 表，一行 = 一轮正在跑的 run。四个字段承担四件事：

* ``owner_instance`` —— 谁在跑（**活跃 run 注册表**就是这张表本身，不另建）
* ``lease_epoch`` —— 第几手租约。每次接管 +1；**续租与释放都带 epoch**，
  于是"上一任的延迟写"会被数据库直接拒掉（不是靠时序运气）
* ``heartbeat_at`` / ``expires_at`` —— 心跳与寿命。**TTL 可配**，长跑 run
  靠续租自己续命，于是 TTL 可以设得很短（默认 30s）而不会误伤长跑
* ``current_step`` —— 最后一次心跳时看到的最新检查点 id。接管判定用它判断
  "检查点有没有在租约失效后继续前进"

**接管不是"TTL 到了就抢"**（roadmap 锁死的口径）。:func:`decide_takeover`
要求四个条件**同时**成立——租约过期、心跳已停、检查点未进展、幂等账本里
没有在途调用。缺一条都可能是"owner 还活着只是慢"，抢了就是双重执行。

**为什么第四条查账本**：一条 ``running`` 的工具调用意味着"我们不知道那次
副作用落没落"。接管后重放它 = 把"可能发生过一次"变成"可能发生两次"，
而上限锁在 1 是 A-3 的判据（``MP-TOOL-IDEMPOTENCY-01``）。所以有在途调用
就**不接管**，如实记下原因——代价见本模块末尾的边界登记。
"""

from __future__ import annotations

import os
import time
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass, replace
from typing import Any, Protocol

import psycopg

from .tenant_db import TenantConnections, tenant_connections

SCHEMA = "agent_team"
LEASES_TABLE = "active_run_lease"

#: 租约寿命（秒）。**可配**：长跑 run 靠续租自己续命，所以这个值可以设得很短
#: ——它只需盖住"心跳间隔 + 一次网络抖动"，不需要盖住整轮执行。
DEFAULT_LEASE_TTL_SECONDS = 30.0
LEASE_TTL_ENV = "MATE_AGENT_TEAM_LEASE_TTL_SECONDS"

#: 心跳间隔（秒）。**必须显著小于 TTL**：否则一次心跳丢失就到期，长跑 run
#: 会被误判成孤儿。默认是 TTL 的 1/3。
DEFAULT_HEARTBEAT_INTERVAL_SECONDS = 10.0
HEARTBEAT_INTERVAL_ENV = "MATE_AGENT_TEAM_HEARTBEAT_SECONDS"

#: "心跳已经停了"的判据：距上次心跳超过这么久才算停。
#: 取 TTL 的量级——比心跳间隔宽，容得下一次抖动。
DEFAULT_HEARTBEAT_GRACE_SECONDS = 30.0


def _env_float(name: str, default: float) -> float:
    try:
        return max(0.0, float(os.getenv(name, str(default))))
    except ValueError:
        return default


def configured_lease_ttl() -> float:
    return _env_float(LEASE_TTL_ENV, DEFAULT_LEASE_TTL_SECONDS)


def configured_heartbeat_interval() -> float:
    """心跳间隔。**硬夹在 TTL/3 以内**——配置写大了会直接把误接管变成常态。"""
    ttl = configured_lease_ttl()
    want = _env_float(HEARTBEAT_INTERVAL_ENV, DEFAULT_HEARTBEAT_INTERVAL_SECONDS)
    if ttl <= 0:
        return want
    return min(want, max(ttl / 3.0, 0.001))


def new_instance_id() -> str:
    """本进程的实例标识（进 ``owner_instance``，用于"谁在跑"与审计）。"""
    return f"{os.getpid()}-{uuid.uuid4().hex[:8]}"


@dataclass(frozen=True, slots=True)
class RunLease:
    """``active_run_lease`` 的一行：**此刻**谁在跑这一轮。"""

    tenant_id: str
    run_id: str
    owner_instance: str
    lease_epoch: int
    heartbeat_at: float
    expires_at: float
    current_step: str = ""
    acquired_at: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "run_id": self.run_id,
            "owner_instance": self.owner_instance,
            "lease_epoch": self.lease_epoch,
            "heartbeat_at": self.heartbeat_at,
            "expires_at": self.expires_at,
            "current_step": self.current_step,
        }


# ── 接管判定（纯函数：好测，也好读）─────────────────────────────────────


@dataclass(frozen=True, slots=True)
class TakeoverDecision:
    """接管结论 + **原因**。原因要能读——"为什么没接管"是运维最常问的那句。"""

    take: bool
    reason: str

    def to_dict(self) -> dict[str, Any]:
        return {"take": self.take, "reason": self.reason}


def decide_takeover(
    lease: RunLease | None,
    *,
    now: float,
    checkpoint_step: str,
    running_invocations: int,
    heartbeat_grace: float = DEFAULT_HEARTBEAT_GRACE_SECONDS,
) -> TakeoverDecision:
    """四个条件**全中**才接管（roadmap 锁死的口径，别退化成只看 TTL）。

    顺序是按"最便宜的否决先说"排的：租约还活着就根本不用往下查。

    * ``lease is None`` —— 无租约却有未完成的检查点：**孤儿**（崩在写租约之前，
      或租约行被清理）。这是唯一"无条件接管"的情形，因为没有第二个人在跑。
    * 租约未过期 —— 有人正拿着 → 不接管。
    * 心跳是新的 —— 它还在动 → 不接管（哪怕租约刚好过期）。
    * 检查点前进了 —— 租约失效之后仍有推进 → 说明有个没续租的活人在写 → 不接管。
    * 账本里还有 ``running`` 调用 —— 重放它可能造成第二次副作用 → 不接管。
    """
    if lease is None:
        return TakeoverDecision(True, "orphan_no_lease")
    if lease.expires_at > now:
        return TakeoverDecision(False, "lease_alive")
    if now - lease.heartbeat_at < heartbeat_grace:
        return TakeoverDecision(False, "heartbeat_fresh")
    if lease.current_step and checkpoint_step and checkpoint_step > lease.current_step:
        # 比较用的是 langgraph 的 ``checkpoint_id``（**UUIDv6，时间有序**），
        # 所以字符串序就是时间序，``>`` 读作"比我记下的那一步更晚"。
        # 只在两边都有值时才判——租约刚建就崩（还没心跳过一次）时它记的是空串，
        # 那种情况不该被当成"进展了"，否则孤儿永远接管不了。
        return TakeoverDecision(False, "checkpoint_advanced")
    if running_invocations > 0:
        return TakeoverDecision(False, "tool_in_flight")
    return TakeoverDecision(True, "expired_and_quiet")


# ── 面 ──────────────────────────────────────────────────────────────────


class RunLeases(Protocol):
    """活跃 run 租约面。``acquire`` 必须是**原子**的（同 ``RunClaims`` 的理由）。"""

    async def acquire(
        self,
        *,
        tenant_id: str,
        run_id: str,
        owner: str,
        ttl: float,
        current_step: str = "",
    ) -> RunLease | None: ...

    async def renew(
        self,
        *,
        tenant_id: str,
        run_id: str,
        owner: str,
        epoch: int,
        ttl: float,
        current_step: str = "",
    ) -> bool: ...

    async def release(self, *, tenant_id: str, run_id: str, owner: str, epoch: int) -> None: ...

    async def get(self, *, tenant_id: str, run_id: str) -> RunLease | None: ...

    async def active(self, *, tenant_id: str) -> list[RunLease]: ...


class InMemoryRunLeases:
    """进程内实现：单副本部署与测试的默认。

    两个 ``RunControl`` **共享同一个它**时，就等于"两个副本共享一张租约表"
    ——多副本用例的同进程模拟就是这么做（真进程的用例在
    ``tests/test_replica_two_process.py``）。
    """

    def __init__(self, ttl: float = DEFAULT_LEASE_TTL_SECONDS) -> None:
        self._ttl = max(0.0, ttl)
        self._rows: dict[tuple[str, str], RunLease] = {}

    async def acquire(
        self,
        *,
        tenant_id: str,
        run_id: str,
        owner: str,
        ttl: float,
        current_step: str = "",
    ) -> RunLease | None:
        now = time.time()
        effective = max(0.0, ttl) or self._ttl
        held = self._rows.get((tenant_id, run_id))
        if held is not None and held.expires_at > now and held.owner_instance != owner:
            return None
        epoch = (held.lease_epoch + 1) if held is not None else 1
        row = RunLease(
            tenant_id=tenant_id,
            run_id=run_id,
            owner_instance=owner,
            lease_epoch=epoch,
            heartbeat_at=now,
            expires_at=now + effective,
            current_step=current_step,
            acquired_at=now,
        )
        self._rows[(tenant_id, run_id)] = row
        return row

    async def renew(
        self,
        *,
        tenant_id: str,
        run_id: str,
        owner: str,
        epoch: int,
        ttl: float,
        current_step: str = "",
    ) -> bool:
        held = self._rows.get((tenant_id, run_id))
        if held is None or held.owner_instance != owner or held.lease_epoch != epoch:
            return False  # 已经被接管了：续租失败是**信号**，不是噪音
        now = time.time()
        self._rows[(tenant_id, run_id)] = replace(
            held,
            heartbeat_at=now,
            expires_at=now + (max(0.0, ttl) or self._ttl),
            current_step=current_step or held.current_step,
        )
        return True

    async def release(self, *, tenant_id: str, run_id: str, owner: str, epoch: int) -> None:
        held = self._rows.get((tenant_id, run_id))
        if held is None or held.owner_instance != owner or held.lease_epoch != epoch:
            return  # 已经换手：别把新主人的租约删掉
        self._rows.pop((tenant_id, run_id), None)

    async def get(self, *, tenant_id: str, run_id: str) -> RunLease | None:
        return self._rows.get((tenant_id, run_id))

    async def active(self, *, tenant_id: str) -> list[RunLease]:
        return [row for key, row in self._rows.items() if key[0] == tenant_id]


# ── PG 实现 ─────────────────────────────────────────────────────────────

_TABLE_DDL = f"""
CREATE TABLE IF NOT EXISTS {LEASES_TABLE} (
    tenant_id      TEXT NOT NULL,
    run_id         TEXT NOT NULL,
    owner_instance TEXT NOT NULL,
    lease_epoch    INTEGER NOT NULL,
    heartbeat_at   DOUBLE PRECISION NOT NULL,
    expires_at     DOUBLE PRECISION NOT NULL,
    current_step   TEXT NOT NULL DEFAULT '',
    acquired_at    DOUBLE PRECISION NOT NULL DEFAULT 0,
    PRIMARY KEY (tenant_id, run_id)
)
"""

_RLS_DDL = """
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
ALTER TABLE {table} FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_iso ON {table};
CREATE POLICY tenant_iso ON {table}
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON {table} TO {app_role};
"""

#: 抢租约那一**条**语句（同 ``RunClaims`` 的成功先例）：没有就插、可接管就顶上、
#: 别人正拿着就**既不更新也不返回**（``RETURNING`` 空手而归）。
#:
#: 两个条件里的第二个 ``owner_instance = EXCLUDED.owner_instance`` 是给**同一实例
#: 重入**用的（续跑自己那轮）；第一个 ``expires_at <= now`` 才是跨副本接管。
#: ``lease_epoch`` 每次 +1 —— 于是上一任的延迟续租/释放会被 epoch 判据挡掉。
_ACQUIRE_SQL = f"""
INSERT INTO {LEASES_TABLE} (
    tenant_id, run_id, owner_instance, lease_epoch,
    heartbeat_at, expires_at, current_step, acquired_at
) VALUES (%s, %s, %s, 1, %s, %s, %s, %s)
ON CONFLICT (tenant_id, run_id) DO UPDATE
   SET owner_instance = EXCLUDED.owner_instance,
       lease_epoch    = {LEASES_TABLE}.lease_epoch + 1,
       heartbeat_at   = EXCLUDED.heartbeat_at,
       expires_at     = EXCLUDED.expires_at,
       current_step   = EXCLUDED.current_step,
       acquired_at    = EXCLUDED.acquired_at
 WHERE {LEASES_TABLE}.expires_at <= %s
    OR {LEASES_TABLE}.owner_instance = EXCLUDED.owner_instance
RETURNING owner_instance, lease_epoch, heartbeat_at, expires_at, current_step, acquired_at
"""

_RENEW_SQL = f"""
UPDATE {LEASES_TABLE}
   SET heartbeat_at = %s, expires_at = %s, current_step = %s
 WHERE tenant_id = %s AND run_id = %s AND owner_instance = %s AND lease_epoch = %s
RETURNING lease_epoch
"""

_RELEASE_SQL = f"DELETE FROM {LEASES_TABLE} WHERE tenant_id = %s AND run_id = %s AND owner_instance = %s AND lease_epoch = %s"

_SELECT_SQL = (
    "SELECT tenant_id, run_id, owner_instance, lease_epoch, heartbeat_at, expires_at,"
    f" current_step, acquired_at FROM {LEASES_TABLE} WHERE tenant_id = %s AND run_id = %s"
)

_SELECT_ACTIVE_SQL = (
    "SELECT tenant_id, run_id, owner_instance, lease_epoch, heartbeat_at, expires_at,"
    f" current_step, acquired_at FROM {LEASES_TABLE}"
    " WHERE tenant_id = %s AND expires_at > %s ORDER BY acquired_at"
)


def bootstrap_run_leases(conn: psycopg.Connection[Any], app_role: str = "mate_app") -> None:
    """建租约表 + RLS（幂等）。``conn`` 必须是 **admin** 连接。"""
    conn.execute(_TABLE_DDL)
    conn.execute(_RLS_DDL.format(table=LEASES_TABLE, app_role=app_role))


def _row(row: tuple[Any, ...]) -> RunLease:
    return RunLease(
        tenant_id=str(row[0]),
        run_id=str(row[1]),
        owner_instance=str(row[2]),
        lease_epoch=int(row[3]),
        heartbeat_at=float(row[4] or 0.0),
        expires_at=float(row[5] or 0.0),
        current_step=str(row[6] or ""),
        acquired_at=float(row[7] or 0.0),
    )


class PgRunLeases:
    """PG 实现：真·多副本共享。原子性由那一条 SQL 保证。"""

    def __init__(
        self,
        dsn: str | TenantConnections,
        schema: str = SCHEMA,
        ttl: float = DEFAULT_LEASE_TTL_SECONDS,
    ) -> None:
        self._conns = tenant_connections(dsn, schema=schema)
        self._ttl = max(0.0, ttl)

    @asynccontextmanager
    async def _conn(self, tenant_id: str) -> AsyncIterator[psycopg.AsyncConnection[Any]]:
        async with self._conns.for_tenant(tenant_id) as conn:
            yield conn

    async def acquire(
        self,
        *,
        tenant_id: str,
        run_id: str,
        owner: str,
        ttl: float,
        current_step: str = "",
    ) -> RunLease | None:
        now = time.time()
        effective = max(0.0, ttl) or self._ttl
        async with self._conn(tenant_id) as conn:
            cur = await conn.execute(
                _ACQUIRE_SQL,
                (
                    tenant_id,
                    run_id,
                    owner,
                    now,
                    now + effective,
                    current_step,
                    now,
                    now,
                ),
            )
            row = await cur.fetchone()
        if row is None:
            return None
        return replace(_row((tenant_id, run_id, *row)), tenant_id=tenant_id, run_id=run_id)

    async def renew(
        self,
        *,
        tenant_id: str,
        run_id: str,
        owner: str,
        epoch: int,
        ttl: float,
        current_step: str = "",
    ) -> bool:
        now = time.time()
        effective = max(0.0, ttl) or self._ttl
        async with self._conn(tenant_id) as conn:
            cur = await conn.execute(
                _RENEW_SQL, (now, now + effective, current_step, tenant_id, run_id, owner, epoch)
            )
            return await cur.fetchone() is not None

    async def release(self, *, tenant_id: str, run_id: str, owner: str, epoch: int) -> None:
        async with self._conn(tenant_id) as conn:
            await conn.execute(_RELEASE_SQL, (tenant_id, run_id, owner, epoch))

    async def get(self, *, tenant_id: str, run_id: str) -> RunLease | None:
        async with self._conn(tenant_id) as conn:
            cur = await conn.execute(_SELECT_SQL, (tenant_id, run_id))
            row = await cur.fetchone()
        return _row(row) if row else None

    async def active(self, *, tenant_id: str) -> list[RunLease]:
        async with self._conn(tenant_id) as conn:
            cur = await conn.execute(_SELECT_ACTIVE_SQL, (tenant_id, time.time()))
            rows = await cur.fetchall()
        return [_row(row) for row in rows]


__all__ = [
    "DEFAULT_HEARTBEAT_GRACE_SECONDS",
    "DEFAULT_HEARTBEAT_INTERVAL_SECONDS",
    "DEFAULT_LEASE_TTL_SECONDS",
    "HEARTBEAT_INTERVAL_ENV",
    "LEASE_TTL_ENV",
    "LEASES_TABLE",
    "InMemoryRunLeases",
    "PgRunLeases",
    "RunLease",
    "RunLeases",
    "TakeoverDecision",
    "bootstrap_run_leases",
    "configured_heartbeat_interval",
    "configured_lease_ttl",
    "decide_takeover",
    "new_instance_id",
]
