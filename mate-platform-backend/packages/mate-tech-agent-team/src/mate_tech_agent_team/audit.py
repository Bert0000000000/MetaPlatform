"""Agent Team 审计面（硬规则 #9 · A-1 / `MP-AUDIT-LEDGER-01`）。

派活、越权转 proposal、审批三件事各落一行。1.4 起这三件事就有记录了，但那时是
**进程内、上限 1 万、重启即丢、多副本各存一份**——那叫日志，不叫审计：事后问
"谁派的、谁批的、批的是什么"，重启一次就答不上来。本模块把同一份记录做成
**持久、可取证、可检篡改**的。

事件形状（顺序即哈希口径，见 :data:`CHAIN_FIELDS`）::

    AgentAuditEvent
    ├─ event_id / tenant_id / sequence
    ├─ run_id / task_id / actor_id(actor) / agent_profile_revision
    ├─ action / decision / approver_id / outcome
    ├─ authority_before / authority_after / policy_version
    ├─ trace_id
    ├─ event_hash / previous_hash        ← 哈希链，可检出篡改
    └─ created_at(at)

**哈希链按租户成链**：``previous_hash`` 取该租户上一条的 ``event_hash``，
``sequence`` 是租户内单调序号。跨租户不成链——于是"多副本合并读"出来的是每条链
各自的完整序列，不会因为两个租户的行互相插队而读不出顺序。

**两个实现，同一套哈希**：:class:`AuditLog`（进程内，单副本与测试的默认）与
:class:`PgAuditLedger`（PG：RLS 强制租户隔离 + append-only 授权）。
哈希一律由 :func:`compute_event_hash` 算——两边必须逐字相同，否则
"多副本合并视图一致"只是句口号。

**投递复用平台既有 Outbox**（PLATFORM-EVENT-01）：接上 ``OutboxWriter`` 时，
落库的同时追加一条 ``agent.audit.recorded`` 事件，由既有的 relay 送到 Kafka。
**不新造总线**；没接就只落库（单副本部署的行为）。投递失败**不回滚**已落库的
审计行——那等于"因为 Kafka 挂了，所以这次审批不算数"。反过来也不成立：
落库才是证据，投递只是通道。

**保留**既有 ``metaplatform.audit.agent_team`` logger 通道（不删，只是不再作为
唯一依赖）。

**查询强制带租户**：:meth:`records` 的 ``tenant_id`` 是**必填关键字参数**——
没有"不传就是全租户"这条默认路径。再叠一层 PG 的 RLS，写错也读不到别人的行。
"""

from __future__ import annotations

import hashlib
import json
import logging
import uuid
from collections.abc import AsyncIterator, Mapping
from contextlib import asynccontextmanager
from dataclasses import dataclass, field, replace
from datetime import UTC, datetime
from typing import Any, Protocol

import psycopg

from mate_platform.messaging.events import Event
from mate_platform.messaging.outbox import OutboxWriter

logger = logging.getLogger("metaplatform.audit.agent_team")

#: 被审计的动作。
AUDIT_SPAWN = "agent_team.spawn"
AUDIT_ESCALATION = "agent_team.authority_escalation"
AUDIT_APPROVAL = "agent_team.approval"
#: 运行期委托身份的签发与拒绝（A-2 / ADR-0067）。**签发失败也要落行**：
#: "为什么这一轮没有以用户身份跑"要答得出来。
AUDIT_DELEGATION = "agent_team.delegation"

#: 投递到 Outbox 的事件类型（``<domain>.<aggregate>.<action>``，见 ``Event.create``）。
AUDIT_EVENT_TYPE = "agent.audit.recorded"

SCHEMA = "agent_team"
AUDIT_TABLE = "audit_events"

#: 链首的 ``previous_hash``（64 个 0，sha256 的宽度）。
GENESIS_HASH = "0" * 64

#: **进哈希的字段**。改这个元组 = 改哈希口径，等于让既有链全部失效——
#: 所以它列在这里当契约，而不是散在两次 ``json.dumps`` 的调用点。
CHAIN_FIELDS: tuple[str, ...] = (
    "tenant_id",
    "sequence",
    "event_id",
    "audit_id",
    "action",
    "actor",
    "task_id",
    "run_id",
    "profile_id",
    "agent_profile_revision",
    "outcome",
    "decision",
    "approver_id",
    "authority_before",
    "authority_after",
    "policy_version",
    "trace_id",
    "detail",
    "at",
)


def _now() -> str:
    return datetime.now(UTC).isoformat()


def compute_event_hash(*, previous_hash: str, body: Mapping[str, Any]) -> str:
    """``sha256(previous_hash ‖ 规范化后的正文)``。

    ``sort_keys=True`` + 紧凑分隔符 = 同一个正文在任何实现、任何进程里都算出同一个
    摘要；``ensure_ascii=False`` 保留原字符，免得"中文被转义"成为一次假的不一致。
    """
    canonical = json.dumps(
        {"previous_hash": previous_hash, "body": dict(body)},
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        default=str,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


@dataclass(frozen=True, slots=True)
class AuditRecord:
    """一行审计（= roadmap 的 ``AgentAuditEvent``）。

    后 12 个字段是 A-1 新增的：前 5 个是**取证要的料**（谁批的、批成什么、
    依哪一版策略、授权前后各是什么），后 7 个是**可检篡改的链**。
    """

    audit_id: str
    action: str
    tenant_id: str
    actor: str
    task_id: str
    run_id: str
    profile_id: str
    outcome: str
    at: str
    detail: dict[str, Any] = field(default_factory=dict)
    # ── A-1：取证字段 ────────────────────────────────────────────────────
    sequence: int = 0
    event_id: str = ""
    agent_profile_revision: str = ""
    decision: str = ""
    approver_id: str = ""
    authority_before: dict[str, Any] = field(default_factory=dict)
    authority_after: dict[str, Any] = field(default_factory=dict)
    policy_version: str = ""
    trace_id: str = ""
    # ── A-1：哈希链 ──────────────────────────────────────────────────────
    previous_hash: str = ""
    event_hash: str = ""

    def body(self) -> dict[str, Any]:
        """进哈希的正文（口径 = :data:`CHAIN_FIELDS`）。"""
        return {name: getattr(self, name) for name in CHAIN_FIELDS}

    def chained(self, *, previous_hash: str, sequence: int) -> AuditRecord:
        """把它接到链上：定序号、算摘要，返回**新**记录（本类型不可变）。"""
        linked = replace(self, sequence=sequence, previous_hash=previous_hash)
        return replace(
            linked, event_hash=compute_event_hash(previous_hash=previous_hash, body=linked.body())
        )

    def to_dict(self) -> dict[str, Any]:
        """对外形态（HTTP 响应 / Outbox payload）。链字段一并给出——审计员要能自己验。"""
        return {
            "audit_id": self.audit_id,
            "action": self.action,
            "tenant_id": self.tenant_id,
            "actor": self.actor,
            "task_id": self.task_id,
            "run_id": self.run_id,
            "profile_id": self.profile_id,
            "outcome": self.outcome,
            "detail": dict(self.detail),
            "at": self.at,
            "sequence": self.sequence,
            "event_id": self.event_id,
            "agent_profile_revision": self.agent_profile_revision,
            "decision": self.decision,
            "approver_id": self.approver_id,
            "authority_before": dict(self.authority_before),
            "authority_after": dict(self.authority_after),
            "policy_version": self.policy_version,
            "trace_id": self.trace_id,
            "previous_hash": self.previous_hash,
            "event_hash": self.event_hash,
        }


@dataclass(frozen=True, slots=True)
class ChainVerification:
    """一条租户链的核验结论。``broken_at`` = 第一条对不上的 ``sequence``（0 = 没断）。"""

    ok: bool
    checked: int
    broken_at: int = 0
    reason: str = ""
    truncated: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "checked": self.checked,
            "broken_at": self.broken_at,
            "reason": self.reason,
            "truncated": self.truncated,
        }


def verify_records(
    records: list[AuditRecord], *, anchor_hash: str = GENESIS_HASH, truncated: bool = False
) -> ChainVerification:
    """核验一串**按 sequence 升序**的行：每行的摘要对不对、前后是否首尾相接。

    任何一处被改过（改字、删行、换序）都会在这里露出来：改字 → 该行摘要对不上；
    删行 → 下一行的 ``previous_hash`` 接不上；换序 → 序号不单调。
    """
    expected_previous = anchor_hash
    checked = 0
    for index, record in enumerate(records):
        if index > 0 and record.sequence <= records[index - 1].sequence:
            return ChainVerification(
                ok=False,
                checked=checked,
                broken_at=record.sequence,
                reason=f"序号不单调：{records[index - 1].sequence} → {record.sequence}",
                truncated=truncated,
            )
        if record.previous_hash != expected_previous:
            return ChainVerification(
                ok=False,
                checked=checked,
                broken_at=record.sequence,
                reason="previous_hash 与上一条的 event_hash 对不上（中间被删或改过）",
                truncated=truncated,
            )
        recomputed = compute_event_hash(previous_hash=record.previous_hash, body=record.body())
        if recomputed != record.event_hash:
            return ChainVerification(
                ok=False,
                checked=checked,
                broken_at=record.sequence,
                reason="event_hash 与正文重算结果不一致（这一行被改过）",
                truncated=truncated,
            )
        expected_previous = record.event_hash
        checked += 1
    return ChainVerification(ok=True, checked=checked, truncated=truncated)


class AuditSink(Protocol):
    """审计账本面。**三个方法都是 async**——PG 实现在请求路径上，不能阻塞事件循环。"""

    async def append(
        self,
        *,
        action: str,
        tenant_id: str,
        actor: str = "",
        task_id: str = "",
        run_id: str = "",
        profile_id: str = "",
        outcome: str = "",
        detail: dict[str, Any] | None = None,
        decision: str = "",
        approver_id: str = "",
        agent_profile_revision: str = "",
        authority_before: Mapping[str, Any] | None = None,
        authority_after: Mapping[str, Any] | None = None,
        policy_version: str = "",
        trace_id: str = "",
    ) -> AuditRecord: ...

    async def records(
        self,
        *,
        tenant_id: str,
        task_id: str | None = None,
        run_id: str | None = None,
        action: str | None = None,
        limit: int | None = None,
    ) -> list[AuditRecord]: ...

    async def verify(self, *, tenant_id: str) -> ChainVerification: ...


def _new_event(record: AuditRecord) -> Event:
    """把一行审计包成平台既有的 ``Event``（Outbox 的投递形状）。"""
    return Event.create(
        type=AUDIT_EVENT_TYPE,
        tenant_id=record.tenant_id,
        aggregate_id=record.run_id or record.task_id or record.audit_id,
        payload=record.to_dict(),
        trace_id=record.trace_id,
        event_id=record.event_id,
    )


class AuditLog:
    """append-only 的进程内审计账本（单副本与测试的默认实现）。

    与 :class:`PgAuditLedger` **同一套哈希**：同一条输入在两边算出同一个
    ``event_hash``。这是"多副本合并视图一致"能被断言的前提。

    ``max_records`` 是内存护栏（按条数裁掉最旧的）。裁掉**不破坏链**：
    每个租户的链头（最后一条的序号与摘要）单独记着，裁掉的只是历史行，
    后续行照旧接得上。被裁过时 :meth:`verify` 会如实标 ``truncated``。
    """

    def __init__(self, *, max_records: int = 10_000, outbox: OutboxWriter | None = None) -> None:
        self._tag = uuid.uuid4().hex[:6]
        self._records: list[AuditRecord] = []
        self._max_records = max_records
        #: 每租户的链头：``(最后一条的 sequence, 最后一条的 event_hash)``。
        self._heads: dict[str, tuple[int, str]] = {}
        self._outbox = outbox
        self._seq = 0

    async def append(
        self,
        *,
        action: str,
        tenant_id: str,
        actor: str = "",
        task_id: str = "",
        run_id: str = "",
        profile_id: str = "",
        outcome: str = "",
        detail: dict[str, Any] | None = None,
        decision: str = "",
        approver_id: str = "",
        agent_profile_revision: str = "",
        authority_before: Mapping[str, Any] | None = None,
        authority_after: Mapping[str, Any] | None = None,
        policy_version: str = "",
        trace_id: str = "",
    ) -> AuditRecord:
        if not tenant_id:
            raise ValueError("审计必须带租户上下文（硬规则 3）")
        self._seq += 1
        head_seq, head_hash = self._heads.get(tenant_id, (0, GENESIS_HASH))
        record = AuditRecord(
            audit_id=f"audit-{self._tag}-{self._seq}",
            action=action,
            tenant_id=tenant_id,
            actor=actor,
            task_id=task_id,
            run_id=run_id,
            profile_id=profile_id,
            outcome=outcome,
            at=_now(),
            detail=dict(detail or {}),
            event_id=str(uuid.uuid4()),
            agent_profile_revision=agent_profile_revision,
            decision=decision,
            approver_id=approver_id,
            authority_before=dict(authority_before or {}),
            authority_after=dict(authority_after or {}),
            policy_version=policy_version,
            trace_id=trace_id,
        ).chained(previous_hash=head_hash, sequence=head_seq + 1)

        self._records.append(record)
        self._heads[tenant_id] = (record.sequence, record.event_hash)
        if len(self._records) > self._max_records:
            del self._records[: len(self._records) - self._max_records]
        # 结构化日志侧同出一份（``metaplatform.audit.*`` 是既有的审计通道，不删）。
        logger.info(record.action, extra=record.to_dict())
        self._deliver(record)
        return record

    def _deliver(self, record: AuditRecord) -> None:
        """往平台既有 Outbox 追加一条。**投递失败不回滚已落的审计行**。"""
        if self._outbox is None:
            return
        try:
            self._outbox.append(_new_event(record))
        except Exception as exc:
            logger.warning(
                "audit.outbox.failed",
                extra={"audit_id": record.audit_id, "error": str(exc)},
            )

    async def records(
        self,
        *,
        tenant_id: str,
        task_id: str | None = None,
        run_id: str | None = None,
        action: str | None = None,
        limit: int | None = None,
    ) -> list[AuditRecord]:
        """按条件列行（时间序）。``tenant_id`` **必填**——没有"全租户"这条路径。"""
        rows = [
            r
            for r in self._records
            if r.tenant_id == tenant_id
            and (task_id is None or r.task_id == task_id)
            and (run_id is None or r.run_id == run_id)
            and (action is None or r.action == action)
        ]
        return rows[-limit:] if limit else rows

    async def verify(self, *, tenant_id: str) -> ChainVerification:
        rows = [r for r in self._records if r.tenant_id == tenant_id]
        if not rows:
            return ChainVerification(ok=True, checked=0)
        # 被裁过时，第一条保留行的 previous_hash 是可信锚点（它本来就是链的一部分）；
        # 没被裁过就必须从链首（GENESIS）起算。
        truncated = rows[0].sequence > 1
        anchor = rows[0].previous_hash if truncated else GENESIS_HASH
        return verify_records(rows, anchor_hash=anchor, truncated=truncated)

    def __len__(self) -> int:
        return len(self._records)


# ── PG 实现 ──────────────────────────────────────────────────────────────

_AUDIT_DDL = f"""
CREATE TABLE IF NOT EXISTS {AUDIT_TABLE} (
    tenant_id              TEXT   NOT NULL,
    sequence               BIGINT NOT NULL,
    audit_id               TEXT   NOT NULL,
    event_id               TEXT   NOT NULL,
    action                 TEXT   NOT NULL,
    actor                  TEXT   NOT NULL DEFAULT '',
    task_id                TEXT   NOT NULL DEFAULT '',
    run_id                 TEXT   NOT NULL DEFAULT '',
    profile_id             TEXT   NOT NULL DEFAULT '',
    agent_profile_revision TEXT   NOT NULL DEFAULT '',
    outcome                TEXT   NOT NULL DEFAULT '',
    decision               TEXT   NOT NULL DEFAULT '',
    approver_id            TEXT   NOT NULL DEFAULT '',
    authority_before       JSONB  NOT NULL DEFAULT '{{}}'::jsonb,
    authority_after        JSONB  NOT NULL DEFAULT '{{}}'::jsonb,
    policy_version         TEXT   NOT NULL DEFAULT '',
    trace_id               TEXT   NOT NULL DEFAULT '',
    detail                 JSONB  NOT NULL DEFAULT '{{}}'::jsonb,
    previous_hash          TEXT   NOT NULL,
    event_hash             TEXT   NOT NULL,
    at                     TEXT   NOT NULL,
    PRIMARY KEY (tenant_id, sequence)
)
"""

_AUDIT_INDEX = (
    f"CREATE INDEX IF NOT EXISTS {AUDIT_TABLE}_run_idx"
    f" ON {AUDIT_TABLE} (tenant_id, run_id, sequence)"
)

#: 与 ``team_task`` / ``cancel_signals`` 用的是**同一套**策略写法。
#: 授权刻意只给 ``SELECT, INSERT``：**append-only 在权限层就成立**，
#: 应用角色连改一行的能力都没有（改不了，也就谈不上"改了没被发现"）。
_RLS_DDL = """
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
ALTER TABLE {table} FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_iso ON {table};
CREATE POLICY tenant_iso ON {table}
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT ON {table} TO {app_role};
"""

_INSERT_SQL = f"""
INSERT INTO {AUDIT_TABLE} (
    tenant_id, sequence, audit_id, event_id, action, actor, task_id, run_id,
    profile_id, agent_profile_revision, outcome, decision, approver_id,
    authority_before, authority_after, policy_version, trace_id, detail,
    previous_hash, event_hash, at
) VALUES (
    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
    %s::jsonb, %s::jsonb, %s, %s, %s::jsonb, %s, %s, %s
)
"""

_SELECT_HEAD_SQL = (
    f"SELECT sequence, event_hash FROM {AUDIT_TABLE}"
    " WHERE tenant_id = %s ORDER BY sequence DESC LIMIT 1"
)


def bootstrap_audit(conn: psycopg.Connection[Any], app_role: str = "mate_app") -> None:
    """建审计表 + RLS + append-only 授权（幂等）。``conn`` 必须是 **admin** 连接。"""
    conn.execute(_AUDIT_DDL)
    conn.execute(_AUDIT_INDEX)
    conn.execute(_RLS_DDL.format(table=AUDIT_TABLE, app_role=app_role))


class PgAuditLedger:
    """PG 审计账本：重启后仍可查，多副本共读同一条链。

    连接随每次调用开闭（审计是低频操作，不为此引入连接池——连接池是 2.1-B
    的 ``MP-RUNTIME-DB-POOL-01``）。

    **成链的原子性**靠 ``pg_advisory_xact_lock(hashtext(tenant_id))``：同一租户的
    并发 append 被串行化，于是"读链头 → 算摘要 → 插入"之间没有窗口。用
    ``SELECT ... FOR UPDATE`` 挡不住"表还空着"这一情形（没有行可锁），
    而 advisory lock 不需要先有行。
    """

    def __init__(
        self,
        dsn: str,
        schema: str = SCHEMA,
        *,
        outbox: OutboxWriter | None = None,
    ) -> None:
        self._dsn = dsn
        self._schema = schema
        self._outbox = outbox

    @asynccontextmanager
    async def _conn(
        self, tenant_id: str, *, autocommit: bool = True
    ) -> AsyncIterator[psycopg.AsyncConnection[Any]]:
        conn = await psycopg.AsyncConnection.connect(self._dsn, autocommit=autocommit)
        try:
            await conn.execute(f"SET search_path TO {self._schema}")
            # set_config() 而非 SET x = %s：后者不接受参数绑定。
            await conn.execute("select set_config('app.tenant_id', %s, false)", (tenant_id,))
            yield conn
        finally:
            await conn.close()

    async def append(
        self,
        *,
        action: str,
        tenant_id: str,
        actor: str = "",
        task_id: str = "",
        run_id: str = "",
        profile_id: str = "",
        outcome: str = "",
        detail: dict[str, Any] | None = None,
        decision: str = "",
        approver_id: str = "",
        agent_profile_revision: str = "",
        authority_before: Mapping[str, Any] | None = None,
        authority_after: Mapping[str, Any] | None = None,
        policy_version: str = "",
        trace_id: str = "",
    ) -> AuditRecord:
        if not tenant_id:
            raise ValueError("审计必须带租户上下文（硬规则 3）")
        draft = AuditRecord(
            audit_id=f"audit-{uuid.uuid4().hex[:12]}",
            action=action,
            tenant_id=tenant_id,
            actor=actor,
            task_id=task_id,
            run_id=run_id,
            profile_id=profile_id,
            outcome=outcome,
            at=_now(),
            detail=dict(detail or {}),
            event_id=str(uuid.uuid4()),
            agent_profile_revision=agent_profile_revision,
            decision=decision,
            approver_id=approver_id,
            authority_before=dict(authority_before or {}),
            authority_after=dict(authority_after or {}),
            policy_version=policy_version,
            trace_id=trace_id,
        )
        async with self._conn(tenant_id, autocommit=False) as conn:
            await conn.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (tenant_id,))
            cur = await conn.execute(_SELECT_HEAD_SQL, (tenant_id,))
            head = await cur.fetchone()
            head_seq, head_hash = (int(head[0]), str(head[1])) if head else (0, GENESIS_HASH)
            record = draft.chained(previous_hash=head_hash, sequence=head_seq + 1)
            await conn.execute(
                _INSERT_SQL,
                (
                    record.tenant_id,
                    record.sequence,
                    record.audit_id,
                    record.event_id,
                    record.action,
                    record.actor,
                    record.task_id,
                    record.run_id,
                    record.profile_id,
                    record.agent_profile_revision,
                    record.outcome,
                    record.decision,
                    record.approver_id,
                    json.dumps(record.authority_before, ensure_ascii=False),
                    json.dumps(record.authority_after, ensure_ascii=False),
                    record.policy_version,
                    record.trace_id,
                    json.dumps(record.detail, ensure_ascii=False),
                    record.previous_hash,
                    record.event_hash,
                    record.at,
                ),
            )
            await conn.commit()

        logger.info(record.action, extra=record.to_dict())
        self._deliver(record)
        return record

    def _deliver(self, record: AuditRecord) -> None:
        if self._outbox is None:
            return
        try:
            self._outbox.append(_new_event(record))
        except Exception as exc:
            logger.warning(
                "audit.outbox.failed",
                extra={"audit_id": record.audit_id, "error": str(exc)},
            )

    async def records(
        self,
        *,
        tenant_id: str,
        task_id: str | None = None,
        run_id: str | None = None,
        action: str | None = None,
        limit: int | None = None,
    ) -> list[AuditRecord]:
        clauses = ["tenant_id = %s"]
        params: list[Any] = [tenant_id]
        for column, value in (("task_id", task_id), ("run_id", run_id), ("action", action)):
            if value is not None:
                clauses.append(f"{column} = %s")
                params.append(value)
        sql = (
            f"SELECT tenant_id, sequence, audit_id, event_id, action, actor, task_id, run_id,"
            f" profile_id, agent_profile_revision, outcome, decision, approver_id,"
            f" authority_before, authority_after, policy_version, trace_id, detail,"
            f" previous_hash, event_hash, at"
            f" FROM {AUDIT_TABLE} WHERE {' AND '.join(clauses)} ORDER BY sequence"
        )
        if limit:
            sql += " DESC LIMIT %s"
        async with self._conn(tenant_id) as conn:
            cur = await conn.execute(sql, tuple(params + ([limit] if limit else [])))
            rows = await cur.fetchall()
        records = [_row_to_record(row) for row in rows]
        return list(reversed(records)) if limit else records

    async def verify(self, *, tenant_id: str) -> ChainVerification:
        rows = await self.records(tenant_id=tenant_id)
        if not rows:
            return ChainVerification(ok=True, checked=0)
        # 从链首开始验：第一条的 previous_hash 必须是 GENESIS（否则中间被删了整段）。
        return verify_records(rows)


def _row_to_record(row: tuple[Any, ...]) -> AuditRecord:
    return AuditRecord(
        tenant_id=str(row[0]),
        sequence=int(row[1]),
        audit_id=str(row[2]),
        event_id=str(row[3]),
        action=str(row[4]),
        actor=str(row[5]),
        task_id=str(row[6]),
        run_id=str(row[7]),
        profile_id=str(row[8]),
        agent_profile_revision=str(row[9]),
        outcome=str(row[10]),
        decision=str(row[11]),
        approver_id=str(row[12]),
        authority_before=dict(row[13] or {}),
        authority_after=dict(row[14] or {}),
        policy_version=str(row[15]),
        trace_id=str(row[16]),
        detail=dict(row[17] or {}),
        previous_hash=str(row[18]),
        event_hash=str(row[19]),
        at=str(row[20]),
    )


def actions_of(records: list[AuditRecord]) -> list[str]:
    return [r.action for r in records]


__all__ = [
    "AUDIT_APPROVAL",
    "AUDIT_DELEGATION",
    "AUDIT_ESCALATION",
    "AUDIT_EVENT_TYPE",
    "AUDIT_SPAWN",
    "AUDIT_TABLE",
    "CHAIN_FIELDS",
    "GENESIS_HASH",
    "AuditLog",
    "AuditRecord",
    "AuditSink",
    "ChainVerification",
    "PgAuditLedger",
    "actions_of",
    "bootstrap_audit",
    "compute_event_hash",
    "verify_records",
]
