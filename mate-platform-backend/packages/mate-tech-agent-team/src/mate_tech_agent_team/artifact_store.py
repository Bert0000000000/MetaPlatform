"""员工产出物（Artifact）的落地存储（1.6 任务 2）。

一个数字员工跑完一轮，它的**产出**（报告 / 清单 / 表格）在这里落成一条
**可寻址**的记录：拿到 ``artifact_id`` 就能原样取回正文，按 ``run_id`` 就能
列出这一轮全部的交付物。

**为什么落 PG，不落 MinIO**——三条理由，按分量排序：

1. **租户隔离只有 PG 这条路是数据库强制的。** 本服务的检查点 / 员工定义 /
   任务实例全在 PG 上靠 RLS 挡跨租户；MinIO 的桶名空间是命名**约定**，隔离靠
   客户端记得写对前缀——那正是"应用层记得过滤"的老病，SEC-TENANT-01 治的就是它。
   artifact 是"本租户的产出物"，跟着走同一道墙最省事也最不容易漏。
2. **"可寻址"要的是主键，PG 直接给。** MinIO 得在别处再维护一份
   ``artifact_id → object key`` 的映射表，那等于两处存事实，重启/多副本时
   两边漂移就是"列得出、取不回"。
3. **产出物是 KB 级文本**，不是需要分片 / 流式的大对象。对象存储的强项
   （大 blob、CDN、预签名直传）在这里用不上，引它只增依赖不减复杂度。

**租户隔离两道**（同 ``team_task`` / ``profile_store`` 的教训）：

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
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Protocol

import psycopg

SCHEMA = "agent_team"
TABLE = "artifact"

#: 产出物的种类。当前只有员工那一份报告；"清单 / 表格"随产出形态增加而增加，
#: 由**生产方**声明，不在这里按内容猜。
KIND_REPORT = "report"

#: 正文的媒体类型。员工产出是自由文本（Markdown 便于前端直接渲染）。
CONTENT_TYPE_MARKDOWN = "text/markdown"

_COLUMNS = (
    "artifact_id",
    "tenant_id",
    "run_id",
    "task_id",
    "profile_id",
    "kind",
    "title",
    "content_type",
    "content",
    "size",
    "created_at",
)

_TABLE_DDL = f"""
CREATE TABLE IF NOT EXISTS {TABLE} (
    artifact_id  TEXT NOT NULL,
    tenant_id    TEXT NOT NULL,
    run_id       TEXT NOT NULL DEFAULT '',
    task_id      TEXT NOT NULL DEFAULT '',
    profile_id   TEXT NOT NULL DEFAULT '',
    kind         TEXT NOT NULL DEFAULT '{KIND_REPORT}',
    title        TEXT NOT NULL DEFAULT '',
    content_type TEXT NOT NULL DEFAULT '{CONTENT_TYPE_MARKDOWN}',
    content      TEXT NOT NULL DEFAULT '',
    size         INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, artifact_id)
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


def bootstrap_artifacts(conn: psycopg.Connection[Any], app_role: str = "mate_app") -> None:
    """建 ``artifact`` 表 + RLS 策略（幂等）。``conn`` 必须是 **admin** 连接。"""
    conn.execute(_TABLE_DDL)
    conn.execute(_RLS_DDL.format(app_role=app_role))


@dataclass(frozen=True, slots=True)
class Artifact:
    """一件产出物。``size`` 是正文的**字节数**（由内容算出，不单独存）。"""

    artifact_id: str
    tenant_id: str
    run_id: str = ""
    task_id: str = ""
    profile_id: str = ""
    kind: str = KIND_REPORT
    title: str = ""
    content_type: str = CONTENT_TYPE_MARKDOWN
    content: str = ""
    created_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())

    @property
    def size(self) -> int:
        return len(self.content.encode("utf-8"))

    def to_dict(self) -> dict[str, Any]:
        """**元数据**（不含正文）——列出一轮的全部产出物时用它。"""
        return {
            "artifact_id": self.artifact_id,
            "run_id": self.run_id,
            "task_id": self.task_id,
            "profile_id": self.profile_id,
            "kind": self.kind,
            "title": self.title,
            "content_type": self.content_type,
            "size": self.size,
            "created_at": self.created_at,
        }

    def to_content_dict(self) -> dict[str, Any]:
        """元数据 + 正文——按 id 取回时用它。"""
        return {**self.to_dict(), "content": self.content}


class ArtifactStore(Protocol):
    """产出物的存储面（内存与 PG 两种实现，语义一致）。"""

    async def put(self, artifact: Artifact) -> Artifact: ...

    async def get(self, tenant_id: str, artifact_id: str) -> Artifact | None: ...

    async def list(self, tenant_id: str, run_id: str) -> list[Artifact]: ...


class InMemoryArtifacts:
    """进程内实现（单测与未配 DSN 的场景；语义与 PG 版一致）。"""

    def __init__(self) -> None:
        self._rows: dict[tuple[str, str], Artifact] = {}

    async def put(self, artifact: Artifact) -> Artifact:
        self._rows[(artifact.tenant_id, artifact.artifact_id)] = artifact
        return artifact

    async def get(self, tenant_id: str, artifact_id: str) -> Artifact | None:
        return self._rows.get((tenant_id, artifact_id))

    async def list(self, tenant_id: str, run_id: str) -> list[Artifact]:
        rows = [
            a for (tenant, _), a in self._rows.items() if tenant == tenant_id and a.run_id == run_id
        ]
        return sorted(rows, key=lambda a: (a.task_id, a.artifact_id))


def _to_artifact(row: Sequence[Any]) -> Artifact:
    (
        artifact_id,
        tenant_id,
        run_id,
        task_id,
        profile_id,
        kind,
        title,
        content_type,
        content,
        _size,
        created_at,
    ) = row
    return Artifact(
        artifact_id=artifact_id,
        tenant_id=tenant_id,
        run_id=run_id or "",
        task_id=task_id or "",
        profile_id=profile_id or "",
        kind=kind or KIND_REPORT,
        title=title or "",
        content_type=content_type or CONTENT_TYPE_MARKDOWN,
        content=content or "",
        created_at=created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at),
    )


class PgArtifacts:
    """``artifact`` 的 PG 实现。连接随 context manager 生命周期开闭。"""

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

    async def put(self, artifact: Artifact) -> Artifact:
        """写入一件产出物。同 ``(tenant_id, artifact_id)`` 已存在时**覆盖**。

        覆盖而不是报错：图重放同一份产出（或同一轮被重跑）不该在库里攒出两条
        同 id 的记录——地址是同一个，事实就该只有一条。
        """
        async with self._conn(artifact.tenant_id) as conn:
            await conn.execute(
                f"INSERT INTO {TABLE} ({', '.join(_COLUMNS)})"
                " VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
                " ON CONFLICT (tenant_id, artifact_id) DO UPDATE SET"
                " run_id = EXCLUDED.run_id,"
                " task_id = EXCLUDED.task_id,"
                " profile_id = EXCLUDED.profile_id,"
                " kind = EXCLUDED.kind,"
                " title = EXCLUDED.title,"
                " content_type = EXCLUDED.content_type,"
                " content = EXCLUDED.content,"
                " size = EXCLUDED.size,"
                " created_at = EXCLUDED.created_at",
                (
                    artifact.artifact_id,
                    artifact.tenant_id,
                    artifact.run_id,
                    artifact.task_id,
                    artifact.profile_id,
                    artifact.kind,
                    artifact.title,
                    artifact.content_type,
                    artifact.content,
                    artifact.size,
                    artifact.created_at,
                ),
            )
        return artifact

    async def get(self, tenant_id: str, artifact_id: str) -> Artifact | None:
        if not tenant_id:
            return None
        async with self._conn(tenant_id) as conn:
            cur = await conn.execute(
                f"SELECT {', '.join(_COLUMNS)} FROM {TABLE}"
                " WHERE tenant_id = %s AND artifact_id = %s",
                (tenant_id, artifact_id),
            )
            row = await cur.fetchone()
            return _to_artifact(row) if row is not None else None

    async def list(self, tenant_id: str, run_id: str) -> list[Artifact]:
        if not tenant_id:
            return []
        async with self._conn(tenant_id) as conn:
            cur = await conn.execute(
                f"SELECT {', '.join(_COLUMNS)} FROM {TABLE}"
                " WHERE tenant_id = %s AND run_id = %s ORDER BY task_id, artifact_id",
                (tenant_id, run_id),
            )
            return [_to_artifact(row) for row in await cur.fetchall()]


def artifact_for_task(
    *,
    tenant_id: str,
    run_id: str,
    task_id: str,
    profile_id: str,
    content: str,
    kind: str = KIND_REPORT,
    title: str = "",
) -> Artifact:
    """把一次员工产出包成产出物。

    ``artifact_id`` 取 **``{run_id 前 8 位}-{计划内标签}``**（与任务实例 id 同一
    个形状）：它按运行唯一，因此"同一个员工在同一轮里只产出一份主交付物"这件事
    由地址本身表达——重放不会攒出第二条。
    """
    short = run_id[:8] if run_id else "run"
    return Artifact(
        artifact_id=f"{short}-{task_id}",
        tenant_id=tenant_id,
        run_id=run_id,
        task_id=task_id,
        profile_id=profile_id,
        kind=kind,
        title=title or f"{profile_id} 的产出",
        content=content,
    )


__all__ = [
    "CONTENT_TYPE_MARKDOWN",
    "KIND_REPORT",
    "SCHEMA",
    "TABLE",
    "Artifact",
    "ArtifactStore",
    "InMemoryArtifacts",
    "PgArtifacts",
    "artifact_for_task",
    "bootstrap_artifacts",
]
