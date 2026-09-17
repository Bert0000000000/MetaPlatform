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
    Artifact,
    InMemoryArtifacts,
)
from mate_tech_agent_team.main import create_app

BASE = "/api/v1/agent-team"
TENANT = "tenant-acme"
OTHER = "tenant-other"


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
    client = TestClient(
        create_app(
            service=service,
            team_bus=bus,
            profile_registry=registry,
            artifact_store=store,
        )
    )
    return client, store


def _run_to_terminal(client: TestClient) -> str:
    run = client.post(f"{BASE}/runs", json={"goal": "找出本月异常订单"}, headers=_headers()).json()
    rejected = client.post(
        f"{BASE}/runs/{run['run_id']}/approve", json={"approved": False}, headers=_headers()
    )
    assert rejected.status_code == 200, rejected.text
    return str(run["run_id"])


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
async def test_putting_the_same_id_twice_replaces_instead_of_duplicating() -> None:
    """同一个 id 重写是**覆盖**：图重放同一份产出不该攒出两条。"""
    store = InMemoryArtifacts()
    for content in ("第一版", "第二版"):
        await store.put(
            Artifact(artifact_id="a-1", tenant_id=TENANT, run_id="r-1", content=content)
        )
    rows = await store.list(TENANT, "r-1")
    assert len(rows) == 1
    assert (await store.get(TENANT, "a-1")).content == "第二版"  # type: ignore[union-attr]


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
