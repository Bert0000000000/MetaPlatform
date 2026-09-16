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
from mate_tech_agent_team.profile_store import ProfileStore
from mate_tech_agent_team.profiles import EmployeeProfile, ProfileRegistry

TENANT_A = "tenant-acme"
TENANT_B = "tenant-bigo"


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
