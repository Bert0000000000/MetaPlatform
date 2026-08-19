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
import re
import threading
from collections.abc import Iterator
from contextlib import contextmanager, suppress
from dataclasses import replace as _dc_replace
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from mate_kernel.objectset.compiler import CompiledFilter, FilterCompiler, individual_to_row
from mate_kernel.objectset.ir import Condition, ObjectSetQuery, QueryOp, QueryResult
from mate_kernel.objectset.sql_compiler import SQLCompiler
from mate_kernel.ontology.api import OntologyRepository
from mate_kernel.ontology.identity import ClassRef, Version
from mate_kernel.ontology.instances import Individual, LinkInstance
from mate_kernel.ontology.query import ObjectSet
from mate_kernel.ontology.reasoning import Axiom, Function
from mate_kernel.ontology.reasoning.axiom import AxiomKind
from mate_kernel.ontology.reasoning.function import FunctionLanguage
from mate_kernel.ontology.types import (
    ActionType,
    Interface,
    LinkType,
    ObjectType,
    Property,
    PropertyFormat,
)
from mate_kernel.ontology.types.link_type import Cardinality, Directionality

# MP-DEDUP-01：psycopg2 错误类引用（UniqueViolation 捕获用）
try:
    import psycopg2.errors as psycopg2_errors  # type: ignore
except ImportError:  # pragma: no cover — psycopg2 始终在依赖中
    psycopg2_errors = None  # type: ignore[assignment]

# GOVERN-05: 默认 inline 源码 —— apply 没注册源码时 fallback，让 dev / 旧测试
# 仍可走通。最简 main(target, params) → params 原样返回。
_PG_DEFAULT_INLINE_FN = "def main(target, params):\n    return params\n"

# source_ref → source 命名注册表（seed / 测试可用）
_PG_INLINE_FUNCTIONS: dict[str, str] = {}


class SlugConflictError(Exception):
    """MP-DEDUP-01：DB UNIQUE 冲突 on (tenant_id, slug) —— API 翻译为 409。

    Attributes:
        tenant_id: 触发冲突的租户。
        slug: 触发冲突的 slug（第 4 段 rid）。
        existing_rid: 已存在的 ObjectType rid（NULL = 仅检测到 UNIQUE 触发，rid 不可知）。
        existing_display_name: 已存在的 ObjectType display_name（best-effort）。
    """

    def __init__(
        self,
        tenant_id: str,
        slug: str,
        existing_rid: str | None,
        existing_display_name: str = "",
    ) -> None:
        self.tenant_id = tenant_id
        self.slug = slug
        self.existing_rid = existing_rid
        self.existing_display_name = existing_display_name
        msg = (
            f"ObjectType slug '{slug}' already exists for tenant '{tenant_id}'"
            + (
                f" (existing rid={existing_rid}, display_name={existing_display_name!r})"
                if existing_rid
                else ""
            )
            + ". Please merge into existing or rename."
        )
        super().__init__(msg)


DDL: tuple[str, ...] = (
    """
    CREATE TABLE IF NOT EXISTS ont_object_type (
        rid          TEXT PRIMARY KEY,
        tenant_id    TEXT NOT NULL,
        slug         TEXT NOT NULL DEFAULT '',
        primary_key  TEXT[] NOT NULL,
        properties   JSONB NOT NULL,
        interfaces   TEXT[] NOT NULL DEFAULT '{}',
        display_name TEXT NOT NULL DEFAULT '',
        marking      TEXT[] NOT NULL DEFAULT '{}',
        archived     BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_ont_ot_tenant ON ont_object_type (tenant_id)",
    # MP-SAL-01：类型级 marking（ADR-0043 §2.6）——旧库补列
    "ALTER TABLE ont_object_type ADD COLUMN IF NOT EXISTS marking TEXT[] NOT NULL DEFAULT '{}'",
    # MP-DEDUP-01：slug 列（从 rid 第 4 段派生）+ archived 列（merge 软删标记）
    "ALTER TABLE ont_object_type ADD COLUMN IF NOT EXISTS slug TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE ont_object_type ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE",
    # MP-DEDUP-01：(tenant_id, slug) 唯一约束。WHERE 子句排除 archived 行（merge 后
    # 软删的源 OT 不再占 slug）与空 slug（兼容旧库未填写 slug 的脏数据）。
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_ont_ot_tenant_slug "
    "ON ont_object_type (tenant_id, slug) WHERE archived = FALSE AND slug != ''",
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
        title                TEXT NOT NULL DEFAULT '',
        description          TEXT NOT NULL DEFAULT '',
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_ont_at_tenant ON ont_action_type (tenant_id)",
    # 旧库补列（CREATE TABLE IF NOT EXISTS 不会给已存在的表加列）
    "ALTER TABLE ont_action_type ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE ont_action_type ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''",
    """
    CREATE TABLE IF NOT EXISTS ont_link_type (
        rid             TEXT PRIMARY KEY,
        tenant_id       TEXT NOT NULL,
        src_rid         TEXT NOT NULL,
        dst_rid         TEXT NOT NULL,
        cardinality     TEXT NOT NULL,
        directionality  TEXT NOT NULL,
        link_properties JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_ont_lt_tenant ON ont_link_type (tenant_id)",
    """
    CREATE TABLE IF NOT EXISTS ont_interface (
        rid                              TEXT PRIMARY KEY,
        tenant_id                        TEXT NOT NULL,
        properties                       JSONB NOT NULL DEFAULT '[]'::jsonb,
        required_links                   TEXT[] NOT NULL DEFAULT '{}',
        polymorphic_action_constraints   TEXT[] NOT NULL DEFAULT '{}',
        updated_at                       TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_ont_if_tenant ON ont_interface (tenant_id)",
    """
    CREATE TABLE IF NOT EXISTS ont_property (
        rid          TEXT PRIMARY KEY,
        tenant_id    TEXT NOT NULL,
        type_id      TEXT NOT NULL DEFAULT 'string',
        nullable     BOOLEAN NOT NULL DEFAULT TRUE,
        primary_key  BOOLEAN NOT NULL DEFAULT FALSE,
        title        TEXT NOT NULL DEFAULT '',
        format       TEXT NOT NULL DEFAULT 'string',
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_ont_prop_tenant ON ont_property (tenant_id)",
    """
    CREATE TABLE IF NOT EXISTS ont_link_instance (
        rid            TEXT PRIMARY KEY,
        tenant_id      TEXT NOT NULL,
        link_type_rid  TEXT NOT NULL,
        src            TEXT NOT NULL,
        dst            TEXT NOT NULL,
        props          JSONB NOT NULL DEFAULT '{}'::jsonb,
        marking        TEXT[] NOT NULL DEFAULT '{}',
        created_at     TIMESTAMPTZ NOT NULL,
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_ont_li_tenant ON ont_link_instance (tenant_id)",
    "CREATE INDEX IF NOT EXISTS ix_ont_li_src ON ont_link_instance (src)",
    "CREATE INDEX IF NOT EXISTS ix_ont_li_dst ON ont_link_instance (dst)",
    """
    CREATE TABLE IF NOT EXISTS ont_axiom (
        rid        TEXT PRIMARY KEY,
        tenant_id  TEXT NOT NULL,
        kind       TEXT NOT NULL,
        operands   TEXT[] NOT NULL DEFAULT '{}',
        rule_ref   TEXT NOT NULL DEFAULT '',
        metadata   JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_ont_ax_tenant ON ont_axiom (tenant_id)",
    # MP-SAL-02: 对象语义检索索引表（OAG，spec §4.2 SAL-02）
    """
    CREATE TABLE IF NOT EXISTS ont_object_embedding (
        chunk_id       TEXT PRIMARY KEY,
        individual_rid TEXT NOT NULL,
        class_rid      TEXT NOT NULL,
        property_rid   TEXT NOT NULL,
        value_text     TEXT NOT NULL DEFAULT '',
        embedding      JSONB,
        tenant_id      TEXT NOT NULL,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_ont_oemb_tenant ON ont_object_embedding (tenant_id)",
    "CREATE INDEX IF NOT EXISTS ix_ont_oemb_ind ON ont_object_embedding (individual_rid)",
    # MP-SAL-04: proposal 状态机持久化（ADR-0044 §2.2）
    """
    CREATE TABLE IF NOT EXISTS ont_proposal (
        proposal_id    TEXT PRIMARY KEY,
        tenant_id      TEXT NOT NULL,
        action_rid     TEXT NOT NULL,
        target_iid     TEXT,
        parameters     JSONB NOT NULL DEFAULT '{}'::jsonb,
        impact_summary TEXT NOT NULL DEFAULT '',
        expected_diff  JSONB NOT NULL DEFAULT '{}'::jsonb,
        status         TEXT NOT NULL DEFAULT 'pending',
        confirmed_by   TEXT,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        confirmed_at   TIMESTAMPTZ,
        applied_at     TIMESTAMPTZ
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_ont_prop_tenant ON ont_proposal (tenant_id)",
    # MP-SAL-04b: proposal kind（action / create_instance / model_type）
    "ALTER TABLE ont_proposal ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'action'",
    """
    CREATE TABLE IF NOT EXISTS ont_function (
        rid        TEXT PRIMARY KEY,
        tenant_id  TEXT NOT NULL,
        language   TEXT NOT NULL,
        version    INTEGER NOT NULL DEFAULT 1,
        source_ref TEXT NOT NULL DEFAULT '',
        signatures JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_ont_fn_tenant ON ont_function (tenant_id)",
    # MP-SAL-05: 流程编排定义持久化（FlowGram WorkflowJSON + 字段配置，按 action_rid 关联）
    """
    CREATE TABLE IF NOT EXISTS ont_flow_definition (
        action_rid TEXT PRIMARY KEY,
        tenant_id  TEXT NOT NULL,
        flow_json  JSONB NOT NULL DEFAULT '{}'::jsonb,
        config     JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_ont_flow_tenant ON ont_flow_definition (tenant_id)",
)


def _props_to_dict(p: tuple[tuple[ClassRef, object], ...]) -> dict[str, Any]:
    return {k.rid: v for k, v in p}


# ─────────────────── ObjectSet SQL 支持（RUNTIME-PG-03 修复） ───────────────────

# JSONB 键 / ORDER BY 键的白名单：Property rid 形如
# ``ont.<tenant>.prop.<slug>.<version>``，字符集由 ClassRef 校验约束。
_SAFE_JSON_KEY = re.compile(r"^[A-Za-z0-9_.:\-]+$")

# Property.type_id → 数值排序白名单（其余按 text 字典序排）。
_NUMERIC_TYPE_IDS = frozenset(
    {"integer", "int", "long", "number", "decimal", "float", "double"}
)


class _RepoSQLCompiler(SQLCompiler):
    """RUNTIME-PG-03: 修上游 ``SQLCompiler._render`` truthy 分支的占位符 bug。

    上游 truthy 渲染把 col_expr（含 ``%s``）输出两次（IS NOT NULL + != ''），
    但 ``_column_expr`` 的参数只 extend 一次 → psycopg2 ``IndexError: list
    index out of range``。本子类把参数补齐成两份；自定义列映射（无占位符）
    时 extra 为空，行为不变。上游修复落地后本子类可删。
    """

    def _render(self, cf: CompiledFilter, params: list[Any]) -> str:
        if cf.kind == "truthy":
            col_expr, extra = self._column_expr(cf.field_name or "")
            params.extend(extra)
            params.extend(extra)
            return f"({col_expr}) IS NOT NULL AND ({col_expr}) != ''"
        return super()._render(cf, params)


def _rewrite_filter_fields(
    cf: CompiledFilter, slug_to_rid: dict[str, str]
) -> CompiledFilter:
    """把 CompiledFilter 里的简写 slug 字段名归一化为完整 Property rid。

    InMemory 执行器（``individual_to_row``）用 rid 第 4 段作 row key，因此
    DSL 支持 ``amount > 10`` 这类简写；PG 的 JSONB 键存的是完整 rid
    （``_props_to_dict``），不归一化则 ``props ->> 'amount'`` 永远 NULL、
    过滤结果恒空。仅在 slug_to_rid 命中时替换，未命中原样保留。
    """

    field = cf.field_name
    new_field = slug_to_rid.get(field, field) if field is not None else None
    new_children = tuple(
        _rewrite_filter_fields(c, slug_to_rid) for c in cf.children
    )
    if new_field == field and new_children == cf.children:
        return cf
    return _dc_replace(cf, field_name=new_field, children=new_children)


def _prop_slug(rid: str) -> str:
    """rid 第 4 段作 slug（与 kernel ``individual_to_row`` 同一规则）。"""
    parts = rid.split(".")
    return parts[3] if len(parts) >= 5 else parts[-1]


def _ir_where(
    conditions: tuple[Condition, ...], slug_to_rid: dict[str, str]
) -> tuple[str, list[Any]]:
    """IR 条件组（AND）→ 参数化 WHERE 片段。语义对齐 SQLCompiler._cmp/_like。"""
    parts: list[str] = []
    params: list[Any] = []
    for cond in conditions:
        field = slug_to_rid.get(cond.field, cond.field)
        op = cond.op
        if op is QueryOp.TRUTHY:
            parts.append("(props ->> %s) IS NOT NULL AND (props ->> %s) <> ''")
            params.extend([field, field])
            continue
        if op in (QueryOp.STARTSWITH, QueryOp.CONTAINS):
            v = str(cond.value).replace("\\", "\\\\").replace("%", r"\%").replace("_", r"\_")
            pat = f"{v}%" if op is QueryOp.STARTSWITH else f"%{v}%"
            parts.append("(props ->> %s) LIKE %s")
            params.extend([field, pat])
            continue
        if op is QueryOp.EQ or op is QueryOp.NE:
            sql_op = "=" if op is QueryOp.EQ else "<>"
            if isinstance(cond.value, (int, float)):
                parts.append(f"((props ->> %s)::numeric {sql_op} %s)")
            else:
                parts.append(f"(props ->> %s {sql_op} %s)")
            params.extend([field, cond.value])
            continue
        sql_op = {
            QueryOp.GT: ">",
            QueryOp.GTE: ">=",
            QueryOp.LT: "<",
            QueryOp.LTE: "<=",
        }.get(op)
        if sql_op is None:
            raise ValueError(f"unsupported IR op {op!r}")
        parts.append(f"((props ->> %s)::numeric {sql_op} %s)")
        params.extend([field, cond.value])
    return " AND ".join(parts), params


def _ot_to_row(ot: ObjectType) -> dict[str, Any]:
    rid_parts = ot.rid.rid.split(".")
    return {
        "rid": ot.rid.rid,
        "tenant_id": rid_parts[1] if len(rid_parts) >= 2 else "",
        # MP-DEDUP-01：slug 从 rid 第 5 段派生（与 kernel ``individual_to_row`` 同规则）
        # rid 形如 ``ont.<tenant>.obj.<domain>.<slug>.v1``，所以 parts[4] 才是 slug，
        # parts[3] 是 domain（与 seed.py 实际使用的 6 段格式一致）。
        "slug": rid_parts[4] if len(rid_parts) >= 6 else "",
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
        "marking": list(ot.marking),
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
        marking=tuple(row.get("marking") or ()),
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


def _lt_to_row(lt: LinkType) -> dict[str, Any]:
    return {
        "rid": lt.rid.rid,
        "tenant_id": lt.rid.rid.split(".")[1] if "." in lt.rid.rid else "",
        "src_rid": lt.src.rid,
        "dst_rid": lt.dst.rid,
        "cardinality": lt.cardinality.value,
        "directionality": lt.directionality.value,
        "link_properties": [
            {
                "rid": p.rid.rid,
                "type_id": p.type_id,
                "nullable": p.nullable,
                "primary_key": p.primary_key,
                "title": p.title,
                "format": p.format.value,
            }
            for p in lt.link_properties
        ],
    }


def _row_to_at(row: dict[str, Any]) -> ActionType:
    """ont_action_type 行 → ActionType。

    parameters 列历史上有两种格式：早期只存 rid 字符串数组（属性定义丢失），
    现在存完整 property dict。两种都兼容。
    """
    params: list[Property] = []
    for p in row.get("parameters") or []:
        if isinstance(p, str):
            params.append(Property(
                rid=ClassRef(p), type_id="string", nullable=True,
                primary_key=False, title="", format=PropertyFormat.STRING,
            ))
        elif isinstance(p, dict):
            params.append(Property(
                rid=ClassRef(p["rid"]), type_id=p["type_id"],
                nullable=bool(p.get("nullable", True)),
                primary_key=bool(p.get("primary_key", False)),
                title=p.get("title", ""),
                format=PropertyFormat(p.get("format", "string")),
            ))
    return ActionType(
        rid=ClassRef(row["rid"]),
        parameters=tuple(params),
        submission_criteria=tuple(row.get("submission_criteria") or []),
        side_effects=tuple(row.get("side_effects") or []),
        function_ref=ClassRef(row["function_ref"]) if row.get("function_ref") else ClassRef("ont.system.fn.noop.v1"),
        on=tuple(ClassRef(r) for r in row.get("target_object_types") or []),
        title=row.get("title") or "",
        description=row.get("description") or "",
    )


def _row_to_lt(row: dict[str, Any]) -> LinkType:
    return LinkType(
        rid=ClassRef(row["rid"]),
        src=ClassRef(row["src_rid"]),
        dst=ClassRef(row["dst_rid"]),
        cardinality=Cardinality(row["cardinality"]),
        directionality=Directionality(row["directionality"]),
        link_properties=tuple(
            Property(
                rid=ClassRef(p["rid"]),
                type_id=p["type_id"],
                nullable=p["nullable"],
                primary_key=p["primary_key"],
                title=p["title"],
                format=PropertyFormat(p["format"]),
            )
            for p in row["link_properties"]
        ),
    )


def _if_to_row(i: Interface) -> dict[str, Any]:
    return {
        "rid": i.rid.rid,
        "tenant_id": i.rid.rid.split(".")[1] if "." in i.rid.rid else "",
        "properties": [
            {
                "rid": p.rid.rid,
                "type_id": p.type_id,
                "nullable": p.nullable,
                "primary_key": p.primary_key,
                "title": p.title,
                "format": p.format.value,
            }
            for p in i.properties
        ],
        "required_links": [r.rid for r in i.required_links],
        "polymorphic_action_constraints": list(i.polymorphic_action_constraints),
    }


def _row_to_if(row: dict[str, Any]) -> Interface:
    return Interface(
        rid=ClassRef(row["rid"]),
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
        required_links=tuple(ClassRef(r) for r in row.get("required_links") or []),
        polymorphic_action_constraints=tuple(
            row.get("polymorphic_action_constraints") or []
        ),
    )


def _prop_to_row(p: Property) -> dict[str, Any]:
    return {
        "rid": p.rid.rid,
        "tenant_id": p.rid.rid.split(".")[1] if "." in p.rid.rid else "",
        "type_id": p.type_id,
        "nullable": p.nullable,
        "primary_key": p.primary_key,
        "title": p.title,
        "format": p.format.value,
    }


def _row_to_prop(row: dict[str, Any]) -> Property:
    return Property(
        rid=ClassRef(row["rid"]),
        type_id=row["type_id"],
        nullable=row["nullable"],
        primary_key=row["primary_key"],
        title=row["title"],
        format=PropertyFormat(row["format"]),
    )


def _li_to_row(li: LinkInstance) -> dict[str, Any]:
    return {
        "rid": li.rid,
        "tenant_id": li.tenant_id,
        "link_type_rid": li.link_type_rid.rid,
        "src": li.src,
        "dst": li.dst,
        "props": {k.rid: v for k, v in li.props},
        "marking": list(li.marking),
        "created_at": li.created_at,
    }


def _row_to_li(row: dict[str, Any]) -> LinkInstance:
    props_dict: dict[str, Any] = row["props"] if isinstance(row["props"], dict) else {}
    return LinkInstance(
        rid=row["rid"],
        link_type_rid=ClassRef(row["link_type_rid"]),
        src=row["src"],
        dst=row["dst"],
        props=tuple((ClassRef(k), v) for k, v in props_dict.items()),
        created_at=row["created_at"],
        tenant_id=row["tenant_id"],
        marking=tuple(row.get("marking", []) or []),
    )


def _ax_to_row(ax: Axiom) -> dict[str, Any]:
    return {
        "rid": ax.rid.rid,
        "tenant_id": ax.rid.rid.split(".")[1] if "." in ax.rid.rid else "",
        "kind": ax.kind.value,
        "operands": [o.rid for o in ax.operands],
        "rule_ref": ax.rule_ref,
        "metadata": [[k, v] for k, v in ax.metadata],
    }


def _row_to_ax(row: dict[str, Any]) -> Axiom:
    metadata_raw = row.get("metadata") or []
    metadata: list[tuple[str, str]] = []
    for item in metadata_raw:
        if isinstance(item, (list, tuple)) and len(item) == 2:
            metadata.append((str(item[0]), str(item[1])))
    return Axiom(
        rid=ClassRef(row["rid"]),
        kind=AxiomKind(row["kind"]),
        operands=tuple(ClassRef(o) for o in row.get("operands") or []),
        rule_ref=row.get("rule_ref") or "",
        metadata=tuple(metadata),
    )


def _fn_to_row(f: Function) -> dict[str, Any]:
    return {
        "rid": f.rid.rid,
        "tenant_id": f.rid.rid.split(".")[1] if "." in f.rid.rid else "",
        "language": f.language.value,
        "version": f.version,
        "source_ref": f.source_ref,
        "signatures": [[n, t] for n, t in f.signatures],
    }


def _row_to_fn(row: dict[str, Any]) -> Function:
    signatures_raw = row.get("signatures") or []
    signatures: list[tuple[str, str]] = []
    for item in signatures_raw:
        if isinstance(item, (list, tuple)) and len(item) == 2:
            signatures.append((str(item[0]), str(item[1])))
    return Function(
        rid=ClassRef(row["rid"]),
        language=FunctionLanguage(row["language"]),
        version=row["version"],
        source_ref=row.get("source_ref") or "",
        signatures=tuple(signatures),
    )


class PgOntologyRepository(OntologyRepository):
    """psycopg2 sync 接口（FastAPI sync def OK）。

    DSN 形如 postgresql://user:pwd@host:5432/dbname。创建表自愈。
    """

    def __init__(self, dsn: str) -> None:
        self._dsn = dsn
        self._lock = threading.Lock()
        self._initialized = False
        # GOVERN-06: 线程局部的 tenant_id 上下文；通过 tenant_scope() 临时绑定。
        # 默认 None 表示"无租户"—— _install_rls 在这种情况下跳过，保留旧行为
        # （便于一次性脚本 / 迁移场景）。生产请求必须经 tenant_scope() 注入。
        self._tenant_local = threading.local()
        from mate_kernel.action.engine import ActionService
        self._action_service = ActionService()
        # GOVERN-05: FunctionResolver + FunctionExecutor 注入
        from mate_kernel.ontology.function_resolver import InMemoryFunctionResolver
        self._function_resolver: InMemoryFunctionResolver = InMemoryFunctionResolver()
        self._function_executor: object | None = None
        # MP-SAL-02: 对象语义检索 embedder（env 未配置时为 None → 索引跳过）
        from .object_search import build_env_embedder
        self._embedder: object | None = build_env_embedder()
        # MP-SAL-04: side_effect outbox 写回（ADR-0044 §2.3；None = dev 未接，行为不变）
        self._outbox_writer: Any = None

        # GOVERN-12-02: 构造即 bootstrap DDL。任何路径（启动 / 测试 fixture /
        # 迁移脚本）拿到 PgOntologyRepository 实例即可用；不需要启动序列先
        # 显式调 ``initialize()``。DSN 不可达时仅 warn，不阻断进程 —— dev
        # 友好（compose 启动顺序保护），生产期望 K8s readiness 失败。
        try:
            self._ensure_schema()
        except Exception as exc:  # bootstrap 失败降级
            import logging
            logging.getLogger(__name__).warning(
                "pg_schema_bootstrap_failed", extra={"dsn": dsn, "error": str(exc)},
            )

    def _current_tenant(self) -> str | None:
        return getattr(self._tenant_local, "tenant_id", None)

    @contextmanager
    def tenant_scope(self, tenant_id: str) -> Iterator[PgOntologyRepository]:
        """GOVERN-06: 在 with 块内所有 _connect() 自动 install_rls(tenant_id)。

        用法（v2_kernel/api.py）::

            with app_state.kernel_repo.tenant_scope(ctx.tenant_id) as repo:
                result = repo.upsert_object_type(...)

        嵌套调用沿用最内层 tenant；退出 with 自动还原。
        """
        prev = getattr(self._tenant_local, "tenant_id", None)
        self._tenant_local.tenant_id = tenant_id
        try:
            yield self
        finally:
            self._tenant_local.tenant_id = prev

    def set_function_executor(self, executor: object) -> None:
        """GOVERN-05: 注入 FunctionExecutor；同步到 ActionService 内 _executors + _resolver。"""
        self._function_executor = executor
        # 注册已知 function_ref 到 ActionService；upsert_function 时也会调。
        # 同步 resolver 让 register_function_ref 内部能找到
        self._action_service.set_resolver(self._function_resolver)

    def _connect(self):
        """建立 psycopg2 连接；GOVERN-06: 连接建立后立即 install_rls。

        若当前线程已通过 tenant_scope() 绑定 tenant_id，则执行
        ``SET LOCAL app.tenant_id = '<tenant>'``，让 RLS 策略生效。
        没绑定时跳过 —— 走 PG repo 的"全局脚本"路径（迁移 / seed），
        旧代码行为不变。
        """
        import psycopg2  # type: ignore
        import psycopg2.extras  # type: ignore
        conn = psycopg2.connect(self._dsn)
        conn.autocommit = False
        psycopg2.extras.register_default_jsonb(conn_or_curs=conn, loads=json.loads)
        # GOVERN-06: 必须在打开任何 SELECT/INSERT 前设置 GUC；RLS policy
        # USING/WITH CHECK 在每条语句求值。如果不绑 tenant，策略拒绝所有行。
        tenant_id = self._current_tenant()
        if tenant_id is not None:
            self._install_rls(conn, tenant_id)
        return conn, psycopg2.extras.RealDictCursor

    def _install_rls(self, conn: Any, tenant_id: str) -> None:
        """psycopg2 版 install_rls_session —— 每次事务前设置 tenant_id GUC。

        等价于 ``mate_platform.tenancy.rls_session.install_rls_session``，
        但目标是 psycopg2 直连（绕过 SQLAlchemy Session）。用参数化
        ``%s`` 而不是 f-string 拼接 —— 防止任何 tenant_id 注入面。

        Reuses the escape rule from rls_session to keep semantics aligned
        (control-character refusal + single-quote doubling).
        """
        from mate_platform.tenancy.rls_session import (
            GUC_TENANT_ID,
            _escape_pg_string,
        )
        safe = _escape_pg_string(tenant_id)
        with conn.cursor() as cur:
            cur.execute(f"SET LOCAL {GUC_TENANT_ID} = %s", (safe,))

    def _ensure_schema(self) -> None:
        """幂等建表：DDL 全部 ``CREATE TABLE IF NOT EXISTS``，重复调用安全。

        GOVERN-12-02: ``__init__`` 末尾主动调用，使任何 ``PgOntologyRepository``
        构造路径（启动 / 测试 fixture / 迁移脚本）自动建表。
        """
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
            created_at=datetime.now(UTC),
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
            # MP-DEDUP-01：先做 (tenant_id, slug) pre-check，命中即抛 SlugConflictError
            # 带 existing_rid 让 API 层返回有意义的 409 hint。空 slug 跳过（兼容旧库）。
            # race window 内仍依赖 UNIQUE INDEX 兜底（见下方 UniqueViolation 捕获）。
            if row["slug"]:
                with self._cursor(conn) as cur:
                    cur.execute(
                        "SELECT rid, display_name FROM ont_object_type "
                        "WHERE tenant_id = %s AND slug = %s "
                        "AND archived = FALSE AND rid != %s LIMIT 1",
                        (row["tenant_id"], row["slug"], row["rid"]),
                    )
                    conflict = cur.fetchone()
                if conflict:
                    raise SlugConflictError(
                        tenant_id=row["tenant_id"],
                        slug=row["slug"],
                        existing_rid=conflict["rid"],
                        existing_display_name=conflict.get("display_name", ""),
                    )

            with self._cursor(conn) as cur:
                try:
                    cur.execute(
                        """
                        INSERT INTO ont_object_type
                            (rid, tenant_id, slug, primary_key, properties, interfaces,
                             display_name, marking, updated_at)
                        VALUES (%s, %s, %s, %s, %s::jsonb, %s, %s, %s, now())
                        ON CONFLICT (rid) DO UPDATE SET
                            slug = EXCLUDED.slug,
                            primary_key = EXCLUDED.primary_key,
                            properties = EXCLUDED.properties,
                            interfaces = EXCLUDED.interfaces,
                            display_name = EXCLUDED.display_name,
                            marking = EXCLUDED.marking,
                            updated_at = now()
                        """,
                        (
                            row["rid"],
                            row["tenant_id"],
                            row["slug"],
                            row["primary_key"],
                            json.dumps(row["properties"]),
                            row["interfaces"],
                            row["display_name"],
                            row["marking"],
                        ),
                    )
                except psycopg2_errors.UniqueViolation as e:
                    # race：另一并发事务先 commit 了同 slug 的另一 rid。回滚后
                    # 重新查 existing_rid 抛 SlugConflictError。diag.constraint_name
                    # 区分是哪条 UNIQUE INDEX 触发的，避免误报。
                    conn.rollback()
                    constraint = ""
                    diag = getattr(e, "diag", None)
                    if diag is not None:
                        constraint = getattr(diag, "constraint_name", "") or ""
                    if constraint == "uq_ont_ot_tenant_slug":
                        with self._cursor(conn) as cur2:
                            cur2.execute(
                                "SELECT rid, display_name FROM ont_object_type "
                                "WHERE tenant_id = %s AND slug = %s "
                                "AND archived = FALSE AND rid != %s LIMIT 1",
                                (row["tenant_id"], row["slug"], row["rid"]),
                            )
                            existing = cur2.fetchone()
                        raise SlugConflictError(
                            tenant_id=row["tenant_id"],
                            slug=row["slug"],
                            existing_rid=existing["rid"] if existing else None,
                            existing_display_name=(
                                existing.get("display_name", "") if existing else ""
                            ),
                        ) from e
                    raise
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

    def list_object_types(
        self, limit: int, offset: int, tenant_id: str | None = None,
    ) -> list[ObjectType]:
        self._ensure_schema()
        tenant = tenant_id or self._current_tenant()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                if tenant:  # 深度防御：RLS 之外显式租户过滤（to_thread 下 thread-local 不可见）
                    cur.execute(
                        "SELECT * FROM ont_object_type WHERE tenant_id = %s "
                        "ORDER BY rid LIMIT %s OFFSET %s",
                        (tenant, limit, offset),
                    )
                else:
                    cur.execute(
                        "SELECT * FROM ont_object_type ORDER BY rid LIMIT %s OFFSET %s",
                        (limit, offset),
                    )
                rows = cur.fetchall()
            return [_row_to_ot(r) for r in rows]
        finally:
            conn.close()

    # ───── MP-DEDUP-01: ObjectType 去重 + merge（ADR-0044 §3）─────

    def merge_object_types(
        self,
        source_rid: str,
        target_rid: str,
        mapping: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """把 source ObjectType 的实例 / 链接重映射到 target，软删 source。

        步骤（事务内执行）：
        1. UPDATE ont_individual.class_rid: source → target
        2. UPDATE ont_link_instance.src/dst: 替换 Individual rid 中的 source slug
           前缀为 target slug 前缀（rid 形如 ont.<tenant>.ind.<slug>.<pk>）
        3. UPDATE ont_object_type.archived = TRUE WHERE rid = source

        Args:
            source_rid: 被合并的 ObjectType rid（merge 后 archived）。
            target_rid: 接收方 ObjectType rid（保留 active）。
            mapping: 可选 source Property rid → target Property rid 映射表。
                     空 dict → 不做字段级迁移（Individual.props 内仍含源 rid，
                     但后续 evaluate_object_set 归一化按 slug 走，仍能查到 target 的
                     properties）。Property 字段名归一化由 evaluate_object_set 自带的
                     slug→rid 映射兜底。

        Returns:
            {source_rid, target_rid, mapping, affected_individuals,
             affected_links, source_archived}

        Raises:
            KeyError: source / target 不存在。
            ValueError: 同 rid / 跨租户。
        """
        self._ensure_schema()
        if source_rid == target_rid:
            raise ValueError("source_rid and target_rid must differ")
        # 两端必须存在 —— 复用 get_object_type 让 RLS 自动守门
        try:
            self.get_object_type(ClassRef(source_rid))
        except KeyError as e:
            raise KeyError(f"source ObjectType not found: {source_rid}") from e
        try:
            self.get_object_type(ClassRef(target_rid))
        except KeyError as e:
            raise KeyError(f"target ObjectType not found: {target_rid}") from e

        src_parts = source_rid.split(".")
        tgt_parts = target_rid.split(".")
        if len(src_parts) < 6 or len(tgt_parts) < 6:
            raise ValueError("invalid rid format (expected ont.<tenant>.obj.<domain>.<slug>.<ver>)")
        if src_parts[1] != tgt_parts[1]:
            raise ValueError("cross-tenant merge denied")
        tenant_id = src_parts[1]
        # rid 形如 ``ont.<tenant>.obj.<domain>.<slug>.v1``，parts[4] 是 slug。
        src_slug, tgt_slug = src_parts[4], tgt_parts[4]

        # Property 字段重映射（mapping）：在 Individual.props JSONB 键里
        # 把 source prop rid 替换为 target prop rid。target 的 primary_key 不动。
        # 没传 mapping 时按 slug 兜底：source prop rid 第 4 段 slug → target prop rid。
        property_remap: dict[str, str] = {}
        if mapping:
            property_remap.update(mapping)
        else:
            try:
                src_ot = self.get_object_type(ClassRef(source_rid))
                tgt_ot = self.get_object_type(ClassRef(target_rid))
            except KeyError:
                property_remap = {}
            else:
                src_slugs = {p.rid.rid.split(".")[3]: p.rid.rid for p in src_ot.properties}
                tgt_slugs = {p.rid.rid.split(".")[3]: p.rid.rid for p in tgt_ot.properties}
                for slug, src_p_rid in src_slugs.items():
                    if slug in tgt_slugs:
                        property_remap[src_p_rid] = tgt_slugs[slug]

        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                # 1) Individual.class_rid 重映射
                cur.execute(
                    "UPDATE ont_individual SET class_rid = %s, updated_at = now() "
                    "WHERE class_rid = %s AND tenant_id = %s",
                    (target_rid, source_rid, tenant_id),
                )
                affected_individuals = cur.rowcount

                # 2) Individual rid 重写（class slug 切换）+ JSONB props 字段重映射
                src_ind_prefix = f"ont.{tenant_id}.ind.{src_slug}."
                tgt_ind_prefix = f"ont.{tenant_id}.ind.{tgt_slug}."
                cur.execute(
                    "UPDATE ont_individual SET rid = REPLACE(rid, %s, %s), "
                    "primary_key = REPLACE(primary_key, %s, %s), "
                    "updated_at = now() "
                    "WHERE class_rid = %s AND tenant_id = %s",
                    (
                        src_ind_prefix, tgt_ind_prefix,
                        src_ind_prefix, tgt_ind_prefix,
                        target_rid, tenant_id,
                    ),
                )

                # 3) LinkInstance.src / dst 重写（Individual rid 同步替换）
                cur.execute(
                    "UPDATE ont_link_instance SET src = REPLACE(src, %s, %s) "
                    "WHERE src LIKE %s",
                    (src_ind_prefix, tgt_ind_prefix, f"{src_ind_prefix}%"),
                )
                src_updates = cur.rowcount
                cur.execute(
                    "UPDATE ont_link_instance SET dst = REPLACE(dst, %s, %s) "
                    "WHERE dst LIKE %s",
                    (src_ind_prefix, tgt_ind_prefix, f"{src_ind_prefix}%"),
                )
                dst_updates = cur.rowcount
                affected_links = src_updates + dst_updates

                # 4) Individual.props JSONB 键重映射（Property rid 切换）
                # 用 jsonb_set 一条一条改成本高，改成：读出 → 改键 → 写回。
                # 简化：遍历 property_remap，每条做一次 jsonb key rename。
                for src_p_rid, tgt_p_rid in property_remap.items():
                    if src_p_rid == tgt_p_rid:
                        continue
                    # 仅当 key 存在才更新（jsonb - 操作符会保留所有键，这里用 jsonb 表达式）
                    cur.execute(
                        "UPDATE ont_individual SET props = props - %s "
                        "|| jsonb_build_object(%s, props -> %s), "
                        "updated_at = now() "
                        "WHERE tenant_id = %s AND props ? %s",
                        (src_p_rid, tgt_p_rid, src_p_rid, tenant_id, src_p_rid),
                    )

                # 5) 软删 source ObjectType（archived = TRUE）
                #    archived 行从 UNIQUE INDEX 排除 → 同 slug 重新可用
                cur.execute(
                    "UPDATE ont_object_type SET archived = TRUE, updated_at = now() "
                    "WHERE rid = %s",
                    (source_rid,),
                )
                source_archived = cur.rowcount > 0

            conn.commit()
            return {
                "source_rid": source_rid,
                "target_rid": target_rid,
                "mapping": property_remap,
                "affected_individuals": affected_individuals,
                "affected_links": affected_links,
                "source_archived": source_archived,
            }
        finally:
            conn.close()

    def propose_merge(
        self,
        source_rid: str,
        target_rid: str,
        similarity: float,
        impact_summary: str,
        mapping: dict[str, str] | None = None,
    ) -> Any:
        """MP-DEDUP-01：AI 提议合并（同 source/target），走 proposal 状态机。

        user confirm → execute_proposal 自动调 merge_object_types。
        """
        parameters = {
            "source_rid": source_rid,
            "target_rid": target_rid,
            "similarity": similarity,
            "mapping": dict(mapping or {}),
        }
        expected_diff = {
            "+merge": {"source": source_rid, "target": target_rid},
            "archived": [source_rid],
        }
        # subject 用 target rid（merge 写入端），便于 API 层定位 ObjectType
        return self.propose_action(
            ClassRef(target_rid),
            parameters, None,
            impact_summary, expected_diff,
            kind="merge_suggestion",
        )

    def upsert_link_type(self, lt: LinkType) -> LinkType:
        self._ensure_schema()
        row = _lt_to_row(lt)
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    """
                    INSERT INTO ont_link_type
                        (rid, tenant_id, src_rid, dst_rid, cardinality, directionality, link_properties, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, now())
                    ON CONFLICT (rid) DO UPDATE SET
                        src_rid = EXCLUDED.src_rid,
                        dst_rid = EXCLUDED.dst_rid,
                        cardinality = EXCLUDED.cardinality,
                        directionality = EXCLUDED.directionality,
                        link_properties = EXCLUDED.link_properties,
                        updated_at = now()
                    """,
                    (
                        row["rid"],
                        row["tenant_id"],
                        row["src_rid"],
                        row["dst_rid"],
                        row["cardinality"],
                        row["directionality"],
                        json.dumps(row["link_properties"]),
                    ),
                )
            conn.commit()
            return lt
        finally:
            conn.close()

    def upsert_action_type(self, at: ActionType) -> ActionType:
        self._ensure_schema()
        tenant = at.rid.rid.split(".")[1] if "." in at.rid.rid else ""
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    """
                    INSERT INTO ont_action_type
                        (rid, tenant_id, parameters, submission_criteria, side_effects, function_ref, target_object_types, title, description, updated_at)
                    VALUES (%s, %s, %s::jsonb, %s::jsonb, %s::jsonb, %s, %s, %s, %s, now())
                    ON CONFLICT (rid) DO UPDATE SET
                        parameters = EXCLUDED.parameters,
                        submission_criteria = EXCLUDED.submission_criteria,
                        side_effects = EXCLUDED.side_effects,
                        function_ref = EXCLUDED.function_ref,
                        target_object_types = EXCLUDED.target_object_types,
                        title = EXCLUDED.title,
                        description = EXCLUDED.description,
                        updated_at = now()
                    """,
                    (
                        at.rid.rid,
                        tenant,
                        json.dumps([
                            {
                                "rid": p.rid.rid, "type_id": p.type_id,
                                "nullable": p.nullable, "primary_key": p.primary_key,
                                "title": p.title, "format": p.format.value,
                            }
                            for p in at.parameters
                        ]),
                        json.dumps(list(at.submission_criteria)),
                        json.dumps(list(at.side_effects)),
                        at.function_ref.rid,
                        [c.rid for c in at.on],
                        at.title,
                        at.description,
                    ),
                )
            conn.commit()
            return at
        finally:
            conn.close()

    def upsert_interface(self, i: Interface) -> Interface:
        self._ensure_schema()
        row = _if_to_row(i)
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    """
                    INSERT INTO ont_interface
                        (rid, tenant_id, properties, required_links, polymorphic_action_constraints, updated_at)
                    VALUES (%s, %s, %s::jsonb, %s, %s, now())
                    ON CONFLICT (rid) DO UPDATE SET
                        properties = EXCLUDED.properties,
                        required_links = EXCLUDED.required_links,
                        polymorphic_action_constraints = EXCLUDED.polymorphic_action_constraints,
                        updated_at = now()
                    """,
                    (
                        row["rid"],
                        row["tenant_id"],
                        json.dumps(row["properties"]),
                        row["required_links"],
                        row["polymorphic_action_constraints"],
                    ),
                )
            conn.commit()
            return i
        finally:
            conn.close()

    def upsert_property(self, p: Property) -> Property:
        self._ensure_schema()
        row = _prop_to_row(p)
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    """
                    INSERT INTO ont_property
                        (rid, tenant_id, type_id, nullable, primary_key, title, format, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, now())
                    ON CONFLICT (rid) DO UPDATE SET
                        type_id = EXCLUDED.type_id,
                        nullable = EXCLUDED.nullable,
                        primary_key = EXCLUDED.primary_key,
                        title = EXCLUDED.title,
                        format = EXCLUDED.format,
                        updated_at = now()
                    """,
                    (
                        row["rid"],
                        row["tenant_id"],
                        row["type_id"],
                        row["nullable"],
                        row["primary_key"],
                        row["title"],
                        row["format"],
                    ),
                )
            conn.commit()
            return p
        finally:
            conn.close()

    def list_link_types(self) -> list[LinkType]:
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute("SELECT * FROM ont_link_type ORDER BY rid")
                rows = cur.fetchall()
            return [_row_to_lt(r) for r in rows]
        finally:
            conn.close()

    def list_action_types(self) -> list[ActionType]:
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute("SELECT * FROM ont_action_type ORDER BY rid")
                rows = cur.fetchall()
            return [_row_to_at(r) for r in rows]
        finally:
            conn.close()

    def list_interfaces(self) -> list[Interface]:
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute("SELECT * FROM ont_interface ORDER BY rid")
                rows = cur.fetchall()
            return [_row_to_if(r) for r in rows]
        finally:
            conn.close()

    def get_link_type(self, rid: ClassRef) -> LinkType:
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute("SELECT * FROM ont_link_type WHERE rid = %s", (rid.rid,))
                row = cur.fetchone()
            if row is None:
                raise KeyError(f"LinkType not found: {rid.rid}")
            return _row_to_lt(row)
        finally:
            conn.close()

    def get_action_type(self, rid: ClassRef) -> ActionType:
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute("SELECT * FROM ont_action_type WHERE rid = %s", (rid.rid,))
                row = cur.fetchone()
            if row is None:
                raise KeyError(f"ActionType not found: {rid.rid}")
            return _row_to_at(row)
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
            self._index_individual_embeddings(conn, ind)
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
        self._ensure_schema()
        row = _li_to_row(li)
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    """
                    INSERT INTO ont_link_instance
                        (rid, tenant_id, link_type_rid, src, dst, props, marking, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s, %s, now())
                    ON CONFLICT (rid) DO UPDATE SET
                        link_type_rid = EXCLUDED.link_type_rid,
                        src = EXCLUDED.src,
                        dst = EXCLUDED.dst,
                        props = EXCLUDED.props,
                        marking = EXCLUDED.marking,
                        updated_at = now()
                    """,
                    (
                        row["rid"],
                        row["tenant_id"],
                        row["link_type_rid"],
                        row["src"],
                        row["dst"],
                        json.dumps(row["props"], default=str),
                        row["marking"],
                        row["created_at"],
                    ),
                )
            conn.commit()
            return li
        finally:
            conn.close()

    def list_link_instances(self) -> list[LinkInstance]:
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute("SELECT * FROM ont_link_instance ORDER BY rid")
                rows = cur.fetchall()
            return [_row_to_li(r) for r in rows]
        finally:
            conn.close()

    # ───── reasoning ─────

    def upsert_axiom(self, ax: Axiom) -> Axiom:
        self._ensure_schema()
        row = _ax_to_row(ax)
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    """
                    INSERT INTO ont_axiom
                        (rid, tenant_id, kind, operands, rule_ref, metadata, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s::jsonb, now())
                    ON CONFLICT (rid) DO UPDATE SET
                        kind = EXCLUDED.kind,
                        operands = EXCLUDED.operands,
                        rule_ref = EXCLUDED.rule_ref,
                        metadata = EXCLUDED.metadata,
                        updated_at = now()
                    """,
                    (
                        row["rid"],
                        row["tenant_id"],
                        row["kind"],
                        row["operands"],
                        row["rule_ref"],
                        json.dumps(row["metadata"]),
                    ),
                )
            conn.commit()
            return ax
        finally:
            conn.close()

    def list_axioms(self) -> list[Axiom]:
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute("SELECT * FROM ont_axiom ORDER BY rid")
                rows = cur.fetchall()
            return [_row_to_ax(r) for r in rows]
        finally:
            conn.close()

    def upsert_function(self, f: Function) -> Function:
        self._ensure_schema()
        row = _fn_to_row(f)
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    """
                    INSERT INTO ont_function
                        (rid, tenant_id, language, version, source_ref, signatures, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s::jsonb, now())
                    ON CONFLICT (rid) DO UPDATE SET
                        language = EXCLUDED.language,
                        version = EXCLUDED.version,
                        source_ref = EXCLUDED.source_ref,
                        signatures = EXCLUDED.signatures,
                        updated_at = now()
                    """,
                    (
                        row["rid"],
                        row["tenant_id"],
                        row["language"],
                        row["version"],
                        row["source_ref"],
                        json.dumps(row["signatures"]),
                    ),
                )
            conn.commit()
            # GOVERN-05: 同步注册到 FunctionResolver + ActionService
            if f.source_ref.startswith("inline://"):
                self._function_resolver.register(
                    f.language,
                    f.source_ref,
                    _PG_INLINE_FUNCTIONS.get(f.source_ref, _PG_DEFAULT_INLINE_FN),
                )
                if self._function_executor is not None:
                    self._action_service.register_function_ref(
                        f.rid.rid,
                        self._function_executor,
                        self._function_resolver,
                    )
            return f
        finally:
            conn.close()

    def list_functions(self) -> list[Function]:
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute("SELECT * FROM ont_function ORDER BY rid")
                rows = cur.fetchall()
            return [_row_to_fn(r) for r in rows]
        finally:
            conn.close()

    # ───── query / apply ─────

    def evaluate_object_set(self, os_: ObjectSet) -> list[Individual]:
        self._ensure_schema()
        compiler = FilterCompiler()
        compiled = compiler.compile(os_.filter_expr)

        # RUNTIME-PG-03: DSL 字段名归一化 —— 简写 slug → 完整 Property rid
        # （JSONB 键为完整 rid；InMemory 路径的 individual_to_row 同样支持
        # slug）。取 class 的 ObjectType.properties 建 slug→rid / rid→type
        # 映射；ObjectType 缺失时跳过归一化，保留裸字段行为。
        slug_to_rid: dict[str, str] = {}
        rid_type: dict[str, str] = {}
        try:
            ot = self.get_object_type(os_.class_rid)
        except KeyError:
            ot = None
        if ot is not None:
            for p in ot.properties:
                slug_to_rid[_prop_slug(p.rid.rid)] = p.rid.rid
                rid_type[p.rid.rid] = p.type_id
        if slug_to_rid:
            compiled = _rewrite_filter_fields(compiled, slug_to_rid)

        sqlc = _RepoSQLCompiler()
        where_sql, params = sqlc.compile_where(compiled)

        # sort —— 键同样做 slug→rid 归一化，cast 按 Property.type_id 分支
        # （数值类型 ::numeric，其余 ::text；旧版一律 ::numeric 会让任何
        # 字符串字段排序直接 DataError）。键经 _SAFE_JSON_KEY 白名单校验
        # 后嵌入（无引号/分号字符面），防注入。
        order_by = ""
        if os_.sort:
            raw = os_.sort[0]
            reverse = raw.startswith("-")
            field_name = raw[1:] if raw.startswith("-") else raw
            key = slug_to_rid.get(field_name, field_name)
            if not _SAFE_JSON_KEY.match(key):
                raise ValueError(f"unsafe sort field {field_name!r}")
            cast = (
                "::numeric"
                if rid_type.get(key) in _NUMERIC_TYPE_IDS
                else "::text"
            )
            direction = "DESC" if reverse else "ASC"
            order_by = f" ORDER BY (props ->> '{key}'){cast} {direction}"

        # where_sql comes from SQLCompiler (not user input); order_by is a
        # controlled sort spec. Safe to compose via f-string.
        sql = (
            f"SELECT * FROM ont_individual "  # noqa: S608
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

    # ───── MP-SAL-01: 结构化 IR 查询（ADR-0043 §2.1）─────

    def execute_object_query(self, q: ObjectSetQuery) -> QueryResult:
        """ObjectSetQuery IR → PG 执行，返回结果信封（与 InMemoryQueryExecutor 同语义）。"""
        self._ensure_schema()
        if q.aggregation is not None and q.sort:
            raise ValueError("sort with aggregation is not supported")
        for m in (q.aggregation.metrics if q.aggregation else ()):
            if m.fn not in ("sum", "count", "avg", "min", "max"):
                raise ValueError(f"unknown metric fn {m.fn!r}")
            if m.fn != "count" and m.field is None:
                raise ValueError(f"metric fn={m.fn!r} requires a field")

        # slug → 完整 rid 归一化（与 evaluate_object_set 同一策略）
        try:
            ot = self.get_object_type(ClassRef(q.source))
        except KeyError:
            ot = None
        slug_to_rid: dict[str, str] = {}
        rid_type: dict[str, str] = {}
        if ot is not None:
            for p in ot.properties:
                slug_to_rid[_prop_slug(p.rid.rid)] = p.rid.rid
                rid_type[p.rid.rid] = p.type_id

        params: list[Any] = [q.source]
        inner = "SELECT rid FROM ont_individual WHERE class_rid = %s"
        where_sql, where_params = _ir_where(q.filters, slug_to_rid)
        if where_sql:
            inner += f" AND ({where_sql})"
            params.extend(where_params)

        final_class = q.source
        for step in q.traversal:
            try:
                lt = self.get_link_type(ClassRef(step.link_type))
            except KeyError:
                lt = None
            if step.direction == "out":
                inner = (
                    "SELECT DISTINCT li.dst AS rid FROM ont_link_instance li "
                    f"WHERE li.link_type_rid = %s AND li.src IN ({inner})"
                )
                final_class = lt.dst.rid if lt is not None else final_class
            else:
                inner = (
                    "SELECT DISTINCT li.src AS rid FROM ont_link_instance li "
                    f"WHERE li.link_type_rid = %s AND li.dst IN ({inner})"
                )
                final_class = lt.src.rid if lt is not None else final_class
            # 新占位符（link_type_rid）在 SQL 文本中先于内层参数出现
            params = [step.link_type, *params]

        if q.aggregation is not None:
            return self._object_query_aggregate(q, inner, params, slug_to_rid, final_class)

        sql = f"SELECT * FROM ont_individual WHERE rid IN ({inner})"  # noqa: S608
        order_parts: list[str] = []
        for key in q.sort:
            field_name = slug_to_rid.get(key.field, key.field)
            if not _SAFE_JSON_KEY.match(field_name):
                raise ValueError(f"unsafe sort field {key.field!r}")
            cast = "::numeric" if rid_type.get(field_name) in _NUMERIC_TYPE_IDS else "::text"
            direction = "DESC" if key.desc else "ASC"
            order_parts.append(f"(props ->> '{field_name}'){cast} {direction}")
        if order_parts:
            sql += " ORDER BY " + ", ".join(order_parts)
        sql += " LIMIT %s OFFSET %s"
        params.extend([q.paging_limit, q.paging_offset])

        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()
            individuals = [_row_to_individual(r) for r in rows]
        finally:
            conn.close()
        return QueryResult(
            kind="objects",
            rows=tuple(individual_to_row(i) for i in individuals),
            result_schema=self._ir_objects_schema(final_class),
        )

    def _object_query_aggregate(
        self,
        q: ObjectSetQuery,
        inner: str,
        params: list[Any],
        slug_to_rid: dict[str, str],
        final_class: str,
    ) -> QueryResult:
        agg = q.aggregation
        assert agg is not None
        select_parts: list[str] = []
        group_parts: list[str] = []
        for f in agg.group_by:
            key = slug_to_rid.get(f, f)
            if not _SAFE_JSON_KEY.match(key):
                raise ValueError(f"unsafe group_by field {f!r}")
            select_parts.append(f"(props ->> '{key}') AS \"{f}\"")
            group_parts.append(f"(props ->> '{key}')")
        for m in agg.metrics:
            name = m.output_name()
            if m.fn == "count" and m.field is None:
                select_parts.append(f"COUNT(*) AS \"{name}\"")
                continue
            assert m.field is not None
            key = slug_to_rid.get(m.field, m.field)
            if not _SAFE_JSON_KEY.match(key):
                raise ValueError(f"unsafe metric field {m.field!r}")
            fn_sql = {"sum": "SUM", "count": "COUNT", "avg": "AVG", "min": "MIN", "max": "MAX"}[m.fn]
            select_parts.append(f"{fn_sql}((props ->> '{key}')::numeric) AS \"{name}\"")

        sql = (
            f"SELECT {', '.join(select_parts)} FROM ont_individual "  # noqa: S608
            f"WHERE rid IN ({inner})"
        )
        if group_parts:
            sql += " GROUP BY " + ", ".join(group_parts)

        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()
        finally:
            conn.close()
        normalized = tuple(
            {k: (float(v) if isinstance(v, Decimal) else v) for k, v in r.items()} for r in rows
        )
        schema: dict[str, Any] = {f: {"role": "dimension"} for f in agg.group_by}
        for m in agg.metrics:
            schema[m.output_name()] = {"fn": m.fn, "field": m.field}
        _ = final_class  # 聚合结果的 result_schema 与类无关（维度+度量）
        return QueryResult(kind="aggregates", rows=normalized, result_schema=schema)

    def _ir_objects_schema(self, class_rid: str) -> dict[str, Any] | None:
        try:
            ot = self.get_object_type(ClassRef(class_rid))
        except KeyError:
            return None
        out: dict[str, Any] = {}
        for p in ot.properties:
            out[_prop_slug(p.rid.rid)] = {"type": p.type_id, "rid": p.rid.rid}
        return out

    # ───── MP-SAL-02: 对象语义检索（OAG）─────

    def set_embedder(self, embedder: Any) -> None:
        """注入 embedder（协议：embed(text)->list[float]）；None = 跳过索引。"""
        self._embedder = embedder

    def _embed_chunks(
        self, ind: Individual,
    ) -> list[tuple[str, str, str, str, str, list[float]]]:
        """Individual → [(chunk_id, individual_rid, class_rid, property_rid, value_text, vec)]。"""
        if self._embedder is None:
            return []
        out: list[tuple[str, str, str, str, str, list[float]]] = []
        for prop_ref, value in ind.props:
            slug = _prop_slug(prop_ref.rid)
            text = f"{slug} {value}"
            out.append((
                f"{ind.rid}#{prop_ref.rid}",
                ind.rid,
                ind.class_rid.rid,
                prop_ref.rid,
                str(value),
                self._embedder.embed(text),
            ))
        return out

    def _index_individual_embeddings(self, conn: Any, ind: Individual) -> None:
        """index-on-write（best-effort：embedder 缺席或失败不阻断主写入）。"""
        try:
            chunks = self._embed_chunks(ind)
            if not chunks:
                return
            with self._cursor(conn) as cur:
                for chunk_id, individual_rid, class_rid, property_rid, value_text, vec in chunks:
                    cur.execute(
                        """
                        INSERT INTO ont_object_embedding
                            (chunk_id, individual_rid, class_rid, property_rid,
                             value_text, embedding, tenant_id, created_at)
                        VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s, now())
                        ON CONFLICT (chunk_id) DO UPDATE SET
                            embedding = EXCLUDED.embedding,
                            value_text = EXCLUDED.value_text,
                            created_at = now()
                        """,
                        (
                            chunk_id, individual_rid, class_rid, property_rid,
                            value_text, json.dumps(vec), ind.tenant_id,
                        ),
                    )
        except Exception:  # 索引失败不影响主路径
            import logging
            logging.getLogger(__name__).warning(
                "object_embedding_index_failed", extra={"rid": ind.rid},
            )

    def search_objects(
        self, text: str, class_rid: str | None = None, top_k: int = 5,
        tenant_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """语义检索 → 对象卡片（带 rid 可追溯）。

        tenant_id 显式传入优先（``_call_scoped`` 经 asyncio.to_thread 执行，
        tenant_scope 的 threading.local 在工作线程不可见 —— 显式参数是
        RLS 之外的第二道防线，13 硬规则 #3）。
        """
        if self._embedder is None:
            return []
        from .object_search import build_card, cosine

        qvec = self._embedder.embed(text)
        tenant = tenant_id or self._current_tenant()
        conds: list[str] = []
        params: list[Any] = []
        if tenant:
            conds.append("tenant_id = %s")
            params.append(tenant)
        if class_rid:
            conds.append("class_rid = %s")
            params.append(class_rid)
        sql = "SELECT * FROM ont_object_embedding"
        if conds:
            sql += " WHERE " + " AND ".join(conds)
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()
        finally:
            conn.close()

        per_individual: dict[str, list[dict[str, Any]]] = {}
        class_of: dict[str, str] = {}
        for r in rows:
            emb = r.get("embedding")
            if not emb:
                continue
            vec = emb if isinstance(emb, list) else json.loads(emb)
            score = cosine(qvec, vec)
            if score <= 0.0:
                continue
            class_of[r["individual_rid"]] = r["class_rid"]
            per_individual.setdefault(r["individual_rid"], []).append({
                "property_rid": r["property_rid"],
                "value_text": r["value_text"],
                "score": score,
            })
        cards: list[dict[str, Any]] = []
        for individual_rid, matched in per_individual.items():
            matched.sort(key=lambda m: m["score"], reverse=True)
            cards.append(
                build_card(individual_rid, class_of[individual_rid], matched[:3])
            )
        cards.sort(key=lambda c: c["score"], reverse=True)
        return cards[:top_k]

    def reindex_object_embeddings(self, tenant_id: str | None = None) -> int:
        """存量补齐：租户内全量 Individual 重嵌入（返回索引数；tenant 显式传参优先）。"""
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            tenant = tenant_id or self._current_tenant()
            with self._cursor(conn) as cur:
                if tenant:
                    cur.execute(
                        "SELECT * FROM ont_individual WHERE tenant_id = %s", (tenant,),
                    )
                else:
                    cur.execute("SELECT * FROM ont_individual")
                rows = cur.fetchall()
            count = 0
            for r in rows:
                self._index_individual_embeddings(conn, _row_to_individual(r))
                count += 1
            conn.commit()
            return count
        finally:
            conn.close()

    # ───── MP-SAL-04: proposal 状态机（ADR-0044 §2.1-2.3）─────

    def set_outbox_writer(self, writer: Any) -> None:
        """注入 outbox 写回：writer(event_type, tenant_id, payload) -> event_id | None。"""
        self._outbox_writer = writer

    def propose_action(
        self,
        action_rid: ClassRef,
        parameters: dict[str, Any],
        target_iid: str | None,
        impact_summary: str,
        expected_diff: dict[str, Any] | None = None,
        kind: str = "action",
    ) -> Any:
        """AI/用户提议 → pending proposal（持久化 + 引擎镜像）。kind 见 MP-SAL-04b。"""
        self._ensure_schema()
        if kind == "action":
            at = self.get_action_type(action_rid)
            subject = at.rid.rid
        else:
            subject = str(action_rid.rid)  # create_instance→class rid / model_type→新类型 rid
            try:
                if kind == "create_instance":
                    self.get_object_type(action_rid)
            except KeyError as e:
                raise KeyError(str(e)) from e
        prop = self._action_service.propose(
            action_rid=subject,
            parameters=parameters,
            target_iid=target_iid,
            impact_summary=impact_summary,
            expected_diff=expected_diff,
            kind=kind,
        )
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    """
                    INSERT INTO ont_proposal
                        (proposal_id, tenant_id, action_rid, target_iid, parameters,
                         impact_summary, expected_diff, status, kind, created_at)
                    VALUES (%s, %s, %s, %s, %s::jsonb, %s, %s::jsonb, %s, %s, %s)
                    """,
                    (
                        prop.proposal_id,
                        subject.split(".")[1] if "." in subject else "",
                        subject,
                        target_iid,
                        json.dumps(parameters, default=str),
                        impact_summary,
                        json.dumps(expected_diff or {}, default=str),
                        prop.status.value,
                        kind,
                        prop.created_at,
                    ),
                )
            conn.commit()
            return prop
        finally:
            conn.close()

    def propose_create_instance(
        self, class_rid: str, props: dict[str, Any],
        impact_summary: str, expected_diff: dict[str, Any] | None = None,
    ) -> Any:
        """MP-SAL-04b：文本抽取字段 → 新建实例提议（subject=class rid）。"""
        return self.propose_action(
            ClassRef(class_rid), {"props": dict(props)}, None,
            impact_summary, expected_diff, kind="create_instance",
        )

    def propose_model_type(
        self, type_def: dict[str, Any], impact_summary: str,
    ) -> Any:
        """MP-SAL-04b：文本→新类型定义提议（subject=新类型 rid）。"""
        if not isinstance(type_def, dict) or "rid" not in type_def:
            raise ValueError("type_def must carry 'rid'")
        return self.propose_action(
            ClassRef(str(type_def["rid"])), {"type_def": type_def}, None,
            impact_summary, {"+type": type_def["rid"]}, kind="model_type",
        )

    def get_proposal(self, proposal_id: str) -> Any:
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    "SELECT * FROM ont_proposal WHERE proposal_id = %s", (proposal_id,),
                )
                row = cur.fetchone()
        finally:
            conn.close()
        if row is None:
            raise KeyError(f"proposal not found: {proposal_id}")
        return self._hydrate_proposal(row)

    def list_proposals(self) -> list[Any]:
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute("SELECT * FROM ont_proposal ORDER BY created_at DESC LIMIT 200")
                rows = cur.fetchall()
        finally:
            conn.close()
        return [self._hydrate_proposal(r) for r in rows]

    def _hydrate_proposal(self, row: dict[str, Any]) -> Any:
        """PG 行 → ActionProposal（并回填引擎镜像，apply 校验用）。"""
        from mate_kernel.action.engine import ActionProposal, ProposalStatus

        params = row.get("parameters") or {}
        if not isinstance(params, dict):
            params = json.loads(params)
        diff = row.get("expected_diff") or {}
        if not isinstance(diff, dict):
            diff = json.loads(diff)
        prop = ActionProposal(
            proposal_id=row["proposal_id"],
            action_rid=row["action_rid"],
            target_iid=row.get("target_iid"),
            parameters=params,
            impact_summary=row.get("impact_summary", ""),
            created_at=row["created_at"],
            status=ProposalStatus(row.get("status", "pending")),
            kind=row.get("kind", "action"),
            expected_diff=diff,
            confirmed_by=row.get("confirmed_by"),
            confirmed_at=row.get("confirmed_at"),
        )
        self._action_service._proposals[prop.proposal_id] = prop  # 镜像回填
        return prop

    def _persist_proposal_transition(self, prop: Any) -> None:
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    """
                    UPDATE ont_proposal
                    SET status = %s, confirmed_by = %s, confirmed_at = %s,
                        applied_at = CASE WHEN %s = 'applied' THEN now() ELSE applied_at END
                    WHERE proposal_id = %s
                    """,
                    (
                        prop.status.value, prop.confirmed_by, prop.confirmed_at,
                        prop.status.value, prop.proposal_id,
                    ),
                )
            conn.commit()
        finally:
            conn.close()

    def confirm_proposal(self, proposal_id: str, confirmed_by: str = "") -> Any:
        self.get_proposal(proposal_id)  # 行存在性 + 镜像回填
        prop = self._action_service.confirm_proposal(proposal_id, confirmed_by=confirmed_by)
        self._persist_proposal_transition(prop)
        return prop

    def reject_proposal(self, proposal_id: str, confirmed_by: str = "") -> Any:
        self.get_proposal(proposal_id)
        prop = self._action_service.reject_proposal(proposal_id, confirmed_by=confirmed_by)
        self._persist_proposal_transition(prop)
        return prop

    def execute_proposal(self, proposal_id: str) -> Any:
        """MP-SAL-04b：confirmed proposal 落库执行（create_instance / model_type）。"""
        from datetime import UTC as _UTC
        from datetime import datetime as _dt

        from mate_kernel.action.engine import (
            ProposalNotConfirmed,
            ProposalStatus,
        )

        p = self.get_proposal(proposal_id)  # 行存在 + 镜像回填
        if p.status is not ProposalStatus.CONFIRMED:
            raise ProposalNotConfirmed(
                f"proposal {proposal_id} is {p.status.value}; execute requires a confirmed proposal"
            )
        if p.kind == "action":
            raise ValueError(
                "action-kind proposals execute via /action-types/{rid}/apply, not /execute"
            )
        if p.kind == "create_instance":
            ot = self.get_object_type(ClassRef(p.action_rid))
            props_in: dict[str, Any] = dict(p.parameters.get("props") or {})
            slug_to_ref = {q.rid.rid.split(".")[3]: q.rid for q in ot.properties}
            pk_slug = ot.primary_key[0].rid.split(".")[3]
            pk_value = props_in.get(pk_slug)
            if pk_value is None:
                raise ValueError(f"primary key '{pk_slug}' required to create {p.action_rid}")
            parts = ot.rid.rid.split(".")
            # rid 形如 ``ont.<tenant>.obj.<domain>.<slug>.v1``，parts[4] 是 slug，
            # parts[3] 是 domain；这里用 slug 构造 Individual rid
            # ``ont.<tenant>.ind.<slug>.<pk>``（保持 5 段 individual 格式与 seed.py 一致）。
            tenant, cls_slug = parts[1], parts[4] if len(parts) >= 6 else parts[3]
            resolved = []
            for key, value in props_in.items():
                ref = slug_to_ref.get(key) or (ClassRef(key) if key.startswith("ont.") else None)
                if ref is None:
                    raise KeyError(f"unknown property {key!r} for {p.action_rid}")
                resolved.append((ref, value))
            ind = Individual(
                rid=f"ont.{tenant}.ind.{cls_slug}.{pk_value}",
                class_rid=ot.rid,
                props=tuple(resolved),
                primary_key=str(pk_value),
                created_at=_dt.now(_UTC),
                updated_at=_dt.now(_UTC),
                tenant_id=tenant,
            )
            created = self.create_individual(ind)
            self._persist_proposal_transition(
                self._action_service.mark_applied(proposal_id),
            )
            return created
        if p.kind == "model_type":
            type_def = p.parameters["type_def"]
            ot = ObjectType(
                rid=ClassRef(str(type_def["rid"])),
                primary_key=tuple(ClassRef(pk) for pk in type_def["primary_key"]),
                properties=tuple(
                    Property(
                        rid=ClassRef(pd["rid"]), type_id=pd.get("type_id", "string"),
                        nullable=pd.get("nullable", True),
                        primary_key=pd.get("primary_key", False),
                        title=pd.get("title", ""),
                        format=PropertyFormat(pd.get("format", "string")),
                    )
                    for pd in type_def.get("properties", ())
                ),
                interfaces=tuple(ClassRef(i) for i in type_def.get("interfaces", ())),
                display_name=type_def.get("display_name", ""),
                marking=tuple(type_def.get("marking", ())),
            )
            saved = self.upsert_object_type(ot)
            self._persist_proposal_transition(
                self._action_service.mark_applied(proposal_id),
            )
            return saved
        if p.kind == "merge_suggestion":
            # MP-DEDUP-01：user confirm → 自动触发 merge_object_types
            source_rid = p.parameters.get("source_rid")
            target_rid = p.parameters.get("target_rid")
            if not source_rid or not target_rid:
                raise ValueError(
                    "merge_suggestion proposal requires source_rid + target_rid"
                )
            mapping = p.parameters.get("mapping") or {}
            result = self.merge_object_types(source_rid, target_rid, mapping)
            self._persist_proposal_transition(
                self._action_service.mark_applied(proposal_id),
            )
            return result
        raise ValueError(f"unknown proposal kind: {p.kind!r}")

    # ───── MP-SAL-05: 流程编排定义持久化（flow definition）─────

    def get_flow_definition(self, action_rid: ClassRef) -> dict[str, Any]:
        """读取 ActionType 的流程编排定义（未保存 → KeyError）。"""
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    "SELECT * FROM ont_flow_definition WHERE action_rid = %s",
                    (action_rid.rid,),
                )
                row = cur.fetchone()
        finally:
            conn.close()
        if row is None:
            raise KeyError(f"flow definition not found: {action_rid.rid}")
        return {
            "action_rid": row["action_rid"],
            "flow_json": row["flow_json"] if isinstance(row["flow_json"], dict) else json.loads(row["flow_json"]),
            "config": row["config"] if isinstance(row["config"], dict) else json.loads(row["config"]),
            "updated_at": row["updated_at"],
        }

    def put_flow_definition(
        self, action_rid: ClassRef, flow_json: dict[str, Any],
        config: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """持久化 ActionType 的流程编排定义（upsert）。"""
        self._ensure_schema()
        tenant_id = action_rid.rid.split(".")[1] if "." in action_rid.rid else ""
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    """
                    INSERT INTO ont_flow_definition
                        (action_rid, tenant_id, flow_json, config, updated_at)
                    VALUES (%s, %s, %s::jsonb, %s::jsonb, now())
                    ON CONFLICT (action_rid) DO UPDATE SET
                        flow_json = EXCLUDED.flow_json,
                        config = EXCLUDED.config,
                        updated_at = now()
                    """,
                    (
                        action_rid.rid, tenant_id,
                        json.dumps(flow_json, default=str),
                        json.dumps(config or {}, default=str),
                    ),
                )
            conn.commit()
            return self.get_flow_definition(action_rid)
        finally:
            conn.close()

    def apply_action(
        self,
        action_rid: ClassRef,
        target_iid: str,
        parameters: dict[str, Any],
        provenance: dict[str, Any],
    ) -> tuple[datetime, list[str]]:
        """ActionType.apply — InMemory 与 PG 走同一 ActionService。

        流程：submission_criteria 求值 → Function 落库 → side_effects → 审计。
        """
        from dataclasses import replace

        from mate_kernel.action.engine import SubmissionContext

        self._ensure_schema()
        at = self.get_action_type(action_rid)
        ind = self.get_individual(target_iid)
        target_props = {k.rid: v for k, v in ind.props}

        # MP-SAL-04（ADR-0044 §2.1/2.3）：proposal_id 透传引擎校验（未确认永不落库）；
        # outbox writer 注入时构造 emitter，事件 id 回填 ApplyOutcome.side_effect_events。
        proposal_id = provenance.get("proposal_id") or None
        if proposal_id is not None:
            with suppress(KeyError):
                self.get_proposal(proposal_id)  # 跨进程场景：行 → 引擎镜像回填
        emitter = None
        if self._outbox_writer is not None:
            def emitter(se: str, *, _w=self._outbox_writer, _t=ind.tenant_id, _a=at.rid.rid, _g=target_iid, _p=proposal_id) -> str | None:
                try:
                    return str(_w(se, _t, {
                        "action_rid": _a, "target_iid": _g, "proposal_id": _p,
                    }))
                except Exception:  # outbox 失败不阻断 apply（审计留 None）
                    return None

        outcome = self._action_service.apply(
            action_rid=at.rid.rid,
            submission_criteria=at.submission_criteria,
            function_ref=at.function_ref.rid,
            on_rid=at.on[0].rid if at.on else "",
            target_iid=target_iid,
            parameters=parameters,
            side_effects=at.side_effects,
            ctx=SubmissionContext(
                actor=str(provenance.get("actor", "?")),
                tenant_id=str(provenance.get("tenant_id", ind.tenant_id)),
            ),
            target_props=target_props,
            proposal_id=proposal_id,
            side_effect_emitter=emitter,
        )
        if proposal_id is not None:
            with suppress(KeyError):
                self._persist_proposal_transition(
                    self._action_service.get_proposal(proposal_id),
                )
        now = outcome.applied_at
        if parameters or outcome.function_result is not None:
            param_rids: dict[str, ClassRef] = {}
            for p in at.parameters:
                parts = p.rid.rid.split(".")
                slug = parts[-2] if parts[-1].startswith("v") else parts[-1]
                param_rids[slug] = p.rid
            merged = dict(ind.props)
            for key, value in parameters.items():
                resolved = ClassRef(key) if key.startswith("ont.") else param_rids.get(key)
                if resolved is None:
                    raise KeyError(f"unknown parameter {key!r} for action={action_rid}")
                merged[resolved] = value
            # GOVERN-05: function_result (dict) 字段填到 at.parameters 短名对应 prop
            # parameters 显式值优先；缺位用 fn_result
            if isinstance(outcome.function_result, dict):
                for slug, value in outcome.function_result.items():
                    rid_for_slug = param_rids.get(slug)
                    if rid_for_slug is not None and slug not in parameters:
                        merged[rid_for_slug] = value
            self.create_individual(replace(ind, props=tuple(merged.items()), updated_at=now))
        # 兼容既有调用方的 side_effects 字符串格式（PG 路径既往用 actor=…/target=…）
        legacy = [
            f"action={at.rid.rid}",
            f"target={ind.rid}",
            f"actor={provenance.get('actor', '?')}",
            f"params={json.dumps(parameters, default=str)}",
        ]
        return now, outcome.side_effects_emitted + legacy


async def run_in_thread(repo_method, /, *args, **kwargs):  # pyright: ignore[reportUnusedFunction]
    """async 包装：把 PG sync 调用推到 threadpool，避免阻塞 event loop。"""
    return await asyncio.to_thread(repo_method, *args, **kwargs)


__all__ = ["DDL", "PgOntologyRepository", "SlugConflictError"]
