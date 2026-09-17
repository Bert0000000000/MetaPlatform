"""员工产出物（Artifact）的落地存储（1.6 任务 2 + 2.1-C C-4 版本化）。

一个数字员工跑完一轮，它的**产出**（报告 / 清单 / 表格）在这里落成一条
**可寻址**的记录：拿到 ``artifact_id`` 就能原样取回正文，按 ``run_id`` 就能
列出这一轮全部的交付物。

**为什么落 PG，不落 MinIO 作主存**——三条理由，按分量排序：

1. **租户隔离只有 PG 这条路是数据库强制的。** 本服务的检查点 / 员工定义 /
   任务实例全在 PG 上靠 RLS 挡跨租户；MinIO 的桶名空间是命名**约定**，隔离靠
   客户端记得写对前缀——那正是"应用层记得过滤"的老病，SEC-TENANT-01 治的就是它。
   artifact 是"本租户的产出物"，跟着走同一道墙最省事也最不容易漏。
2. **"可寻址"要的是主键，PG 直接给。** MinIO 得在别处再维护一份
   ``artifact_id → object key`` 的映射表，那等于两处存事实，重启/多副本时
   两边漂移就是"列得出、取不回"。
3. **产出物通常是 KB 级文本**，不是需要分片 / 流式的大对象。

**C-4 版本化（`MP-ARTIFACT-VERSIONING-01`）**：1.6 的 ``put()`` 是
``ON CONFLICT (tenant_id, artifact_id) DO UPDATE``——**同一地址写第二次就把第一次
盖掉了**。那让复现变成一句空话：出事之后你说不出"第一次交付的到底是什么"。

现在：``(tenant_id, artifact_id, version)`` 才是主键，每次**内容真的变了**的写入
**追加**一版；内容没变的重放**不产生新版本**（幂等），于是"重放/续跑/重试"不会
把版本号刷出一串噪声（langgraph 会重放节点，这一点很要紧）。

**为什么是"同一张表加 version 列"，不是"另开一张 artifact_version 表"**：
版本表方案里，父表只剩一个 ``artifact_id``，而 ``title / content / digest /
producer_*`` 这些**真正描述交付物**的字段全在子表——父表变成一行空壳，每次读
都要 join，且"最新一版是谁"要靠 ``MAX(version)`` 再关联一次。同一张表里
``(id, version)`` 就是那个事实本身，``ORDER BY version DESC LIMIT 1`` 直接给最新。

**小内容留 PG，大内容进对象存储**（``storage_uri`` 间接层）：
超过 :data:`INLINE_CONTENT_MAX_BYTES` 且**部署真的配了** blob 客户端时才把正文
外移（``content`` 留空、``storage_uri`` 记地址、``size`` / ``immutable_digest``
仍是**原文**的）。**没配 blob 客户端就照旧内联**——绝不假装上传成功，那会让
"地址有了、内容取不回"变成一条静默的交付失败。

**租户隔离两道**（同 ``team_task`` / ``profile_store`` 的教训）：

1. 应用层每条 SQL 都带 ``tenant_id``；
2. 数据库层 RLS + ``FORCE ROW LEVEL SECURITY``，建表必须由 **admin** 角色做
   ——PG 的表 owner 默认绕过 RLS，用 ``mate_app`` 建表会让隔离**静默失效**。

**fail-closed**：``current_setting('app.tenant_id', true)`` 未设置时返回 NULL，
``tenant_id = NULL`` 恒为 NULL → 一行都匹配不到。忘记设租户 = 读不到，而不是
读到别人的。
"""

from __future__ import annotations

import hashlib
from collections.abc import AsyncIterator, Sequence
from contextlib import asynccontextmanager
from dataclasses import dataclass, field, replace
from datetime import UTC, datetime
from typing import Any, Protocol

import psycopg

from .tenant_db import TenantConnections, tenant_connections

SCHEMA = "agent_team"
TABLE = "artifact"

#: 产出物的种类。当前只有员工那一份报告；"清单 / 表格"随产出形态增加而增加，
#: 由**生产方**声明，不在这里按内容猜。
KIND_REPORT = "report"

#: 正文的媒体类型。员工产出是自由文本（Markdown 便于前端直接渲染）。
CONTENT_TYPE_MARKDOWN = "text/markdown"

#: 超过这个字节数的正文才考虑外移到对象存储。64 KiB 的取法：本服务的产出是
#: 分析报告（实测 KB 级），留足两个数量级余量；再往上才值得多一次网络往返。
#: 它只是**阈值**，不是承诺——没配 blob 客户端时多大的正文都照旧内联。
INLINE_CONTENT_MAX_BYTES = 64 * 1024

#: ``version`` 的起点。第一版恒为 1（0 留给"没有版本概念"的老行做哨兵）。
FIRST_VERSION = 1

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
    "version",
    "immutable_digest",
    "provenance",
    "security_classification",
    "retention_policy",
    "storage_uri",
    "created_at",
)

_TABLE_DDL = f"""
CREATE TABLE IF NOT EXISTS {TABLE} (
    artifact_id             TEXT NOT NULL,
    tenant_id               TEXT NOT NULL,
    run_id                  TEXT NOT NULL DEFAULT '',
    task_id                 TEXT NOT NULL DEFAULT '',
    profile_id              TEXT NOT NULL DEFAULT '',
    kind                    TEXT NOT NULL DEFAULT '{KIND_REPORT}',
    title                   TEXT NOT NULL DEFAULT '',
    content_type            TEXT NOT NULL DEFAULT '{CONTENT_TYPE_MARKDOWN}',
    content                 TEXT NOT NULL DEFAULT '',
    size                    INTEGER NOT NULL DEFAULT 0,
    version                 INTEGER NOT NULL DEFAULT {FIRST_VERSION},
    immutable_digest        TEXT NOT NULL DEFAULT '',
    provenance              TEXT NOT NULL DEFAULT '',
    security_classification TEXT NOT NULL DEFAULT '',
    retention_policy        TEXT NOT NULL DEFAULT '',
    storage_uri             TEXT NOT NULL DEFAULT '',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, artifact_id, version)
)
"""

#: 老表（1.6 ~ 2.1-B）的迁移：**只加列，不删行**。
#:
#: ① ``ADD COLUMN IF NOT EXISTS`` 幂等，且带 ``DEFAULT`` —— PG 11 起这一步是
#:    元数据级操作，既有行**当场**读到默认值（不会留 NULL 破坏 NOT NULL）。
#: ② 主键从 ``(tenant_id, artifact_id)`` 改成 ``(tenant_id, artifact_id, version)``。
#:    PG 没有 ``ADD CONSTRAINT … IF NOT EXISTS``，所以先查 ``pg_constraint``：
#:    主键里**已经含 version** 就什么都不做（幂等）。老行 version 全是默认的 1，
#:    所以换键不会撞唯一约束。
_MIGRATE_DDL = f"""
ALTER TABLE {TABLE} ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT {FIRST_VERSION};
ALTER TABLE {TABLE} ADD COLUMN IF NOT EXISTS immutable_digest TEXT NOT NULL DEFAULT '';
ALTER TABLE {TABLE} ADD COLUMN IF NOT EXISTS provenance TEXT NOT NULL DEFAULT '';
ALTER TABLE {TABLE} ADD COLUMN IF NOT EXISTS security_classification TEXT NOT NULL DEFAULT '';
ALTER TABLE {TABLE} ADD COLUMN IF NOT EXISTS retention_policy TEXT NOT NULL DEFAULT '';
ALTER TABLE {TABLE} ADD COLUMN IF NOT EXISTS storage_uri TEXT NOT NULL DEFAULT '';
DO $$
DECLARE
    pk_name TEXT;
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
         WHERE t.relname = '{TABLE}' AND n.nspname = current_schema()
           AND c.contype = 'p' AND a.attname = 'version'
    ) THEN
        RETURN;  -- 已经是三列主键，幂等退出
    END IF;
    SELECT c.conname INTO pk_name
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE t.relname = '{TABLE}' AND n.nspname = current_schema() AND c.contype = 'p'
     LIMIT 1;
    IF pk_name IS NOT NULL THEN
        -- ``quote_ident`` 而不是 ``format('… %I')``：psycopg 把 ``%`` 当参数占位符，
        -- 一条带 ``%I`` 的 DO 块会在**发出去之前**就报 "unsupported format character"。
        EXECUTE 'ALTER TABLE {TABLE} DROP CONSTRAINT ' || quote_ident(pk_name);
    END IF;
    ALTER TABLE {TABLE} ADD PRIMARY KEY (tenant_id, artifact_id, version);
END $$;
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
    """建 ``artifact`` 表 + RLS 策略 + **老表迁移**（幂等）。``conn`` 必须是 **admin** 连接。"""
    conn.execute(_TABLE_DDL)
    conn.execute(_MIGRATE_DDL)
    conn.execute(_RLS_DDL.format(app_role=app_role))


def digest_of(content: str) -> str:
    """正文的**不可变摘要**（sha256 十六进制）。

    它是"这一版到底是不是那一版"的判据：同一段内容永远算出同一个摘要，改了
    一个字就全变。行一旦落库，``immutable_digest`` 不再重算——所以它也是
    "这行有没有被人改过正文"的检出手段。
    """
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


class ArtifactBlobs(Protocol):
    """对象存储的最小面（大正文的外移层）。

    **只声明本服务真的会用到的两个动作**。生产上由部署决定接哪个实现
    （MinIO / S3 / …）；没配置时 ``PgArtifacts`` 拿到的就是 ``None``，于是
    一切照旧内联——见模块头"没配就照旧内联"那一段。
    """

    async def put(self, *, key: str, data: bytes, content_type: str) -> str:
        """写入一份字节，返回**可寻址的 URI**（落进 ``storage_uri``）。"""
        ...

    async def get(self, uri: str) -> bytes:
        """按 URI 取回字节。取不回就抛——**不返回空字节**。"""
        ...


@dataclass(frozen=True, slots=True)
class Artifact:
    """一件产出物的**一个版本**。

    ``size`` 是**原文**的字节数（不是 PG 里那一列的长度）：正文外移之后
    ``content`` 是空的，但 ``size`` 与 ``immutable_digest`` 仍是原文的——
    否则"这份交付物多大"会随"存哪儿"而变。

    ``version`` / ``immutable_digest`` 由 :func:`put` 在写入时定死；``content``
    与 ``storage_uri`` 二选一有值（小于阈值或没配 blob 客户端时是前者）。
    """

    artifact_id: str
    tenant_id: str
    run_id: str = ""
    task_id: str = ""
    profile_id: str = ""
    kind: str = KIND_REPORT
    title: str = ""
    content_type: str = CONTENT_TYPE_MARKDOWN
    content: str = ""
    size: int = 0
    version: int = FIRST_VERSION
    immutable_digest: str = ""
    #: 谁、按哪一版流程产出的它（如 ``agent-runtime/v1``）。生产方声明。
    provenance: str = ""
    #: 密级标记。**只记录、不强制**——本服务不做访问策略判定（见边界登记）。
    security_classification: str = ""
    #: 保留策略名（如 ``7d``）。同上：只记录。
    retention_policy: str = ""
    #: 正文外移后的对象存储地址；内联时为空串。
    storage_uri: str = ""
    created_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())

    def __post_init__(self) -> None:
        """从正文补齐 ``size`` / ``immutable_digest``（**两者都显式给了就不动**）。

        ``size`` 曾是只读属性（由正文算出）。改成字段是因为外移之后正文不在行里，
        属性会算成 0——"这份交付物多大"必须跟着**内容**而不是**存储位置**。
        """
        if not self.content:
            return
        if not self.size:
            object.__setattr__(self, "size", len(self.content.encode("utf-8")))
        if not self.immutable_digest:
            object.__setattr__(self, "immutable_digest", digest_of(self.content))

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
            "version": self.version,
            "immutable_digest": self.immutable_digest,
            "provenance": self.provenance,
            "security_classification": self.security_classification,
            "retention_policy": self.retention_policy,
            "storage_uri": self.storage_uri,
            "created_at": self.created_at,
        }

    def to_content_dict(self) -> dict[str, Any]:
        """元数据 + 正文——按 id 取回时用它。"""
        return {**self.to_dict(), "content": self.content}


class ArtifactStore(Protocol):
    """产出物的存储面（内存与 PG 两种实现，语义一致）。"""

    async def put(self, artifact: Artifact) -> Artifact:
        """写入一版。同地址同内容 = 幂等（不产生新版本）；内容变了则**追加**。"""
        ...

    async def get(
        self, tenant_id: str, artifact_id: str, version: int | None = None
    ) -> Artifact | None:
        """取某一版；``version=None`` 取**最新**一版。"""
        ...

    async def list(self, tenant_id: str, run_id: str) -> list[Artifact]:
        """这一轮的全部交付物（每个地址只出**最新**一版）。"""
        ...

    async def list_versions(self, tenant_id: str, artifact_id: str) -> list[Artifact]:
        """某个地址的**全部历史版本**（旧→新）——"第一次交付了什么"靠它。"""
        ...


def _latest(rows: Sequence[Artifact]) -> list[Artifact]:
    """按地址留最新一版（输入不改）。"""
    newest: dict[str, Artifact] = {}
    for row in rows:
        current = newest.get(row.artifact_id)
        if current is None or row.version > current.version:
            newest[row.artifact_id] = row
    return [newest[key] for key in sorted(newest)]


async def _offload(artifact: Artifact, blobs: ArtifactBlobs | None) -> Artifact:
    """超过阈值**且**配了 blob 客户端时，把正文外移，元数据留 PG。

    不满足任一条件就原样返回（内联）——"没配就照旧内联"是**有意**的：假装上传
    成功会留下一个取不回的地址，那正是 1.6 要治的"看着交付了、其实取不回来"。
    """
    if blobs is None or artifact.size <= INLINE_CONTENT_MAX_BYTES or artifact.storage_uri:
        return artifact
    key = f"{artifact.tenant_id}/{artifact.artifact_id}/v{artifact.version}"
    uri = await blobs.put(
        key=key, data=artifact.content.encode("utf-8"), content_type=artifact.content_type
    )
    return replace(artifact, content="", storage_uri=uri)


async def _hydrate(artifact: Artifact | None, blobs: ArtifactBlobs | None) -> Artifact | None:
    """正文外移过就读回来（取不回**不吞**：抛出去，而不是回一份空正文）。"""
    if artifact is None or artifact.content or not artifact.storage_uri or blobs is None:
        return artifact
    data = await blobs.get(artifact.storage_uri)
    return replace(artifact, content=data.decode("utf-8"))


class InMemoryArtifacts:
    """进程内实现（单测与未配 DSN 的场景；语义与 PG 版一致）。"""

    def __init__(self, blobs: ArtifactBlobs | None = None) -> None:
        self._rows: dict[tuple[str, str, int], Artifact] = {}
        self._blobs = blobs

    def _versions(self, tenant_id: str, artifact_id: str) -> list[Artifact]:
        return sorted(
            (
                row
                for (tenant, aid, _v), row in self._rows.items()
                if tenant == tenant_id and aid == artifact_id
            ),
            key=lambda row: row.version,
        )

    async def put(self, artifact: Artifact) -> Artifact:
        existing = self._versions(artifact.tenant_id, artifact.artifact_id)
        if existing and existing[-1].immutable_digest == artifact.immutable_digest:
            # **内容没变 = 同一次交付**：重放（图重跑节点 / 工具重试）不该刷版本号。
            return await _hydrate(existing[-1], self._blobs) or existing[-1]
        stored = await _offload(
            replace(artifact, version=(existing[-1].version + 1) if existing else FIRST_VERSION),
            self._blobs,
        )
        self._rows[(stored.tenant_id, stored.artifact_id, stored.version)] = stored
        return stored

    async def get(
        self, tenant_id: str, artifact_id: str, version: int | None = None
    ) -> Artifact | None:
        rows = self._versions(tenant_id, artifact_id)
        if not rows:
            return None
        picked = (
            rows[-1] if version is None else next((r for r in rows if r.version == version), None)
        )
        return await _hydrate(picked, self._blobs)

    async def list(self, tenant_id: str, run_id: str) -> list[Artifact]:
        rows = [
            a
            for (tenant, _aid, _v), a in self._rows.items()
            if tenant == tenant_id and a.run_id == run_id
        ]
        return sorted(_latest(rows), key=lambda a: (a.task_id, a.artifact_id))

    async def list_versions(self, tenant_id: str, artifact_id: str) -> list[Artifact]:
        return list(self._versions(tenant_id, artifact_id))


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
        size,
        version,
        immutable_digest,
        provenance,
        security_classification,
        retention_policy,
        storage_uri,
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
        size=int(size or 0),
        version=int(version or FIRST_VERSION),
        immutable_digest=str(immutable_digest or ""),
        provenance=str(provenance or ""),
        security_classification=str(security_classification or ""),
        retention_policy=str(retention_policy or ""),
        storage_uri=str(storage_uri or ""),
        created_at=created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at),
    )


class PgArtifacts:
    """``artifact`` 的 PG 实现。连接随 context manager 生命周期开闭。"""

    def __init__(
        self, dsn: str | TenantConnections, schema: str = SCHEMA, blobs: ArtifactBlobs | None = None
    ) -> None:
        self._conns = tenant_connections(dsn, schema=schema)
        self._blobs = blobs

    @asynccontextmanager
    async def _conn(self, tenant_id: str) -> AsyncIterator[psycopg.AsyncConnection[Any]]:
        # 租户上下文走 tenant_db：**事务级** GUC + 归还前 RESET（B-5）。
        async with self._conns.for_tenant(tenant_id) as conn:
            yield conn

    async def _latest_row(
        self, conn: psycopg.AsyncConnection[Any], tenant_id: str, artifact_id: str
    ) -> Artifact | None:
        cur = await conn.execute(
            f"SELECT {', '.join(_COLUMNS)} FROM {TABLE}"
            " WHERE tenant_id = %s AND artifact_id = %s ORDER BY version DESC LIMIT 1",
            (tenant_id, artifact_id),
        )
        row = await cur.fetchone()
        return _to_artifact(row) if row is not None else None

    async def put(self, artifact: Artifact) -> Artifact:
        """写入**一版**。同地址同内容 → 幂等返回既有那一版；内容变了 → 追加新版本。

        旧实现是 ``ON CONFLICT DO UPDATE``（覆盖），于是"第一次交付了什么"在第二次
        写之后**再也取不回来**。现在每次内容变化都落一行新版本，旧行**一个字不动**。

        ``version`` 的分配是"读最新再 +1"。同一个 ``artifact_id`` 的写入方是**同一
        轮 run 的同一个子任务**（地址里就带着 run 与任务标签），所以这里没有并发写
        同一地址的竞争面；真要并发，最坏结果是同一段内容多一版——不会丢数据，也
        不会读错版本。
        """
        async with self._conn(artifact.tenant_id) as conn:
            latest = await self._latest_row(conn, artifact.tenant_id, artifact.artifact_id)
            if latest is not None and latest.immutable_digest == artifact.immutable_digest:
                return await _hydrate(latest, self._blobs) or latest
            stored = await _offload(
                replace(artifact, version=latest.version + 1 if latest else FIRST_VERSION),
                self._blobs,
            )
            await conn.execute(
                f"INSERT INTO {TABLE} ({', '.join(_COLUMNS)})"
                f" VALUES ({', '.join(['%s'] * len(_COLUMNS))})",
                (
                    stored.artifact_id,
                    stored.tenant_id,
                    stored.run_id,
                    stored.task_id,
                    stored.profile_id,
                    stored.kind,
                    stored.title,
                    stored.content_type,
                    stored.content,
                    stored.size,
                    stored.version,
                    stored.immutable_digest,
                    stored.provenance,
                    stored.security_classification,
                    stored.retention_policy,
                    stored.storage_uri,
                    stored.created_at,
                ),
            )
        return stored

    async def get(
        self, tenant_id: str, artifact_id: str, version: int | None = None
    ) -> Artifact | None:
        if not tenant_id:
            return None
        async with self._conn(tenant_id) as conn:
            if version is None:
                found = await self._latest_row(conn, tenant_id, artifact_id)
            else:
                cur = await conn.execute(
                    f"SELECT {', '.join(_COLUMNS)} FROM {TABLE}"
                    " WHERE tenant_id = %s AND artifact_id = %s AND version = %s",
                    (tenant_id, artifact_id, version),
                )
                row = await cur.fetchone()
                found = _to_artifact(row) if row is not None else None
        return await _hydrate(found, self._blobs)

    async def list(self, tenant_id: str, run_id: str) -> list[Artifact]:
        if not tenant_id:
            return []
        async with self._conn(tenant_id) as conn:
            cur = await conn.execute(
                f"SELECT {', '.join(_COLUMNS)} FROM {TABLE} a"
                " WHERE a.tenant_id = %s AND a.run_id = %s"
                " AND a.version = (SELECT MAX(b.version) FROM {t} b"
                " WHERE b.tenant_id = a.tenant_id AND b.artifact_id = a.artifact_id)"
                " ORDER BY a.task_id, a.artifact_id".format(t=TABLE),
                (tenant_id, run_id),
            )
            return [_to_artifact(row) for row in await cur.fetchall()]

    async def list_versions(self, tenant_id: str, artifact_id: str) -> list[Artifact]:
        if not tenant_id:
            return []
        async with self._conn(tenant_id) as conn:
            cur = await conn.execute(
                f"SELECT {', '.join(_COLUMNS)} FROM {TABLE}"
                " WHERE tenant_id = %s AND artifact_id = %s ORDER BY version",
                (tenant_id, artifact_id),
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
    provenance: str = "",
) -> Artifact:
    """把一次员工产出包成产出物。

    ``artifact_id`` 取 **``{run_id 前 8 位}-{计划内标签}``**（与任务实例 id 同一
    个形状）：它按运行唯一，因此"同一个员工在同一轮里只产出一份主交付物"这件事
    由地址本身表达。

    **跨轮重跑天然是不同地址**（run_id 不同），所以版本化的真正用武之地是
    **同一地址被写第二次**：图重放节点、续跑重新派活、工具级重试。旧实现在那里
    覆盖，现在追加——"这一轮的第一版交付是什么"因此始终取得到。
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
        provenance=provenance,
    )


__all__ = [
    "CONTENT_TYPE_MARKDOWN",
    "FIRST_VERSION",
    "INLINE_CONTENT_MAX_BYTES",
    "KIND_REPORT",
    "SCHEMA",
    "TABLE",
    "Artifact",
    "ArtifactBlobs",
    "ArtifactStore",
    "InMemoryArtifacts",
    "PgArtifacts",
    "artifact_for_task",
    "bootstrap_artifacts",
    "digest_of",
]
