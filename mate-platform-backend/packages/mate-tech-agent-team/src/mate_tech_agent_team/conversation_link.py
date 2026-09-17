"""会话 ↔ run 的持久关系（C-1 / `MP-SESSION-RUN-LINK-01`）。

**要解决的问题**：一次对话里的"这条消息对应哪一轮 run"，之前只写在**浏览器
localStorage** 里（``mp-agent-team-run:<会话id>`` → run_id）。换个机器、清一次
浏览器缓存，这层关系就没了——历史轮次还在库里，但没人知道它们属于哪次对话。
更根本的问题是**关系有两个存放地**：会话在 copilot 的库里，run 在本服务的库
里，中间的映射却在第三个地方（浏览器）。

**做法**：把映射搬进本服务的库，成为**唯一关系源**。前端那份降级为缓存
——读得到就先用（省一次往返），读不到就问后端。

**为什么是"关系表"而不是"给 run 加一列 conversation_id"**：一次 run 可以被
多个会话看到（同一个 ``Idempotency-Key`` 从两个会话提交，落到同一个 run），
一对多不是异常而是语义。主键取 ``(tenant_id, conversation_id, run_id)``，
于是重复关联是幂等的、多对多是表达得出来的。

``relation_type`` 现在只有 ``initiated`` 一种；留这一列是因为"这一轮是从这个
会话发起的"和"这一轮被这个会话引用/续问"在审计上是两回事，后者出现时不该
靠猜。新增取值走契约。

**租户隔离两道**（同 ``profile_store`` / ``run_lease`` 的教训）：

1. 应用层每条 SQL 都带 ``tenant_id``；
2. 数据库层 RLS + ``FORCE ROW LEVEL SECURITY``，建表必须由 **admin** 角色做
   ——PG 的表 owner 默认绕过 RLS，用 ``mate_app`` 建表会让隔离**静默失效**。

**fail-closed**：``current_setting('app.tenant_id', true)`` 未设置时返回 NULL，
``tenant_id = NULL`` 恒为 NULL → 一行都匹配不到。忘记设租户 = 读不到，而不是
读到别人的。
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Sequence
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Protocol

import psycopg

from .tenant_db import TenantConnections, tenant_connections

SCHEMA = "agent_team"
TABLE = "conversation_run"

#: 这一轮由该会话**发起**。目前唯一取值；"被引用"是另一种关系，出现时再加。
RELATION_INITIATED = "initiated"

_COLUMNS = (
    "tenant_id",
    "conversation_id",
    "run_id",
    "turn_id",
    "created_by",
    "relation_type",
    "created_at",
)

_TABLE_DDL = f"""
CREATE TABLE IF NOT EXISTS {TABLE} (
    tenant_id       TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    run_id          TEXT NOT NULL,
    turn_id         TEXT NOT NULL DEFAULT '',
    created_by      TEXT NOT NULL DEFAULT '',
    relation_type   TEXT NOT NULL DEFAULT '{RELATION_INITIATED}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, conversation_id, run_id)
)
"""

#: 按会话列 run 是这张表唯一的读法（写是逐条 upsert），所以索引就建在它上面。
_INDEX_DDL = f"""
CREATE INDEX IF NOT EXISTS {TABLE}_by_conversation
    ON {TABLE} (tenant_id, conversation_id, created_at)
"""

_RLS_DDL = f"""
ALTER TABLE {TABLE} ENABLE ROW LEVEL SECURITY;
ALTER TABLE {TABLE} FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_iso ON {TABLE};
CREATE POLICY tenant_iso ON {TABLE}
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON {TABLE} TO {{app_role}};
"""


def bootstrap_conversation_runs(conn: psycopg.Connection[Any], app_role: str = "mate_app") -> None:
    """建 ``conversation_run`` 表 + 索引 + RLS（幂等）。``conn`` 必须是 **admin**。"""
    conn.execute(_TABLE_DDL)
    conn.execute(_INDEX_DDL)
    conn.execute(_RLS_DDL.format(app_role=app_role))


@dataclass(frozen=True, slots=True)
class ConversationRun:
    """一条关系：**这个会话**里的**这一轮**（第 ``turn_id`` 次发言）。"""

    tenant_id: str
    conversation_id: str
    run_id: str
    turn_id: str = ""
    created_by: str = ""
    relation_type: str = RELATION_INITIATED
    created_at: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "conversation_id": self.conversation_id,
            "run_id": self.run_id,
            "turn_id": self.turn_id,
            "created_by": self.created_by,
            "relation_type": self.relation_type,
            "created_at": self.created_at,
        }


class ConversationRuns(Protocol):
    """会话 ↔ run 关系面（内存与 PG 两种实现，语义一致）。"""

    async def link(
        self,
        *,
        tenant_id: str,
        conversation_id: str,
        run_id: str,
        turn_id: str = "",
        created_by: str = "",
        relation_type: str = RELATION_INITIATED,
    ) -> ConversationRun: ...

    async def by_conversation(
        self, tenant_id: str, conversation_id: str
    ) -> list[ConversationRun]: ...

    async def by_run(self, tenant_id: str, run_id: str) -> ConversationRun | None: ...


class InMemoryConversationRuns:
    """进程内实现（单副本部署与测试的默认；语义与 PG 版一致）。

    ``created_at`` 用**插入序**兜底：同一毫秒内关联的多轮，靠它保持稳定顺序
    ——PG 那边由 ``created_at`` + 主键给出同样的保证。
    """

    def __init__(self) -> None:
        self._rows: dict[tuple[str, str, str], ConversationRun] = {}
        self._seq: dict[tuple[str, str, str], int] = {}
        self._counter = 0

    async def link(
        self,
        *,
        tenant_id: str,
        conversation_id: str,
        run_id: str,
        turn_id: str = "",
        created_by: str = "",
        relation_type: str = RELATION_INITIATED,
    ) -> ConversationRun:
        key = (tenant_id, conversation_id, run_id)
        existing = self._rows.get(key)
        if existing is not None:
            # 重复关联是幂等的：**不**刷新 created_at，否则"这一轮什么时候进
            # 这个会话"会随重复提交漂移，历史顺序就不稳了。
            return existing
        self._counter += 1
        row = ConversationRun(
            tenant_id=tenant_id,
            conversation_id=conversation_id,
            run_id=run_id,
            turn_id=turn_id,
            created_by=created_by,
            relation_type=relation_type,
            created_at=datetime.now(UTC).isoformat(),
        )
        self._rows[key] = row
        self._seq[key] = self._counter
        return row

    async def by_conversation(self, tenant_id: str, conversation_id: str) -> list[ConversationRun]:
        rows = [
            (self._seq[key], row)
            for key, row in self._rows.items()
            if key[0] == tenant_id and key[1] == conversation_id
        ]
        rows.sort(key=lambda pair: (pair[1].created_at, pair[0]))
        return [row for _, row in rows]

    async def by_run(self, tenant_id: str, run_id: str) -> ConversationRun | None:
        found = [row for key, row in self._rows.items() if key[0] == tenant_id and key[2] == run_id]
        if not found:
            return None
        found.sort(key=lambda row: (row.created_at, row.conversation_id))
        return found[0]


def _to_row(row: Sequence[Any]) -> ConversationRun:
    tenant_id, conversation_id, run_id, turn_id, created_by, relation_type, created_at = row
    return ConversationRun(
        tenant_id=str(tenant_id),
        conversation_id=str(conversation_id),
        run_id=str(run_id),
        turn_id=str(turn_id or ""),
        created_by=str(created_by or ""),
        relation_type=str(relation_type or RELATION_INITIATED),
        created_at=created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at),
    )


#: 重复关联**什么都不改**（``DO NOTHING``）——见内存实现里那段注释：
#: 刷新 ``created_at`` 会让历史顺序随重复提交漂移。
_LINK_SQL = f"""
INSERT INTO {TABLE} ({", ".join(_COLUMNS)})
VALUES (%s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (tenant_id, conversation_id, run_id) DO NOTHING
"""

_SELECT_SQL = (
    f"SELECT {', '.join(_COLUMNS)} FROM {TABLE}"
    " WHERE tenant_id = %s AND conversation_id = %s ORDER BY created_at, run_id"
)

_SELECT_BY_RUN_SQL = (
    f"SELECT {', '.join(_COLUMNS)} FROM {TABLE}"
    " WHERE tenant_id = %s AND run_id = %s ORDER BY created_at, conversation_id LIMIT 1"
)


class PgConversationRuns:
    """PG 实现：重启与多副本下都是同一份关系。"""

    def __init__(self, dsn: str | TenantConnections, schema: str = SCHEMA) -> None:
        self._conns = tenant_connections(dsn, schema=schema)

    @asynccontextmanager
    async def _conn(self, tenant_id: str) -> AsyncIterator[psycopg.AsyncConnection[Any]]:
        # 租户上下文走 tenant_db：**事务级** GUC + 归还前 RESET（B-5）。
        async with self._conns.for_tenant(tenant_id) as conn:
            yield conn

    async def link(
        self,
        *,
        tenant_id: str,
        conversation_id: str,
        run_id: str,
        turn_id: str = "",
        created_by: str = "",
        relation_type: str = RELATION_INITIATED,
    ) -> ConversationRun:
        async with self._conn(tenant_id) as conn:
            await conn.execute(
                _LINK_SQL,
                (
                    tenant_id,
                    conversation_id,
                    run_id,
                    turn_id,
                    created_by,
                    relation_type,
                    datetime.now(UTC).isoformat(),
                ),
            )
        return ConversationRun(
            tenant_id=tenant_id,
            conversation_id=conversation_id,
            run_id=run_id,
            turn_id=turn_id,
            created_by=created_by,
            relation_type=relation_type,
            created_at=datetime.now(UTC).isoformat(),
        )

    async def by_conversation(self, tenant_id: str, conversation_id: str) -> list[ConversationRun]:
        if not tenant_id or not conversation_id:
            return []
        async with self._conn(tenant_id) as conn:
            cur = await conn.execute(_SELECT_SQL, (tenant_id, conversation_id))
            return [_to_row(row) for row in await cur.fetchall()]

    async def by_run(self, tenant_id: str, run_id: str) -> ConversationRun | None:
        if not tenant_id or not run_id:
            return None
        async with self._conn(tenant_id) as conn:
            cur = await conn.execute(_SELECT_BY_RUN_SQL, (tenant_id, run_id))
            row = await cur.fetchone()
            return _to_row(row) if row is not None else None


__all__ = [
    "RELATION_INITIATED",
    "SCHEMA",
    "TABLE",
    "ConversationRun",
    "ConversationRuns",
    "InMemoryConversationRuns",
    "PgConversationRuns",
    "bootstrap_conversation_runs",
]
