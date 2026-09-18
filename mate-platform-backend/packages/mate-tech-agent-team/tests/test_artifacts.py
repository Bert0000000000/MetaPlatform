"""1.6 任务 2 · 真实 Artifact（员工产出物 → 可寻址、可取回的落地存储）。

判据（来自 GOAL 任务 2）：

* 一次 run 产出 **≥1 个 artifact**；
* **可寻址、可取回**（按 id 取回内容）。

**为什么落 PG 而不是 MinIO**：三条理由，写在 :mod:`mate_tech_agent_team.artifact_store`
的模块注释里。最要紧的一条是**租户隔离只有 PG 这条路是数据库强制的**——本服务的
检查点 / 员工定义 / 任务实例都在 PG 上靠 RLS 挡跨租户；MinIO 的桶名空间是命名
**约定**，隔离靠客户端记得写对前缀。artifact 是"本租户的产出物"，跟着走同一道墙。

**落地存储，不是内存态**：所以本文件除了内存替身的路子，还有一条**真 PG + RLS**
的断言（跨租户一行都读不到），用非超级角色 ``mate_app`` 跑。
"""

from __future__ import annotations

import time
from collections.abc import Iterator
from contextlib import ExitStack
from typing import Any

import pytest
from fastapi.testclient import TestClient
from mate_tech_agent_team import (
    BrainService,
    InMemoryCheckpointerProvider,
    InMemoryTeamTasks,
    ProfileRegistry,
    StaticPlanner,
    SubTask,
    SubTaskResult,
    TeamBus,
)
from mate_tech_agent_team.artifact_store import (
    INLINE_CONTENT_MAX_BYTES,
    Artifact,
    InMemoryArtifacts,
    digest_of,
)
from mate_tech_agent_team.main import create_app

BASE = "/api/v1/agent-team"
TENANT = "tenant-acme"
OTHER = "tenant-other"


class _RecordingBlobs:
    """测试用的最小 blob 客户端（``ArtifactBlobs`` 协议）。

    刻意**不放在 src 里**：生产模块带一个"假的对象存储"会让人以为部署真的有存储
    ——本仓的诚实口径是"没配 blob 客户端就内联"，而不是"反正有个内存实现"。
    """

    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    async def put(self, *, key: str, data: bytes, content_type: str) -> str:
        uri = f"mem://{key}"
        self.objects[uri] = data
        return uri

    async def get(self, uri: str) -> bytes:
        return self.objects[uri]


def _token(*, tenant_id: str = TENANT) -> str:
    import time

    import jwt as pyjwt

    now = int(time.time())
    return pyjwt.encode(
        {
            "sub": "u-1",
            "iss": "http://localhost:8080/realms/metaplatform",
            "aud": "metaplatform-backend",
            "azp": "metaplatform-backend",
            "realm_access": {"roles": ["PLATFORM_SUPER_ADMIN"]},
            "roles": ["PLATFORM_SUPER_ADMIN"],
            "tenant_id": tenant_id,
            "iat": now,
            "exp": now + 3600,
        },
        "test-secret",
        algorithm="HS256",
    )


def _headers(tenant_id: str = TENANT) -> dict[str, str]:
    return {"Authorization": f"Bearer {_token(tenant_id=tenant_id)}"}


# ── 替身 ────────────────────────────────────────────────────────────────


class _ReportRuntime:
    """每个员工交一份**非空**产出（产出物才有东西可落）。"""

    def __init__(self) -> None:
        self.seen: list[str] = []

    async def run(self, *, subtask: SubTask, tenant_id: str) -> SubTaskResult:
        self.seen.append(subtask["task_id"])
        return SubTaskResult(
            task_id=subtask["task_id"],
            team_task_id=subtask.get("team_task_id", ""),
            profile_id=subtask["profile_id"],
            status="ok",
            output=f"# {subtask['profile_id']} 的分析报告\n\n结论：异常订单 3 笔。",
            llm_calls=1,
            source="llm",
        )


class _SilentRuntime:
    """产出为空的员工——**不该**产出 artifact（空文件不是交付物）。"""

    async def run(self, *, subtask: SubTask, tenant_id: str) -> SubTaskResult:
        return SubTaskResult(
            task_id=subtask["task_id"],
            team_task_id=subtask.get("team_task_id", ""),
            profile_id=subtask["profile_id"],
            status="ok",
            output="   ",
            llm_calls=1,
            source="llm",
        )


_clients: ExitStack = ExitStack()

#: run 停下来的状态：闸门（等人）或任何终态。
_SETTLED = frozenset({"awaiting_approval", "completed", "failed", "cancelled", "timeout"})


@pytest.fixture(autouse=True)
def _close_test_clients() -> Iterator[None]:
    """关掉本测试开出去的 TestClient。

    只有 ``with`` 进 TestClient 才有**跨请求存活**的事件循环；不带上下文时
    Starlette 每个请求现起一个循环、请求一完就关，``POST /runs``（1.7 起是受理制）
    里 ``create_task`` 出去的后台执行会在响应返回的瞬间被拆掉，run 永远停在
    ``running``。完整说明见 ``test_async_runs.py``。
    """
    yield
    _clients.close()


def _app(*, runtime: Any = None, artifacts: Any = None) -> tuple[TestClient, Any]:
    registry = ProfileRegistry()
    bus = TeamBus(registry=registry, tasks=InMemoryTeamTasks())
    store = artifacts if artifacts is not None else InMemoryArtifacts()
    service = BrainService(
        planner_for=lambda _ctx: StaticPlanner(),
        runtime_for=lambda _ctx: runtime if runtime is not None else _ReportRuntime(),
        checkpointer=InMemoryCheckpointerProvider(),
        team_bus=bus,
        artifacts=store,
    )
    client = _clients.enter_context(
        TestClient(
            create_app(
                service=service,
                team_bus=bus,
                profile_registry=registry,
                artifact_store=store,
            )
        )
    )
    return client, store


def _wait_settled(client: TestClient, run_id: str, timeout: float = 8.0) -> dict[str, Any]:
    """轮询到 run 停下来（闸门或终态）为止——受理制下"提交"与"有结果"是两件事。"""
    deadline = time.monotonic() + timeout
    body: dict[str, Any] = {}
    while time.monotonic() < deadline:
        body = client.get(f"{BASE}/runs/{run_id}", headers=_headers()).json()
        if body.get("status") in _SETTLED:
            return body
        time.sleep(0.02)
    return body


def _run_to_terminal(client: TestClient) -> str:
    """受理一轮、等它停下来，再驳回闸门把它推到终态（1.7：提交不再同步返回状态）。"""
    accepted = client.post(f"{BASE}/runs", json={"goal": "找出本月异常订单"}, headers=_headers())
    assert accepted.status_code == 202, accepted.text
    run_id = str(accepted.json()["run_id"])
    _wait_settled(client, run_id)
    rejected = client.post(
        f"{BASE}/runs/{run_id}/approve", json={"approved": False}, headers=_headers()
    )
    assert rejected.status_code == 200, rejected.text
    return run_id


# ── 存储面：落地 + 可寻址 ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_an_artifact_round_trips_through_the_store() -> None:
    store = InMemoryArtifacts()
    written = await store.put(
        Artifact(
            artifact_id="a-1",
            tenant_id=TENANT,
            run_id="r-1",
            task_id="t1",
            profile_id="EMP-ANALYST",
            kind="report",
            title="分析报告",
            content_type="text/markdown",
            content="# 报告\n\n结论：3 笔。",
        )
    )
    assert written.size == len("# 报告\n\n结论：3 笔。".encode())

    fetched = await store.get(TENANT, "a-1")
    assert fetched is not None
    assert fetched.content == "# 报告\n\n结论：3 笔。"
    assert fetched.run_id == "r-1"


@pytest.mark.asyncio
async def test_the_store_is_tenant_scoped() -> None:
    store = InMemoryArtifacts()
    await store.put(
        Artifact(
            artifact_id="a-1",
            tenant_id=TENANT,
            run_id="r-1",
            content="x",
        )
    )
    assert await store.get(OTHER, "a-1") is None
    assert await store.list(OTHER, "r-1") == []
    assert [a.artifact_id for a in await store.list(TENANT, "r-1")] == ["a-1"]


@pytest.mark.asyncio
async def test_rewriting_the_same_address_with_new_content_appends_a_version() -> None:
    """C-4 判据：**重跑不覆盖旧版**——两版并存，第一版仍取得到。

    旧实现是 ``ON CONFLICT DO UPDATE``：第二次写把第一次**盖掉**，于是"第一次
    交付的是什么"再也取不回来。现在每次内容变化都落一行新版本。
    """
    store = InMemoryArtifacts()
    for content in ("第一版", "第二版"):
        await store.put(
            Artifact(artifact_id="a-1", tenant_id=TENANT, run_id="r-1", content=content)
        )

    versions = await store.list_versions(TENANT, "a-1")
    assert [(v.version, v.content) for v in versions] == [(1, "第一版"), (2, "第二版")]

    # 最新 = 第二版；**第一版仍原样取得到**（这就是"能证明第一次交付了什么"）
    assert (await store.get(TENANT, "a-1")).content == "第二版"  # type: ignore[union-attr]
    first = await store.get(TENANT, "a-1", 1)
    assert first is not None and first.content == "第一版"
    # 列表只出**最新**一版：一轮的交付物清单不该出现同一个地址两次
    assert [a.version for a in await store.list(TENANT, "r-1")] == [2]


@pytest.mark.asyncio
async def test_replaying_the_same_content_does_not_churn_versions() -> None:
    """同内容重放是**幂等**的：图重放节点 / 工具重试不该把版本号刷成一串噪声。"""
    store = InMemoryArtifacts()
    first = await store.put(
        Artifact(artifact_id="a-1", tenant_id=TENANT, run_id="r-1", content="同一份产出")
    )
    again = await store.put(
        Artifact(artifact_id="a-1", tenant_id=TENANT, run_id="r-1", content="同一份产出")
    )
    assert again.version == first.version == 1
    assert len(await store.list_versions(TENANT, "a-1")) == 1


@pytest.mark.asyncio
async def test_the_digest_is_stable_and_content_addressed() -> None:
    """摘要必须**只由正文决定**：同内容恒同摘要，改一个字就全变。"""
    store = InMemoryArtifacts()
    same_a = await store.put(
        Artifact(artifact_id="a-1", tenant_id=TENANT, run_id="r-1", content="结论：3 笔")
    )
    same_b = Artifact(artifact_id="a-2", tenant_id=TENANT, run_id="r-1", content="结论：3 笔")
    assert same_a.immutable_digest == same_b.immutable_digest == digest_of("结论：3 笔")
    assert len(same_a.immutable_digest) == 64

    changed = Artifact(artifact_id="a-3", tenant_id=TENANT, run_id="r-1", content="结论：4 笔")
    assert changed.immutable_digest != same_a.immutable_digest


@pytest.mark.asyncio
async def test_a_large_body_is_offloaded_only_when_a_blob_client_is_configured() -> None:
    """超阈值**且**配了 blob 客户端才外移；没配就照旧内联（不假装上传成功）。"""
    blobs = _RecordingBlobs()
    store = InMemoryArtifacts(blobs=blobs)
    big = "x" * (INLINE_CONTENT_MAX_BYTES + 1)
    stored = await store.put(
        Artifact(artifact_id="a-1", tenant_id=TENANT, run_id="r-1", content=big)
    )
    assert stored.storage_uri and stored.content == ""
    # 元数据仍是**原文**的：外移不改"这份交付物多大、摘要是什么"
    assert stored.size == len(big.encode())
    assert stored.immutable_digest == digest_of(big)
    # 取回来时按 storage_uri 还原正文
    fetched = await store.get(TENANT, "a-1")
    assert fetched is not None and fetched.content == big

    # 没配 blob 客户端：同样的正文**内联在 PG**，不产生取不回的地址
    inline = await InMemoryArtifacts().put(
        Artifact(artifact_id="a-1", tenant_id=TENANT, run_id="r-1", content=big)
    )
    assert inline.storage_uri == ""
    assert inline.content == big


# ── 判据：一次 run 产出 ≥1 个 artifact，且可寻址可取回 ──────────────────


def test_a_run_produces_at_least_one_addressable_artifact() -> None:
    client, _store = _app()
    run_id = _run_to_terminal(client)

    listed = client.get(f"{BASE}/runs/{run_id}/artifacts", headers=_headers())
    assert listed.status_code == 200, listed.text
    items = listed.json()["items"]
    assert len(items) >= 1, listed.text

    first = items[0]
    assert first["kind"] == "report"
    assert first["run_id"] == run_id
    assert first["content_type"] == "text/markdown"
    assert first["size"] > 0
    assert "content" not in first, "列表只出元数据，别把正文全带上"

    got = client.get(f"{BASE}/artifacts/{first['artifact_id']}", headers=_headers())
    assert got.status_code == 200, got.text
    body = got.json()
    assert body["artifact_id"] == first["artifact_id"]
    assert "分析报告" in body["content"]


def test_every_successful_employee_contributes_its_own_artifact() -> None:
    client, _store = _app()
    run_id = _run_to_terminal(client)
    items = client.get(f"{BASE}/runs/{run_id}/artifacts", headers=_headers()).json()["items"]

    profiles = {item["profile_id"] for item in items}
    assert profiles == {"EMP-ANALYST", "EMP-AUDITOR", "EMP-RESEARCHER"}, items
    assert len({item["artifact_id"] for item in items}) == len(items), "id 必须唯一"


def test_the_run_receipt_points_at_its_artifacts() -> None:
    """回执里要看得见"这轮产出了什么"——不然前端还得再问一次才知道有没有。"""
    client, _store = _app()
    run_id = _run_to_terminal(client)
    state = client.get(f"{BASE}/runs/{run_id}", headers=_headers()).json()

    refs = [a for row in state["results"].values() for a in row["artifacts"]]
    assert refs, state
    assert all(ref["artifact_id"] for ref in refs)
    assert all(ref["kind"] == "report" for ref in refs)


# ── 负例 ────────────────────────────────────────────────────────────────


def test_an_empty_output_does_not_become_an_artifact() -> None:
    client, _store = _app(runtime=_SilentRuntime())
    run_id = _run_to_terminal(client)
    assert client.get(f"{BASE}/runs/{run_id}/artifacts", headers=_headers()).json()["items"] == []


def test_artifacts_from_another_tenant_are_not_found() -> None:
    client, _store = _app()
    run_id = _run_to_terminal(client)
    artifact_id = client.get(f"{BASE}/runs/{run_id}/artifacts", headers=_headers()).json()["items"][
        0
    ]["artifact_id"]

    assert client.get(f"{BASE}/artifacts/{artifact_id}", headers=_headers(OTHER)).status_code == 404
    assert client.get(f"{BASE}/runs/{run_id}/artifacts", headers=_headers(OTHER)).status_code == 404


def test_an_unknown_artifact_is_not_found() -> None:
    client, _store = _app()
    assert client.get(f"{BASE}/artifacts/does-not-exist", headers=_headers()).status_code == 404


# ── C-4：版本化在 HTTP 面上取得到 ────────────────────────────────────────


@pytest.mark.asyncio
async def test_the_first_delivery_is_retrievable_over_http() -> None:
    """判据落地：**能证明第一次交付了什么**——`?version=1` 直接取回原文。"""
    client, store = _app()
    run_id = _run_to_terminal(client)
    items = client.get(f"{BASE}/runs/{run_id}/artifacts", headers=_headers()).json()["items"]
    first = items[0]
    assert first["version"] == 1
    assert len(first["immutable_digest"]) == 64

    # 同一地址再交付一次（图重放 / 续跑重派会走到这条路）：内容变了就 +1 版
    await store.put(
        Artifact(
            artifact_id=first["artifact_id"],
            tenant_id=TENANT,
            run_id=first["run_id"],
            task_id=first["task_id"],
            profile_id=first["profile_id"],
            content="# 改过的第二版",
        )
    )

    latest = client.get(f"{BASE}/artifacts/{first['artifact_id']}", headers=_headers()).json()
    assert latest["version"] == 2 and "第二版" in latest["content"]

    original = client.get(
        f"{BASE}/artifacts/{first['artifact_id']}?version=1", headers=_headers()
    ).json()
    assert original["version"] == 1
    assert "分析报告" in original["content"]
    assert original["immutable_digest"] == first["immutable_digest"]

    # 存量读取路径不受影响：列表仍只出**最新**一版，一个地址一条
    listed = client.get(f"{BASE}/runs/{run_id}/artifacts", headers=_headers()).json()["items"]
    assert [row["version"] for row in listed if row["artifact_id"] == first["artifact_id"]] == [2]


# ── 落地存储：真 PG + RLS（跨租户一行都读不到）──────────────────────────


@pytest.mark.asyncio
async def test_artifacts_are_isolated_by_rls_on_a_real_database(
    pg_dsns: tuple[str, str],
) -> None:
    """隔离必须是**数据库**说的：用非超级、非 BYPASSRLS 的 ``mate_app`` 读。

    用 ``meta`` 跑这条会假通过（它同时是 superuser 与 rolbypassrls）。
    """
    import psycopg
    from mate_tech_agent_team.artifact_store import PgArtifacts, bootstrap_artifacts

    admin_dsn, app_dsn = pg_dsns
    schema = "agent_team_artifact_test"
    with psycopg.connect(admin_dsn, autocommit=True) as conn:
        conn.execute(f"DROP SCHEMA IF EXISTS {schema} CASCADE")
        conn.execute(f"CREATE SCHEMA {schema}")
        conn.execute(f"GRANT USAGE ON SCHEMA {schema} TO mate_app")
        conn.execute(f"SET search_path TO {schema}")
        bootstrap_artifacts(conn)
    try:
        store = PgArtifacts(app_dsn, schema=schema)
        await store.put(
            Artifact(artifact_id="a-1", tenant_id=TENANT, run_id="r-1", content="机密产出")
        )
        mine = await store.get(TENANT, "a-1")
        assert mine is not None and mine.content == "机密产出"

        # 另一个租户：按 id 直取读不到，列 run 也看不到
        assert await store.get(OTHER, "a-1") is None
        assert await store.list(OTHER, "r-1") == []
        # **忘了设租户**（fail-closed）：同样读不到，而不是读到全部
        assert await store.list("", "r-1") == []
    finally:
        with psycopg.connect(admin_dsn, autocommit=True) as conn:
            conn.execute(f"DROP SCHEMA IF EXISTS {schema} CASCADE")


# ── C-4：真 PG 上的版本往返 + 老表迁移 ──────────────────────────────────

_OLD_TABLE_DDL = """
CREATE TABLE IF NOT EXISTS artifact (
    artifact_id  TEXT NOT NULL,
    tenant_id    TEXT NOT NULL,
    run_id       TEXT NOT NULL DEFAULT '',
    task_id      TEXT NOT NULL DEFAULT '',
    profile_id   TEXT NOT NULL DEFAULT '',
    kind         TEXT NOT NULL DEFAULT 'report',
    title        TEXT NOT NULL DEFAULT '',
    content_type TEXT NOT NULL DEFAULT 'text/markdown',
    content      TEXT NOT NULL DEFAULT '',
    size         INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, artifact_id)
)
"""

_OLD_ROW_INSERT = """
INSERT INTO artifact (artifact_id, tenant_id, run_id, task_id, content, size)
VALUES ('a-1', %s, 'r-1', 't1', '1.6 时期落的产出', 24)
"""


@pytest.mark.asyncio
async def test_versions_round_trip_through_a_real_database(pg_dsns: tuple[str, str]) -> None:
    """两版并存且第一版取得到——**这条只能在真库上验**（主键与 ORDER BY 是库里的事）。"""
    import psycopg
    from mate_tech_agent_team.artifact_store import PgArtifacts, bootstrap_artifacts

    admin_dsn, app_dsn = pg_dsns
    schema = "agent_team_artifact_version_test"
    with psycopg.connect(admin_dsn, autocommit=True) as conn:
        conn.execute(f"DROP SCHEMA IF EXISTS {schema} CASCADE")
        conn.execute(f"CREATE SCHEMA {schema}")
        conn.execute(f"GRANT USAGE ON SCHEMA {schema} TO mate_app")
        conn.execute(f"SET search_path TO {schema}")
        bootstrap_artifacts(conn)
    try:
        store = PgArtifacts(app_dsn, schema=schema)
        await store.put(
            Artifact(artifact_id="a-1", tenant_id=TENANT, run_id="r-1", content="第一版")
        )
        second = await store.put(
            Artifact(artifact_id="a-1", tenant_id=TENANT, run_id="r-1", content="第二版")
        )
        assert second.version == 2
        # 同内容再写一次：**幂等**，不刷版本号（重放不该攒版本）
        assert (
            await store.put(
                Artifact(artifact_id="a-1", tenant_id=TENANT, run_id="r-1", content="第二版")
            )
        ).version == 2

        versions = await store.list_versions(TENANT, "a-1")
        assert [(v.version, v.content) for v in versions] == [(1, "第一版"), (2, "第二版")]
        assert [v.version for v in await store.list(TENANT, "r-1")] == [2]

        first = await store.get(TENANT, "a-1", 1)
        assert first is not None and first.content == "第一版"
        assert first.immutable_digest == digest_of("第一版")
        # 跨租户仍然一行都读不到（新列没有引入新的读路径）
        assert await store.get(OTHER, "a-1", 1) is None
        assert await store.list_versions(OTHER, "a-1") == []
    finally:
        with psycopg.connect(admin_dsn, autocommit=True) as conn:
            conn.execute(f"DROP SCHEMA IF EXISTS {schema} CASCADE")


@pytest.mark.asyncio
async def test_the_migration_is_idempotent_and_loses_no_rows(pg_dsns: tuple[str, str]) -> None:
    """老表（1.6~2.1-B 的两列主键）迁移：**加列不丢行**，且可重复跑。

    第一步刻意用**旧 DDL** 建表并塞一行——那是"2.1-B 之前就存在的库"的样子。
    迁移后：那一行还在，``version`` 读到默认 1，主键换成三列；再跑一次 migration
    仍然成功（幂等），行数与内容都不变。
    """
    import psycopg
    from mate_tech_agent_team.artifact_store import PgArtifacts, bootstrap_artifacts

    admin_dsn, app_dsn = pg_dsns
    schema = "agent_team_artifact_migrate_test"
    with psycopg.connect(admin_dsn, autocommit=True) as conn:
        conn.execute(f"DROP SCHEMA IF EXISTS {schema} CASCADE")
        conn.execute(f"CREATE SCHEMA {schema}")
        conn.execute(f"GRANT USAGE ON SCHEMA {schema} TO mate_app")
        conn.execute(f"SET search_path TO {schema}")
        conn.execute(_OLD_TABLE_DDL)
        conn.execute(_OLD_ROW_INSERT, (TENANT,))
        # 迁移（第一次）+ 再跑一次（幂等）
        bootstrap_artifacts(conn)
        bootstrap_artifacts(conn)
        cur = conn.execute(
            "SELECT column_name FROM information_schema.columns"
            " WHERE table_schema = current_schema() AND table_name = 'artifact'"
        )
        columns = {row[0] for row in cur.fetchall()}
    try:
        assert {"version", "immutable_digest", "provenance", "storage_uri"} <= columns
        store = PgArtifacts(app_dsn, schema=schema)
        preserved = await store.get(TENANT, "a-1")
        assert preserved is not None
        assert preserved.content == "1.6 时期落的产出"
        assert preserved.version == 1  # 老行落到第一版，而不是丢行或 NULL
        assert len(await store.list_versions(TENANT, "a-1")) == 1

        # 换键之后**同一个地址仍能追加新版本**（老行没有被主键变更挤掉）
        appended = await store.put(
            Artifact(artifact_id="a-1", tenant_id=TENANT, run_id="r-1", content="迁移后的第二版")
        )
        assert appended.version == 2
    finally:
        with psycopg.connect(admin_dsn, autocommit=True) as conn:
            conn.execute(f"DROP SCHEMA IF EXISTS {schema} CASCADE")
