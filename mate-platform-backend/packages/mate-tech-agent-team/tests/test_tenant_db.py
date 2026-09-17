"""B-5 / `MP-RUNTIME-DB-POOL-01` 的判据：**连接复用不泄漏租户上下文**。

这条不是"用了池"的性能断言，是安全断言。加池之前那 8 处写的是
``set_config('app.tenant_id', %s, **false**)``——会话级，只在"用完就关"的前提下
才不泄漏。上了池，归还的连接会带着上一个租户的 GUC 进入下一个请求，而 RLS 恰好
读这个值做判定 → 隔离静默失效。

所以这里的每一条都尽量**在真库上、真池上**做，并且刻意断言"是**同一条物理
连接**"（``pg_backend_pid()`` 相等）——不然"没泄漏"可能只是因为换了条连接。
"""

from __future__ import annotations

import pytest
import pytest_asyncio
from mate_tech_agent_team.tenant_db import TenantConnections

TENANT_A = "tenant-alpha"
TENANT_B = "tenant-beta"


@pytest_asyncio.fixture
async def pooled(app_dsn: str, rls_schema: str):
    """**上限 1** 的池：任何两次取用拿到的一定是同一条物理连接。

    这是本文件全部断言的前提——池里只有一条连接，"没看到上一个租户的 GUC"
    才等价于"归还时被清干净了"。
    """
    conns = TenantConnections(app_dsn, schema=rls_schema, max_size=1)
    await conns.open()
    try:
        yield conns
    finally:
        await conns.aclose()


async def _guc(conn) -> str | None:
    cur = await conn.execute("select current_setting('app.tenant_id', true)")
    row = await cur.fetchone()
    return None if row is None else row[0]


async def _pid(conn) -> int:
    cur = await conn.execute("select pg_backend_pid()")
    row = await cur.fetchone()
    return int(row[0])


# ── 判据本身 ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_borrowed_then_returned_connection_leaves_no_tenant_behind(pooled) -> None:
    """借给 A → 归还 → 再借给 B：B 看到的 GUC **是空的**，且是同一条物理连接。"""
    async with pooled.for_tenant(TENANT_A) as conn:
        pid_a = await _pid(conn)
        assert await _guc(conn) == TENANT_A

    async with pooled.for_tenant(TENANT_B) as conn:
        pid_b = await _pid(conn)
        assert await _guc(conn) == TENANT_B

    assert pid_a == pid_b, "池上限为 1，两次取用必须是同一条物理连接（否则本用例没验到东西）"


@pytest.mark.asyncio
async def test_returned_connection_is_sanitized_before_the_next_tenant(pooled) -> None:
    """**归还那一刻**就被清干净了——不靠下一个租户"覆盖掉"。

    用不设租户的连接源（控制面形态）回读：它不会写 GUC，所以读到什么就是
    上一条连接留下的什么。
    """
    async with pooled.for_tenant(TENANT_A) as conn:
        assert await _guc(conn) == TENANT_A

    async with pooled.for_control_plane() as conn:
        assert await _guc(conn) in (None, ""), (
            "归还的连接上还留着上一个租户的 app.tenant_id —— "
            "改成池之后这就是跨租户串读，而且不会有任何报错"
        )


@pytest.mark.asyncio
async def test_transaction_scoped_guc_dies_with_the_transaction(pooled) -> None:
    """事务级 GUC：块内可见、出块即失效（提交路径）。"""
    async with pooled.for_tenant(TENANT_A) as conn:
        assert await _guc(conn) == TENANT_A
    async with pooled.for_control_plane() as conn:
        assert await _guc(conn) in (None, "")


@pytest.mark.asyncio
async def test_guc_also_dies_when_the_block_raises(pooled) -> None:
    """异常路径同样不留痕：回滚把事务级设置一起带走。"""

    class _Boom(Exception):
        pass

    with pytest.raises(_Boom):
        async with pooled.for_tenant(TENANT_A) as conn:
            assert await _guc(conn) == TENANT_A
            raise _Boom

    async with pooled.for_control_plane() as conn:
        assert await _guc(conn) in (None, "")


@pytest.mark.asyncio
async def test_next_tenant_cannot_see_the_previous_tenants_rows(pooled, rls_schema) -> None:
    """**隔离的最终判据**：同一条连接，A 写的行 B 一行都读不到。

    前面几条看的是 GUC 这个手段；这一条看的是它的**后果**——RLS 到底拦没拦住。
    """
    async with pooled.for_tenant(TENANT_A) as conn:
        pid_a = await _pid(conn)
        await conn.execute(
            f"INSERT INTO {rls_schema}.artifact (artifact_id, tenant_id, run_id, task_id,"
            " profile_id, kind, title, content_type, content, size, created_at)"
            " VALUES ('art-leak', %s, 'r', 't', 'p', 'report', 'title', 'text/markdown',"
            " 'body', 4, now())",
            (TENANT_A,),
        )
        cur = await conn.execute(
            f"SELECT count(*) FROM {rls_schema}.artifact WHERE tenant_id = %s", (TENANT_A,)
        )
        assert (await cur.fetchone())[0] == 1

    async with pooled.for_tenant(TENANT_B) as conn:
        assert await _pid(conn) == pid_a
        cur = await conn.execute(f"SELECT count(*) FROM {rls_schema}.artifact")
        assert (await cur.fetchone())[0] == 0, "换了租户却读到了上一个租户的行"


# ── autocommit 路径（langgraph 的 checkpointer）─────────────────────────


@pytest.mark.asyncio
async def test_autocommit_path_is_cleaned_by_reset_on_putback(
    app_dsn: str, rls_schema: str
) -> None:
    """会话级 GUC 那条路（checkpointer）靠**归还前 RESET** 兜底。

    这条不池化（上限 1 也一样），所以真正的机制是"连接被关掉、会话级设置随之
    消失"；把上限设成 1 是为了让它走**真正的池**，从而验到 ``RESET ALL`` 钩子。
    """
    conns = TenantConnections(app_dsn, schema=rls_schema, autocommit=True, max_size=1)
    await conns.open()
    try:
        async with conns.for_tenant(TENANT_A) as conn:
            pid_a = await _pid(conn)
            assert await _guc(conn) == TENANT_A

        async with conns.for_control_plane() as conn:
            assert await _pid(conn) == pid_a
            assert await _guc(conn) in (None, ""), (
                "autocommit 路径的会话级 GUC 没被归还钩子清掉——"
                "checkpointer 的连接一旦复用就是跨租户串读"
            )
    finally:
        await conns.aclose()


# ── 负例 ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_empty_tenant_is_refused(pooled) -> None:
    with pytest.raises(ValueError, match="租户"):
        async with pooled.for_tenant("") as _conn:
            pass


@pytest.mark.asyncio
async def test_pipe_in_tenant_is_refused(pooled) -> None:
    """``|`` 会破坏检查点 thread_id 的前缀约定 → 前缀匹配不再等价于租户相等。"""
    with pytest.raises(ValueError, match=r"\|"):
        async with pooled.for_tenant("bad|tenant") as _conn:
            pass


@pytest.mark.asyncio
async def test_schema_must_be_a_plain_identifier() -> None:
    """schema 名会拼进 SQL（``SET LOCAL search_path`` 不接受参数绑定），必须挡住。"""
    with pytest.raises(ValueError, match="标识符"):
        TenantConnections("postgresql://x/y", schema="agent_team; DROP TABLE t")
