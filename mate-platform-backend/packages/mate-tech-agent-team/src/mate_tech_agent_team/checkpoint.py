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
from dataclasses import dataclass

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
    """建 schema + langgraph 表 + 员工身份表 + 任务实例表 + 产出物表 + 协作面表 +
    RLS 策略。幂等。

    必须以 **admin** 身份调用——见模块 docstring 第 1 条。
    """
    from .artifact_store import bootstrap_artifacts
    from .coordination import bootstrap_coordination
    from .profile_store import bootstrap_profiles
    from .team_task_store import bootstrap_tasks

    with psycopg.connect(admin_dsn, autocommit=True) as conn:
        conn.execute(f"CREATE SCHEMA IF NOT EXISTS {schema}")
        conn.execute(f"GRANT USAGE ON SCHEMA {schema} TO {app_role}")
        conn.execute(f"SET search_path TO {schema}")
        # setup() 里含 CREATE INDEX CONCURRENTLY —— 连接必须 autocommit（上面已设）。
        PostgresSaver(conn).setup()
        for table in CHECKPOINT_TABLES:
            conn.execute(_RLS_DDL.format(table=table, app_role=app_role))
        # 1.1 任务 3：员工身份同库同 schema，同一套守门。
        bootstrap_profiles(conn, app_role=app_role)
        # 1.2 任务 2：任务实例（含 inbox）同库同 schema，同一套守门。
        bootstrap_tasks(conn, app_role=app_role)
        # 1.6 任务 2：产出物（artifact）同库同 schema，同一套守门。
        bootstrap_artifacts(conn, app_role=app_role)
        # 1.9 任务 2/3：取消信号 + 幂等认领同库同 schema，同一套守门。
        # 它的表名不带 schema 前缀，落在上面的 search_path 里——**建表位置只有
        # 这一处说了算**，``coordination`` 那份默认值只用于不指定 schema 的调用。
        bootstrap_coordination(conn, app_role=app_role)


def _guc_statement(tenant_id: str) -> tuple[str, tuple[str]]:
    """用 set_config() 而非 ``SET x = %s``：后者不接受参数绑定。"""
    if "|" in tenant_id:
        raise ValueError("tenant_id 不得含 '|'（会破坏 thread_id 前缀约定）")
    return "select set_config('app.tenant_id', %s, false)", (tenant_id,)


#: 扫"没跑完的 run"时，读的是**最新那条检查点**里的状态字段。
#: 状态键在 langgraph 的 checkpoint JSONB 里，路径固定；这里只在读，不写。
_STATUS_QUERY = """
SELECT DISTINCT ON (thread_id) thread_id, checkpoint -> 'channel_values' ->> 'status' AS status
FROM {schema}.checkpoints
WHERE checkpoint_ns = ''
ORDER BY thread_id, checkpoint_id DESC
"""


@dataclass(frozen=True, slots=True)
class UnfinishedRun:
    """一个"可能还没跑完"的 run 的地址（租户 + run_id + 最后见到的状态）。

    它不是第二份 run 状态——状态仍然只在检查点里。这里只是**索引**：
    让启动扫描知道该去哪儿续，而不必把整份状态搬出来。
    """

    tenant_id: str
    run_id: str
    status: str = ""


def list_unfinished(
    dsn: str,
    *,
    statuses: frozenset[str],
    schema: str = SCHEMA,
    connect_timeout: int = 5,
) -> list[UnfinishedRun]:
    """列出检查点里**状态落在 ``statuses`` 里**的 run（跨租户，供启动扫描用）。

    为什么要给状态当参数、而不是"只要不是终态就都算"：停在 ``awaiting_approval``
    的 run 也是"不是终态"，但它是在**等人**——扫描把它捞回来，控制面就得为它建
    一次图、开一次连接去确认"哦，它不用续"，代价随堆积的 run 数线性涨。筛选条件
    放进查询里，启动扫描的代价只跟**真的需要续跑**的 run 数有关。

    两条实现上的取舍，都写在这里免得后人当成 bug：

    * **读的是检查点的 JSONB，不是 langgraph 的 API**。逐条 ``get_state`` 要按
      租户开连接、逐个把图建起来，启动扫描的代价会随 run 数线性膨胀；而
      "最新一条检查点的 ``channel_values.status``"就是同一份事实的紧凑形态。
      代价是耦合了 checkpoint 的序列化结构——本函数是**只读**的，坏了也只影响
      "能不能扫到"，不影响 run 本身。
    * **要用能看见全部租户的连接**（admin DSN）。检查点表的 RLS 是 fail-closed：
      带着 app 角色、又没有 ``app.tenant_id`` 时一行都读不到，"扫不到"会被误当成
      "没有没跑完的 run"。这是控制面自己的扫描，不回任何业务数据给调用方——它
      只吐 ``(tenant_id, run_id, status)``，续跑仍走各租户自己的 RLS 连接。
    """
    if not statuses:
        return []
    with psycopg.connect(dsn, autocommit=True, connect_timeout=connect_timeout) as conn:
        rows = conn.execute(_STATUS_QUERY.format(schema=schema)).fetchall()
    unfinished: list[UnfinishedRun] = []
    for thread_id, status in rows:
        thread = str(thread_id)
        if "|" not in thread:
            continue  # 不是本服务的 thread 命名约定（``<租户ID>|<任务ID>``）
        state = str(status or "")
        if state not in statuses:
            continue
        tenant_id, _, run_id = thread.partition("|")
        unfinished.append(UnfinishedRun(tenant_id=tenant_id, run_id=run_id, status=state))
    return unfinished


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
    "UnfinishedRun",
    "bootstrap",
    "list_unfinished",
    "thread_id_for",
]
