"""任务 1 · 租户隔离由**数据库**强制（PG RLS）。

为什么要单独一个文件：内存检查点器只能证明"命名不同"，证明不了"隔离"。
真正的断言必须在 Postgres 上用**非超级、非 BYPASSRLS** 的角色（``mate_app``）做——
用 ``meta`` 测会假通过（它同时是 superuser 与 rolbypassrls）。

四个必须成立的性质：
  1. A 看得到自己的行，B 一行都看不到
  2. B 拿着 A 的 thread_id 去读 → 读不到
  3. **忘了设租户 → 什么都读不到**（fail-closed，而不是读到全部）
  4. 落库的 thread_id 形状与策略前缀一致
"""

from __future__ import annotations

import psycopg
import pytest
from mate_tech_agent_team import (
    BrainService,
    PgCheckpointerProvider,
    RunNotFound,
    StaticPlanner,
    SubTaskResult,
)


class _TinyRuntime:
    async def run(self, *, subtask, tenant_id: str) -> SubTaskResult:
        return SubTaskResult(
            task_id=subtask["task_id"],
            profile_id=subtask["profile_id"],
            status="ok",
            output=f"{tenant_id}:{subtask['task_id']}",
            source="llm",
            llm_calls=1,
        )


def _service(app_dsn: str, schema: str) -> BrainService:
    return BrainService(
        planner=StaticPlanner(),
        runtime=_TinyRuntime(),
        checkpointer=PgCheckpointerProvider(app_dsn, schema=schema),
    )


async def _visible_checkpoints(app_dsn: str, schema: str, tenant_id: str | None) -> int:
    conn = await psycopg.AsyncConnection.connect(app_dsn, autocommit=True)
    try:
        await conn.execute(f"SET search_path TO {schema}")
        if tenant_id is not None:
            await conn.execute("select set_config('app.tenant_id', %s, false)", (tenant_id,))
        cur = await conn.execute("select count(*) from checkpoints")
        row = await cur.fetchone()
        assert row is not None
        return int(row[0])
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_tenant_sees_own_rows_but_not_others(pg_dsns, rls_schema: str) -> None:
    _, app_dsn = pg_dsns
    run = await _service(app_dsn, rls_schema).start(tenant_id="tenant-a", goal="甲的异常订单")
    assert run["status"] == "awaiting_approval"

    assert await _visible_checkpoints(app_dsn, rls_schema, "tenant-a") > 0
    assert await _visible_checkpoints(app_dsn, rls_schema, "tenant-b") == 0


@pytest.mark.asyncio
async def test_missing_tenant_context_reads_nothing(pg_dsns, rls_schema: str) -> None:
    """fail-closed：不设 ``app.tenant_id`` 时策略匹配不到任何行。"""
    _, app_dsn = pg_dsns
    await _service(app_dsn, rls_schema).start(tenant_id="tenant-a", goal="甲的异常订单")
    assert await _visible_checkpoints(app_dsn, rls_schema, None) == 0


@pytest.mark.asyncio
async def test_cross_tenant_read_of_known_thread_is_not_found(pg_dsns, rls_schema: str) -> None:
    _, app_dsn = pg_dsns
    run = await _service(app_dsn, rls_schema).start(tenant_id="tenant-a", goal="甲的异常订单")
    got = await _service(app_dsn, rls_schema).get(tenant_id="tenant-a", run_id=run["run_id"])
    assert got["goal"] == "甲的异常订单"
    with pytest.raises(RunNotFound):
        await _service(app_dsn, rls_schema).get(tenant_id="tenant-b", run_id=run["run_id"])


@pytest.mark.asyncio
async def test_thread_id_shape_matches_rls_policy(pg_dsns, rls_schema: str) -> None:
    _, app_dsn = pg_dsns
    run = await _service(app_dsn, rls_schema).start(tenant_id="tenant-a", goal="目标")
    conn = await psycopg.AsyncConnection.connect(app_dsn, autocommit=True)
    try:
        await conn.execute(f"SET search_path TO {rls_schema}")
        await conn.execute("select set_config('app.tenant_id', %s, false)", ("tenant-a",))
        cur = await conn.execute("select distinct thread_id from checkpoints")
        rows = await cur.fetchall()
    finally:
        await conn.close()
    assert rows, "租户 A 应当看得到自己的 thread"
    assert all(tid.startswith("tenant-a|") for (tid,) in rows), rows
    assert any(tid.endswith(f"|{run['run_id']}") for (tid,) in rows), rows


@pytest.mark.asyncio
async def test_no_prefix_write_is_rejected(pg_dsns, rls_schema: str) -> None:
    """WITH CHECK：写一条不带租户前缀的 thread 必须被策略拒掉。"""
    _, app_dsn = pg_dsns
    conn = await psycopg.AsyncConnection.connect(app_dsn, autocommit=True)
    try:
        await conn.execute(f"SET search_path TO {rls_schema}")
        await conn.execute("select set_config('app.tenant_id', %s, false)", ("tenant-b",))
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            await conn.execute(
                "insert into checkpoints(thread_id, checkpoint_ns, checkpoint_id, checkpoint)"
                " values ('no-prefix-thread','','c1','{}'::jsonb)"
            )
    finally:
        await conn.close()
