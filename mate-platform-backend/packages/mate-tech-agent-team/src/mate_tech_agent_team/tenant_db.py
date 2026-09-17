"""租户安全的连接来源（B-5 / `MP-RUNTIME-DB-POOL-01`）。

**这不是性能模块，是安全模块。** 加它之前，本服务有 8 处
``AsyncConnection.connect → set_config('app.tenant_id', %s, **false**) → close``：
第三个参数 ``false`` = **会话级** GUC，它在连接关闭前一直有效。之所以一直没出
事，纯粹因为**每条连接用完就关**——会话级设置随连接一起消失。一旦上连接池，
归还的连接会**带着上一个租户的** ``app.tenant_id`` 进入下一个请求，而 RLS 策略
恰好就是读这个值做判定的（``USING (tenant_id = current_setting('app.tenant_id'))``）
→ **隔离静默失效，没有任何报错**。

所以本模块把两件事一起做掉，缺一不可：

1. **事务级 GUC**（默认路径）：``set_config('app.tenant_id', %s, true)`` 加
   ``SET LOCAL search_path``，都在显式事务里。事务一结束（提交或回滚）PG 自己
   就把它们丢掉，连接**凭数据库语义**就是干净的——不依赖任何一方记得清理。
2. **归还前 RESET**（两条路径都做）：池的 putback 钩子无条件执行
   ``RESET ALL``。这是给 ``autocommit`` 那条路（langgraph 的 checkpointer，
   它自己管事务边界，只能设会话级 GUC）兜底的**唯一**机制，同时也是给事务级
   路径的第二道网。

**判据在测试里，不在注释里**：``tests/test_tenant_db.py`` 会真的把一条连接借给
租户 A、还回去、再借给租户 B，断言 B 看到的 GUC 是**空**的——而且是在**同一条
物理连接**上（``pg_backend_pid()`` 相等）。

**控制面身份**（:meth:`TenantConnections.for_control_plane`）是另一件事：跨租户
的恢复扫描要读**所有**租户的行，那是控制面的活，不该由业务 pod 用 admin 凭据
去干（B-4）。这里只提供"不设租户 GUC"的连接形态，**身份由 DSN 决定**。
"""

from __future__ import annotations

import os
import re
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from typing import Any

from psycopg import AsyncConnection
from psycopg.pq import TransactionStatus

SCHEMA = "agent_team"

#: 租户上下文的 GUC 名（与各表 RLS 策略里 ``current_setting(...)`` 的名字一致）。
TENANT_GUC = "app.tenant_id"

#: 池的最大连接数。0 = **不池化**（每次真开一条，行为与加这个模块之前一致）。
POOL_MAX_ENV = "MATE_AGENT_TEAM_POOL_MAX"

#: schema 名会拼进 SQL（``SET LOCAL search_path TO <schema>`` 不接受参数绑定），
#: 所以只放行普通标识符。``agent_team`` 与测试用的 ``agent_team_rls_test`` 都过。
_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")

DEFAULT_MAX_SIZE = 8


def configured_pool_max() -> int:
    """池上限：环境变量说了算，缺省 8，非法值退回默认（不静默变 0=不池化）。"""
    raw = os.getenv(POOL_MAX_ENV, "")
    if not raw:
        return DEFAULT_MAX_SIZE
    try:
        value = int(raw)
    except ValueError:
        return DEFAULT_MAX_SIZE
    return max(0, value)


def _checked_schema(schema: str) -> str:
    if not _IDENTIFIER.match(schema):
        raise ValueError(f"schema 必须是普通标识符：{schema!r}")
    return schema


async def _reset_on_putback(conn: AsyncConnection[Any]) -> None:
    """池的归还钩子：**无条件**把会话状态清干净。

    ``RESET ALL`` 把包括 ``app.tenant_id`` 在内的全部会话级 GUC 打回默认值。
    先 rollback 是因为连接回来时可能还挂着一个未结束的事务（调用方抛异常、
    或 langgraph 那条 autocommit 路径留了半截）——``RESET ALL`` 在事务里也能跑，
    但先回滚语义更干净：那条事务**不该**被提交。
    """
    if conn.info.transaction_status != TransactionStatus.IDLE:
        await conn.rollback()
    await conn.execute("RESET ALL")
    # ``RESET ALL`` 自己会**开一个新事务**（非 autocommit 连接上）。
    # 不把它收掉的话，池会判定"归还的连接还挂在 INTRANS 里"并把它**丢弃**——
    # 表现为池永远建不满、"复用"这件事根本没发生（实测：pid 每次都变）。
    if conn.info.transaction_status != TransactionStatus.IDLE:
        await conn.commit()


def _new_connection_configure(
    autocommit: bool,
) -> Callable[[AsyncConnection[Any]], Awaitable[None]]:
    """池里新连接的初值。

    **必须**走 ``await conn.set_autocommit(...)``：async 连接上 ``conn.autocommit = x``
    是只读属性，直接赋值会让**每一次建连都失败**，而池的报错只在后台任务里刷
    （表象是 30 秒后 ``PoolTimeout``，不是一句"你写错了"）。
    """

    async def _configure(conn: AsyncConnection[Any]) -> None:
        await conn.set_autocommit(autocommit)

    return _configure


class TenantConnections:
    """租户安全的连接来源：可池化，且**保证归还的连接不带上一个租户**。

    ``dsn`` 必须是**受 RLS 约束的 app 角色**（``mate_app``）——用 owner 角色
    会绕过 RLS，那这套隔离就等于没有（教训见 :mod:`mate_tech_agent_team.checkpoint`）。

    ``pool=False``（或 ``max_size=0``）时退化成"每次开一条、用完关掉"：单次脚本与
    测试的形态，行为与加这个模块之前逐字一致。生产由 ``wiring`` 传共享的池化实例。
    """

    def __init__(
        self,
        dsn: str,
        *,
        schema: str = SCHEMA,
        autocommit: bool = False,
        max_size: int = DEFAULT_MAX_SIZE,
    ) -> None:
        self._dsn = dsn
        self._schema = _checked_schema(schema)
        self._autocommit = autocommit
        self._max_size = max(0, max_size)
        self._pool: Any = None

    # -- 构造 / 收尾 --------------------------------------------------------
    @property
    def pooled(self) -> bool:
        return self._pool is not None

    async def open(self) -> None:
        """建池。**不池化时是 no-op**（没有要建的东西）。可重复调用。"""
        if self._max_size == 0 or self._pool is not None:
            return
        from psycopg_pool import AsyncConnectionPool

        pool: AsyncConnectionPool = AsyncConnectionPool(
            self._dsn,
            min_size=1,
            max_size=self._max_size,
            open=False,
            configure=_new_connection_configure(self._autocommit),
            reset=_reset_on_putback,
        )
        await pool.open(wait=False)
        self._pool = pool

    async def aclose(self) -> None:
        if self._pool is not None:
            await self._pool.close()
            self._pool = None

    # -- 取用 --------------------------------------------------------------
    @asynccontextmanager
    async def _acquire(self) -> AsyncIterator[AsyncConnection[Any]]:
        """拿一条连接。池化时走池（归还即 ``RESET ALL``）；否则现开现关。

        不池化那条路**不会泄漏**：连接在 ``finally`` 里被真正关闭，会话级 GUC
        随连接一起消失——这正是加这个模块之前能work的原因，保留它作为退路。
        """
        if self._pool is not None:
            async with self._pool.connection() as conn:
                yield conn
            return
        conn = await AsyncConnection.connect(self._dsn, autocommit=self._autocommit)
        try:
            yield conn
        finally:
            await conn.close()

    @asynccontextmanager
    async def for_tenant(self, tenant_id: str) -> AsyncIterator[AsyncConnection[Any]]:
        """带租户上下文的连接（**默认事务级**，出块即失效）。

        块内所有语句处在**同一个事务**里：调用方拿到的不是"一条设过 GUC 的连接"，
        而是"一个属于该租户的事务"。异常会把整个事务回滚掉——这也是 RLS 之外的
        一层正确性（半截写入不会落库）。

        ``autocommit=True`` 的实例（给 langgraph 的 checkpointer 用）走**会话级**
        GUC：它自己管事务边界，外头套一层事务会把它的语义改掉。那条路的安全性
        由池的归还钩子（``RESET ALL``）保证，不由此处。
        """
        if not tenant_id:
            raise ValueError("租户上下文不能为空（硬规则 3：没有 tenant 上下文不访问 repository）")
        if "|" in tenant_id:
            # ``|`` 是检查点 thread_id 的分隔符（``<租户>|<run>``），也是 RLS 策略
            # ``thread_id LIKE current_setting(...) || '|%'`` 的锚点。租户名里带它，
            # 前缀匹配就不再等价于租户相等——那是**静默**的跨租户串读。
            raise ValueError("tenant_id 不得含 '|'（会破坏 thread_id 前缀约定）")
        async with self._acquire() as conn:
            if self._autocommit:
                await conn.execute(f"SET search_path TO {self._schema}")
                await conn.execute(f"select set_config('{TENANT_GUC}', %s, false)", (tenant_id,))
                yield conn
                return
            async with conn.transaction():
                await conn.execute(f"SET LOCAL search_path TO {self._schema}")
                await conn.execute(f"select set_config('{TENANT_GUC}', %s, true)", (tenant_id,))
                yield conn

    @asynccontextmanager
    async def for_control_plane(self) -> AsyncIterator[AsyncConnection[Any]]:
        """**不设租户 GUC** 的连接——给跨租户的控制面扫描用（B-4）。

        这里刻意不设任何租户：能不能看到别的租户，**完全由 DSN 的角色**决定
        （控制面身份 vs 受 RLS 约束的 app 角色）。把"我能看到几个租户"这件事
        从代码里的布尔开关，挪回数据库的角色上——那条线才是可审计的。
        """
        async with self._acquire() as conn:
            if self._autocommit:
                await conn.execute(f"SET search_path TO {self._schema}")
                yield conn
                return
            async with conn.transaction():
                # 非 autocommit 时 ``SET LOCAL`` 必须在事务块里，否则 PG 只发一句
                # warning 然后**什么都不做**——search_path 悄悄留在默认值上。
                await conn.execute(f"SET LOCAL search_path TO {self._schema}")
                yield conn


def tenant_connections(
    source: str | TenantConnections, *, schema: str = SCHEMA, autocommit: bool = False
) -> TenantConnections:
    """把"DSN 或已建好的连接源"统一成 :class:`TenantConnections`。

    传字符串时**不建池**：创建池要求当下有活的事件循环，而且谁会关它没有答案。
    单次脚本与测试因此拿到的是"现开现关"的安全形态；生产装配（``wiring``）显式
    建一个共享的池化实例传进来，由它统一在关停时 ``aclose()``。

    ``autocommit=True`` 只给 langgraph 的 checkpointer 用（它自己管事务边界）。
    """
    if isinstance(source, TenantConnections):
        return source
    return TenantConnections(source, schema=schema, autocommit=autocommit, max_size=0)


__all__ = [
    "DEFAULT_MAX_SIZE",
    "POOL_MAX_ENV",
    "SCHEMA",
    "TENANT_GUC",
    "TenantConnections",
    "configured_pool_max",
    "tenant_connections",
]
