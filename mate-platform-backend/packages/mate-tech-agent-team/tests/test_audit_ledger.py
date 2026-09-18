"""A-1 / `MP-AUDIT-LEDGER-01`：持久、可取证、带哈希链的 Agent 审计。

判据（本文件逐条断言）：

1. **重启后可查** —— 换一个账本实例（= 进程重启）仍读得到同一批行。
2. **多副本合并视图一致** —— 两个实例并发/交替写同一租户，读出来是**一条**链，
   序号不重不漏。
3. **篡改可检出** —— 改一个字、删一行、换一次序，哈希链都能指出断在哪。
4. **跨租户查询被拒** —— 表在 RLS 下（``mate_app`` 角色），换租户读不到别人的行；
   ``records()`` 的 ``tenant_id`` 是**必填关键字参数**，没有"全租户"这条路径。
5. **append-only** —— 应用角色连 UPDATE/DELETE 的权限都没有。
6. **投递复用平台既有 Outbox** —— 落库同时产出一条 ``agent.audit.recorded`` 事件，
   能经平台既有的 relay 送出去；投递失败**不回滚**已落的审计行。
"""

from __future__ import annotations

import dataclasses
from typing import Any

import pytest
from mate_tech_agent_team.audit import (
    AUDIT_APPROVAL,
    AUDIT_EVENT_TYPE,
    AUDIT_SPAWN,
    AUDIT_TABLE,
    GENESIS_HASH,
    AuditLog,
    PgAuditLedger,
    verify_records,
)

from mate_platform.messaging.outbox import EventTypeTopicResolver, InMemoryOutboxWriter, OutboxRelay

TENANT = "tenant-acme"
OTHER = "tenant-other"


async def _seed(
    log: Any, *, tenant_id: str = TENANT, count: int = 3, run_id: str = "run-1"
) -> None:
    for index in range(count):
        await log.append(
            action=AUDIT_SPAWN,
            tenant_id=tenant_id,
            actor="u-1",
            task_id=f"t{index}",
            run_id=run_id,
            profile_id="EMP-X",
            outcome="granted",
            decision="granted",
            policy_version="authority-envelope/v1",
        )


# ── 判据 3：哈希链自身 ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_rows_are_chained_and_verifiable() -> None:
    log = AuditLog()
    await _seed(log, count=3)
    rows = await log.records(tenant_id=TENANT)

    assert [r.sequence for r in rows] == [1, 2, 3]
    assert rows[0].previous_hash == GENESIS_HASH, "链首必须接在 GENESIS 上"
    assert rows[1].previous_hash == rows[0].event_hash
    assert rows[2].previous_hash == rows[1].event_hash
    assert len({r.event_hash for r in rows}) == 3, "摘要不该重复"

    result = await log.verify(tenant_id=TENANT)
    assert result.ok and result.checked == 3


@pytest.mark.asyncio
async def test_editing_a_row_breaks_the_chain() -> None:
    log = AuditLog()
    await _seed(log, count=3)
    rows = await log.records(tenant_id=TENANT)

    forged = dataclasses.replace(rows[1], outcome="forged")
    result = verify_records([rows[0], forged, rows[2]])
    assert not result.ok
    assert result.broken_at == 2
    assert "event_hash" in result.reason


@pytest.mark.asyncio
async def test_deleting_a_row_breaks_the_chain() -> None:
    """删一行：序号跳跃 + 下一条的 previous_hash 接不上，两处都能露出来。"""
    log = AuditLog()
    await _seed(log, count=3)
    rows = await log.records(tenant_id=TENANT)

    result = verify_records([rows[0], rows[2]])
    assert not result.ok
    assert result.broken_at == 3
    assert "previous_hash" in result.reason


@pytest.mark.asyncio
async def test_reordering_rows_breaks_the_chain() -> None:
    """换序：第一条就接不到 GENESIS 上，链从这里断。"""
    log = AuditLog()
    await _seed(log, count=3)
    rows = await log.records(tenant_id=TENANT)

    result = verify_records([rows[1], rows[0], rows[2]])
    assert not result.ok, "换了序还验得过 = 链只认内容不认顺序"
    assert result.broken_at == 2


@pytest.mark.asyncio
async def test_the_chain_is_per_tenant() -> None:
    """两个租户各自成链：各自从 1 起，互不插队（多副本合并读也读得清）。"""
    log = AuditLog()
    await log.append(action=AUDIT_SPAWN, tenant_id=TENANT, run_id="r-a")
    await log.append(action=AUDIT_SPAWN, tenant_id=OTHER, run_id="r-b")
    await log.append(action=AUDIT_SPAWN, tenant_id=TENANT, run_id="r-a")

    acme = await log.records(tenant_id=TENANT)
    other = await log.records(tenant_id=OTHER)
    assert [r.sequence for r in acme] == [1, 2]
    assert [r.sequence for r in other] == [1]
    assert acme[0].previous_hash == GENESIS_HASH
    assert other[0].previous_hash == GENESIS_HASH
    assert (await log.verify(tenant_id=TENANT)).ok
    assert (await log.verify(tenant_id=OTHER)).ok


# ── 判据 4：租户过滤不是"调用方责任"────────────────────────────────────


@pytest.mark.asyncio
async def test_records_requires_a_tenant() -> None:
    """``tenant_id`` 是必填关键字参数——没有"不传就是全租户"这条默认路径。"""
    log = AuditLog()
    await _seed(log)
    with pytest.raises(TypeError):
        await log.records()  # type: ignore[call-arg]


@pytest.mark.asyncio
async def test_records_only_returns_the_asked_tenant() -> None:
    log = AuditLog()
    await _seed(log, tenant_id=TENANT, count=2)
    await _seed(log, tenant_id=OTHER, count=5)

    assert len(await log.records(tenant_id=TENANT)) == 2
    assert len(await log.records(tenant_id=OTHER)) == 5
    assert await log.records(tenant_id="tenant-nobody") == []


@pytest.mark.asyncio
async def test_records_filters_by_run_and_action() -> None:
    log = AuditLog()
    await _seed(log, count=2, run_id="run-1")
    await _seed(log, count=1, run_id="run-2")
    await log.append(action=AUDIT_APPROVAL, tenant_id=TENANT, run_id="run-2")

    assert len(await log.records(tenant_id=TENANT, run_id="run-1")) == 2
    approvals = await log.records(tenant_id=TENANT, action=AUDIT_APPROVAL)
    assert [r.action for r in approvals] == [AUDIT_APPROVAL]
    assert len(await log.records(tenant_id=TENANT, limit=1)) == 1


# ── 判据 6：投递复用平台既有 Outbox ─────────────────────────────────────


class _RecordingProducer:
    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []

    def send(self, *, topic: str, key: str, value: bytes, headers: dict[str, str]) -> None:
        self.sent.append({"topic": topic, "key": key, "value": value, "headers": headers})


@pytest.mark.asyncio
async def test_audit_rows_go_through_the_platform_outbox() -> None:
    """落库的同时产出一条平台既有形状的 ``Event``，且能被既有 relay 送出去。"""
    outbox = InMemoryOutboxWriter()
    log = AuditLog(outbox=outbox)
    await _seed(log, count=1, run_id="run-42")

    pending = outbox.fetch_pending()
    assert len(pending) == 1, pending
    event = pending[0].event
    assert event.type == AUDIT_EVENT_TYPE
    assert event.tenant_id == TENANT
    assert event.aggregate_id == "run-42"
    assert event.payload["event_hash"]

    producer = _RecordingProducer()
    sent = OutboxRelay(
        outbox=outbox, producer=producer, topic_resolver=EventTypeTopicResolver()
    ).drain_once()
    assert sent == 1
    assert producer.sent[0]["headers"]["tenant_id"] == TENANT
    assert producer.sent[0]["headers"]["event_type"] == AUDIT_EVENT_TYPE


@pytest.mark.asyncio
async def test_a_broken_delivery_does_not_lose_the_audit_row() -> None:
    """投递通道挂了 ≠ 这次审批没记录：审计行照落，失败只作为一条告警。"""

    class _BrokenOutbox:
        def append(self, event: Any) -> None:
            raise RuntimeError("kafka 挂了")

    log = AuditLog(outbox=_BrokenOutbox())  # type: ignore[arg-type]
    record = await log.append(action=AUDIT_APPROVAL, tenant_id=TENANT, run_id="run-x")

    assert record.event_hash
    rows = await log.records(tenant_id=TENANT, run_id="run-x")
    assert len(rows) == 1, "投递失败不该把已经落下的审计行一起丢掉"


@pytest.mark.asyncio
async def test_missing_tenant_is_refused() -> None:
    log = AuditLog()
    with pytest.raises(ValueError, match="租户"):
        await log.append(action=AUDIT_SPAWN, tenant_id="")


# ── 判据 1 / 2 / 4 / 5：PG 账本（真库，RLS 必须在这里验）──────────────────


@pytest.mark.asyncio
async def test_pg_ledger_survives_a_restart(rls_schema: str, pg_dsns: tuple[str, str]) -> None:
    """换一个账本实例（= 进程重启）读同一批行：行在、链在、序号在。"""
    _, app_dsn = pg_dsns
    writer = PgAuditLedger(app_dsn, schema=rls_schema)
    await _seed(writer, count=3)

    after_restart = PgAuditLedger(app_dsn, schema=rls_schema)
    rows = await after_restart.records(tenant_id=TENANT)
    assert [r.sequence for r in rows] == [1, 2, 3]
    assert rows[0].previous_hash == GENESIS_HASH
    assert (await after_restart.verify(tenant_id=TENANT)).ok


@pytest.mark.asyncio
async def test_two_replicas_append_one_consistent_chain(
    rls_schema: str, pg_dsns: tuple[str, str]
) -> None:
    """两个实例交替写同一租户 → 合并读出来是**一条**链（序号 1..6 不重不漏）。"""
    _, app_dsn = pg_dsns
    replica_a = PgAuditLedger(app_dsn, schema=rls_schema)
    replica_b = PgAuditLedger(app_dsn, schema=rls_schema)

    await replica_a.append(action=AUDIT_SPAWN, tenant_id=TENANT, run_id="run-1")
    await replica_b.append(action=AUDIT_SPAWN, tenant_id=TENANT, run_id="run-1")
    await replica_a.append(action=AUDIT_APPROVAL, tenant_id=TENANT, run_id="run-1")
    await replica_b.append(action=AUDIT_APPROVAL, tenant_id=TENANT, run_id="run-1")

    rows = await replica_a.records(tenant_id=TENANT)
    assert [r.sequence for r in rows] == [1, 2, 3, 4], "并发写把序号写重了或写漏了"
    verification = await replica_b.verify(tenant_id=TENANT)
    assert verification.ok, verification


@pytest.mark.asyncio
async def test_pg_tampering_is_detected(rls_schema: str, pg_dsns: tuple[str, str]) -> None:
    """绕过应用角色、用 admin 直接改一行 → 链在那一行断开。"""
    import psycopg

    admin_dsn, app_dsn = pg_dsns
    ledger = PgAuditLedger(app_dsn, schema=rls_schema)
    await _seed(ledger, count=3)
    assert (await ledger.verify(tenant_id=TENANT)).ok

    with psycopg.connect(admin_dsn, autocommit=True) as conn:
        conn.execute(f"SET search_path TO {rls_schema}")
        conn.execute(
            f"UPDATE {AUDIT_TABLE} SET outcome = 'forged' WHERE tenant_id = %s AND sequence = 2",
            (TENANT,),
        )

    result = await ledger.verify(tenant_id=TENANT)
    assert not result.ok
    assert result.broken_at == 2


@pytest.mark.asyncio
async def test_the_app_role_cannot_rewrite_history(
    rls_schema: str, pg_dsns: tuple[str, str]
) -> None:
    """append-only 在**权限层**成立：应用角色没有 UPDATE / DELETE 的授权。"""
    import psycopg

    _, app_dsn = pg_dsns
    await _seed(PgAuditLedger(app_dsn, schema=rls_schema), count=1)

    # UPDATE 与 DELETE 各开一条连接：`SET search_path` / `set_config` 都是事务内的，
    # 一次失败回滚会把它们一起撤销，再接着用同一条连接就查不到表了。
    for statement in (
        f"UPDATE {AUDIT_TABLE} SET outcome = 'x' WHERE tenant_id = %s",
        f"DELETE FROM {AUDIT_TABLE} WHERE tenant_id = %s",
    ):
        async with await psycopg.AsyncConnection.connect(app_dsn) as conn:
            await conn.execute(f"SET search_path TO {rls_schema}")
            await conn.execute("select set_config('app.tenant_id', %s, false)", (TENANT,))
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                await conn.execute(statement, (TENANT,))


@pytest.mark.asyncio
async def test_pg_rls_hides_another_tenants_rows(rls_schema: str, pg_dsns: tuple[str, str]) -> None:
    """跨租户读被 RLS 拒：同一个库里两个租户都有行，GUC=acme 时只看得见 acme 的。"""
    import psycopg

    _, app_dsn = pg_dsns
    ledger = PgAuditLedger(app_dsn, schema=rls_schema)
    await _seed(ledger, tenant_id=TENANT, count=2)
    await _seed(ledger, tenant_id=OTHER, count=3)

    async with await psycopg.AsyncConnection.connect(app_dsn) as conn:
        await conn.execute(f"SET search_path TO {rls_schema}")
        await conn.execute("select set_config('app.tenant_id', %s, false)", (TENANT,))
        cur = await conn.execute(f"SELECT count(*) FROM {AUDIT_TABLE}")
        assert (await cur.fetchone())[0] == 2, "RLS 没挡住跨租户读"

    assert len(await ledger.records(tenant_id=TENANT)) == 2
    assert len(await ledger.records(tenant_id=OTHER)) == 3


# ── 生产装配防回归（closeout 批）────────────────────────────────────────────
# 实测踩过：`main._lifespan` 建 bus 时漏传 `audit=`，而 `build_service` 只在
# **不传** bus 时才会自己挂 PG 账本——生产装配下审计全落进程内账本、重启即失
# （表是迁移 Job 建的，一行都没进去）。账本本体有 16 条用例，但它们都直接构造
# `PgAuditLedger`，测不到"装配有没有接上"。这里用源码断言钉住装配形态（与
# test_sandbox_isolation 对 `{**os.environ}` 的 AST 断言同一手法）。


def test_the_production_lifespan_wires_the_pg_audit_ledger() -> None:
    import ast
    import pathlib

    from mate_tech_agent_team import main

    source = pathlib.Path(main.__file__).read_text(encoding="utf-8")
    calls = [
        node
        for node in ast.walk(ast.parse(source))
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "build_team_bus"
    ]
    assert calls, "main._lifespan 里找不到 build_team_bus(...) 调用"
    wired = any(kw.arg == "audit" for kw in calls[0].keywords)
    assert wired, (
        "生产装配的 build_team_bus(...) 必须显式传 audit=（PG 账本）："
        "漏传时 build_service 不会替你补——bus 一旦由调用方传入，它内部的"
        "audit 默认就再也不生效（closeout 批 ⑧ 的实测教训）。"
    )
