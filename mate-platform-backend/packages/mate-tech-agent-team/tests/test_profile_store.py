"""1.1 任务 3 · 员工身份落库（ADR-0066 S0）。

1.0 的 ``ProfileRegistry`` 是**纯进程内**的声明式名册：建出来的员工只活在
内存里，服务一重启就没了，跨副本也各看各的。本文件守住落库后的性质：

  1. 建一个员工 → 换一个 store 实例（= 重启）→ 它还在
  2. 跨租户不可见（应用层过滤 + **数据库 RLS 双保险**）
  3. 忘了设租户 → 一行都读不到（fail-closed）
  4. 身份三要素（提示词 / 技能清单 / 工具白名单）与权限包络四维完整往返
  5. 内置员工不依赖库里的行，始终在册

隔离断言一律用 ``mate_app``（非 superuser、非 BYPASSRLS）；用 ``meta`` 测会
假通过。PG 不可用时用例 skip，不判红。
"""

from __future__ import annotations

import psycopg
import pytest
from fastapi.testclient import TestClient
from mate_tech_agent_team.main import create_app
from mate_tech_agent_team.profile_store import ProfileStore, bootstrap_profiles
from mate_tech_agent_team.profiles import EmployeeProfile, ProfileRegistry, RuntimeKind

TENANT_A = "tenant-acme"
TENANT_B = "tenant-bigo"
BASE = "/api/v1/agent-team"


def _profile(profile_id: str = "EMP-ORDER-ANALYST", **overrides: object) -> EmployeeProfile:
    base: dict[str, object] = {
        "profile_id": profile_id,
        "name": "订单分析师",
        "base_role": "ontology",
        "system_prompt": "你是订单分析师，只报可核对的数字。",
        "skills": ("sk-order-anomaly",),
        "tools": ("ont_object_query", "read_skill"),
        "action_rids": ("ont.create_link",),
        "kb_ids": ("kb-orders",),
        "markings": ("internal",),
        "origin": "instantiated",
    }
    base.update(overrides)
    return EmployeeProfile(**base)  # type: ignore[arg-type]


async def _store(app_dsn: str, schema: str) -> ProfileStore:
    return ProfileStore(app_dsn, schema=schema)


# --- 落库与重启 -----------------------------------------------------------
@pytest.mark.asyncio
async def test_created_profile_survives_a_new_store_instance(pg_dsns, rls_schema: str) -> None:
    """判据：建一个员工 → 重启服务 → 它还在。"""
    _, app_dsn = pg_dsns
    await (await _store(app_dsn, rls_schema)).upsert(TENANT_A, _profile())

    # 新实例 = 新进程：内存里什么都不剩，只有 PG 里的行。
    reloaded = await (await _store(app_dsn, rls_schema)).get(TENANT_A, "EMP-ORDER-ANALYST")
    assert reloaded is not None
    assert reloaded.name == "订单分析师"
    assert reloaded.system_prompt == "你是订单分析师，只报可核对的数字。"


@pytest.mark.asyncio
async def test_upsert_updates_in_place(pg_dsns, rls_schema: str) -> None:
    _, app_dsn = pg_dsns
    store = await _store(app_dsn, rls_schema)
    await store.upsert(TENANT_A, _profile())
    await store.upsert(TENANT_A, _profile(name="订单分析师(改)", tools=("ont_list_classes",)))

    rows = await store.list(TENANT_A)
    assert len(rows) == 1
    assert rows[0].name == "订单分析师(改)"
    assert rows[0].tools == ("ont_list_classes",)


@pytest.mark.asyncio
async def test_delete_removes_the_row(pg_dsns, rls_schema: str) -> None:
    _, app_dsn = pg_dsns
    store = await _store(app_dsn, rls_schema)
    await store.upsert(TENANT_A, _profile())
    assert await store.delete(TENANT_A, "EMP-ORDER-ANALYST") is True
    assert await store.get(TENANT_A, "EMP-ORDER-ANALYST") is None
    assert await store.delete(TENANT_A, "EMP-ORDER-ANALYST") is False


# --- 身份三要素 + 权限包络 ------------------------------------------------
@pytest.mark.asyncio
async def test_identity_and_envelope_round_trip(pg_dsns, rls_schema: str) -> None:
    _, app_dsn = pg_dsns
    store = await _store(app_dsn, rls_schema)
    await store.upsert(TENANT_A, _profile())

    got = await store.get(TENANT_A, "EMP-ORDER-ANALYST")
    assert got is not None
    # 身份三要素（D-7）
    assert got.system_prompt
    assert got.skills == ("sk-order-anomaly",)
    assert got.tools == ("ont_object_query", "read_skill")
    # 权限包络四维（ADR-0066 §3.3）
    assert got.envelope() == (
        frozenset({"ont_object_query", "read_skill"}),
        frozenset({"ont.create_link"}),
        frozenset({"kb-orders"}),
        frozenset({"internal"}),
    )


# --- 跨租户不可见 ---------------------------------------------------------
@pytest.mark.asyncio
async def test_list_is_tenant_scoped(pg_dsns, rls_schema: str) -> None:
    _, app_dsn = pg_dsns
    store = await _store(app_dsn, rls_schema)
    await store.upsert(TENANT_A, _profile("EMP-A"))
    await store.upsert(TENANT_B, _profile("EMP-B"))

    assert [p.profile_id for p in await store.list(TENANT_A)] == ["EMP-A"]
    assert [p.profile_id for p in await store.list(TENANT_B)] == ["EMP-B"]


@pytest.mark.asyncio
async def test_cross_tenant_get_and_delete_are_denied(pg_dsns, rls_schema: str) -> None:
    _, app_dsn = pg_dsns
    store = await _store(app_dsn, rls_schema)
    await store.upsert(TENANT_A, _profile("EMP-A"))

    assert await store.get(TENANT_B, "EMP-A") is None
    assert await store.delete(TENANT_B, "EMP-A") is False
    assert await store.get(TENANT_A, "EMP-A") is not None


@pytest.mark.asyncio
async def test_rls_blocks_cross_tenant_read_at_the_database(pg_dsns, rls_schema: str) -> None:
    """双保险：绕过应用层直接查库，RLS 也必须挡住。"""
    _, app_dsn = pg_dsns
    await (await _store(app_dsn, rls_schema)).upsert(TENANT_A, _profile("EMP-A"))

    async def _count(tenant: str | None) -> int:
        conn = await psycopg.AsyncConnection.connect(app_dsn, autocommit=True)
        try:
            await conn.execute(f"SET search_path TO {rls_schema}")
            if tenant is not None:
                await conn.execute("select set_config('app.tenant_id', %s, false)", (tenant,))
            cur = await conn.execute("select count(*) from employee_profile")
            row = await cur.fetchone()
            assert row is not None
            return int(row[0])
        finally:
            await conn.close()

    assert await _count(TENANT_A) == 1
    assert await _count(TENANT_B) == 0
    assert await _count(None) == 0  # fail-closed


@pytest.mark.asyncio
async def test_blank_tenant_reads_and_writes_nothing(pg_dsns, rls_schema: str) -> None:
    _, app_dsn = pg_dsns
    store = await _store(app_dsn, rls_schema)
    await store.upsert(TENANT_A, _profile("EMP-A"))
    assert await store.list("") == []
    assert await store.get("", "EMP-A") is None
    with pytest.raises(ValueError):
        await store.upsert("", _profile("EMP-NO-TENANT"))


# --- 名册：内置 + 本租户 -------------------------------------------------
@pytest.mark.asyncio
async def test_registry_merges_builtins_with_tenant_rows(pg_dsns, rls_schema: str) -> None:
    _, app_dsn = pg_dsns
    store = await _store(app_dsn, rls_schema)
    await store.upsert(TENANT_A, _profile("EMP-ORDER-ANALYST"))
    registry = ProfileRegistry(store=store)

    ids_a = {p.profile_id for p in await registry.list(TENANT_A)}
    assert "EMP-ORDER-ANALYST" in ids_a
    assert {"EMP-ANALYST", "EMP-AUDITOR", "EMP-RESEARCHER"} <= ids_a  # 内置仍在

    ids_b = {p.profile_id for p in await registry.list(TENANT_B)}
    assert "EMP-ORDER-ANALYST" not in ids_b


@pytest.mark.asyncio
async def test_registry_without_a_store_stays_offline(pg_dsns, rls_schema: str) -> None:
    """没接 store 时保持 1.0 行为（纯内置），不让现有调用方被迫改造。"""
    registry = ProfileRegistry()
    assert {p.profile_id for p in await registry.list(TENANT_A)} >= {"EMP-ANALYST"}


@pytest.mark.asyncio
async def test_registry_tenant_row_overrides_a_builtin(pg_dsns, rls_schema: str) -> None:
    _, app_dsn = pg_dsns
    store = await _store(app_dsn, rls_schema)
    await store.upsert(TENANT_A, _profile("EMP-ANALYST", name="本租户改过的分析师"))
    registry = ProfileRegistry(store=store)

    got = await registry.get("EMP-ANALYST", TENANT_A)
    assert got.name == "本租户改过的分析师"
    # 别的租户拿到的仍是内置定义
    assert (await registry.get("EMP-ANALYST", TENANT_B)).name == "数据分析师"


# ── C-5：执行面（runtimes）落库 + 拒绝陌生值 ────────────────────────────
#
# 锁死决策「**不许静默切换 Runtime**」的三条落点：
#   ① 写进去的要能原样读回来（重启后仍是它）；
#   ② 陌生值在**写侧**被拒（不落库、不回落默认）；
#   ③ 库里已有的坏值在**读侧**被拒（同样不回落默认）。


@pytest.mark.asyncio
async def test_runtimes_round_trip_through_the_database(pg_dsns, rls_schema: str) -> None:
    """判据：配的执行面能落库，**换一个 store 实例（= 重启）读回来仍是它**。"""
    _, app_dsn = pg_dsns
    await (await _store(app_dsn, rls_schema)).upsert(
        TENANT_A,
        _profile(runtimes=(RuntimeKind.CLAUDE_CODE, RuntimeKind.EXTERNAL_A2A)),
    )

    reloaded = await (await _store(app_dsn, rls_schema)).get(TENANT_A, "EMP-ORDER-ANALYST")
    assert reloaded is not None
    assert reloaded.runtimes == (RuntimeKind.CLAUDE_CODE, RuntimeKind.EXTERNAL_A2A)
    # revision 把 runtimes 算进摘要（A-6）：改了执行面就是换了一份定义
    assert reloaded.runtimes != _profile().runtimes


@pytest.mark.asyncio
async def test_an_unknown_runtime_is_rejected_on_write(pg_dsns, rls_schema: str) -> None:
    """陌生值**写不进去**——而不是被丢掉之后照常落库。"""
    _, app_dsn = pg_dsns
    store = await _store(app_dsn, rls_schema)
    with pytest.raises(ValueError, match="未知的执行面"):
        await store.upsert(TENANT_A, _profile(runtimes=("claude-code",)))  # 少了那个下划线
    assert await store.list(TENANT_A) == []  # 一行都没落


@pytest.mark.asyncio
async def test_a_corrupt_runtime_in_the_database_is_rejected_on_read(
    pg_dsns, rls_schema: str
) -> None:
    """库里被别处写坏时，**读的人当场知道**，而不是静默跑回默认执行面。"""
    _, app_dsn = pg_dsns
    store = await _store(app_dsn, rls_schema)
    await store.upsert(TENANT_A, _profile())

    conn = await psycopg.AsyncConnection.connect(app_dsn, autocommit=True)
    try:
        await conn.execute(f"SET search_path TO {rls_schema}")
        await conn.execute("select set_config('app.tenant_id', %s, false)", (TENANT_A,))
        await conn.execute(
            "UPDATE employee_profile SET runtimes = '{dsh}' WHERE profile_id = %s",
            ("EMP-ORDER-ANALYST",),
        )
    finally:
        await conn.close()

    with pytest.raises(ValueError, match="未知的执行面"):
        await store.get(TENANT_A, "EMP-ORDER-ANALYST")


_OLD_PROFILE_TABLE_DDL = """
CREATE TABLE IF NOT EXISTS employee_profile (
    profile_id    TEXT NOT NULL,
    tenant_id     TEXT NOT NULL,
    name          TEXT NOT NULL DEFAULT '',
    base_role     TEXT NOT NULL DEFAULT 'ontology',
    system_prompt TEXT NOT NULL DEFAULT '',
    skills        TEXT[] NOT NULL DEFAULT '{}',
    tools         TEXT[] NOT NULL DEFAULT '{}',
    model         TEXT NOT NULL DEFAULT 'glm-5.3-flash',
    action_rids   TEXT[] NOT NULL DEFAULT '{}',
    kb_ids        TEXT[] NOT NULL DEFAULT '{}',
    markings      TEXT[] NOT NULL DEFAULT '{}',
    origin        TEXT NOT NULL DEFAULT 'instantiated',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, profile_id)
)
"""


@pytest.mark.asyncio
async def test_the_default_runtimes_are_preserved_for_rows_written_before_the_column(
    pg_dsns,
) -> None:
    """**列存在之前写下的行**：迁移加列后读回来是默认 ``(superai,)``，不是空、不是报错。

    刻意用**旧 DDL**（没有 runtimes 列）建表并塞一行，再跑迁移——那就是"C-5
    之前就在跑的库"的样子。
    """
    admin_dsn, app_dsn = pg_dsns
    schema = "agent_team_profile_migrate_test"
    with psycopg.connect(admin_dsn, autocommit=True) as conn:
        conn.execute(f"DROP SCHEMA IF EXISTS {schema} CASCADE")
        conn.execute(f"CREATE SCHEMA {schema}")
        conn.execute(f"GRANT USAGE ON SCHEMA {schema} TO mate_app")
        conn.execute(f"SET search_path TO {schema}")
        conn.execute(_OLD_PROFILE_TABLE_DDL)
        conn.execute(
            "INSERT INTO employee_profile (profile_id, tenant_id, name)"
            " VALUES ('EMP-OLD', %s, '迁移前建的员工')",
            (TENANT_A,),
        )
        bootstrap_profiles(conn)
        bootstrap_profiles(conn)  # 幂等：再跑一次也成功
    try:
        got = await ProfileStore(app_dsn, schema=schema).get(TENANT_A, "EMP-OLD")
        assert got is not None
        assert got.name == "迁移前建的员工"  # 行没丢
        assert got.runtimes == (RuntimeKind.SUPERAI,)  # 默认被保留
    finally:
        with psycopg.connect(admin_dsn, autocommit=True) as conn:
            conn.execute(f"DROP SCHEMA IF EXISTS {schema} CASCADE")


# ── C-5：HTTP 面暴露 runtimes（请求模型校验 + 响应回显）──────────────────


class _StubProfileStore:
    """HTTP 面的替身：只验路由 / 契约 / 校验，不验落库（那是上面几条的事）。

    刻意**不碰真 PG**：HTTP 层的 TestClient 起的是自己的事件循环，与 pytest 的
    selector 策略不是同一个（Windows 上 psycopg 的 async 连接只在 selector 上
    能跑）。真库往返在上面那几条里已经验过，这里只关心"字段进得来、出得去"。
    """

    def __init__(self) -> None:
        self.rows: dict[tuple[str, str], EmployeeProfile] = {}

    async def upsert(self, tenant_id: str, profile: EmployeeProfile) -> EmployeeProfile:
        self.rows[(tenant_id, profile.profile_id)] = profile
        return profile

    async def get(self, tenant_id: str, profile_id: str) -> EmployeeProfile | None:
        return self.rows.get((tenant_id, profile_id))

    async def list(self, tenant_id: str) -> list[EmployeeProfile]:
        return [p for (tenant, _), p in self.rows.items() if tenant == tenant_id]


def _client(store: _StubProfileStore) -> TestClient:
    return TestClient(
        create_app(
            profile_registry=ProfileRegistry(store=store),
            profile_store=store,  # type: ignore[arg-type]
        )
    )


def test_the_http_surface_carries_and_echoes_runtimes(auth_headers: dict[str, str]) -> None:
    store = _StubProfileStore()
    with _client(store) as client:
        created = client.post(
            f"{BASE}/profiles",
            json={"name": "外部执行员工", "runtimes": ["claude_code"]},
            headers=auth_headers,
        )
        assert created.status_code == 201, created.text
        body = created.json()
        assert body["runtimes"] == ["claude_code"]

        # **读回来仍是它**（这就是"配置要能落库、重启后保持"在接口层的形态）
        profile_id = body["profile_id"]
        got = client.get(f"{BASE}/profiles/{profile_id}", headers=auth_headers)
        assert got.status_code == 200, got.text
        assert got.json()["runtimes"] == ["claude_code"]


def test_omitting_runtimes_keeps_the_default(auth_headers: dict[str, str]) -> None:
    """存量调用方一个字段都不传时，行为不变（默认 ``superai``）。"""
    with _client(_StubProfileStore()) as client:
        created = client.post(
            f"{BASE}/profiles", json={"name": "没写执行面的员工"}, headers=auth_headers
        )
        assert created.status_code == 201, created.text
        assert created.json()["runtimes"] == ["superai"]


def test_an_unknown_or_empty_runtime_is_rejected_over_http(auth_headers: dict[str, str]) -> None:
    """**不许静默切换 Runtime**：陌生名字 422，空数组同样 422（不落回默认）。"""
    with _client(_StubProfileStore()) as client:
        unknown = client.post(
            f"{BASE}/profiles",
            json={"name": "拼错了", "runtimes": ["claude-code"]},
            headers=auth_headers,
        )
        assert unknown.status_code == 422, unknown.text
        empty = client.post(
            f"{BASE}/profiles", json={"name": "空清单", "runtimes": []}, headers=auth_headers
        )
        assert empty.status_code == 422, empty.text
