"""``team_task`` 任务实例表 + inbox（ADR-0066 §5.1 / §5.5）。

定义层（``EmployeeProfile``）与**实例层**（``team_task``）是两层：一次运行
产生一个实例，实例上挂着它有生之年的状态——最重要的是 ``inbox``，
双向消息（``send``）就写在这里。

**租户隔离两道**（同 :mod:`mate_tech_agent_team.profile_store` 的教训）：

1. 应用层每条 SQL 都带 ``tenant_id``；
2. 数据库层 RLS + ``FORCE ROW LEVEL SECURITY``，建表必须由 **admin** 角色做
   —— PG 的表 owner 默认绕过 RLS，用 ``mate_app`` 建表会让隔离**静默失效**。

**fail-closed**：``current_setting('app.tenant_id', true)`` 未设置时返回 NULL，
``tenant_id = NULL`` 恒为 NULL → 一行都匹配不到。忘记设租户 = 读不到，
而不是读到别人的。
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator, Sequence
from contextlib import asynccontextmanager
from dataclasses import dataclass, field, replace
from datetime import UTC, datetime
from typing import Any, Protocol

import psycopg

SCHEMA = "agent_team"
TABLE = "team_task"

#: 任务在跑；终态之后 ``send`` 一律 409，**不隐式起新轮**（ADR-0066 §5.5）。
RUNNING = "running"
TERMINAL_STATUSES: frozenset[str] = frozenset({"completed", "failed", "rejected"})

_COLUMNS = (
    "task_id",
    "tenant_id",
    "profile_id",
    "parent_task_id",
    "root_task_id",
    "depth",
    "status",
    "inbox",
)

_TABLE_DDL = f"""
CREATE TABLE IF NOT EXISTS {TABLE} (
    task_id        TEXT NOT NULL,
    tenant_id      TEXT NOT NULL,
    profile_id     TEXT NOT NULL DEFAULT '',
    parent_task_id TEXT,
    root_task_id   TEXT,
    depth          INTEGER NOT NULL DEFAULT 1,
    status         TEXT NOT NULL DEFAULT '{RUNNING}',
    inbox          JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, task_id)
)
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


def bootstrap_tasks(conn: psycopg.Connection[Any], app_role: str = "mate_app") -> None:
    """建 ``team_task`` 表 + RLS 策略（幂等）。``conn`` 必须是 **admin** 连接。"""
    conn.execute(_TABLE_DDL)
    conn.execute(_RLS_DDL.format(app_role=app_role))


@dataclass(frozen=True, slots=True)
class ChannelMessage:
    """投递到某个任务 inbox 的一条消息。"""

    sender: str
    text: str
    #: 投递时刻（ISO8601）。默认取当下，便于回执里排序。
    at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())

    def to_dict(self) -> dict[str, str]:
        return {"sender": self.sender, "text": self.text, "at": self.at}

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False)

    @classmethod
    def from_json(cls, raw: Any) -> ChannelMessage:
        data = json.loads(raw) if isinstance(raw, str) else dict(raw or {})
        return cls(
            sender=str(data.get("sender") or ""),
            text=str(data.get("text") or ""),
            at=str(data.get("at") or ""),
        )


@dataclass(frozen=True, slots=True)
class TeamTask:
    """一个子 agent 实例（= 一条 ``team_task`` 行）。"""

    task_id: str
    tenant_id: str
    profile_id: str = ""
    parent_task_id: str | None = None
    root_task_id: str | None = None
    depth: int = 1
    status: str = RUNNING
    inbox: tuple[ChannelMessage, ...] = ()

    @property
    def is_terminal(self) -> bool:
        return self.status in TERMINAL_STATUSES


class TeamTasks(Protocol):
    """任务实例的存储面（内存与 PG 两种实现，语义一致）。"""

    async def create(self, task: TeamTask) -> None: ...

    async def get(self, tenant_id: str, task_id: str) -> TeamTask | None: ...

    async def append(self, tenant_id: str, task_id: str, message: ChannelMessage) -> None: ...

    async def drain(self, tenant_id: str, task_id: str) -> list[ChannelMessage]: ...

    async def set_status(self, tenant_id: str, task_id: str, status: str) -> None: ...


class InMemoryTeamTasks:
    """进程内实现（单测与未配 DSN 的场景；语义与 PG 版一致）。"""

    def __init__(self) -> None:
        self._tasks: dict[tuple[str, str], TeamTask] = {}

    async def create(self, task: TeamTask) -> None:
        self._tasks[(task.tenant_id, task.task_id)] = task

    async def get(self, tenant_id: str, task_id: str) -> TeamTask | None:
        return self._tasks.get((tenant_id, task_id))

    async def append(self, tenant_id: str, task_id: str, message: ChannelMessage) -> None:
        key = (tenant_id, task_id)
        task = self._tasks.get(key)
        if task is None:
            return
        self._tasks[key] = replace(task, inbox=(*task.inbox, message))

    async def drain(self, tenant_id: str, task_id: str) -> list[ChannelMessage]:
        key = (tenant_id, task_id)
        task = self._tasks.get(key)
        if task is None:
            return []
        self._tasks[key] = replace(task, inbox=())
        return list(task.inbox)

    async def set_status(self, tenant_id: str, task_id: str, status: str) -> None:
        key = (tenant_id, task_id)
        task = self._tasks.get(key)
        if task is not None:
            self._tasks[key] = replace(task, status=status)


def _to_task(row: Sequence[Any]) -> TeamTask:
    (
        task_id,
        tenant_id,
        profile_id,
        parent_task_id,
        root_task_id,
        depth,
        status,
        inbox,
    ) = row
    return TeamTask(
        task_id=task_id,
        tenant_id=tenant_id,
        profile_id=profile_id or "",
        parent_task_id=parent_task_id,
        root_task_id=root_task_id,
        depth=int(depth or 0),
        status=status or RUNNING,
        inbox=tuple(ChannelMessage.from_json(m) for m in (inbox or [])),
    )


class PgTeamTasks:
    """``team_task`` 的 PG 实现。连接随 context manager 生命周期开闭。"""

    def __init__(self, dsn: str, schema: str = SCHEMA) -> None:
        self._dsn = dsn
        self._schema = schema

    @asynccontextmanager
    async def _conn(self, tenant_id: str) -> AsyncIterator[psycopg.AsyncConnection[Any]]:
        conn = await psycopg.AsyncConnection.connect(self._dsn, autocommit=True)
        try:
            await conn.execute(f"SET search_path TO {self._schema}")
            if tenant_id:
                # set_config() 而非 SET x = %s：后者不接受参数绑定。
                await conn.execute("select set_config('app.tenant_id', %s, false)", (tenant_id,))
            yield conn
        finally:
            await conn.close()

    async def create(self, task: TeamTask) -> None:
        """登记一个任务实例。同 ``(tenant_id, task_id)`` 已存在时**重置**。

        重置而不是 DO NOTHING：执行侧在开跑时用它登记（``TeamBus.start``），
        语义是"这一轮从现在开始跑"。留着上一轮的状态会让新一轮一开跑就是
        终态（``send`` 直接 409），且残留的信箱会被新一轮吃掉。
        """
        async with self._conn(task.tenant_id) as conn:
            await conn.execute(
                f"INSERT INTO {TABLE} ({', '.join(_COLUMNS)}, updated_at)"
                f" VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, now())"
                " ON CONFLICT (tenant_id, task_id) DO UPDATE SET"
                " profile_id = EXCLUDED.profile_id,"
                " parent_task_id = EXCLUDED.parent_task_id,"
                " root_task_id = EXCLUDED.root_task_id,"
                " depth = EXCLUDED.depth,"
                " status = EXCLUDED.status,"
                " inbox = EXCLUDED.inbox,"
                " updated_at = now()",
                (
                    task.task_id,
                    task.tenant_id,
                    task.profile_id,
                    task.parent_task_id,
                    task.root_task_id,
                    task.depth,
                    task.status,
                    json.dumps([m.to_dict() for m in task.inbox]),
                ),
            )

    async def get(self, tenant_id: str, task_id: str) -> TeamTask | None:
        if not tenant_id:
            return None
        async with self._conn(tenant_id) as conn:
            cur = await conn.execute(
                f"SELECT {', '.join(_COLUMNS)} FROM {TABLE} WHERE tenant_id = %s AND task_id = %s",
                (tenant_id, task_id),
            )
            row = await cur.fetchone()
            return _to_task(row) if row is not None else None

    async def append(self, tenant_id: str, task_id: str, message: ChannelMessage) -> None:
        if not tenant_id:
            return
        async with self._conn(tenant_id) as conn:
            await conn.execute(
                f"UPDATE {TABLE} SET inbox = inbox || %s::jsonb, updated_at = now()"
                " WHERE tenant_id = %s AND task_id = %s",
                (json.dumps([message.to_dict()]), tenant_id, task_id),
            )

    async def drain(self, tenant_id: str, task_id: str) -> list[ChannelMessage]:
        """读出并**清空**（消费即清空，ADR-0066 §5.5）。

        **不能用 ``UPDATE ... RETURNING inbox``**：PG 的 ``RETURNING`` 回的是
        **新**行值，那样读到的是刚被清空的那份（实测恒为空数组）。改成
        ``SELECT ... FOR UPDATE`` 读旧值 + 清空，两步在**同一个事务**里，
        不留读后写窗口。
        """
        if not tenant_id:
            return []
        async with self._conn(tenant_id) as conn:
            async with conn.transaction():
                cur = await conn.execute(
                    f"SELECT inbox FROM {TABLE} WHERE tenant_id = %s AND task_id = %s FOR UPDATE",
                    (tenant_id, task_id),
                )
                row = await cur.fetchone()
                messages = [ChannelMessage.from_json(m) for m in ((row[0] if row else None) or [])]
                if messages:
                    await conn.execute(
                        f"UPDATE {TABLE} SET inbox = '[]'::jsonb, updated_at = now()"
                        " WHERE tenant_id = %s AND task_id = %s",
                        (tenant_id, task_id),
                    )
                return messages

    async def set_status(self, tenant_id: str, task_id: str, status: str) -> None:
        if not tenant_id:
            return
        async with self._conn(tenant_id) as conn:
            await conn.execute(
                f"UPDATE {TABLE} SET status = %s, updated_at = now()"
                " WHERE tenant_id = %s AND task_id = %s",
                (status, tenant_id, task_id),
            )


__all__ = [
    "RUNNING",
    "SCHEMA",
    "TABLE",
    "TERMINAL_STATUSES",
    "ChannelMessage",
    "InMemoryTeamTasks",
    "PgTeamTasks",
    "TeamTask",
    "TeamTasks",
    "bootstrap_tasks",
]
