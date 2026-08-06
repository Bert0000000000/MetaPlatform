"""PgOntologyRepository —— RUNTIME-MVP-02 补齐（RUNTIME-PG-03 / RUNTIME-OPT）。

实现 12 基元 OntologyRepository Protocol 的 PG 持久化版本：
- JSONB 列存 ObjectType / Individual / ActionType 等结构
- ObjectSet 真在 PG 上执行（filter_expr → SQL WHERE via SQLCompiler）
- 启动时 CREATE TABLE IF NOT EXISTS 自愈

不走 SQLAlchemy ORM（轻量），直接 psycopg2 sync + asyncio.to_thread
包装成 sync 接口（FastAPI threadpool 默认跑 sync 函数 OK）。
"""

from __future__ import annotations

import asyncio
import json
import threading
from datetime import datetime, timezone
from typing import Any

from mate_kernel.ontology.api import OntologyRepository
from mate_kernel.ontology.identity import ClassRef, Version
from mate_kernel.ontology.instances import Individual, LinkInstance
from mate_kernel.ontology.query import ObjectSet
from mate_kernel.ontology.reasoning import Axiom, Function
from mate_kernel.ontology.types import (
    ActionType,
    Interface,
    LinkType,
    ObjectType,
    Property,
    PropertyFormat,
)

from mate_kernel.objectset.compiler import FilterCompiler
from mate_kernel.objectset.sql_compiler import SQLCompiler


DDL: tuple[str, ...] = (
    """
    CREATE TABLE IF NOT EXISTS ont_object_type (
        rid          TEXT PRIMARY KEY,
        tenant_id    TEXT NOT NULL,
        primary_key  TEXT[] NOT NULL,
        properties   JSONB NOT NULL,
        interfaces   TEXT[] NOT NULL DEFAULT '{}',
        display_name TEXT NOT NULL DEFAULT '',
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_ont_ot_tenant ON ont_object_type (tenant_id)",
    """
    CREATE TABLE IF NOT EXISTS ont_individual (
        rid          TEXT PRIMARY KEY,
        tenant_id    TEXT NOT NULL,
        class_rid    TEXT NOT NULL,
        props        JSONB NOT NULL DEFAULT '{}'::jsonb,
        primary_key  TEXT NOT NULL,
        marking      TEXT[] NOT NULL DEFAULT '{}',
        created_at   TIMESTAMPTZ NOT NULL,
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_ont_ind_tenant_class ON ont_individual (tenant_id, class_rid)",
    "CREATE INDEX IF NOT EXISTS ix_ont_ind_props ON ont_individual USING GIN (props)",
    """
    CREATE TABLE IF NOT EXISTS ont_action_type (
        rid                  TEXT PRIMARY KEY,
        tenant_id            TEXT NOT NULL,
        parameters           JSONB NOT NULL DEFAULT '[]'::jsonb,
        submission_criteria  JSONB NOT NULL DEFAULT '[]'::jsonb,
        side_effects         JSONB NOT NULL DEFAULT '[]'::jsonb,
        function_ref         TEXT NOT NULL DEFAULT '',
        target_object_types  TEXT[] NOT NULL DEFAULT '{}',
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_ont_at_tenant ON ont_action_type (tenant_id)",
)


def _props_to_dict(p: tuple[tuple[ClassRef, object], ...]) -> dict[str, Any]:
    return {k.rid: v for k, v in p}


def _ot_to_row(ot: ObjectType) -> dict[str, Any]:
    return {
        "rid": ot.rid.rid,
        "tenant_id": ot.rid.rid.split(".")[1] if "." in ot.rid.rid else "",
        "primary_key": [pk.rid for pk in ot.primary_key],
        "properties": [
            {
                "rid": p.rid.rid,
                "type_id": p.type_id,
                "nullable": p.nullable,
                "primary_key": p.primary_key,
                "title": p.title,
                "format": p.format.value,
            }
            for p in ot.properties
        ],
        "interfaces": [i.rid for i in ot.interfaces],
        "display_name": ot.display_name,
    }


def _row_to_ot(row: dict[str, Any]) -> ObjectType:
    return ObjectType(
        rid=ClassRef(row["rid"]),
        primary_key=tuple(ClassRef(pk) for pk in row["primary_key"]),
        properties=tuple(
            Property(
                rid=ClassRef(p["rid"]),
                type_id=p["type_id"],
                nullable=p["nullable"],
                primary_key=p["primary_key"],
                title=p["title"],
                format=PropertyFormat(p["format"]),
            )
            for p in row["properties"]
        ),
        interfaces=tuple(ClassRef(i) for i in row["interfaces"]),
        display_name=row["display_name"],
    )


def _row_to_individual(row: dict[str, Any]) -> Individual:
    props_dict: dict[str, Any] = row["props"] if isinstance(row["props"], dict) else {}
    return Individual(
        rid=row["rid"],
        class_rid=ClassRef(row["class_rid"]),
        props=tuple((ClassRef(k), v) for k, v in props_dict.items()),
        primary_key=row["primary_key"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        tenant_id=row["tenant_id"],
        marking=tuple(row.get("marking", []) or []),
    )


class PgOntologyRepository(OntologyRepository):
    """psycopg2 sync 接口（FastAPI sync def OK）。

    DSN 形如 postgresql://user:pwd@host:5432/dbname。创建表自愈。
    """

    def __init__(self, dsn: str) -> None:
        self._dsn = dsn
        self._lock = threading.Lock()
        self._initialized = False

    def _connect(self):
        import psycopg2  # type: ignore
        import psycopg2.extras  # type: ignore
        conn = psycopg2.connect(self._dsn)
        conn.autocommit = False
        # 全局开启 dict cursor：fetchone/fetchall 返回 dict（row["rid"]）
        psycopg2.extras.register_default_jsonb(conn_or_curs=conn, loads=json.loads)
        return conn, psycopg2.extras.RealDictCursor

    def _ensure_schema(self) -> None:
        if self._initialized:
            return
        with self._lock:
            if self._initialized:
                return
            conn, _ = self._connect()
            try:
                with self._cursor(conn) as cur:
                    for stmt in DDL:
                        cur.execute(stmt)
                conn.commit()
                self._initialized = True
            finally:
                conn.close()

    def _cursor(self, conn):
        """返回 RealDictCursor —— 永远走 dict 路径。"""
        import psycopg2.extras  # type: ignore
        return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    def _ensure_schema(self) -> None:
        if self._initialized:
            return
        with self._lock:
            if self._initialized:
                return
            conn, _ = self._connect()
            try:
                with self._cursor(conn) as cur:
                    for stmt in DDL:
                        cur.execute(stmt)
                conn.commit()
                self._initialized = True
            finally:
                conn.close()

    # ───── identity ─────

    def resolve_class_ref(self, rid: str) -> ClassRef:
        return ClassRef(rid)

    def snapshot_version(
        self, class_rid: ClassRef, author: str, parent: str | None, change_set: tuple[str, ...]
    ) -> Version:
        existing = self.list_versions(class_rid)
        n = len(existing) + 1
        rid = f"ont.{class_rid.rid.split('.')[1]}.ver.{class_rid.rid.split('.')[-1]}.v{n}"
        return Version(
            rid=rid,
            class_ref=class_rid,
            parent_rid=parent or (existing[-1].rid if existing else None),
            created_at=datetime.now(timezone.utc),
            author=author,
            change_set=change_set,
        )

    def list_versions(self, class_rid: ClassRef) -> list[Version]:
        # M1/M2: 版本历史元数据放 PG 不在 MVP 范围；返回空 list 保协议
        return []

    # ───── types ─────

    def upsert_object_type(self, ot: ObjectType) -> ObjectType:
        self._ensure_schema()
        row = _ot_to_row(ot)
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    """
                    INSERT INTO ont_object_type
                        (rid, tenant_id, primary_key, properties, interfaces, display_name, updated_at)
                    VALUES (%s, %s, %s, %s::jsonb, %s, %s, now())
                    ON CONFLICT (rid) DO UPDATE SET
                        primary_key = EXCLUDED.primary_key,
                        properties = EXCLUDED.properties,
                        interfaces = EXCLUDED.interfaces,
                        display_name = EXCLUDED.display_name,
                        updated_at = now()
                    """,
                    (
                        row["rid"],
                        row["tenant_id"],
                        row["primary_key"],
                        json.dumps(row["properties"]),
                        row["interfaces"],
                        row["display_name"],
                    ),
                )
            conn.commit()
            return ot
        finally:
            conn.close()

    def get_object_type(self, rid: ClassRef) -> ObjectType:
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute("SELECT * FROM ont_object_type WHERE rid = %s", (rid.rid,))
                row = cur.fetchone()
            if row is None:
                raise KeyError(f"ObjectType not found: {rid.rid}")
            return _row_to_ot(row)
        finally:
            conn.close()

    def list_object_types(self, limit: int, offset: int) -> list[ObjectType]:
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    "SELECT * FROM ont_object_type ORDER BY rid LIMIT %s OFFSET %s",
                    (limit, offset),
                )
                rows = cur.fetchall()
            return [_row_to_ot(r) for r in rows]
        finally:
            conn.close()

    def upsert_link_type(self, lt: LinkType) -> LinkType:
        # MVP: 不持久化 LinkType（保留接口兼容）
        return lt

    def upsert_action_type(self, at: ActionType) -> ActionType:
        self._ensure_schema()
        tenant = at.rid.rid.split(".")[1] if "." in at.rid.rid else ""
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    """
                    INSERT INTO ont_action_type
                        (rid, tenant_id, parameters, submission_criteria, side_effects, function_ref, target_object_types, updated_at)
                    VALUES (%s, %s, %s::jsonb, %s::jsonb, %s::jsonb, %s, %s, now())
                    ON CONFLICT (rid) DO UPDATE SET
                        parameters = EXCLUDED.parameters,
                        submission_criteria = EXCLUDED.submission_criteria,
                        side_effects = EXCLUDED.side_effects,
                        function_ref = EXCLUDED.function_ref,
                        target_object_types = EXCLUDED.target_object_types,
                        updated_at = now()
                    """,
                    (
                        at.rid.rid,
                        tenant,
                        json.dumps([p.rid.rid for p in at.parameters]),
                        json.dumps(list(at.submission_criteria)),
                        json.dumps(list(at.side_effects)),
                        at.function_ref.rid,
                        [c.rid for c in at.on],
                    ),
                )
            conn.commit()
            return at
        finally:
            conn.close()

    def upsert_interface(self, i: Interface) -> Interface:
        return i

    def upsert_property(self, p: Property) -> Property:
        return p

    def list_link_types(self) -> list[LinkType]:
        return []

    def list_action_types(self) -> list[ActionType]:
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute("SELECT rid, parameters FROM ont_action_type ORDER BY rid")
                rows = cur.fetchall()
            from mate_kernel.ontology.types.action_type import ActionType
            out: list[ActionType] = []
            for r in rows:
                out.append(
                    ActionType(
                        rid=ClassRef(r["rid"]),
                        parameters=(),
                        submission_criteria=(),
                        side_effects=(),
                        function_ref=ClassRef("ont.system.fn.noop.v1"),
                        on=(),
                    )
                )
            return out
        finally:
            conn.close()

    def list_interfaces(self) -> list[Interface]:
        return []

    def get_link_type(self, rid: ClassRef) -> LinkType:
        raise KeyError(rid.rid)

    def get_action_type(self, rid: ClassRef) -> ActionType:
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute("SELECT * FROM ont_action_type WHERE rid = %s", (rid.rid,))
                row = cur.fetchone()
            if row is None:
                raise KeyError(f"ActionType not found: {rid.rid}")
            from mate_kernel.ontology.types.action_type import ActionType
            return ActionType(
                rid=ClassRef(row["rid"]),
                parameters=(),
                submission_criteria=tuple(row.get("submission_criteria", []) or []),
                side_effects=tuple(row.get("side_effects", []) or []),
                function_ref=ClassRef(row.get("function_ref") or "ont.system.fn.noop.v1"),
                on=tuple(ClassRef(c) for c in (row.get("target_object_types") or [])),
            )
        finally:
            conn.close()

    # ───── instances ─────

    def create_individual(self, ind: Individual) -> Individual:
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    """
                    INSERT INTO ont_individual
                        (rid, tenant_id, class_rid, props, primary_key, marking, created_at, updated_at)
                    VALUES (%s, %s, %s, %s::jsonb, %s, %s, %s, %s)
                    ON CONFLICT (rid) DO UPDATE SET
                        props = EXCLUDED.props,
                        marking = EXCLUDED.marking,
                        updated_at = EXCLUDED.updated_at
                    """,
                    (
                        ind.rid,
                        ind.tenant_id,
                        ind.class_rid.rid,
                        json.dumps(_props_to_dict(ind.props), default=str),
                        ind.primary_key,
                        list(ind.marking),
                        ind.created_at,
                        ind.updated_at,
                    ),
                )
            conn.commit()
            return ind
        finally:
            conn.close()

    def get_individual(self, rid: str) -> Individual:
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute("SELECT * FROM ont_individual WHERE rid = %s", (rid,))
                row = cur.fetchone()
            if row is None:
                raise KeyError(f"Individual not found: {rid}")
            return _row_to_individual(row)
        finally:
            conn.close()

    def list_individuals(self, class_rid: ClassRef | None) -> list[Individual]:
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                if class_rid is None:
                    cur.execute("SELECT * FROM ont_individual ORDER BY rid")
                else:
                    cur.execute(
                        "SELECT * FROM ont_individual WHERE class_rid = %s ORDER BY rid",
                        (class_rid.rid,),
                    )
                rows = cur.fetchall()
            return [_row_to_individual(r) for r in rows]
        finally:
            conn.close()

    def create_link_instance(self, li: LinkInstance) -> LinkInstance:
        return li

    def list_link_instances(self) -> list[LinkInstance]:
        return []

    # ───── reasoning ─────

    def upsert_axiom(self, ax: Axiom) -> Axiom:
        return ax

    def list_axioms(self) -> list[Axiom]:
        return []

    def upsert_function(self, f: Function) -> Function:
        return f

    def list_functions(self) -> list[Function]:
        return []

    # ───── query / apply ─────

    def evaluate_object_set(self, os_: ObjectSet) -> list[Individual]:
        self._ensure_schema()
        compiler = FilterCompiler()
        compiled = compiler.compile(os_.filter_expr)
        sqlc = SQLCompiler()
        where_sql, params = sqlc.compile_where(compiled)

        # sort
        order_by = ""
        if os_.sort:
            sort_field = os_.sort[0]
            reverse = sort_field.startswith("-")
            field_name = sort_field.lstrip("-")
            col = f"(props ->> '{field_name}')"
            order_by = f" ORDER BY {col}::numeric DESC" if reverse else f" ORDER BY {col}::numeric ASC"
            # 简化：MVP 全当 numeric 排；后续按 type_id 分支

        sql = (
            f"SELECT * FROM ont_individual "
            f"WHERE class_rid = %s AND ({where_sql})"
            f"{order_by} "
            f"LIMIT %s OFFSET %s"
        )
        params_all: list[Any] = [os_.class_rid.rid, *params, os_.paging_limit, os_.paging_offset]

        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(sql, params_all)
                rows = cur.fetchall()
            return [_row_to_individual(r) for r in rows]
        finally:
            conn.close()

    def apply_action(
        self,
        action_rid: ClassRef,
        target_iid: str,
        parameters: dict[str, Any],
        provenance: dict[str, Any],
    ) -> tuple[datetime, list[str]]:
        # MVP: 校验 action 注册过；记录 audit_id；落 updated_at
        at = self.get_action_type(action_rid)
        ind = self.get_individual(target_iid)
        now = datetime.now(timezone.utc)
        side_effects = [
            f"action={at.rid.rid}",
            f"target={ind.rid}",
            f"actor={provenance.get('actor', '?')}",
            f"params={json.dumps(parameters, default=str)}",
        ]
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    "UPDATE ont_individual SET updated_at = %s WHERE rid = %s",
                    (now, target_iid),
                )
            conn.commit()
        finally:
            conn.close()
        return now, side_effects


async def run_in_thread(repo_method, /, *args, **kwargs):  # pyright: ignore[reportUnusedFunction]
    """async 包装：把 PG sync 调用推到 threadpool，避免阻塞 event loop。"""
    return await asyncio.to_thread(repo_method, *args, **kwargs)


__all__ = ["PgOntologyRepository", "DDL"]