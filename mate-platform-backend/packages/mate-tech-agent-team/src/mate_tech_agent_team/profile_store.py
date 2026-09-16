"""员工身份的 PG 落库（ADR-0066 S0）。

1.0 的 ``ProfileRegistry`` 是纯进程内名册：建出来的员工只活在内存里，重启即丢、
多副本各看各的。本模块把「身份三要素 + 权限包络」落进 ``agent_team.employee_profile``。

**租户隔离两道**（同 :mod:`mate_tech_agent_team.checkpoint` 的教训）：

1. 应用层每条 SQL 都带 ``tenant_id``；
2. 数据库层 RLS 策略 + ``FORCE ROW LEVEL SECURITY``，且建表必须由 **admin**
   角色做 —— PG 的表 owner 默认绕过 RLS，用 ``mate_app`` 建表会让隔离**静默
   失效**（不报错、只是看不见墙）。

**fail-closed**：``current_setting('app.tenant_id', true)`` 未设置时返回 NULL，
``tenant_id = NULL`` 恒为 NULL → 一行都匹配不到。忘记设租户 = 读不到，而不是
读到别人的。
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import psycopg

from .profiles import DEFAULT_MODEL, EmployeeProfile

SCHEMA = "agent_team"
TABLE = "employee_profile"

#: 权限包络的四个维度都存成 text[]（ADR-0066 §3.3）。
_COLUMNS = (
    "profile_id",
    "tenant_id",
    "name",
    "base_role",
    "system_prompt",
    "skills",
    "tools",
    "model",
    "action_rids",
    "kb_ids",
    "markings",
    "origin",
)

_TABLE_DDL = f"""
CREATE TABLE IF NOT EXISTS {TABLE} (
    profile_id    TEXT NOT NULL,
    tenant_id     TEXT NOT NULL,
    name          TEXT NOT NULL DEFAULT '',
    base_role     TEXT NOT NULL DEFAULT 'ontology',
    system_prompt TEXT NOT NULL DEFAULT '',
    skills        TEXT[] NOT NULL DEFAULT '{{}}',
    tools         TEXT[] NOT NULL DEFAULT '{{}}',
    model         TEXT NOT NULL DEFAULT '{DEFAULT_MODEL}',
    action_rids   TEXT[] NOT NULL DEFAULT '{{}}',
    kb_ids        TEXT[] NOT NULL DEFAULT '{{}}',
    markings      TEXT[] NOT NULL DEFAULT '{{}}',
    origin        TEXT NOT NULL DEFAULT 'instantiated',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, profile_id)
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


def bootstrap_profiles(conn: psycopg.Connection[Any], app_role: str = "mate_app") -> None:
    """建员工表 + RLS 策略（幂等）。``conn`` 必须是 **admin** 连接且已设好 search_path。"""
    conn.execute(_TABLE_DDL)
    conn.execute(_RLS_DDL.format(app_role=app_role))


def _to_profile(row: tuple[Any, ...]) -> EmployeeProfile:
    (
        profile_id,
        _tenant,
        name,
        base_role,
        system_prompt,
        skills,
        tools,
        model,
        action_rids,
        kb_ids,
        markings,
        origin,
    ) = row
    return EmployeeProfile(
        profile_id=profile_id,
        name=name or "",
        base_role=base_role or "ontology",
        system_prompt=system_prompt or "",
        skills=tuple(skills or ()),
        tools=tuple(tools or ()),
        model=model or DEFAULT_MODEL,
        action_rids=tuple(action_rids or ()),
        kb_ids=tuple(kb_ids or ()),
        markings=tuple(markings or ()),
        origin=origin or "instantiated",
    )


class ProfileStore:
    """按租户读写的员工身份表。连接随 context manager 生命周期开闭。"""

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
                await conn.execute(
                    "select set_config('app.tenant_id', %s, false)",
                    (tenant_id,),
                )
            yield conn
        finally:
            await conn.close()

    async def upsert(self, tenant_id: str, profile: EmployeeProfile) -> EmployeeProfile:
        if not tenant_id:
            raise ValueError("tenant_id is required to persist an employee profile")
        values = (
            profile.profile_id,
            tenant_id,
            profile.name,
            profile.base_role,
            profile.system_prompt,
            list(profile.skills),
            list(profile.tools),
            profile.model,
            list(profile.action_rids),
            list(profile.kb_ids),
            list(profile.markings),
            profile.origin,
        )
        updates = ", ".join(
            f"{c} = EXCLUDED.{c}" for c in _COLUMNS if c not in ("profile_id", "tenant_id")
        )
        async with self._conn(tenant_id) as conn:
            await conn.execute(
                f"INSERT INTO {TABLE} ({', '.join(_COLUMNS)}, updated_at)"
                f" VALUES ({', '.join(['%s'] * len(_COLUMNS))}, now())"
                f" ON CONFLICT (tenant_id, profile_id) DO UPDATE SET {updates}, updated_at = now()",
                values,
            )
        return profile

    async def get(self, tenant_id: str, profile_id: str) -> EmployeeProfile | None:
        if not tenant_id:
            return None
        async with self._conn(tenant_id) as conn:
            cur = await conn.execute(
                f"SELECT {', '.join(_COLUMNS)} FROM {TABLE}"
                " WHERE tenant_id = %s AND profile_id = %s",
                (tenant_id, profile_id),
            )
            row = await cur.fetchone()
            return _to_profile(row) if row is not None else None

    async def list(self, tenant_id: str) -> list[EmployeeProfile]:
        if not tenant_id:
            return []
        async with self._conn(tenant_id) as conn:
            cur = await conn.execute(
                f"SELECT {', '.join(_COLUMNS)} FROM {TABLE}"
                " WHERE tenant_id = %s ORDER BY profile_id",
                (tenant_id,),
            )
            return [_to_profile(r) for r in await cur.fetchall()]

    async def delete(self, tenant_id: str, profile_id: str) -> bool:
        if not tenant_id:
            return False
        async with self._conn(tenant_id) as conn:
            cur = await conn.execute(
                f"DELETE FROM {TABLE} WHERE tenant_id = %s AND profile_id = %s",
                (tenant_id, profile_id),
            )
            return bool(cur.rowcount)


__all__ = ["SCHEMA", "TABLE", "ProfileStore", "bootstrap_profiles"]
