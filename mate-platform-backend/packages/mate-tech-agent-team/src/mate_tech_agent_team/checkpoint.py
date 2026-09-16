"""租户隔离的 langgraph 持久化（决策 D-4）。

**形态**：不改 langgraph 表结构，把租户编进 ``thread_id`` 前缀
（``<租户ID>|<任务ID>``），再用 PG 的 RLS 策略按前缀过滤。三张数据表的**首列都是
``thread_id``**，所以策略不需要额外列。

**两条实跑踩出来的硬约束**（不满足则"隔离"是假的）：

1. **建表必须由 admin 角色做，不能由 app 角色做。** PG 里表的 owner **默认绕过
   RLS**；如果用 ``mate_app`` 调 ``setup()``，它就成了 owner，于是租户 B 能看到
   租户 A 的行——而且**不报错**。故 ``bootstrap`` 走 admin DSN，运行走 app DSN。
   另加 ``FORCE ROW LEVEL SECURITY`` 作双保险。
2. **async 图必须配 ``AsyncPostgresSaver``。** 同步 ``PostgresSaver`` 配
   ``ainvoke`` 会抛 ``NotImplementedError``。

**fail-closed**：``current_setting('app.tenant_id', true)`` 在未设置时返回 NULL，
``thread_id LIKE NULL`` 为 NULL → 一行都匹配不到。忘记设租户 = 什么都读不到，
而不是读到别人的。这是设计如此。
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import psycopg
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

SCHEMA = "agent_team"

# langgraph 建的表里，前三张以 thread_id 为首列（RLS 可按前缀过滤）；
# checkpoint_migrations 没有 thread_id，是迁移记录表，不参与租户隔离。
CHECKPOINT_TABLES = ("checkpoints", "checkpoint_blobs", "checkpoint_writes")


def thread_id_for(tenant_id: str, run_id: str) -> str:
    """租户本地化的 thread 名。RLS 策略按 ``<租户ID>|`` 前缀匹配。"""
    return f"{tenant_id}|{run_id}"


_RLS_DDL = """
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
ALTER TABLE {table} FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_iso ON {table};
CREATE POLICY tenant_iso ON {table}
  USING (thread_id LIKE current_setting('app.tenant_id', true) || '|%')
  WITH CHECK (thread_id LIKE current_setting('app.tenant_id', true) || '|%');
GRANT SELECT, INSERT, UPDATE, DELETE ON {table} TO {app_role};
"""


def bootstrap(admin_dsn: str, app_role: str = "mate_app", schema: str = SCHEMA) -> None:
    """建 schema + langgraph 表 + RLS 策略。幂等。

    必须以 **admin** 身份调用——见模块 docstring 第 1 条。
    """
    with psycopg.connect(admin_dsn, autocommit=True) as conn:
        conn.execute(f"CREATE SCHEMA IF NOT EXISTS {schema}")
        conn.execute(f"GRANT USAGE ON SCHEMA {schema} TO {app_role}")
        conn.execute(f"SET search_path TO {schema}")
        # setup() 里含 CREATE INDEX CONCURRENTLY —— 连接必须 autocommit（上面已设）。
        PostgresSaver(conn).setup()
        for table in CHECKPOINT_TABLES:
            conn.execute(_RLS_DDL.format(table=table, app_role=app_role))


def _guc_statement(tenant_id: str) -> tuple[str, tuple[str]]:
    """用 set_config() 而非 ``SET x = %s``：后者不接受参数绑定。"""
    if "|" in tenant_id:
        raise ValueError("tenant_id 不得含 '|'（会破坏 thread_id 前缀约定）")
    return "select set_config('app.tenant_id', %s, false)", (tenant_id,)


class PgCheckpointerProvider:
    """按租户开一条 async 连接、设好 GUC，产出 :class:`AsyncPostgresSaver`。

    连接随 context manager 生命周期开闭；HITL 的暂停/恢复是两次独立请求，
    各自开连接——状态在 PG 里，不在连接里。
    """

    def __init__(self, dsn: str, schema: str = SCHEMA) -> None:
        self._dsn = dsn
        self._schema = schema

    @asynccontextmanager
    async def for_tenant(self, tenant_id: str) -> AsyncIterator[BaseCheckpointSaver]:
        conn = await psycopg.AsyncConnection.connect(self._dsn, autocommit=True)
        try:
            await conn.execute(f"SET search_path TO {self._schema}")
            stmt, params = _guc_statement(tenant_id)
            await conn.execute(stmt, params)
            yield AsyncPostgresSaver(conn)
        finally:
            await conn.close()


class InMemoryCheckpointerProvider:
    """无 PG 时的退化实现（测试/本地演示）。

    **注意**：它靠 thread_id 命名区分租户，隔离**不是**数据库强制的。
    真实隔离断言必须走 :class:`PgCheckpointerProvider`。
    """

    def __init__(self) -> None:
        self._saver = InMemorySaver()

    @asynccontextmanager
    async def for_tenant(self, tenant_id: str) -> AsyncIterator[BaseCheckpointSaver]:
        del tenant_id
        yield self._saver


__all__ = [
    "CHECKPOINT_TABLES",
    "SCHEMA",
    "InMemoryCheckpointerProvider",
    "PgCheckpointerProvider",
    "bootstrap",
    "thread_id_for",
]
