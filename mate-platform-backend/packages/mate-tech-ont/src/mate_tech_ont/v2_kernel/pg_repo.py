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
import contextvars
import hashlib
import json
import re
import threading
from collections.abc import Iterator
from contextlib import contextmanager, suppress
from dataclasses import replace as _dc_replace
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import uuid4

from mate_kernel.objectset.compiler import CompiledFilter, FilterCompiler, individual_to_row
from mate_kernel.objectset.ir import Condition, ObjectSetQuery, QueryOp, QueryResult
from mate_kernel.objectset.sql_compiler import SQLCompiler
from mate_kernel.ontology.api import OntologyRepository
from mate_kernel.ontology.function_resolver import FunctionNotFoundError
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

# F2：proposal.parameters 中的保留键 —— 由 propose_action 注入的平台元数据，
# 非 action 声明的参数。execute 必须跳过它们，不得当作未知参数报错。
_RESERVED_PARAM_KEYS: frozenset[str] = frozenset({"provenance"})

# F8/F7：当前请求的租户（GOVERN-06 第 2 层防线）。
# **必须是 ContextVar 而非 threading.local** —— API 路径经 `asyncio.to_thread`
# 把 repo 调用推到工作线程，threading.local 不跨线程（实测工作线程里恒为 None），
# 于是 `_install_rls` 被跳过、`SET LOCAL app.tenant_id` 从不执行；
# 一旦 PG 层 RLS 生效，策略会因 tenant 未设而拒绝所有行 → 全站读空。
# contextvars 会被 `asyncio.to_thread` 复制进工作线程（Python 3.12 实测）。
_TENANT_CTX: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "ont_current_tenant", default=None
)


class ModelValidationUnavailable(RuntimeError):
    """MODEL-WRITE-ATOMICITY：模型一致性校验**所需读取失败** → fail-closed。

    语义：无法确认接口/引用一致性时**不得视为通过**（与「校验没跑=通过」区分）。
    API 层翻译为 503（依赖不可用，可重试），而不是 422（调用方错误）。
    """


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
    CREATE TABLE IF NOT EXISTS ont_axiom (
        rid          TEXT PRIMARY KEY,
        tenant_id    TEXT NOT NULL,
        kind         TEXT NOT NULL,
        operands     TEXT[] NOT NULL,
        rule_ref     TEXT NOT NULL DEFAULT 'builtin',
        enabled      BOOLEAN NOT NULL DEFAULT TRUE,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS ont_type_version (
        rid          TEXT PRIMARY KEY,
        parent_rid   TEXT,
        branched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        note         TEXT NOT NULL DEFAULT ''
    )
    """,
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
        parent_class TEXT NOT NULL DEFAULT '',
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_ont_ot_tenant ON ont_object_type (tenant_id)",
    "ALTER TABLE ont_object_type ADD COLUMN IF NOT EXISTS marking TEXT[] NOT NULL DEFAULT '{}'",
    # MP-DEDUP-01：slug 列（从 rid 第 4 段派生）+ archived 列（merge 软删标记）
    "ALTER TABLE ont_object_type ADD COLUMN IF NOT EXISTS slug TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE ont_object_type ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE",
    # EXP-01（D2）：浅层级声明列（限 1 层 parent；自动同步 subclass 公理）
    "ALTER TABLE ont_object_type ADD COLUMN IF NOT EXISTS parent_class TEXT NOT NULL DEFAULT ''",
    # EXP-04：治理/展示元数据列
    "ALTER TABLE ont_object_type ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE ont_object_type ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'",
    "ALTER TABLE ont_object_type ADD COLUMN IF NOT EXISTS type_group TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE ont_object_type ADD COLUMN IF NOT EXISTS render_hints JSONB NOT NULL DEFAULT '[]'::jsonb",
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
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        provenance   JSONB NULL
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_ont_ind_tenant_class ON ont_individual (tenant_id, class_rid)",
    "CREATE INDEX IF NOT EXISTS ix_ont_ind_props ON ont_individual USING GIN (props)",
    # MP-SAL-01：记录级溯源列 —— **必须排在 ont_individual 建表之后**。
    # 2026-09-15 修复：此前该 ALTER 排在建表之前，全新库（CI ga-014 的
    # metaplatform_ont_test）bootstrap 直接 UndefinedTable 炸掉整条 DDL 序列。
    "ALTER TABLE ont_individual ADD COLUMN IF NOT EXISTS provenance JSONB NULL",
    # DATA-SYNC-INTEGRITY：字段级来源归属（prop_rid → {prio, src}）—— 多源优先级
    # **跨批次**生效的前提：低优先级源写入时据此拒绝覆盖高优先级已写字段。
    "ALTER TABLE ont_individual ADD COLUMN IF NOT EXISTS props_src JSONB NULL",
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
    # ACT-05：声明式编辑模板（Palantir action rules 对位）
    "ALTER TABLE ont_action_type ADD COLUMN IF NOT EXISTS declarative_edits JSONB NOT NULL DEFAULT '[]'::jsonb",
    """
    CREATE TABLE IF NOT EXISTS ont_link_type (
        rid               TEXT PRIMARY KEY,
        tenant_id         TEXT NOT NULL,
        src_rid           TEXT NOT NULL,
        dst_rid           TEXT NOT NULL,
        cardinality       TEXT NOT NULL,
        directionality    TEXT NOT NULL,
        link_properties   JSONB NOT NULL DEFAULT '[]'::jsonb,
        src_display_name  TEXT NOT NULL DEFAULT '',
        dst_display_name  TEXT NOT NULL DEFAULT '',
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_ont_lt_tenant ON ont_link_type (tenant_id)",
    # EXP-03：两端命名补列（旧库）
    "ALTER TABLE ont_link_type ADD COLUMN IF NOT EXISTS src_display_name TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE ont_link_type ADD COLUMN IF NOT EXISTS dst_display_name TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE ont_link_type ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''",
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
    # EXP-02：属性库扩展列（描述/struct/数组/派生/共享）—— 旧库补列
    "ALTER TABLE ont_property ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE ont_property ADD COLUMN IF NOT EXISTS struct_fields JSONB NOT NULL DEFAULT '[]'::jsonb",
    "ALTER TABLE ont_property ADD COLUMN IF NOT EXISTS is_array BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE ont_property ADD COLUMN IF NOT EXISTS reducer TEXT",
    "ALTER TABLE ont_property ADD COLUMN IF NOT EXISTS derived JSONB",
    "ALTER TABLE ont_property ADD COLUMN IF NOT EXISTS shared BOOLEAN NOT NULL DEFAULT FALSE",
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
    # 旧库补列：早期 ont_axiom 无 updated_at（G21 闭包查询 ORDER BY 抛错被
    # evaluate_object_set 静默吞掉 → 层级查询退化为精确匹配，test_ont_g21 失败）
    "ALTER TABLE ont_axiom ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()",
    # GOVERN-04：kernel Axiom.metadata（kv 元数据）—— 早期 DDL 漏列，upsert_axiom
    # 一直写该列（无列即 500），此前测试库未启用未暴露
    "ALTER TABLE ont_axiom ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb",
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
    # SEC-12：行列级安全策略（读时强制；与租户 RLS 叠加）
    """
    CREATE TABLE IF NOT EXISTS ont_security_policy (
        rid          TEXT PRIMARY KEY,
        tenant_id    TEXT NOT NULL,
        kind         TEXT NOT NULL,
        class_rid    TEXT NOT NULL DEFAULT '',
        property_rid TEXT NOT NULL DEFAULT '',
        field        TEXT NOT NULL DEFAULT '',
        op           TEXT NOT NULL DEFAULT '',
        value        JSONB,
        markings     TEXT[] NOT NULL DEFAULT '{}',
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_ont_secpol_tenant ON ont_security_policy (tenant_id)",
    # DATA-14：背挂数据源声明（与类型 schema 分离存储 —— Palantir 同构）
    """
    CREATE TABLE IF NOT EXISTS ont_backing_datasource (
        rid           TEXT PRIMARY KEY,
        tenant_id     TEXT NOT NULL,
        class_rid     TEXT NOT NULL,
        name          TEXT NOT NULL,
        kind          TEXT NOT NULL DEFAULT 'pg_table',
        dsn_env       TEXT NOT NULL DEFAULT 'ONT_SOURCE_DSN',
        table_name    TEXT NOT NULL,
        pk_column     TEXT NOT NULL,
        field_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
        priority      INTEGER NOT NULL DEFAULT 100,
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (tenant_id, class_rid, name)
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_ont_bds_tenant ON ont_backing_datasource (tenant_id)",
    # writeback 双流合并：用户编辑覆盖层（管道同步不覆盖这些属性）
    """
    CREATE TABLE IF NOT EXISTS ont_edit_overlay (
        individual_rid TEXT NOT NULL,
        property_rid   TEXT NOT NULL,
        tenant_id      TEXT NOT NULL,
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (individual_rid, property_rid)
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_ont_eo_tenant ON ont_edit_overlay (tenant_id)",
    # CDC 增量腿：水位 + 时间戳列
    "ALTER TABLE ont_backing_datasource ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ",
    "ALTER TABLE ont_backing_datasource ADD COLUMN IF NOT EXISTS ts_column TEXT NOT NULL DEFAULT 'updated_at'",
    # DATA-SYNC-INTEGRITY：游标 = 已可靠处理的**源端**边界 (ts, pk)（不是目标端 now()）；
    # 失败可追踪：上一次错误 + 失败行数。
    "ALTER TABLE ont_backing_datasource ADD COLUMN IF NOT EXISTS last_synced_pk TEXT",
    "ALTER TABLE ont_backing_datasource ADD COLUMN IF NOT EXISTS last_error TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE ont_backing_datasource ADD COLUMN IF NOT EXISTS last_failed INTEGER NOT NULL DEFAULT 0",
    # G20：webhook 订阅 + 投递审计
    """
    CREATE TABLE IF NOT EXISTS ont_webhook_subscription (
        rid        TEXT PRIMARY KEY,
        tenant_id  TEXT NOT NULL,
        event_type TEXT NOT NULL DEFAULT '*',
        url        TEXT NOT NULL,
        secret     TEXT NOT NULL DEFAULT '',
        active     BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS ont_webhook_delivery (
        id               BIGSERIAL PRIMARY KEY,
        event_id         TEXT NOT NULL,
        subscription_rid TEXT NOT NULL,
        status           TEXT NOT NULL,
        attempts         INTEGER NOT NULL DEFAULT 0,
        last_error       TEXT NOT NULL DEFAULT '',
        tenant_id        TEXT NOT NULL DEFAULT '',
        delivered_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_ont_whd_pair ON ont_webhook_delivery (event_id, subscription_rid)",
    # G33：schema WIP 暂存（他人不可见；apply 走破坏性门禁）
    """
    CREATE TABLE IF NOT EXISTS ont_schema_wip (
        rid        TEXT PRIMARY KEY,
        tenant_id  TEXT NOT NULL,
        author     TEXT NOT NULL DEFAULT '',
        payload    JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_ont_wip_tenant ON ont_schema_wip (tenant_id)",
    # G23：Function 版本快照 + 别名
    """
    CREATE TABLE IF NOT EXISTS ont_function_version (
        function_rid TEXT NOT NULL,
        version      INTEGER NOT NULL,
        language     TEXT NOT NULL DEFAULT '',
        source_ref   TEXT NOT NULL DEFAULT '',
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (function_rid, version)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS ont_function_alias (
        alias        TEXT PRIMARY KEY,
        function_rid TEXT NOT NULL,
        tenant_id    TEXT NOT NULL DEFAULT ''
    )
    """,
    # GOV-16：使用量指标（Reads/Writes per type per day；P1-7：actor/source 维度）
    """
    CREATE TABLE IF NOT EXISTS ont_usage_metric (
        id         BIGSERIAL PRIMARY KEY,
        tenant_id  TEXT NOT NULL,
        class_rid  TEXT NOT NULL,
        op         TEXT NOT NULL,
        day        DATE NOT NULL DEFAULT CURRENT_DATE,
        count      BIGINT NOT NULL DEFAULT 0,
        actor      TEXT NOT NULL DEFAULT '',
        source     TEXT NOT NULL DEFAULT ''
    )
    """,
    # P1-7 幂等迁移：旧表补列 + 唯一键从 4 列扩到 6 列
    # （旧数据 actor/source 均为 ''，天然满足新唯一约束，无需回填）
    "ALTER TABLE ont_usage_metric ADD COLUMN IF NOT EXISTS actor TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE ont_usage_metric ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE ont_usage_metric DROP CONSTRAINT IF EXISTS "
    "ont_usage_metric_tenant_id_class_rid_op_day_key",
    "CREATE UNIQUE INDEX IF NOT EXISTS ux_ont_usage_dims ON ont_usage_metric "
    "(tenant_id, class_rid, op, day, actor, source)",
    "CREATE INDEX IF NOT EXISTS ix_ont_usage_tenant ON ont_usage_metric (tenant_id)",
    # GOV-19：时序存储（TIMESERIES 属性背后的 series store）
    """
    CREATE TABLE IF NOT EXISTS ont_timeseries_point (
        series_rid TEXT NOT NULL,
        tenant_id  TEXT NOT NULL,
        ts         TIMESTAMPTZ NOT NULL,
        value      DOUBLE PRECISION NOT NULL,
        attrs      JSONB NOT NULL DEFAULT '{}'::jsonb,
        PRIMARY KEY (series_rid, ts)
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_ont_ts_tenant ON ont_timeseries_point (tenant_id)",
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
    """
    CREATE TABLE IF NOT EXISTS ont_proposal_event (
        event_id    BIGSERIAL PRIMARY KEY,
        proposal_id TEXT NOT NULL REFERENCES ont_proposal(proposal_id) ON DELETE CASCADE,
        tenant_id   TEXT NOT NULL,
        from_status TEXT,
        to_status   TEXT NOT NULL,
        actor_id    TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_ont_prop_event_proposal ON ont_proposal_event (proposal_id, event_id)",
    "CREATE INDEX IF NOT EXISTS ix_ont_prop_event_tenant ON ont_proposal_event (tenant_id)",
    """
    CREATE TABLE IF NOT EXISTS ont_proposal_idempotency (
        tenant_id          TEXT NOT NULL,
        operation          TEXT NOT NULL,
        idempotency_key    TEXT NOT NULL,
        proposal_id        TEXT NOT NULL REFERENCES ont_proposal(proposal_id) ON DELETE CASCADE,
        request_fingerprint TEXT NOT NULL,
        created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (tenant_id, operation, idempotency_key)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS ont_proposal_execution (
        proposal_id TEXT PRIMARY KEY REFERENCES ont_proposal(proposal_id) ON DELETE CASCADE,
        tenant_id   TEXT NOT NULL,
        result      JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_ont_prop_execution_tenant ON ont_proposal_execution (tenant_id)",
    "ALTER TABLE ont_proposal_execution ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ",
    "ALTER TABLE ont_proposal_execution ADD COLUMN IF NOT EXISTS audit_id TEXT",
    """
    CREATE TABLE IF NOT EXISTS ont_action_audit (
        audit_id    TEXT PRIMARY KEY,
        tenant_id   TEXT NOT NULL,
        proposal_id TEXT NOT NULL REFERENCES ont_proposal(proposal_id) ON DELETE CASCADE,
        action_rid  TEXT NOT NULL,
        target_iid  TEXT NOT NULL,
        actor_id    TEXT NOT NULL,
        result      JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_ont_action_audit_proposal ON ont_action_audit (proposal_id)",
    """
    CREATE TABLE IF NOT EXISTS ont_outbox_event (
        event_id    TEXT PRIMARY KEY,
        tenant_id   TEXT NOT NULL,
        proposal_id TEXT NOT NULL REFERENCES ont_proposal(proposal_id) ON DELETE CASCADE,
        event_type  TEXT NOT NULL,
        payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_ont_outbox_event_proposal ON ont_outbox_event (proposal_id)",
    # MP-SAL-04b: proposal kind（action / create_instance / model_type）
    "ALTER TABLE ont_proposal ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'action'",
    # ACT-05：edit-set 提案字段（与 kernel ActionProposal 对齐）
    "ALTER TABLE ont_proposal ADD COLUMN IF NOT EXISTS requires_hitl BOOLEAN NOT NULL DEFAULT TRUE",
    "ALTER TABLE ont_proposal ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE ont_proposal ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()",
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
_NUMERIC_TYPE_IDS = frozenset({"integer", "int", "long", "number", "decimal", "float", "double"})


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


def _rewrite_filter_fields(cf: CompiledFilter, slug_to_rid: dict[str, str]) -> CompiledFilter:
    """把 CompiledFilter 里的简写 slug 字段名归一化为完整 Property rid。

    InMemory 执行器（``individual_to_row``）用 rid 第 4 段作 row key，因此
    DSL 支持 ``amount > 10`` 这类简写；PG 的 JSONB 键存的是完整 rid
    （``_props_to_dict``），不归一化则 ``props ->> 'amount'`` 永远 NULL、
    过滤结果恒空。仅在 slug_to_rid 命中时替换，未命中原样保留。
    """

    field = cf.field_name
    new_field = slug_to_rid.get(field, field) if field is not None else None
    new_children = tuple(_rewrite_filter_fields(c, slug_to_rid) for c in cf.children)
    if new_field == field and new_children == cf.children:
        return cf
    return _dc_replace(cf, field_name=new_field, children=new_children)


def _slug_of(rid: str) -> str:
    """rid 的 slug 段（5 段取 [3]，6 段取 [4]；兜底最后一段）。"""
    parts = rid.split(".")
    if len(parts) >= 6:
        return parts[4]
    return parts[3] if len(parts) >= 5 else parts[-1]


def _collect_filter_fields(cf: CompiledFilter) -> list[str]:
    """递归收集 CompiledFilter 里出现过的字段名（F4 校验用）。"""
    out: list[str] = []
    if cf.field_name:
        out.append(cf.field_name)
    for c in cf.children:
        out.extend(_collect_filter_fields(c))
    return out


def _assert_filter_fields_resolvable(cf: CompiledFilter, known_slugs: set[str]) -> None:
    """F4：字段既不是完整 rid、也不在已知 slug 集合 → fail-fast。

    否则 `props ->> '<未知键>'` 恒 NULL，过滤**静默返回空集** —— 调用方无法
    区分"没有匹配"与"字段名写错了"。空集比报错危险得多。
    只对非 rid 形态的字段严格：完整 rid 一律放行（含跨类/继承属性场景）。
    """
    bad = sorted(
        {f for f in _collect_filter_fields(cf) if not f.startswith("ont.") and f not in known_slugs}
    )
    if bad:
        raise ValueError(
            f"unknown filter field(s) {bad} —— 既非完整 Property rid，也不在已知 slug 中"
        )


def _require_resolvable_field(field: str, known_slugs: set[str], *, kind: str) -> None:
    """F4 同族：sort / group_by / 聚合字段既非完整 rid 也不在已知 slug → fail-fast。

    此前这些位置一律 `slug_to_rid.get(f, f)` 静默回落 —— `props ->> '<未知键>'`
    恒 NULL，表现为「排序/分组无效果」而不是报错，与 filter 的静默空集同病。
    完整 rid 一律放行（避免误伤继承/跨类属性）。
    """
    if field.startswith("ont.") or field in known_slugs:
        return
    raise ValueError(f"unknown {kind} field {field!r} —— 既非完整 Property rid，也不在已知 slug 中")


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
        "properties": [_prop_to_json(p) for p in ot.properties],
        "interfaces": [i.rid for i in ot.interfaces],
        "display_name": ot.display_name,
        "marking": list(ot.marking),
        "parent_class": ot.parent_class.rid if ot.parent_class is not None else "",
        "description": ot.description,
        "status": ot.status,
        "type_group": ot.type_group,
        "render_hints": [list(kv) for kv in ot.render_hints],
    }


def _row_to_ot(row: dict[str, Any]) -> ObjectType:
    return ObjectType(
        rid=ClassRef(row["rid"]),
        primary_key=tuple(ClassRef(pk) for pk in row["primary_key"]),
        properties=tuple(_json_to_prop(p) for p in row["properties"]),
        interfaces=tuple(ClassRef(i) for i in row["interfaces"]),
        display_name=row["display_name"],
        marking=tuple(row.get("marking") or ()),
        parent_class=(ClassRef(row["parent_class"]) if row.get("parent_class") else None),
        description=row.get("description", "") or "",
        status=row.get("status", "") or "active",
        type_group=row.get("type_group", "") or "",
        render_hints=tuple(tuple(kv) for kv in (row.get("render_hints") or [])),
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
        provenance=row.get("provenance") if isinstance(row.get("provenance"), dict) else None,
    )


def _lt_to_row(lt: LinkType) -> dict[str, Any]:
    return {
        "rid": lt.rid.rid,
        "tenant_id": lt.rid.rid.split(".")[1] if "." in lt.rid.rid else "",
        "src_rid": lt.src.rid,
        "dst_rid": lt.dst.rid,
        "cardinality": lt.cardinality.value,
        "directionality": lt.directionality.value,
        "src_display_name": lt.src_display_name,
        "dst_display_name": lt.dst_display_name,
        "description": lt.description,
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
            params.append(
                Property(
                    rid=ClassRef(p),
                    type_id="string",
                    nullable=True,
                    primary_key=False,
                    title="",
                    format=PropertyFormat.STRING,
                )
            )
        elif isinstance(p, dict):
            params.append(
                Property(
                    rid=ClassRef(p["rid"]),
                    type_id=p["type_id"],
                    nullable=bool(p.get("nullable", True)),
                    primary_key=bool(p.get("primary_key", False)),
                    title=p.get("title", ""),
                    format=PropertyFormat(p.get("format", "string")),
                )
            )
    return ActionType(
        rid=ClassRef(row["rid"]),
        parameters=tuple(params),
        submission_criteria=tuple(row.get("submission_criteria") or []),
        side_effects=tuple(row.get("side_effects") or []),
        # ADR-0064 S1：不再静默造 ont.system.fn.noop.v1（与 ADR-0063 S2 删除的
        # 同类病）。空 function_ref = 纯声明式；空 + 空 declarative_edits 的行
        # 由 ActionType「至少声明一个」校验 fail-fast。
        function_ref=ClassRef(row["function_ref"]) if row.get("function_ref") else None,
        on=tuple(ClassRef(r) for r in row.get("target_object_types") or []),
        title=row.get("title") or "",
        description=row.get("description") or "",
        declarative_edits=tuple(row.get("declarative_edits") or []),
    )


def _row_to_lt(row: dict[str, Any]) -> LinkType:
    return LinkType(
        rid=ClassRef(row["rid"]),
        src=ClassRef(row["src_rid"]),
        dst=ClassRef(row["dst_rid"]),
        cardinality=Cardinality(row["cardinality"]),
        directionality=Directionality(row["directionality"]),
        src_display_name=row.get("src_display_name", "") or "",
        dst_display_name=row.get("dst_display_name", "") or "",
        description=row.get("description", "") or "",
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
        polymorphic_action_constraints=tuple(row.get("polymorphic_action_constraints") or []),
    )


def _prop_to_json(p: Property) -> dict[str, Any]:
    """EXP-02：Property → JSONB dict（ont_object_type.properties 与 ont_property 共用）。"""
    return {
        "rid": p.rid.rid,
        "type_id": p.type_id,
        "nullable": p.nullable,
        "primary_key": p.primary_key,
        "title": p.title,
        "format": p.format.value,
        "description": p.description,
        "struct_fields": [_prop_to_json(sf) for sf in p.struct_fields],
        "array": p.array,
        "reducer": p.reducer,
        "derived": (
            {"fn": p.derived.fn, "over_link": p.derived.over_link, "field": p.derived.field}
            if p.derived is not None
            else None
        ),
        "shared": p.shared,
    }


def _json_to_prop(d: dict[str, Any]) -> Property:
    from mate_kernel.ontology.types.property_ import DerivedSpec

    derived_raw = d.get("derived")
    return Property(
        rid=ClassRef(d["rid"]),
        type_id=d["type_id"],
        nullable=d["nullable"],
        primary_key=d["primary_key"],
        title=d["title"],
        format=PropertyFormat(d["format"]),
        description=d.get("description", ""),
        struct_fields=tuple(_json_to_prop(sf) for sf in d.get("struct_fields") or ()),
        array=bool(d.get("array", False)),
        reducer=d.get("reducer"),
        derived=(
            DerivedSpec(
                fn=derived_raw["fn"],
                over_link=derived_raw["over_link"],
                field=derived_raw.get("field"),
            )
            if derived_raw
            else None
        ),
        shared=bool(d.get("shared", False)),
    )


def _prop_to_row(p: Property) -> dict[str, Any]:
    row = _prop_to_json(p)
    row["tenant_id"] = p.rid.rid.split(".")[1] if "." in p.rid.rid else ""
    return row


def _row_to_prop(row: dict[str, Any]) -> Property:
    return _json_to_prop(row)


def _assert_value_type_consistent(p: Property) -> None:
    """EXP-02：宽松值类型校验 —— 已注册 type_id 与 format 不符即 ValueError。

    未注册 type_id 放行（开放注册表：先声明后注册合法）；注册与否查询
    kernel value_types 模块（进程内注册表，无 DB 依赖）。
    """
    from mate_kernel.ontology.types.value_types import get_value_type

    vt = get_value_type(p.type_id)
    if vt is not None and vt.format is not p.format:
        raise ValueError(
            f"property {p.rid.rid} format {p.format.value!r} != "
            f"value type {p.type_id!r} declared format {vt.format.value!r}"
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


def _count_endpoint_edges(
    cur: Any, link_type_rid: str, src: str, dst: str, exclude_rid: str
) -> tuple[int, int]:
    """既有同类型边数：(src 出边, dst 入边)，不含 ``exclude_rid``（upsert 幂等）。

    在**调用方游标**上执行，便于与写入共享同一事务（并发保护见
    ``_lock_link_endpoints``）。
    """
    cur.execute(
        "SELECT"
        " COUNT(*) FILTER (WHERE src = %s AND rid != %s) AS src_out,"
        " COUNT(*) FILTER (WHERE dst = %s AND rid != %s) AS dst_in"
        " FROM ont_link_instance WHERE link_type_rid = %s",
        (src, exclude_rid, dst, exclude_rid, link_type_rid),
    )
    r = cur.fetchone()
    return (int(r["src_out"]) if r else 0), (int(r["dst_in"]) if r else 0)


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
    # F9：operand 不保证是完整 rid —— ① 无父类的 parent 公理曾写空串占位
    # （见 upsert_object_type）；② 闭包路径（list_subclass_axioms）刻意按
    # **原始字符串**消费 operand，支持 slug 写法（G21 测试的两种写法）。
    # 而 Axiom.operands 是 ClassRef（严格 rid 正则）——无法表示的 operand
    # 只能跳过，否则整个 list_axioms / GET /axioms 一并 500。
    operands: list[ClassRef] = []
    for o in row.get("operands") or []:
        try:
            operands.append(ClassRef(o))
        except ValueError:
            continue
    return Axiom(
        rid=ClassRef(row["rid"]),
        kind=AxiomKind(row["kind"]),
        operands=tuple(operands),
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
        # F8：租户上下文用模块级 ContextVar（跨 asyncio.to_thread 可见），见 _TENANT_CTX。
        from mate_kernel.action.engine import ActionService

        self._action_service = ActionService()
        # P1-5：事务提交后待 pg_notify 的事件 ID（WS LISTEN/NOTIFY 即时推）
        self._pending_notify: list[str] = []
        # GOVERN-05: FunctionResolver + FunctionExecutor 注入
        from mate_kernel.ontology.function_resolver import (
            GitFunctionResolver,
            InMemoryFunctionResolver,
        )

        self._function_resolver: InMemoryFunctionResolver = InMemoryFunctionResolver()
        # ADR-0063 S1：git: 来源的 resolver（未注入时 upsert_function 遇 git: fail-fast）
        self._git_resolver: GitFunctionResolver | None = None
        self._function_executor: object | None = None
        # MP-SAL-02: 对象语义检索 embedder（env 未配置时为 None → 索引跳过）
        from .object_search import build_env_embedder

        self._embedder: object | None = build_env_embedder()
        # The database transaction outbox is always available. Integrations can
        # replace this ID allocator with a publisher adapter, but a normal
        # service must never downgrade an approved action to an unaudited path.
        self._outbox_writer: Any = lambda _event_type, _tenant_id, _payload: f"outbox-{uuid4()}"

        # GOVERN-12-02: 构造即 bootstrap DDL。任何路径（启动 / 测试 fixture /
        # 迁移脚本）拿到 PgOntologyRepository 实例即可用；不需要启动序列先
        # 显式调 ``initialize()``。DSN 不可达时仅 warn，不阻断进程 —— dev
        # 友好（compose 启动顺序保护），生产期望 K8s readiness 失败。
        try:
            self._ensure_schema()
        except Exception as exc:  # bootstrap 失败降级
            import logging

            logging.getLogger(__name__).warning(
                "pg_schema_bootstrap_failed",
                extra={"dsn": dsn, "error": str(exc)},
            )

    def _current_tenant(self) -> str | None:
        """当前请求租户（ContextVar，跨 asyncio.to_thread 可见；F8）。"""
        return _TENANT_CTX.get()

    @contextmanager
    def tenant_scope(self, tenant_id: str) -> Iterator[PgOntologyRepository]:
        """GOVERN-06: 在 with 块内所有 _connect() 自动 install_rls(tenant_id)。

        用法（v2_kernel/api.py）::

            with app_state.kernel_repo.tenant_scope(ctx.tenant_id) as repo:
                result = repo.upsert_object_type(...)

        嵌套调用沿用最内层 tenant；退出 with 自动还原。
        F8：实现为 ContextVar.set/reset —— `asyncio.to_thread` 会复制 context，
        因此工作线程内的 `_connect()` 也能拿到 tenant（threading.local 不能）。
        """
        token = _TENANT_CTX.set(tenant_id)
        try:
            yield self
        finally:
            _TENANT_CTX.reset(token)

    def set_function_executor(self, executor: object) -> None:
        """GOVERN-05: 注入 FunctionExecutor；同步到 ActionService 内 _executors + _resolver。

        ADR-0063：**必须同时为已存在的 Function 注册 function_ref**。启动顺序是
        `seed_demo()` → `_inject_function_executor()`，即函数通常在 executor
        就位**之前**就已 upsert；此时 `upsert_function` 内的 `register_function_ref`
        被 `_function_executor is None` 跳过。若不在此处补齐，ActionService 永远
        不认识这些函数，apply 会 fail-fast（FunctionNotRegistered）。
        （InMemory 版本早就在 __init__ 里遍历注册；PG 版本此前缺这一步。）
        """
        self._function_executor = executor
        self._action_service.set_resolver(self._function_resolver)
        try:
            for f in self.list_functions():
                self._action_service.register_function_ref(
                    f.rid.rid, executor, self._function_resolver
                )
        except Exception:  # 表尚未创建等 → 留待 upsert_function 时注册
            pass

    def set_git_resolver(self, resolver: object) -> None:
        """ADR-0063 S1：注入 GitFunctionResolver，使 ``git:<sha>:<path>`` 来源可解析。

        未注入时 `upsert_function` 遇到 git: source_ref 会 fail-fast（不静默）。
        """
        self._git_resolver = resolver  # type: ignore[assignment]

    def register_function_source(self, function_rid: str, source: str) -> None:
        """ADR-0063：显式登记 inline 源码（dev/test/seed）。

        `upsert_function` 不再回落恒等函数，故须先登记（key 为
        ``inline://<rid>``）再 upsert，否则 fail-fast。
        **同时登记进 resolver** —— 只写 `_PG_INLINE_FUNCTIONS` 时，源码要到
        下一次 `upsert_function` 才进 resolver；若调用方只 register 不 upsert，
        解析会失败。
        """
        ref = f"inline://{function_rid}"
        _PG_INLINE_FUNCTIONS[ref] = source
        from mate_kernel.ontology.reasoning import FunctionLanguage

        self._function_resolver.register(FunctionLanguage.PYTHON, ref, source)

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
                    cur.execute(
                        "UPDATE ont_proposal SET status = 'executed' WHERE status = 'applied'"
                    )
                conn.commit()
                self._initialized = True
            finally:
                conn.close()
        # AI-09：建表成功后尝试 pgvector 升级（一次尝试，失败静默兜底）
        self._try_pgvector_upgrade()

    def _try_pgvector_upgrade(self) -> None:
        """AI-09：ont_object_embedding 加向量列 + HNSW 索引（对齐 tech-rag kb_chunks v3）。

        扩展不可用（非 pgvector 镜像）→ 标志保持 False，检索走 JSONB cosine
        兜底（同接口双实现）。HNSW 2000 维上限 → dim>2000 用 halfvec。
        """
        import os as _os

        try:
            vec_dim = int(_os.environ.get("ONT_VECTOR_DIM", "2048"))
        except ValueError:
            vec_dim = 2048
        vec_type = "halfvec" if vec_dim > 2000 else "vector"
        vec_ops = vec_type + "_cosine_ops"
        stmts = [
            "CREATE EXTENSION IF NOT EXISTS vector",
            (
                "DO $do$ BEGIN "
                "IF EXISTS (SELECT 1 FROM pg_attribute a "
                "JOIN pg_class c ON c.oid = a.attrelid "
                "JOIN pg_type t ON t.oid = a.atttypid "
                "WHERE c.relname='ont_object_embedding' "
                "AND a.attname='embedding_vec' "
                "AND (t.typname <> '" + vec_type + "' "
                # atttypmod = dim for vector/halfvec；information_schema 的
                # character_maximum_length 对扩展类型恒为 NULL，用它比较会让
                # DROP 分支每次启动都触发、把已回填的向量全部清空。
                "     OR COALESCE(a.atttypmod, 0) <> '" + str(vec_dim) + "'::int)) THEN "
                "ALTER TABLE ont_object_embedding DROP COLUMN embedding_vec; "
                "END IF; "
                "END $do$"
            ),
            "ALTER TABLE ont_object_embedding ADD COLUMN IF NOT EXISTS "
            "embedding_vec " + vec_type + "(" + str(vec_dim) + ")",
            "CREATE INDEX IF NOT EXISTS ix_ont_oemb_vec ON ont_object_embedding "
            "USING hnsw (embedding_vec " + vec_ops + ")",
        ]
        try:
            conn, _ = self._connect()
            try:
                with self._cursor(conn) as cur:
                    for stmt in stmts:
                        cur.execute(stmt)
                conn.commit()
                self._pgvector_ready = True
                self._pgvector_dim = vec_dim  # 记录实际列维度（写侧自检用）
            finally:
                conn.close()
        except Exception:
            self._pgvector_ready = False

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
        # EXP-01：Interface 约束 fail-fast —— 已注册 Interface 的属性签名不符即拒绝
        # （未注册的 Interface 声明保持 legacy 宽松语义：可能先声明后注册）。
        self._validate_registered_interfaces(ot)
        # EXP-02：值类型宽松校验（已注册 type_id 的 format 一致性）
        for p in ot.properties:
            _assert_value_type_consistent(p)
        # EXP-01：parent_class 环检测（沿 parent 链上溯，出现自身即成环）
        if row["parent_class"]:
            self._assert_parent_acyclic(row["rid"], row["parent_class"])
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
                             display_name, marking, parent_class,
                             description, status, type_group, render_hints, updated_at)
                        VALUES (%s, %s, %s, %s, %s::jsonb, %s, %s, %s, %s,
                                %s, %s, %s, %s::jsonb, now())
                        ON CONFLICT (rid) DO UPDATE SET
                            slug = EXCLUDED.slug,
                            primary_key = EXCLUDED.primary_key,
                            properties = EXCLUDED.properties,
                            interfaces = EXCLUDED.interfaces,
                            display_name = EXCLUDED.display_name,
                            marking = EXCLUDED.marking,
                            parent_class = EXCLUDED.parent_class,
                            description = EXCLUDED.description,
                            status = EXCLUDED.status,
                            type_group = EXCLUDED.type_group,
                            render_hints = EXCLUDED.render_hints,
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
                            row["parent_class"],
                            row["description"],
                            row["status"],
                            row["type_group"],
                            json.dumps(row["render_hints"]),
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
                # EXP-01：parent_class → subclass 公理与类型行**同一事务**写入；
                # 任一失败 → 整体回滚（不得「先提交类型再吞掉公理异常」）。
                self._sync_parent_axiom(cur, row)
            conn.commit()
            return ot
        except Exception:
            # 类型行/接口校验/公理任一失败 → 整体回滚（原子性）
            conn.rollback()
            raise
        finally:
            conn.close()

    def _sync_parent_axiom(self, cur: Any, row: dict[str, Any]) -> None:
        """EXP-01：parent_class → subclass 公理（与类型行**同一事务**，单一事实源）。

        - 有父类 → 启用公理（operands=[self, parent]）；
        - 无父类 → 禁用旧公理（operands=[self]；F9：不写空串 operand，否则
          `_row_to_ax` 读回抛 ValueError、/axioms 恒 500）。

        公理 rid 由类型 rid 派生（`obj` → `ax.parent`）。rid 形态不支持派生时
        跳过（无公理可写，属结构 no-op，非吞异常）。失败由调用方回滚整个事务。
        """
        parts = row["rid"].split(".", 3)
        if len(parts) != 4:
            return
        ax_rid = f"{parts[0]}.{parts[1]}.ax.parent.{parts[3]}"
        parent = row["parent_class"]
        operands = [row["rid"], parent] if parent else [row["rid"]]
        cur.execute(
            """INSERT INTO ont_axiom (rid, tenant_id, kind, operands, rule_ref, enabled)
               VALUES (%s,%s,%s,%s,%s,%s)
               ON CONFLICT (rid) DO UPDATE SET kind=EXCLUDED.kind,
                 operands=EXCLUDED.operands, rule_ref=EXCLUDED.rule_ref,
                 enabled=EXCLUDED.enabled""",
            (ax_rid, row["tenant_id"], "subclass", operands, "parent_class", bool(parent)),
        )

    def _validate_registered_interfaces(self, ot: ObjectType) -> None:
        """EXP-01：对已注册 Interface 做 fail-fast 约束校验（属性签名维度）。

        未注册的 Interface 声明保持宽松（先声明后注册合法）；已注册但属性
        签名不符 → ValueError（对齐 Palantir OMS 保存门禁语义）。
        """
        from mate_kernel.ontology.types.interface import validate_interface_constraints

        try:
            interfaces = self.list_interfaces()
        except Exception as e:
            # 读取失败**不得**视为通过（fail-closed）：无法确认接口一致性 → 拒绝落库。
            raise ModelValidationUnavailable(
                f"interface consistency check unavailable: {type(e).__name__}: {e}"
            ) from e
        registered = {i.rid.rid: i for i in interfaces}
        for ref in ot.interfaces:
            ifc = registered.get(ref.rid if hasattr(ref, "rid") else str(ref))
            if ifc is None:
                continue
            violations = validate_interface_constraints(ot, ifc)
            if violations:
                raise ValueError("; ".join(violations))

    def _assert_parent_acyclic(self, rid: str, parent: str, _depth: int = 0) -> None:
        """EXP-01：沿 parent_class 链上溯做环检测（同时限深，防脏数据长链）。"""
        if _depth > 16:
            raise ValueError(
                f"parent_class chain too deep (>{16}) at {rid!r}; "
                "deep hierarchies should use Interface composition"
            )
        if parent == rid:
            raise ValueError(f"parent_class cycle detected: {rid!r} is its own ancestor")
        try:
            parent_ot = self.get_object_type(ClassRef(parent))
        except KeyError:
            return  # parent 未注册（允许先声明后注册）
        next_parent = parent_ot.parent_class.rid if parent_ot.parent_class is not None else ""
        if next_parent:
            self._assert_parent_acyclic(rid, next_parent, _depth + 1)

    def get_type_hierarchy(self) -> list[dict[str, Any]]:
        """EXP-01：租户内类型层级树（parent_class 维度）。

        返回扁平行 [{rid, display_name, parent_class, children:[...]}]，
        children 嵌套完整子树；孤儿/脏 parent 挂 children 缺席不报错（按根渲染）。
        """
        all_types = self.list_object_types(limit=10000, offset=0)
        by_rid = {ot.rid.rid: ot for ot in all_types}
        children_of: dict[str, list[str]] = {}
        roots: list[str] = []
        for ot in all_types:
            parent = ot.parent_class.rid if ot.parent_class is not None else ""
            if parent and parent in by_rid:
                children_of.setdefault(parent, []).append(ot.rid.rid)
            else:
                roots.append(ot.rid.rid)

        def _node(rid: str) -> dict[str, Any]:
            ot = by_rid[rid]
            return {
                "rid": rid,
                "display_name": ot.display_name,
                "parent_class": (ot.parent_class.rid if ot.parent_class is not None else ""),
                "children": [_node(c) for c in children_of.get(rid, [])],
            }

        return [_node(r) for r in roots]

    # ─────────── ONT-G18：Axiom 注册中心 ───────────

    def upsert_axiom_record(
        self,
        rid: str,
        kind: str,
        operands: list[str],
        rule_ref: str = "builtin",
        *,
        tenant_id: str = "",
        enabled: bool = True,
    ) -> dict:
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    """INSERT INTO ont_axiom (rid, tenant_id, kind, operands, rule_ref, enabled)
                       VALUES (%s,%s,%s,%s,%s,%s)
                       ON CONFLICT (rid) DO UPDATE SET kind=EXCLUDED.kind,
                         operands=EXCLUDED.operands, rule_ref=EXCLUDED.rule_ref,
                         enabled=EXCLUDED.enabled""",
                    (
                        rid,
                        tenant_id or self._current_tenant() or "tenant-default",
                        kind,
                        list(operands),
                        rule_ref,
                        enabled,
                    ),
                )
            conn.commit()
        finally:
            conn.close()
        return {
            "rid": rid,
            "kind": kind,
            "operands": list(operands),
            "rule_ref": rule_ref,
            "enabled": enabled,
        }

    def list_axiom_records(self, tenant_id: str = "", *, enabled_only: bool = False) -> list[dict]:
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                sql = "SELECT rid, kind, operands, rule_ref, enabled FROM ont_axiom WHERE tenant_id = %s"
                if enabled_only:
                    sql += " AND enabled = TRUE"
                # 旧表无 created_at（legacy 会话建），兼容 updated_at
                cur.execute(sql + " ORDER BY updated_at", (tenant_id,))
                rows = cur.fetchall()
        finally:
            conn.close()
        out = []
        for r in rows:
            if isinstance(r, dict):
                out.append(
                    {
                        "rid": r["rid"],
                        "kind": r["kind"],
                        "operands": list(r["operands"]),
                        "rule_ref": r["rule_ref"],
                        "enabled": r["enabled"],
                    }
                )
            else:
                out.append(
                    {
                        "rid": r[0],
                        "kind": r[1],
                        "operands": list(r[2]),
                        "rule_ref": r[3],
                        "enabled": r[4],
                    }
                )
        return out

    def delete_axiom_record(self, rid: str) -> bool:
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute("DELETE FROM ont_axiom WHERE rid = %s", (rid,))
                deleted = cur.rowcount
            conn.commit()
        finally:
            conn.close()
        return bool(deleted)

    # ─────────── ONT-G8/G19：branch / diff / rollback ───────────

    def branch_object_type(
        self,
        rid: ClassRef,
        new_rid: ClassRef,
        *,
        note: str = "",
    ) -> ObjectType:
        """以当前定义复制出 new_rid（如 ...v2），记录 lineage。"""
        ot = self.get_object_type(rid)
        from dataclasses import replace as _replace

        branched = _replace(ot, rid=new_rid)
        # rid 派生租户（to_thread 线程里 _current_tenant() 为 None）
        with self.tenant_scope(rid.rid.split(".")[1]):
            self.upsert_object_type(branched)
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    """INSERT INTO ont_type_version (rid, parent_rid, note)
                       VALUES (%s, %s, %s)
                       ON CONFLICT (rid) DO UPDATE SET parent_rid = EXCLUDED.parent_rid""",
                    (new_rid.rid, rid.rid, note),
                )
            conn.commit()
        finally:
            conn.close()
        return branched

    def diff_object_types(self, old_rid: ClassRef, new_rid: ClassRef) -> dict:
        from mate_kernel.ontology.versioning_ops import diff_object_types as _diff

        return _diff(self.get_object_type(old_rid), self.get_object_type(new_rid))

    def rollback_object_type(self, rid: ClassRef, from_rid: ClassRef) -> ObjectType:
        """把 rid 的定义恢复为 from_rid（同族旧版本）的定义。"""
        restored = self.get_object_type(from_rid)
        from dataclasses import replace as _replace

        target = _replace(restored, rid=rid)
        with self.tenant_scope(rid.rid.split(".")[1]):
            self.upsert_object_type(target)
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    """INSERT INTO ont_type_version (rid, parent_rid, note)
                       VALUES (%s, %s, %s)
                       ON CONFLICT (rid) DO UPDATE SET parent_rid = EXCLUDED.parent_rid""",
                    (rid.rid, from_rid.rid, f"rollback to {from_rid.rid}"),
                )
            conn.commit()
        finally:
            conn.close()
        return target

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
        self,
        limit: int,
        offset: int,
        tenant_id: str | None = None,
    ) -> list[ObjectType]:
        self._ensure_schema()
        tenant = tenant_id or self._current_tenant()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                # 只列活动类型：merge / lifecycle delete 走软删（archived=TRUE），
                # 语义是「从活动集合移除」（见 test_ont_act05_unified InMemory 口径）。
                # 此前漏了这个过滤 → 已合并的类型仍出现在列表与层级树里。
                if tenant:  # 深度防御：RLS 之外显式租户过滤（to_thread 下 thread-local 不可见）
                    cur.execute(
                        "SELECT * FROM ont_object_type WHERE tenant_id = %s AND archived = FALSE "
                        "ORDER BY rid LIMIT %s OFFSET %s",
                        (tenant, limit, offset),
                    )
                else:
                    cur.execute(
                        "SELECT * FROM ont_object_type WHERE archived = FALSE "
                        "ORDER BY rid LIMIT %s OFFSET %s",
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
                        src_ind_prefix,
                        tgt_ind_prefix,
                        src_ind_prefix,
                        tgt_ind_prefix,
                        target_rid,
                        tenant_id,
                    ),
                )

                # 3) LinkInstance.src / dst 重写（Individual rid 同步替换）
                cur.execute(
                    "UPDATE ont_link_instance SET src = REPLACE(src, %s, %s) WHERE src LIKE %s",
                    (src_ind_prefix, tgt_ind_prefix, f"{src_ind_prefix}%"),
                )
                src_updates = cur.rowcount
                cur.execute(
                    "UPDATE ont_link_instance SET dst = REPLACE(dst, %s, %s) WHERE dst LIKE %s",
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
                    "UPDATE ont_object_type SET archived = TRUE, updated_at = now() WHERE rid = %s",
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
            parameters,
            None,
            impact_summary,
            expected_diff,
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
                        (rid, tenant_id, src_rid, dst_rid, cardinality, directionality,
                         link_properties, src_display_name, dst_display_name,
                         description, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s, now())
                    ON CONFLICT (rid) DO UPDATE SET
                        src_rid = EXCLUDED.src_rid,
                        dst_rid = EXCLUDED.dst_rid,
                        cardinality = EXCLUDED.cardinality,
                        directionality = EXCLUDED.directionality,
                        link_properties = EXCLUDED.link_properties,
                        src_display_name = EXCLUDED.src_display_name,
                        dst_display_name = EXCLUDED.dst_display_name,
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
                        row.get("src_display_name", ""),
                        row.get("dst_display_name", ""),
                        row.get("description", ""),
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
                        (rid, tenant_id, parameters, submission_criteria, side_effects, function_ref, target_object_types, title, description, declarative_edits, updated_at)
                    VALUES (%s, %s, %s::jsonb, %s::jsonb, %s::jsonb, %s, %s, %s, %s, %s::jsonb, now())
                    ON CONFLICT (rid) DO UPDATE SET
                        parameters = EXCLUDED.parameters,
                        submission_criteria = EXCLUDED.submission_criteria,
                        side_effects = EXCLUDED.side_effects,
                        function_ref = EXCLUDED.function_ref,
                        target_object_types = EXCLUDED.target_object_types,
                        title = EXCLUDED.title,
                        description = EXCLUDED.description,
                        declarative_edits = EXCLUDED.declarative_edits,
                        updated_at = now()
                    """,
                    (
                        at.rid.rid,
                        tenant,
                        json.dumps(
                            [
                                {
                                    "rid": p.rid.rid,
                                    "type_id": p.type_id,
                                    "nullable": p.nullable,
                                    "primary_key": p.primary_key,
                                    "title": p.title,
                                    "format": p.format.value,
                                }
                                for p in at.parameters
                            ]
                        ),
                        json.dumps(list(at.submission_criteria)),
                        json.dumps(list(at.side_effects)),
                        # 列保持 NOT NULL DEFAULT ''：空串 = 纯声明式（ADR-0064）
                        at.function_ref.rid if at.function_ref is not None else "",
                        [c.rid for c in at.on],
                        at.title,
                        at.description,
                        json.dumps([dict(t) for t in at.declarative_edits]),
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
        # EXP-02：值类型宽松校验 —— type_id 已注册但 format 不符即拒
        # （未注册 type_id 放行：开放注册表，先声明后注册合法）。
        _assert_value_type_consistent(p)
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    """
                    INSERT INTO ont_property
                        (rid, tenant_id, type_id, nullable, primary_key, title, format,
                         description, struct_fields, is_array, reducer, derived, shared,
                         updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s::jsonb, %s, now())
                    ON CONFLICT (rid) DO UPDATE SET
                        type_id = EXCLUDED.type_id,
                        nullable = EXCLUDED.nullable,
                        primary_key = EXCLUDED.primary_key,
                        title = EXCLUDED.title,
                        format = EXCLUDED.format,
                        description = EXCLUDED.description,
                        struct_fields = EXCLUDED.struct_fields,
                        is_array = EXCLUDED.is_array,
                        reducer = EXCLUDED.reducer,
                        derived = EXCLUDED.derived,
                        shared = EXCLUDED.shared,
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
                        row["description"],
                        json.dumps(row["struct_fields"]),
                        row["array"],
                        row["reducer"],
                        json.dumps(row["derived"]) if row["derived"] is not None else None,
                        row["shared"],
                    ),
                )
            conn.commit()
            return p
        finally:
            conn.close()

    def list_properties(self) -> list[Property]:
        """EXP-02：属性库全量（共享属性管理面 / 建模引用）。"""
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute("SELECT * FROM ont_property ORDER BY rid")
                rows = cur.fetchall()
            return [_row_to_prop(r) for r in rows]
        finally:
            conn.close()

    def shared_properties_usage(self) -> list[dict[str, Any]]:
        """EXP-02：共享属性使用统计 —— Property rid → 引用它的 ObjectType 清单。

        同一 Property rid 被 >1 类型引用即视为共享（Palantir shared property
        语义：一致建模、一改全改）。返回 [{rid, shared, used_by:[type rid...]}]，
        仅含 used_by 非空条目，按引用数降序。
        """
        types = self.list_object_types(limit=10000, offset=0)
        usage: dict[str, list[str]] = {}
        for ot in types:
            for p in ot.properties:
                usage.setdefault(p.rid.rid, []).append(ot.rid.rid)
        return [
            {"rid": rid, "shared": len(users) > 1, "used_by": users}
            for rid, users in sorted(
                usage.items(),
                key=lambda kv: (-len(kv[1]), kv[0]),
            )
            if users
        ]

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
                        (rid, tenant_id, class_rid, props, primary_key, marking, created_at, updated_at, provenance)
                    VALUES (%s, %s, %s, %s::jsonb, %s, %s, %s, %s, %s::jsonb)
                    ON CONFLICT (rid) DO UPDATE SET
                        props = ont_individual.props || EXCLUDED.props,
                        marking = EXCLUDED.marking,
                        updated_at = EXCLUDED.updated_at,
                        provenance = EXCLUDED.provenance
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
                        json.dumps(ind.provenance, default=str) if ind.provenance else None,
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

    def list_individuals(
        self, class_rid: ClassRef | None, tenant_id: str | None = None
    ) -> list[Individual]:
        self._ensure_schema()
        # F8：必须显式按租户过滤（与 list_object_types 对齐）。tenant_scope 的
        # thread-local 不跨 asyncio.to_thread —— API 路径下 _current_tenant()
        # 恒为 None，仅靠它是拿不到租户的，故 API handler 须显式传 tenant_id。
        tenant = tenant_id or self._current_tenant()
        # EXP-01 补全（2026-09-14）：class_rid 是已注册 Interface 时展开为
        # 实现类型 + 各自后代（与 ObjectSet/IR 查询路径同语义）；具体
        # ObjectType 保持精确匹配（既有行为不变）。
        class_filter: tuple[str, ...] | None = None
        if class_rid is not None:
            # ONT-QUERY-SEMANTICS：与 ObjectSet / Agent 路径**同一**源类解析
            # （Interface 实现类型 + 后代；具体类型 + 后代）。
            class_filter = self._resolve_source_classes(class_rid.rid)
            if not class_filter:
                return []  # Interface 无实现类型 → 空结果（不得退化成"不过滤"）
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                where: list[str] = []
                params: list[Any] = []
                order = "rid"
                if tenant:
                    where.append("tenant_id = %s")
                    params.append(tenant)
                if class_filter is not None:
                    where.append("class_rid = ANY(%s)")
                    params.append(list(class_filter))
                    # 稳定排序：类 + rid（分页可复现）
                    order = "class_rid, rid"
                sql = "SELECT * FROM ont_individual"
                if where:
                    sql += " WHERE " + " AND ".join(where)
                sql += f" ORDER BY {order}"
                cur.execute(sql, tuple(params))
                rows = cur.fetchall()
            return [_row_to_individual(r) for r in rows]
        finally:
            conn.close()

    def _resolve_source_classes(self, source_rid: str) -> tuple[str, ...]:
        """**统一源类解析**（唯一语义实现：`mate_kernel.objectset.source_resolution`）。

        规则：Interface → 实现类型 + 各自后代；ObjectType → 自身 + 后代
        （沿**启用**的 subclass 公理）；未注册 → 精确；无实现类型的 Interface → 空集。
        类型/接口/公理**一次性批量取**（不逐条回查）；浏览 / ObjectSet / Agent
        三条路径共用本方法，语义不再分叉。
        """
        from mate_kernel.objectset.source_resolution import resolve_source_classes

        types = self.list_object_types(limit=10000, offset=0)
        try:
            interfaces = self.list_interfaces()
        except Exception:
            interfaces = []
        parts = source_rid.split(".")
        tenant = parts[1] if source_rid.startswith("ont.") and len(parts) >= 3 else ""
        pairs: list[tuple[str, str]] = []
        if tenant:
            try:
                axioms = self.list_axiom_records(tenant, enabled_only=True)
            except Exception:
                axioms = []
            for a in axioms:
                ops = a.get("operands") or []
                if a.get("kind") == "subclass" and len(ops) >= 2:
                    pairs.append((str(ops[0]), str(ops[1])))
        return resolve_source_classes(
            source_rid,
            object_types=types,
            interface_rids={i.rid.rid for i in interfaces},
            subclass_pairs=pairs,
        )

    def _order_by_sql(
        self,
        keys: list[tuple[str, bool]],
        slug_to_rid: dict[str, str],
        rid_type: dict[str, str],
    ) -> str:
        """多键排序 → ORDER BY 片段，**末尾恒加 rid 稳定决胜键**（分页可复现）。

        字段 slug → rid 归一；未声明字段显式报错（不静默回落）；JSONB 键走字符集
        白名单；数值类型 `::numeric`，其余 `::text`。null 序：PG 默认
        （ASC → NULLS LAST / DESC → NULLS FIRST）与 InMemory `_sort_rank`
        （None 恒为最低档）一致。浏览 / ObjectSet / Agent 共用。
        """
        parts: list[str] = []
        for field_name, desc in keys:
            key = slug_to_rid.get(field_name, field_name)
            if not _SAFE_JSON_KEY.match(key):
                raise ValueError(f"unsafe sort field {field_name!r}")
            _require_resolvable_field(field_name, set(slug_to_rid), kind="sort")
            cast = "::numeric" if rid_type.get(key) in _NUMERIC_TYPE_IDS else "::text"
            direction = "DESC" if desc else "ASC"
            parts.append(f"(props ->> '{key}'){cast} {direction}")
        parts.append("rid")  # 稳定决胜键：同键值集的分页顺序唯一
        return " ORDER BY " + ", ".join(parts)

    def create_link_instance(self, li: LinkInstance) -> LinkInstance:
        self._ensure_schema()
        row = _li_to_row(li)
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                # LINK-CARDINALITY-CONCURRENCY：端点 DB 锁 → 基数校验 → 写入
                # **同一事务**。校验绝不能另开连接（TOCTOU：两个连接各数到 0 条后
                # 都写入成功，基数约束形同虚设）。
                self._lock_link_endpoints(cur, row["link_type_rid"], row["src"], row["dst"])
                # F3：必须传 exclude_rid —— 下方 INSERT 是 ON CONFLICT (rid) DO UPDATE
                # （upsert 语义），同一条链接重放不应被当成"第二条件边"。
                self._check_link_cardinality(
                    row["link_type_rid"],
                    row["src"],
                    row["dst"],
                    exclude_rid=row["rid"],
                    cur=cur,
                )
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
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _lock_link_endpoints(self, cur: Any, link_type_rid: str, src: str, dst: str) -> None:
        """跨进程互斥：对 (link_type, src) / (link_type, dst) 取事务级 advisory lock。

        基数约束只取决于这两个端点的既有边数；对两端点加锁后，「数一遍 + 写一条」
        在同一事务内被串行化 —— **两个进程/连接**并发写冲突关系时只有一个能通过检查。
        按 key 排序依次加锁以避免死锁；锁随事务提交/回滚自动释放。
        """
        for key in sorted({f"{link_type_rid}|{src}", f"{link_type_rid}|{dst}"}):
            cur.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (key,))

    def _flush_notify(self) -> None:
        """P1-5：事务提交后对 pending 事件发 pg_notify（即时推 WS 订阅者）。

        独立短连接；失败静默（轮询兜底）。清空 pending 防重发。
        """
        if not self._pending_notify:
            return
        pending, self._pending_notify = self._pending_notify[:], []
        dsn = getattr(self, "_dsn", "")
        if not dsn:
            return
        from .notify_hub import notify_outbox_event

        for eid in pending:
            notify_outbox_event(dsn, eid)

    def _check_link_cardinality(
        self,
        link_type_rid: str,
        src: str,
        dst: str,
        exclude_rid: str = "",
        *,
        cur: Any = None,
    ) -> None:
        """EXP-03：注册 LinkType 的基数约束（见 kernel check_cardinality）。

        ``cur`` 给定时在**调用方事务**内数边 —— 调用方须已取端点锁
        （``_lock_link_endpoints``），否则仍是 TOCTOU。缺省自开连接（旧行为，供只读路径）。
        """
        from mate_kernel.ontology.types.link_type import check_cardinality

        try:
            lt = self.get_link_type(ClassRef(link_type_rid))
        except KeyError:
            return
        if cur is not None:
            src_out, dst_in = _count_endpoint_edges(cur, link_type_rid, src, dst, exclude_rid)
        else:
            conn, _ = self._connect()
            try:
                with self._cursor(conn) as c2:
                    src_out, dst_in = _count_endpoint_edges(
                        c2, link_type_rid, src, dst, exclude_rid
                    )
            finally:
                conn.close()
        violation = check_cardinality(lt.cardinality, src_out, dst_in)
        if violation:
            raise ValueError(f"{violation} (link_type={link_type_rid}, src={src}, dst={dst})")

    def search_around(self, rid: str, limit: int = 100) -> list[dict[str, Any]]:
        """EXP-03：一跳关系遍历（Object Explorer Search Around 同语义）。

        返回按 (link_type, direction) 分组的对端实例清单：
        [{link_type_rid, link_display, direction, peers: [individual_row...]}]。
        limit 是对端实例总数上限（默认 100，防大图拖垮）。
        """
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    "SELECT * FROM ont_link_instance WHERE src = %s OR dst = %s LIMIT %s",
                    (rid, rid, limit),
                )
                links = cur.fetchall()
                if not links:
                    return []
                peer_rids = list({(l["dst"] if l["src"] == rid else l["src"]) for l in links})[
                    :limit
                ]
                cur.execute(
                    "SELECT * FROM ont_individual WHERE rid = ANY(%s)",
                    (peer_rids,),
                )
                ind_rows = {r["rid"]: _row_to_individual(r) for r in cur.fetchall()}
        finally:
            conn.close()
        link_types = {lt.rid.rid: lt for lt in self.list_link_types()}
        grouped: dict[tuple[str, str], dict[str, Any]] = {}
        for l in links:
            lt = link_types.get(l["link_type_rid"])
            outgoing = l["src"] == rid
            peer_rid = l["dst"] if outgoing else l["src"]
            key = (l["link_type_rid"], "out" if outgoing else "in")
            entry = grouped.setdefault(
                key,
                {
                    "link_type_rid": l["link_type_rid"],
                    "link_display": (
                        (lt.src_display_name if lt else "") or _slug_of(l["link_type_rid"])
                        if outgoing
                        else (lt.dst_display_name if lt else "") or _slug_of(l["link_type_rid"])
                    ),
                    "direction": key[1],
                    "peers": [],
                },
            )
            ind = ind_rows.get(peer_rid)
            if ind is not None:
                entry["peers"].append(individual_to_row(ind))
        return list(grouped.values())

    def list_link_instances(self, tenant_id: str | None = None) -> list[LinkInstance]:
        self._ensure_schema()
        # F8：必须显式按租户过滤（与 list_object_types 对齐），理由同 list_individuals。
        tenant = tenant_id or self._current_tenant()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                if tenant:
                    cur.execute(
                        "SELECT * FROM ont_link_instance WHERE tenant_id = %s ORDER BY rid",
                        (tenant,),
                    )
                else:
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
            # F9：单条脏行不得让整个列表端点 500 —— 转换失败的（如历史写入的
            # 非法 rid / operand）跳过。库中确实存在此类遗留行（例如
            # ont.*.obj.*#parent 这种合成的非 rid 形式）。
            out: list[Axiom] = []
            for r in rows:
                try:
                    out.append(_row_to_ax(r))
                except ValueError:
                    continue
            return out
        finally:
            conn.close()

    def upsert_function(self, f: Function) -> Function:
        self._ensure_schema()
        # G23：被覆盖的旧版本先快照（版本演进可回溯）
        try:
            conn_v, _ = self._connect()
            try:
                with self._cursor(conn_v) as cur:
                    cur.execute(
                        "SELECT version, language, source_ref FROM ont_function WHERE rid = %s",
                        (f.rid.rid,),
                    )
                    old = cur.fetchone()
                if old is not None:
                    with self._cursor(conn_v) as cur:
                        cur.execute(
                            """INSERT INTO ont_function_version
                               (function_rid, version, language, source_ref)
                               VALUES (%s,%s,%s,%s)
                               ON CONFLICT (function_rid, version) DO NOTHING""",
                            (f.rid.rid, int(old["version"]), old["language"], old["source_ref"]),
                        )
                conn_v.commit()
            finally:
                conn_v.close()
        except Exception:
            pass  # 快照失败不阻断主路径
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
            # ADR-0063 S2：按 source_ref scheme 分派注册。**未知 scheme / 未登记
            # 源码一律 fail-fast** —— 不再回落恒等函数（那会把"配置缺陷"伪装成
            # "正常执行"：apply 返回 200 却什么也没算，失败不可观测）。
            ref = f.source_ref
            if ref.startswith("inline://"):
                # ADR-0063 S4 / 硬规则 5：production profile 拒绝 inline 来源
                from mate_platform.runtime import is_production_profile

                if is_production_profile():
                    raise FunctionNotFoundError(
                        f"inline:// source_ref 在 production profile 被拒绝：{ref!r}"
                        "（硬规则 5：prod 禁 fallback；请改用 git:<sha>:<path>）"
                    )
                src = _PG_INLINE_FUNCTIONS.get(ref)
                if src is None:
                    raise FunctionNotFoundError(
                        f"inline source not registered for {ref!r} —— ADR-0063 起不再回落恒等函数"
                    )
                self._function_resolver.register(f.language, ref, src)
                if self._function_executor is not None:
                    self._action_service.register_function_ref(
                        f.rid.rid,
                        self._function_executor,
                        self._function_resolver,
                    )
            elif ref.startswith("git:"):
                if self._git_resolver is None:
                    raise FunctionNotFoundError(
                        f"git source_ref {ref!r} 需要先注入 GitFunctionResolver（见 ADR-0063 S1）"
                    )
                self._git_resolver.register_ref(f.rid.rid, f.language, ref)
                if self._function_executor is not None:
                    self._action_service.register_function_ref(
                        f.rid.rid,
                        self._function_executor,
                        self._git_resolver,
                    )
            else:
                raise FunctionNotFoundError(
                    f"unknown source_ref scheme: {ref!r}（支持 inline:// / git:<sha>:<path>）"
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

    # ───── G23：Function 版本/别名/调用 ─────

    def register_function_alias(self, alias: str, function_rid: str) -> dict[str, Any]:
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    """INSERT INTO ont_function_alias (alias, function_rid, tenant_id)
                       VALUES (%s,%s,%s)
                       ON CONFLICT (alias) DO UPDATE SET
                         function_rid = EXCLUDED.function_rid""",
                    (alias, function_rid, self._current_tenant() or "tenant-default"),
                )
            conn.commit()
            return {"alias": alias, "function_rid": function_rid}
        finally:
            conn.close()

    def resolve_function_alias(self, alias: str) -> str:
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    "SELECT function_rid FROM ont_function_alias WHERE alias = %s", (alias,)
                )
                row = cur.fetchone()
            if row is None:
                raise KeyError(f"alias not found: {alias}")
            return row["function_rid"]
        finally:
            conn.close()

    def list_function_versions(self, function_rid: str) -> list[dict[str, Any]]:
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    "SELECT * FROM ont_function_version WHERE function_rid = %s "
                    "ORDER BY version DESC",
                    (function_rid,),
                )
                return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def invoke_function(self, function_rid: str, parameters: dict[str, Any]) -> dict[str, Any]:
        """调用已注册 Function（invoker/executor 优先，缺位报 422 语义错误）。"""
        action_rid = function_rid
        invoker = self._action_service._invokers.get(function_rid)
        if invoker is not None:
            result = invoker(None, parameters)
            return {"function_rid": function_rid, "result": result}
        executor = self._function_executor
        if executor is not None:
            lang, source = self._function_resolver.resolve(ClassRef(function_rid))
            rc, out, err = executor.execute(source, (None, parameters))
            if rc != 0:
                raise RuntimeError(f"function exited {rc}: {err}")
            try:
                import json as _json

                parsed = _json.loads(out) if out else None
                result = parsed.get("result", parsed) if isinstance(parsed, dict) else parsed
            except Exception:
                result = None
            return {"function_rid": function_rid, "result": result}
        raise KeyError(
            f"function {function_rid!r} has no registered invoker/executor "
            "(G23 invoke 需先 set_function_executor 或 register_function)"
        )

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
        # Interface 源：slug 归一化用接口自身的属性声明（共享属性 rid 在全部实现
        # 类型上一致）。**源类集合解析交给统一实现**（见下方 _resolve_source_classes）。
        if ot is None:
            try:
                ifcs = self.list_interfaces()
            except Exception:
                ifcs = []
            target = os_.class_rid.rid
            ifc = next(
                (i for i in ifcs if i.rid.rid == target),
                None,
            )
            if ifc is not None:
                for p in ifc.properties:
                    slug_to_rid[_prop_slug(p.rid.rid)] = p.rid.rid
                    rid_type[p.rid.rid] = p.type_id
        if slug_to_rid:
            _assert_filter_fields_resolvable(compiled, set(slug_to_rid))
            compiled = _rewrite_filter_fields(compiled, slug_to_rid)

        sqlc = _RepoSQLCompiler()
        where_sql, params = sqlc.compile_where(compiled)

        # ONT-QUERY-SEMANTICS：排序与源类解析都走**统一实现**（多键 + rid 稳定决胜；
        # Interface / 具体类型同一解析规则），不再各自一份。
        order_by = self._order_by_sql(
            [(s[1:] if s.startswith("-") else s, s.startswith("-")) for s in os_.sort],
            slug_to_rid,
            rid_type,
        )
        source_classes = self._resolve_source_classes(os_.class_rid.rid)
        if not source_classes:
            return []  # Interface 无实现类型 → 空结果
        where_sql = f"(class_rid = ANY(%s)) AND ({where_sql})"
        params = [list(source_classes), *params]

        # where_sql comes from SQLCompiler (not user input); order_by is a
        # controlled sort spec. Safe to compose via f-string.
        sql = f"SELECT * FROM ont_individual WHERE {where_sql}{order_by} LIMIT %s OFFSET %s"
        params_all: list[Any] = [*params, os_.paging_limit, os_.paging_offset]

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
        for m in q.aggregation.metrics if q.aggregation else ():
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

        # ONT-QUERY-SEMANTICS：**统一源类解析**（Interface → 实现类型 + 各自后代；
        # 具体类型 → 自身 + 后代）—— 与浏览 / evaluate_object_set 同一实现，
        # 消除"同一语义参数在不同入口结果不同"。
        source_classes = self._resolve_source_classes(q.source)
        if not source_classes:
            return QueryResult(kind="objects", rows=(), result_schema=None)
        if ot is None:
            # Interface 源：slug 归一化用接口自身的属性声明（共享属性 rid 一致）
            try:
                ifcs = self.list_interfaces()
            except Exception:
                ifcs = []
            ifc = next((i for i in ifcs if i.rid.rid == q.source), None)
            if ifc is not None:
                for p in ifc.properties:
                    slug_to_rid[_prop_slug(p.rid.rid)] = p.rid.rid
                    rid_type[p.rid.rid] = p.type_id
        params_inner: list[Any] = [list(source_classes)]
        inner = "SELECT rid FROM ont_individual WHERE class_rid = ANY(%s)"
        # G13：nearestNeighbors —— inner 换成 embedding KNN 子查询
        # （先 KNN 后 filters：filters 作用于最终行集）
        if q.nearest is not None and self._embedder is not None:
            inner, params_inner = self._nearest_inner_sql(
                q.nearest,
                source_rids=list(source_classes),
                fallback_classes=[q.source],
            )
        params: list[Any] = list(params_inner)
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

        sql = f"SELECT * FROM ont_individual WHERE rid IN ({inner})"
        # ONT-QUERY-SEMANTICS：统一排序（多键 + **rid 稳定决胜键**）。
        # 此前 q.sort 为空时不带 ORDER BY → 分页顺序不保证可比。
        sql += self._order_by_sql([(k.field, k.desc) for k in q.sort], slug_to_rid, rid_type)
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
        result_rows = [individual_to_row(i) for i in individuals]
        # G12：数组属性按声明 reducer 折叠为单值
        if ot is not None:
            self._apply_array_reducers(ot, result_rows)
        # EXP-02：派生列追加（count/sum/avg over link，批量聚合避免逐行子查询）
        if ot is not None:
            self._attach_derived_pg(ot, result_rows)
            # L1 marking 血缘传播：派生值继承源对象 marking（Palantir 语义：
            # derived properties 沿计算涉及对象继承安全标记）
            self._propagate_derived_markings(ot, result_rows)
        return QueryResult(
            kind="objects",
            rows=tuple(result_rows),
            result_schema=self._ir_objects_schema(final_class),
        )

    def _nearest_inner_sql(
        self,
        spec: Any,
        source_rids: list[str],
        fallback_classes: list[str],
    ) -> tuple[str, list[Any]]:
        """G13：nearest 的 inner SQL（embedding_vec KNN，HNSW 加速）。

        类过滤：source 类集合 = Interface 展开（或自身）+ 后代闭包 —— 复用
        G21 的公理闭包；无 embedder/扩展缺位由调用方保证不进此路径。
        """
        # 展开类集合（含后代）
        rid_by_slug: dict[str, set[str]] = {}
        conn0, _ = self._connect()
        try:
            with self._cursor(conn0) as cur:
                cur.execute("SELECT rid FROM ont_object_type WHERE rid LIKE %s", ("ont.%.obj.%.%",))
                for row in cur.fetchall():
                    parts = row["rid"].split(".")
                    if len(parts) >= 6:
                        rid_by_slug.setdefault(parts[4], set()).add(row["rid"])
        finally:
            conn0.close()
        pairs: list[tuple[str, str]] = []
        for r in self.list_axiom_records("", enabled_only=False):
            if r.get("kind") != "subclass":
                continue
            ops = r.get("operands") or []
            if len(ops) >= 2 and ops[1]:
                subs = {ops[0]} if ops[0].startswith("ont.") else rid_by_slug.get(ops[0], set())
                sups = {ops[1]} if ops[1].startswith("ont.") else rid_by_slug.get(ops[1], set())
                pairs.extend((a, b) for a in subs for b in sups)
        from mate_kernel.ontology.reasoning.engine import descendant_closure

        closure = descendant_closure(pairs) if pairs else {}
        classes: set[str] = set()
        for base in source_rids or fallback_classes:
            classes.add(base)
            classes |= closure.get(base, set())
        qvec = self._embedder.embed(spec.text)
        vec_literal = "[" + ",".join(f"{x:.6g}" for x in qvec) + "]"
        conds = ["e.embedding_vec IS NOT NULL", "e.class_rid = ANY(%s)"]
        params: list[Any] = [sorted(classes)]
        if spec.property_rid:
            conds.append("e.property_rid = %s")
            params.append(spec.property_rid)
        # DISTINCT + ORDER BY 表达式冲突 → GROUP BY individual + min(距离)（个体级最近）
        sql = (
            "SELECT e.individual_rid AS rid FROM ont_object_embedding e "
            "WHERE " + " AND ".join(conds) + " "
            "GROUP BY e.individual_rid "
            "ORDER BY min(e.embedding_vec <=> %s::halfvec) LIMIT %s"
        )
        params.extend([vec_literal, spec.k])
        return sql, params

    def _propagate_derived_markings(
        self,
        ot: ObjectType,
        rows: list[dict[str, Any]],
    ) -> None:
        """L1：派生属性值继承计算源对象的 marking（血缘传播）。

        语义：如果类型有派生属性，则查询结果的行附带
        ``_derived_markings``（源对象 marking 的并集）—— 下游消费方
        （导出/报表/二次计算）应据此打标。源对象 = link 对端个体。
        实现：对有 derived 属性的类型，拉对端个体 marking 的并集一次性
        附加（v1 类型级传播；行级精确传播在 link 数据量大时按需升级）。
        """
        from mate_kernel.ontology.types.derived import derived_properties

        dprops = derived_properties(ot.properties)
        if not dprops:
            return
        # 类型级传播：本类型 marking ∪ 各 over_link 对端类型 marking
        inherited = set(ot.marking)
        conn = None
        try:
            for p in dprops:
                spec = p.derived
                assert spec is not None
                try:
                    lt = self.get_link_type(ClassRef(spec.over_link))
                    peer = lt.dst if lt.src.rid == ot.rid.rid else lt.src
                    if conn is None:
                        conn, _ = self._connect()
                    with self._cursor(conn) as cur:
                        cur.execute(
                            "SELECT DISTINCT unnest(marking) FROM ont_object_type "
                            "WHERE rid = ANY(%s)",
                            ([ot.rid.rid, peer.rid],),
                        )
                        for r in cur.fetchall():
                            m = r[0] if not isinstance(r, dict) else r.get("unnest")
                            if m:
                                inherited.add(m)
                except KeyError:
                    continue
        except Exception:
            pass  # 血缘传播 best-effort——失败不影响查询结果
        finally:
            if conn is not None:
                conn.close()
        if inherited:
            for row in rows:
                row["_derived_markings"] = sorted(inherited)

    @staticmethod
    def _apply_array_reducers(ot: ObjectType, rows: list[dict[str, Any]]) -> None:
        """G12：array 属性行值按 reducer 折叠（就地）。"""
        from mate_kernel.ontology.types.property_ import reduce_array_value

        for p in ot.properties:
            if not p.array or not p.reducer:
                continue
            slug = _prop_slug(p.rid.rid)
            for row in rows:
                if slug in row:
                    row[slug] = reduce_array_value(row[slug], p.reducer)

    def _attach_derived_pg(
        self,
        ot: ObjectType,
        rows: list[dict[str, Any]],
    ) -> None:
        """派生属性批量计算：每个 DerivedSpec 一条聚合 SQL，结果映射回行。

        方向由 LinkType 端点决定（本类是 src 端 → 行 rid 在 li.src）。
        count 缺省 0；sum/avg 无对端数值时 None（与内核 compute_derived_for_row
        同语义）。field 必须是完整 Property rid（DerivedSpec 契约）。
        """
        from mate_kernel.ontology.types.derived import derived_properties

        dprops = derived_properties(ot.properties)
        if not dprops or not rows:
            return
        row_rids = [r["__rid__"] for r in rows if r.get("__rid__")]
        if not row_rids:
            return
        conn, _ = self._connect()
        try:
            for p in dprops:
                spec = p.derived
                assert spec is not None
                try:
                    lt = self.get_link_type(ClassRef(spec.over_link))
                except KeyError:
                    continue
                if ot.rid.rid == lt.src.rid:
                    col, peer_col = "src", "dst"
                elif ot.rid.rid == lt.dst.rid:
                    col, peer_col = "dst", "src"
                else:
                    continue
                slug = _prop_slug(p.rid.rid)
                if spec.fn == "count":
                    cur_sql = (
                        f"SELECT li.{col} AS rid, COUNT(*) AS v "
                        f"FROM ont_link_instance li "
                        f"WHERE li.link_type_rid = %s AND li.{col} = ANY(%s) "
                        f"GROUP BY li.{col}"
                    )
                    q_params: list[Any] = [spec.over_link, row_rids]
                else:
                    field = spec.field or ""
                    if not _SAFE_JSON_KEY.match(field):
                        continue
                    agg = "SUM" if spec.fn == "sum" else "AVG"
                    cur_sql = (
                        f"SELECT li.{col} AS rid, {agg}((pi.props ->> '{field}')::numeric) AS v "
                        f"FROM ont_link_instance li "
                        f"JOIN ont_individual pi ON pi.rid = li.{peer_col} "
                        f"WHERE li.link_type_rid = %s AND li.{col} = ANY(%s) "
                        f"GROUP BY li.{col}"
                    )
                    q_params = [spec.over_link, row_rids]
                with self._cursor(conn) as cur:
                    cur.execute(cur_sql, q_params)
                    mapping = {
                        (r["rid"] if isinstance(r, dict) else r[0]): (
                            r["v"] if isinstance(r, dict) else r[1]
                        )
                        for r in cur.fetchall()
                    }
                for row in rows:
                    rid_key = row.get("__rid__")
                    if spec.fn == "count":
                        row[slug] = mapping.get(rid_key, 0)
                    else:
                        v = mapping.get(rid_key)
                        row[slug] = float(v) if v is not None else None
        finally:
            conn.close()

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
            _require_resolvable_field(f, set(slug_to_rid), kind="group_by")
            if not _SAFE_JSON_KEY.match(key):
                raise ValueError(f"unsafe group_by field {f!r}")
            select_parts.append(f"(props ->> '{key}') AS \"{f}\"")
            group_parts.append(f"(props ->> '{key}')")
        for m in agg.metrics:
            name = m.output_name()
            if m.fn == "count" and m.field is None:
                select_parts.append(f'COUNT(*) AS "{name}"')
                continue
            assert m.field is not None
            key = slug_to_rid.get(m.field, m.field)
            if not _SAFE_JSON_KEY.match(key):
                raise ValueError(f"unsafe metric field {m.field!r}")
            fn_sql = {"sum": "SUM", "count": "COUNT", "avg": "AVG", "min": "MIN", "max": "MAX"}[
                m.fn
            ]
            select_parts.append(f"{fn_sql}((props ->> '{key}')::numeric) AS \"{name}\"")

        sql = f"SELECT {', '.join(select_parts)} FROM ont_individual WHERE rid IN ({inner})"
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
        self,
        ind: Individual,
    ) -> list[tuple[str, str, str, str, str, list[float]]]:
        """Individual → [(chunk_id, individual_rid, class_rid, property_rid, value_text, vec)]。"""
        if self._embedder is None:
            return []
        out: list[tuple[str, str, str, str, str, list[float]]] = []
        for prop_ref, value in ind.props:
            slug = _prop_slug(prop_ref.rid)
            text = f"{slug} {value}"
            out.append(
                (
                    f"{ind.rid}#{prop_ref.rid}",
                    ind.rid,
                    ind.class_rid.rid,
                    prop_ref.rid,
                    str(value),
                    self._embedder.embed(text),
                )
            )
        return out

    def _index_individual_embeddings(self, conn: Any, ind: Individual) -> None:
        """index-on-write（best-effort：embedder 缺席或失败不阻断主写入）。

        真实缺陷修复（2026-09-11）：整个 embedding 写入包在 SAVEPOINT 里。
        此前维度不匹配的 embedding_vec INSERT 会使 PG 事务进入 aborted
        状态，后续 conn.commit() 变成 no-op——主行写入静默丢失（raw
        count 0）。SAVEPOINT 让失败只回滚 embedding，不影响主行提交。
        """
        try:
            chunks = self._embed_chunks(ind)
            if not chunks:
                return
            sp_n = 0
            with self._cursor(conn) as cur:
                for chunk_id, individual_rid, class_rid, property_rid, value_text, vec in chunks:
                    sp_n += 1
                    sp_name = f"embedding_index_{sp_n}"
                    # 每 chunk 独立 savepoint：单 chunk 失败只回滚该 chunk，
                    # 不污染事务（ cured 了早期"一个失败全事务 aborted"）
                    cur.execute(f"SAVEPOINT {sp_name}")
                    vec_written = False
                    if not getattr(self, "_pgvector_ready", False):
                        # 硬化：启动时升级可能因瞬时锁/连接问题静默失败
                        # （_initialized 防重跑）—— 首次写入时重试一次
                        try:
                            self._pgvector_ready = False
                            self._try_pgvector_upgrade()
                        except Exception:
                            pass
                    if getattr(self, "_pgvector_ready", False):
                        vec_literal = "[" + ",".join(f"{x:.6g}" for x in vec) + "]"
                        try:
                            cur.execute(
                                """
                                INSERT INTO ont_object_embedding
                                    (chunk_id, individual_rid, class_rid, property_rid,
                                     value_text, embedding, embedding_vec, tenant_id, created_at)
                                VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s, %s, now())
                                ON CONFLICT (chunk_id) DO UPDATE SET
                                    embedding = EXCLUDED.embedding,
                                    embedding_vec = EXCLUDED.embedding_vec,
                                    value_text = EXCLUDED.value_text,
                                    created_at = now()
                                """,
                                (
                                    chunk_id,
                                    individual_rid,
                                    class_rid,
                                    property_rid,
                                    value_text,
                                    json.dumps(vec),
                                    vec_literal,
                                    ind.tenant_id,
                                ),
                            )
                            vec_written = True
                        except Exception:
                            # 维度不匹配等 → ROLLBACK TO savepoint 回落 JSONB-only
                            # （裸 conn.rollback() 会连主行一起回滚）
                            try:
                                cur.execute(f"ROLLBACK TO SAVEPOINT {sp_name}")
                                cur.execute(f"SAVEPOINT {sp_name}")
                            except Exception:
                                pass
                    if not vec_written:
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
                                chunk_id,
                                individual_rid,
                                class_rid,
                                property_rid,
                                value_text,
                                json.dumps(vec),
                                ind.tenant_id,
                            ),
                        )
        except Exception:  # 索引失败不影响主路径
            import logging

            logging.getLogger(__name__).warning(
                "object_embedding_index_failed",
                extra={"rid": ind.rid},
            )

    # ───── G33：schema WIP 暂存 ─────

    def save_schema_wip(
        self, rid: str, payload: dict[str, Any], author: str = ""
    ) -> dict[str, Any]:
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    """INSERT INTO ont_schema_wip (rid, tenant_id, author, payload)
                       VALUES (%s, %s, %s, %s::jsonb)
                       ON CONFLICT (rid) DO UPDATE SET
                         payload = EXCLUDED.payload, author = EXCLUDED.author,
                         created_at = now()""",
                    (
                        rid,
                        self._current_tenant() or "tenant-default",
                        author,
                        json.dumps(payload, default=str),
                    ),
                )
            conn.commit()
            return {"rid": rid, "status": "staged"}
        finally:
            conn.close()

    def list_schema_wip(self) -> list[dict[str, Any]]:
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    "SELECT rid, author, payload, created_at FROM ont_schema_wip "
                    "ORDER BY created_at DESC"
                )
                return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def get_schema_wip(self, rid: str) -> dict[str, Any]:
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute("SELECT * FROM ont_schema_wip WHERE rid = %s", (rid,))
                row = cur.fetchone()
            if row is None:
                raise KeyError(f"wip not found: {rid}")
            return dict(row)
        finally:
            conn.close()

    def delete_schema_wip(self, rid: str) -> bool:
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute("DELETE FROM ont_schema_wip WHERE rid = %s", (rid,))
                deleted = cur.rowcount == 1
            conn.commit()
            return deleted
        finally:
            conn.close()

    # ───── G20：webhook 订阅 + 投递 ─────

    def upsert_webhook_subscription(self, decl: dict[str, Any]) -> dict[str, Any]:
        rid = decl.get("rid") or (
            "ont."
            + (decl.get("tenant_id") or "t")
            + ".wh."
            + decl["url"].split("//")[-1].replace("/", "_")[:40]
        )
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    """INSERT INTO ont_webhook_subscription
                       (rid, tenant_id, event_type, url, secret, active)
                       VALUES (%s,%s,%s,%s,%s,%s)
                       ON CONFLICT (rid) DO UPDATE SET
                         event_type=EXCLUDED.event_type, url=EXCLUDED.url,
                         secret=EXCLUDED.secret, active=EXCLUDED.active""",
                    (
                        rid,
                        decl.get("tenant_id") or self._current_tenant() or "tenant-default",
                        decl.get("event_type", "*"),
                        decl["url"],
                        decl.get("secret", ""),
                        bool(decl.get("active", True)),
                    ),
                )
            conn.commit()
            return {"rid": rid}
        finally:
            conn.close()

    def list_webhook_subscriptions(self) -> list[dict[str, Any]]:
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute("SELECT * FROM ont_webhook_subscription ORDER BY rid")
                return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def record_webhook_delivery(
        self,
        *,
        event_id: str,
        subscription_rid: str,
        status: str,
        attempts: int,
        last_error: str,
        tenant_id: str = "",
    ) -> None:
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    """INSERT INTO ont_webhook_delivery
                       (event_id, subscription_rid, status, attempts, last_error, tenant_id)
                       VALUES (%s,%s,%s,%s,%s,%s)""",
                    (event_id, subscription_rid, status, attempts, last_error, tenant_id),
                )
            conn.commit()
        finally:
            conn.close()

    def webhook_delivery_exists(self, event_id: str, subscription_rid: str) -> bool:
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    "SELECT 1 FROM ont_webhook_delivery WHERE event_id=%s "
                    "AND subscription_rid=%s AND status='delivered' LIMIT 1",
                    (event_id, subscription_rid),
                )
                return cur.fetchone() is not None
        finally:
            conn.close()

    def list_outbox_events(self, since_id: str = "0", limit: int = 50) -> list[dict[str, Any]]:
        """outbox 事件列（id 比较：PG 无自增 id → 用 created_at+event_id 序；
        since_id 取 event_id 字典序，v1 简化为全量窗口 limit）。"""
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    "SELECT * FROM ont_outbox_event ORDER BY created_at DESC LIMIT %s", (limit,)
                )
                return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()

    # ───── GOV-16~19：治理四件套 ─────

    def list_action_audit(
        self, limit: int = 100, action_rid: str | None = None
    ) -> list[dict[str, Any]]:
        """UI-04：执行历史查询（audit 行倒序；action_rid 过滤可选）。"""
        self._ensure_schema()
        conds = ""
        params: list[Any] = []
        if action_rid:
            conds = " WHERE action_rid = %s"
            params.append(action_rid)
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    "SELECT * FROM ont_action_audit" + conds + " ORDER BY created_at DESC LIMIT %s",
                    (*params, limit),
                )
                return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def record_usage(
        self, class_rid: str, op: str, count: int = 1, actor: str = "", source: str = ""
    ) -> None:
        """GOV-16：使用量打点（read/write；UPSERT 日聚合）。

        P1-7：actor（谁在读/写）/source（哪个应用）两个可选维度；
        缺省 '' 与旧数据同一聚合桶，向后兼容。best-effort。
        """
        tenant = self._current_tenant() or "tenant-default"
        try:
            conn, _ = self._connect()
            try:
                with self._cursor(conn) as cur:
                    cur.execute(
                        """INSERT INTO ont_usage_metric
                           (tenant_id, class_rid, op, day, count, actor, source)
                           VALUES (%s,%s,%s,CURRENT_DATE,%s,%s,%s)
                           ON CONFLICT (tenant_id, class_rid, op, day, actor, source)
                           DO UPDATE SET count = ont_usage_metric.count + EXCLUDED.count""",
                        (tenant, class_rid, op, count, actor or "", source or ""),
                    )
                conn.commit()
            finally:
                conn.close()
        except Exception:
            pass

    def usage_summary(self, days: int = 30) -> list[dict[str, Any]]:
        """GOV-16：近 N 天 per-type 使用量（reads/writes/total + active_days）。

        P1-7：聚合行新增 ``actors``（distinct 非空 actor 数）；结构只增不改。
        """
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    """SELECT class_rid,
                              SUM(count) FILTER (WHERE op='read') AS reads,
                              SUM(count) FILTER (WHERE op='write') AS writes,
                              COUNT(DISTINCT day) AS active_days,
                              COUNT(DISTINCT NULLIF(actor, '')) AS actors
                       FROM ont_usage_metric
                       WHERE day > CURRENT_DATE - %s::int
                       GROUP BY class_rid ORDER BY SUM(count) DESC""",
                    (days,),
                )
                return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def delete_object_type(self, rid: str, *, hard: bool = False) -> dict[str, Any]:
        """C8：删除 ObjectType（默认软删；hard=True 物理删，供清理演练残留）。

        保护（两级，与 GOV-17 同口径）：
        - 近 30 天有读使用量 → 拒绝（先 Deprecate）；
        - hard 删除且仍有实例 → 拒绝（避免对象宇宙出现悬空实例）。
        """
        from mate_kernel.ontology.identity.class_ref import ClassRef

        self.get_object_type(ClassRef(rid))  # 不存在 → KeyError
        usage = [
            u for u in self.usage_summary(30) if u["class_rid"] == rid and (u.get("reads") or 0) > 0
        ]
        if usage:
            raise ValueError(
                f"delete protection: {rid} has {usage[0]['reads']} reads in last 30d; "
                "deprecate first"
            )
        if not hard:
            return self.apply_lifecycle(rid, "delete") | {"hard": False}

        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute("SELECT count(*) FROM ont_individual WHERE class_rid = %s", (rid,))
                instances = cur.fetchone()[0]
                if instances:
                    raise ValueError(f"hard delete refused: {rid} still has {instances} instances")
                cur.execute("DELETE FROM ont_axiom WHERE %s = ANY(operands)", (rid,))
                cur.execute("DELETE FROM ont_object_type WHERE rid = %s", (rid,))
                deleted = cur.rowcount
            conn.commit()
        finally:
            conn.close()
        return {"class_rid": rid, "action": "delete", "hard": True, "rows": deleted}

    def delete_interface(self, rid: str) -> dict[str, Any]:
        """C8：删除 Interface（物理删；实现该接口的类型不级联，仅解除引用由
        ONT 层校验兜底 —— 有实现者时拒绝）。"""

        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute("SELECT 1 FROM ont_interface WHERE rid = %s", (rid,))
                if cur.fetchone() is None:
                    raise KeyError(f"interface not found: {rid}")
                cur.execute(
                    "SELECT count(*) FROM ont_object_type WHERE %s = ANY(interfaces)", (rid,)
                )
                impls = cur.fetchone()[0]
                if impls:
                    raise ValueError(f"delete refused: {rid} is implemented by {impls} types")
                cur.execute("DELETE FROM ont_interface WHERE rid = %s", (rid,))
                deleted = cur.rowcount
            conn.commit()
        finally:
            conn.close()
        return {"rid": rid, "deleted": deleted}

    def apply_lifecycle(self, class_rid: str, action: str, actor: str = "") -> dict[str, Any]:
        """GOV-17：Snooze/Deprecate/Delete 三级处置 + 删除保护。

        删除保护：近 30 天有 read 使用量的类型拒绝 delete（先 Deprecate）。
        snooze → status 不变 + 标记；deprecate → status='deprecated'；
        delete → 归档 + 移除数据。
        """
        from mate_kernel.ontology.identity.class_ref import ClassRef

        if action not in ("snooze", "deprecate", "delete"):
            raise ValueError(f"action must be snooze|deprecate|delete: {action!r}")
        ot = self.get_object_type(ClassRef(class_rid))
        if action == "delete":
            usage = [
                u
                for u in self.usage_summary(30)
                if u["class_rid"] == class_rid and (u.get("reads") or 0) > 0
            ]
            if usage:
                raise ValueError(
                    f"delete protection: {class_rid} has "
                    f"{usage[0]['reads']} reads in last 30d; deprecate first"
                )
        from dataclasses import replace as _replace

        if action == "deprecate":
            updated = _replace(ot, status="deprecated")
            self.upsert_object_type(updated)
            return {"class_rid": class_rid, "action": action, "status": "deprecated"}
        if action == "snooze":
            # snooze 是个人队列语义（v1 记审计事件即可）
            return {"class_rid": class_rid, "action": action, "status": ot.status}
        # delete：软删（archived）—— 与 MP-DEDUP-01 merge 同口径
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    "UPDATE ont_object_type SET archived = TRUE WHERE rid = %s", (class_rid,)
                )
            conn.commit()
        finally:
            conn.close()
        return {"class_rid": class_rid, "action": action, "archived": True}

    def append_timeseries(
        self, series_rid: str, points: list[dict[str, Any]], tenant_id: str | None = None
    ) -> int:
        """GOV-19：追加时序点 [{ts, value, attrs?}]（UPSERT on (series, ts)）。"""
        tenant = tenant_id or self._current_tenant() or "tenant-default"
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                for p in points:
                    cur.execute(
                        """INSERT INTO ont_timeseries_point
                           (series_rid, tenant_id, ts, value, attrs)
                           VALUES (%s,%s,%s,%s,%s::jsonb)
                           ON CONFLICT (series_rid, ts) DO UPDATE SET
                             value = EXCLUDED.value, attrs = EXCLUDED.attrs""",
                        (
                            series_rid,
                            tenant,
                            p["ts"],
                            float(p["value"]),
                            json.dumps(p.get("attrs") or {}),
                        ),
                    )
            conn.commit()
            return len(points)
        finally:
            conn.close()

    def query_timeseries(
        self, series_rid: str, start: str | None = None, end: str | None = None, limit: int = 10000
    ) -> list[dict[str, Any]]:
        """GOV-19：窗口查询（ts 升序）。"""
        self._ensure_schema()
        conds = ["series_rid = %s"]
        params: list[Any] = [series_rid]
        if start:
            conds.append("ts >= %s")
            params.append(start)
        if end:
            conds.append("ts <= %s")
            params.append(end)
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    "SELECT ts, value, attrs FROM ont_timeseries_point WHERE "
                    + " AND ".join(conds)
                    + " ORDER BY ts ASC LIMIT %s",
                    (*params, limit),
                )
                return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()

    # ───── DATA-14：背挂数据源声明 ─────

    def upsert_backing_datasource(self, decl: dict[str, Any]) -> dict[str, Any]:
        """声明/更新一个 backing datasource（kind v1=pg_table；secret 走 dsn_env）。

        可选 ``ts_column`` / ``last_synced_at`` / ``last_synced_pk``：增量游标
        （源端边界）。缺省不覆盖既有游标（``COALESCE``）。
        """
        rid = decl.get("rid") or (
            f"ont.{decl.get('tenant_id', 't')}.bds."
            f"{decl['class_rid'].split('.')[-2]}-{decl['name']}"
        )
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    """INSERT INTO ont_backing_datasource
                       (rid, tenant_id, class_rid, name, kind, dsn_env,
                        table_name, pk_column, field_mapping, priority, ts_column,
                        last_synced_at, last_synced_pk, updated_at)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s,now())
                       ON CONFLICT (rid) DO UPDATE SET
                         name=EXCLUDED.name, kind=EXCLUDED.kind,
                         dsn_env=EXCLUDED.dsn_env, table_name=EXCLUDED.table_name,
                         pk_column=EXCLUDED.pk_column,
                         field_mapping=EXCLUDED.field_mapping,
                         priority=EXCLUDED.priority, ts_column=EXCLUDED.ts_column,
                         last_synced_at=COALESCE(EXCLUDED.last_synced_at,
                                                 ont_backing_datasource.last_synced_at),
                         last_synced_pk=COALESCE(EXCLUDED.last_synced_pk,
                                                 ont_backing_datasource.last_synced_pk),
                         updated_at=now()""",
                    (
                        rid,
                        decl.get("tenant_id") or self._current_tenant() or "tenant-default",
                        decl["class_rid"],
                        decl["name"],
                        decl.get("kind", "pg_table"),
                        decl.get("dsn_env", "ONT_SOURCE_DSN"),
                        decl["table"],
                        decl["pk_column"],
                        json.dumps(decl.get("field_mapping") or {}),
                        int(decl.get("priority", 100)),
                        decl.get("ts_column") or "updated_at",
                        decl.get("last_synced_at"),
                        decl.get("last_synced_pk"),
                    ),
                )
            conn.commit()
            return {"rid": rid, "name": decl["name"]}
        finally:
            conn.close()

    def upsert_sourced_props(
        self,
        *,
        rid: str,
        tenant_id: str,
        class_rid: ClassRef,
        primary_key: str,
        values: dict[str, Any],
        source: str,
        priority: int,
        ts: Any,
    ) -> dict[str, Any]:
        """DATA-SYNC-INTEGRITY：按**字段级来源优先级**写入（跨批次生效）。

        规则（``props_src`` 记录每字段的 (prio, src)）：
        - 已有字段的来源优先级 ``<=`` 本次 → 跳过（低优先级/同级不得覆盖）；
        - 否则写入（``None`` 值 = 显式清空，同样受优先级约束）；
        - 用户编辑覆盖层由调用方（引擎）在 ``values`` 里剔除，此处不再判。
        返回 ``{written: n, skipped: m}``。
        """
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute("SELECT props_src FROM ont_individual WHERE rid = %s", (rid,))
                row = cur.fetchone()
                existing = dict(row.get("props_src") or {}) if row else {}
                write_props: dict[str, Any] = {}
                write_src: dict[str, Any] = {}
                skipped = 0
                for prop_rid, value in values.items():
                    prev = existing.get(prop_rid)
                    if isinstance(prev, dict) and int(prev.get("prio", 10**9)) < priority:
                        skipped += 1
                        continue
                    write_props[prop_rid] = value
                    write_src[prop_rid] = {"prio": priority, "src": source}
                if not write_props:
                    return {"written": 0, "skipped": skipped}
                cur.execute(
                    """
                    INSERT INTO ont_individual
                        (rid, tenant_id, class_rid, props, primary_key, marking,
                         created_at, updated_at, props_src)
                    VALUES (%s,%s,%s,%s::jsonb,%s,'{}',%s,%s,%s::jsonb)
                    ON CONFLICT (rid) DO UPDATE SET
                        props = ont_individual.props || EXCLUDED.props,
                        props_src = COALESCE(ont_individual.props_src, '{}'::jsonb)
                                    || EXCLUDED.props_src,
                        updated_at = EXCLUDED.updated_at
                    """,
                    (
                        rid,
                        tenant_id,
                        class_rid.rid,
                        json.dumps(write_props, default=str),
                        primary_key,
                        ts,
                        ts,
                        json.dumps(write_src),
                    ),
                )
            conn.commit()
            return {"written": len(write_props), "skipped": skipped}
        finally:
            conn.close()

    def upsert_sourced_props_batch(
        self,
        items: list[dict[str, Any]],
        *,
        tenant_id: str,
        class_rid: ClassRef,
        source: str,
        priority: int,
        ts: Any,
    ) -> dict[str, Any]:
        """``upsert_sourced_props`` 的批量版：一次 SELECT + 一次 execute_values + 一次提交。

        ``items``: ``[{"rid", "primary_key", "values": {prop_rid: value}}]``。
        优先级规则与单行版一致（``props_src`` 决定谁不得覆盖谁）。
        """
        self._ensure_schema()
        if not items:
            return {"written": 0, "skipped": 0}
        from psycopg2.extras import execute_values

        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                rids = [it["rid"] for it in items]
                cur.execute(
                    "SELECT rid, props_src FROM ont_individual WHERE rid = ANY(%s)", (rids,)
                )
                existing = {r["rid"]: dict(r["props_src"] or {}) for r in cur.fetchall()}
                rows: list[tuple[Any, ...]] = []
                skipped = 0
                for it in items:
                    prev = existing.get(it["rid"], {})
                    props: dict[str, Any] = {}
                    srcs: dict[str, Any] = {}
                    for prop_rid, value in it["values"].items():
                        p = prev.get(prop_rid)
                        if isinstance(p, dict) and int(p.get("prio", 10**9)) < priority:
                            skipped += 1
                            continue
                        props[prop_rid] = value
                        srcs[prop_rid] = {"prio": priority, "src": source}
                    if props:
                        rows.append(
                            (
                                it["rid"],
                                tenant_id,
                                class_rid.rid,
                                json.dumps(props, default=str),
                                it["primary_key"],
                                ts,
                                ts,
                                json.dumps(srcs),
                            )
                        )
                if rows:
                    execute_values(
                        cur,
                        """
                        INSERT INTO ont_individual
                            (rid, tenant_id, class_rid, props, primary_key, marking,
                             created_at, updated_at, props_src)
                        VALUES %s
                        ON CONFLICT (rid) DO UPDATE SET
                            props = ont_individual.props || EXCLUDED.props,
                            props_src = COALESCE(ont_individual.props_src, '{}'::jsonb)
                                        || EXCLUDED.props_src,
                            updated_at = EXCLUDED.updated_at
                        """,
                        rows,
                        template="(%s,%s,%s,%s::jsonb,%s,'{}',%s,%s,%s::jsonb)",
                    )
            conn.commit()
            return {"written": len(rows), "skipped": skipped}
        finally:
            conn.close()

    def _edit_overlay_for_class(self, tenant: str, cls_slug: str) -> dict[str, set[str]]:
        """writeback 双流合并：类前缀下的用户编辑覆盖层（rid → {prop_rid}）。"""
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    "SELECT individual_rid, property_rid FROM ont_edit_overlay "
                    "WHERE individual_rid LIKE %s",
                    (f"ont.{tenant}.ind.{cls_slug}.%",),
                )
                out: dict[str, set[str]] = {}
                for r in cur.fetchall():
                    out.setdefault(r["individual_rid"], set()).add(r["property_rid"])
            return out
        finally:
            conn.close()

    def delete_individual(self, rid: str) -> bool:
        """删实例 + 级联链接 + 清覆盖层。返回是否删除（False = 不存在）。"""
        self._ensure_schema()
        tenant = self._current_tenant() or "tenant-default"
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute("DELETE FROM ont_link_instance WHERE src = %s OR dst = %s", (rid, rid))
                cur.execute("DELETE FROM ont_edit_overlay WHERE individual_rid = %s", (rid,))
                cur.execute("DELETE FROM ont_individual WHERE rid = %s", (rid,))
                deleted = cur.rowcount == 1
            conn.commit()
            return deleted
        finally:
            conn.close()

    def list_backing_datasources(self, class_rid: str | None = None) -> list[dict[str, Any]]:
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                if class_rid:
                    cur.execute(
                        "SELECT * FROM ont_backing_datasource "
                        "WHERE class_rid = %s ORDER BY priority, name",
                        (class_rid,),
                    )
                else:
                    cur.execute("SELECT * FROM ont_backing_datasource ORDER BY priority, name")
                return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def sync_backing_datasources(
        self,
        class_rid: str,
        incremental: bool = False,
        *,
        batch_limit: int = 5000,
        delete_missing: bool = False,
    ) -> dict[str, Any]:
        """DATA-14/CDC：批量或增量同步（声明按 priority 序）。

        游标语义（DATA-SYNC-INTEGRITY）：增量按 ``(ts_column, pk) > (last_synced_at,
        last_synced_pk)`` **keyset** 过滤 —— 同时间戳靠 pk 决胜（不漏行）；同步后
        水位**只推进到已可靠处理的源端边界**，绝不写目标端 ``now()``（不丢更新）。
        失败行登记且**不越过**失败点 —— 下一轮重读即自动重试。

        返回 ``{ok, total_synced, total_failed, total_deleted, sources:{name:{...}}}``；
        ``ok=False`` = 存在失败行，调用方**不得**据此报整体成功。
        """
        from .backing_datasources import BackingDatasource, sync_backing_datasource

        decls = self.list_backing_datasources(class_rid)
        if not decls:
            raise KeyError(f"no backing datasources declared for {class_rid}")
        ot = self.get_object_type(ClassRef(class_rid))
        rid_parts = class_rid.split(".")
        tenant = self._current_tenant() or rid_parts[1]
        cls_slug = rid_parts[4] if len(rid_parts) >= 6 else rid_parts[3]
        overlay = self._edit_overlay_for_class(tenant, cls_slug)
        sources = [
            BackingDatasource(
                name=d["name"],
                kind=d["kind"],
                dsn_env=d["dsn_env"],
                table=d["table_name"],
                pk_column=d["pk_column"],
                field_mapping=dict((d.get("field_mapping") or {}).items()),
                priority=int(d.get("priority", 100)),
            )
            for d in decls
        ]

        def _iso(v: Any) -> Any:
            return v.isoformat() if hasattr(v, "isoformat") else v

        result = sync_backing_datasource(
            self,
            ot,
            sources,
            batch_limit=batch_limit,
            incremental=incremental,
            overlay_props=overlay,
            cursors={
                d["name"]: {"ts": _iso(d.get("last_synced_at")), "pk": d.get("last_synced_pk")}
                for d in decls
            },
            ts_columns={d["name"]: d.get("ts_column") or "updated_at" for d in decls},
            delete_missing=delete_missing,
        )

        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                for d in decls:
                    r = result.get(d["name"]) or {}
                    cur_ts = (r.get("cursor") or {}).get("ts")
                    cur_pk = (r.get("cursor") or {}).get("pk")
                    fails = r.get("failures") or []
                    last_err = str(fails[0].get("error", ""))[:300] if fails else ""
                    cur.execute(
                        "UPDATE ont_backing_datasource SET "
                        "last_synced_at = COALESCE(%s, last_synced_at), "
                        "last_synced_pk = COALESCE(%s, last_synced_pk), "
                        "last_error = %s, last_failed = %s "
                        "WHERE class_rid = %s AND name = %s",
                        (cur_ts, cur_pk, last_err, int(r.get("failed", 0)), class_rid, d["name"]),
                    )
            conn.commit()
        finally:
            conn.close()

        return {
            "ok": sum(int(r.get("failed", 0)) for r in result.values()) == 0,
            "total_synced": sum(int(r.get("synced", 0)) for r in result.values()),
            "total_failed": sum(int(r.get("failed", 0)) for r in result.values()),
            "total_deleted": sum(int(r.get("deleted", 0)) for r in result.values()),
            "sources": result,
        }

    def apply_cdc_changes(self, class_rid: str, changes: list[dict[str, Any]]) -> dict[str, int]:
        """CDC 流式绑定入口（debezium / mate-tech-etl 变更事件）。

        mapping 缺省取 priority 最高声明的 field_mapping；upsert 尊重
        用户编辑覆盖层；delete 走 delete_individual（含级联清理）。
        """
        from .backing_datasources import apply_cdc_changes as _apply

        decls = self.list_backing_datasources(class_rid)
        if not decls:
            raise KeyError(f"no backing datasources declared for {class_rid}")
        ot = self.get_object_type(ClassRef(class_rid))
        rid_parts = class_rid.split(".")
        tenant = self._current_tenant() or rid_parts[1]
        cls_slug = rid_parts[4] if len(rid_parts) >= 6 else rid_parts[3]
        overlay = self._edit_overlay_for_class(tenant, cls_slug)
        top = decls[0]
        return _apply(
            self,
            ot,
            changes,
            pk_column=top["pk_column"],
            field_mapping=dict((top.get("field_mapping") or {}).items()),
            overlay_props=overlay,
            default_priority=int(top.get("priority", 100)),
        )

    def materialize_object_type(self, class_rid: str, limit: int = 10000) -> dict[str, Any]:
        """DATA-15：对象当前状态 → 行集（materialization 读端点）。"""
        from .backing_datasources import materialize_object_type as _mat

        return _mat(self, class_rid, limit=limit)

    # ───── SEC-12：行列级安全策略（存储 + 执行）─────

    def upsert_security_policy(self, policy: dict[str, Any]) -> dict[str, Any]:
        """row/column 策略 upsert。字段：rid/kind/class_rid/property_rid/
        field/op/value/markings（row: bypass_markings；column: required_markings）。"""
        import uuid as _uuid

        rid = (
            policy.get("rid")
            or f"ont.{policy.get('tenant_id', 't')}.secpol.{_uuid.uuid4().hex[:8]}"
        )
        tenant = policy.get("tenant_id") or self._current_tenant() or "tenant-default"
        kind = policy["kind"]
        if kind not in ("row", "column"):
            raise ValueError("policy.kind must be row|column")
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    """INSERT INTO ont_security_policy
                       (rid, tenant_id, kind, class_rid, property_rid, field, op,
                        value, markings, updated_at)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s,now())
                       ON CONFLICT (rid) DO UPDATE SET
                         kind=EXCLUDED.kind, class_rid=EXCLUDED.class_rid,
                         property_rid=EXCLUDED.property_rid, field=EXCLUDED.field,
                         op=EXCLUDED.op, value=EXCLUDED.value,
                         markings=EXCLUDED.markings, updated_at=now()""",
                    (
                        rid,
                        tenant,
                        kind,
                        policy.get("class_rid", ""),
                        policy.get("property_rid", ""),
                        policy.get("field", ""),
                        policy.get("op", ""),
                        json.dumps(policy.get("value"), default=str),
                        list(policy.get("markings", ()))
                        or list(policy.get("bypass_markings", ()))
                        or list(policy.get("required_markings", ())),
                    ),
                )
            conn.commit()
            return {"rid": rid, "kind": kind, "tenant_id": tenant}
        finally:
            conn.close()

    def list_security_policies(self) -> list[dict[str, Any]]:
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute("SELECT * FROM ont_security_policy ORDER BY rid")
                return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def delete_security_policy(self, rid: str) -> bool:
        """删除安全策略 —— 按当前租户过滤（ADR-0064 后同族守门实测发现：
        policy rid 是 ``pol-`` 前缀，走不了 ``ont.{tenant}.`` 前缀守门，
        必须在 SQL 层带 tenant 条件，否则可跨租户删除）。"""
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                tenant = self._current_tenant()
                if tenant:
                    cur.execute(
                        "DELETE FROM ont_security_policy WHERE rid = %s AND tenant_id = %s",
                        (rid, tenant),
                    )
                else:
                    cur.execute("DELETE FROM ont_security_policy WHERE rid = %s", (rid,))
                deleted = cur.rowcount == 1
            conn.commit()
            return deleted
        finally:
            conn.close()

    def _policy_set(self) -> Any:
        """行/列策略 → kernel SecurityPolicySet（本租户）。"""
        from mate_kernel.ontology.security_policies import (
            ColumnPolicy,
            RowPolicy,
            SecurityPolicySet,
        )

        rows_, cols_ = [], []
        for r in self.list_security_policies():
            markings = tuple(r.get("markings") or ())
            if r["kind"] == "row":
                rows_.append(
                    RowPolicy(
                        class_rid=r.get("class_rid", ""),
                        field=r.get("field", ""),
                        op=r.get("op", ""),
                        value=r.get("value"),
                        bypass_markings=markings,
                    )
                )
            else:
                cols_.append(
                    ColumnPolicy(property_rid=r.get("property_rid", ""), required_markings=markings)
                )
        return SecurityPolicySet(row_policies=tuple(rows_), column_policies=tuple(cols_))

    def _ancestors_of_class(self, class_rid: str) -> frozenset[str]:
        """类的全部祖先（subclass 公理闭包，EXP-01 联动）。"""
        rid_by_slug: dict[str, set[str]] = {}
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute("SELECT rid FROM ont_object_type WHERE rid LIKE %s", ("ont.%.obj.%.%",))
                for row in cur.fetchall():
                    parts = row["rid"].split(".")
                    if len(parts) >= 6:
                        rid_by_slug.setdefault(parts[4], set()).add(row["rid"])
        finally:
            conn.close()
        pairs: list[tuple[str, str]] = []
        for r in self.list_axiom_records("", enabled_only=False):
            if r.get("kind") != "subclass":
                continue
            ops = r.get("operands") or []
            if len(ops) >= 2 and ops[1]:
                subs = {ops[0]} if ops[0].startswith("ont.") else rid_by_slug.get(ops[0], set())
                sups = {ops[1]} if ops[1].startswith("ont.") else rid_by_slug.get(ops[1], set())
                pairs.extend((a, b) for a in subs for b in sups)
        if not pairs:
            return frozenset({class_rid})
        from mate_kernel.ontology.reasoning.engine import _subclass_closure

        anc = _subclass_closure(pairs).get(class_rid, set())
        return frozenset({class_rid} | anc)

    def _individual_by_rid(self, rid: str) -> Any:
        """ADR-0064 S2：闸门用 —— rid → Individual | None（跨连接只读）。"""
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute("SELECT * FROM ont_individual WHERE rid = %s", (rid,))
                row = cur.fetchone()
                return _row_to_individual(row) if row is not None else None
        finally:
            conn.close()

    def _class_markings_of(self, class_rid: str) -> tuple[str, ...]:
        """G6：类型 marking（含祖先类型 —— schema 血缘传播）。"""
        anc = self._ancestors_of_class(class_rid)
        out: set[str] = set()
        if not anc:
            return ()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    "SELECT marking FROM ont_object_type WHERE rid = ANY(%s)", (sorted(anc),)
                )
                for row in cur.fetchall():
                    out.update(row.get("marking") or [])
        finally:
            conn.close()
        return tuple(out)

    def enforce_read_policies(
        self,
        individuals: list[Any],
        viewer_markings: list[str] | tuple[str, ...],
    ) -> list[Any]:
        """行策略 + G6 marking 门（读端点调用；分页前）。"""
        from mate_kernel.ontology.security_policies import (
            filter_by_markings,
            filter_visible_individuals,
        )

        ps = self._policy_set()
        if ps.row_policies:
            individuals = filter_visible_individuals(
                individuals,
                ps,
                viewer_markings,
                ancestor_classes_of=self._ancestors_of_class,
            )
        # G6：实例 marking ⊆ viewer ∧ 类型 marking（含祖先）⊆ viewer
        return filter_by_markings(
            individuals, viewer_markings, class_marking_of=self._class_markings_of
        )

    def mask_rows(
        self,
        rows: list[dict[str, Any]],
        viewer_markings: list[str] | tuple[str, ...],
    ) -> list[dict[str, Any]]:
        """列策略脱敏（值置 None，对象仍可见）。"""
        from mate_kernel.ontology.security_policies import mask_property_values

        ps = self._policy_set()
        if not ps.column_policies:
            return rows
        for r in rows:
            mask_property_values(r, ps, viewer_markings)
        return rows

    def _marking_visible_rids(
        self, rids: list[str], viewer_markings: tuple[str, ...] | list[str]
    ) -> set[str]:
        """G6：卡片按实例/类型 marking 过滤后可见的 rid 集。"""
        if not rids:
            return set()
        from mate_kernel.ontology.security_policies import filter_by_markings

        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute("SELECT * FROM ont_individual WHERE rid = ANY(%s)", (rids,))
                inds = [_row_to_individual(r) for r in cur.fetchall()]
        finally:
            conn.close()
        return {
            i.rid
            for i in filter_by_markings(
                inds, viewer_markings, class_marking_of=self._class_markings_of
            )
        }

    def search_objects(
        self,
        text: str,
        class_rid: str | None = None,
        top_k: int = 5,
        tenant_id: str | None = None,
        viewer_markings: tuple[str, ...] | list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """语义检索 → 对象卡片（带 rid 可追溯；G6 marking 过滤可选）。

        tenant_id 显式传入优先（``_call_scoped`` 经 asyncio.to_thread 执行；
        F8 后 tenant 走 ContextVar 已能跨线程，但显式参数仍是 RLS 之外的
        第二道防线，13 硬规则 #3）。
        """
        if self._embedder is None:
            return []
        from .object_search import build_card, cosine

        qvec = self._embedder.embed(text)
        tenant = tenant_id or self._current_tenant()
        self._ensure_schema()
        rows: list[dict[str, Any]] = []
        if getattr(self, "_pgvector_ready", False):
            # AI-09：pgvector KNN（HNSW 余弦距离），score = 1 - distance
            vec_literal = "[" + ",".join(f"{x:.6g}" for x in qvec) + "]"
            conds = ["embedding_vec IS NOT NULL"]
            params: list[Any] = []
            if tenant:
                conds.append("tenant_id = %s")
                params.append(tenant)
            if class_rid:
                conds.append("class_rid = %s")
                params.append(class_rid)
            sql = (
                "SELECT *, 1 - (embedding_vec <=> %s::halfvec) AS _score "
                "FROM ont_object_embedding WHERE "
                + " AND ".join(conds)
                + " ORDER BY embedding_vec <=> %s::halfvec LIMIT %s"
            )
            q_params = [vec_literal, *params, vec_literal, max(top_k * 12, 24)]
            conn, _ = self._connect()
            try:
                with self._cursor(conn) as cur:
                    cur.execute(sql, q_params)
                    raw = cur.fetchall()
            finally:
                conn.close()
            per_individual: dict[str, list[dict[str, Any]]] = {}
            class_of: dict[str, str] = {}
            for r in raw:
                score = float(r["_score"]) if r.get("_score") is not None else 0.0
                if score <= 0.0:
                    continue
                class_of[r["individual_rid"]] = r["class_rid"]
                per_individual.setdefault(r["individual_rid"], []).append(
                    {
                        "property_rid": r["property_rid"],
                        "value_text": r["value_text"],
                        "score": score,
                    }
                )
            cards = []
            for individual_rid, matched in per_individual.items():
                matched.sort(key=lambda m: m["score"], reverse=True)
                cards.append(build_card(individual_rid, class_of[individual_rid], matched[:3]))
            cards.sort(key=lambda c: c["score"], reverse=True)
            cards = cards[:top_k]
            if viewer_markings:
                visible = self._marking_visible_rids(
                    [c["individual_rid"] for c in cards], viewer_markings
                )
                cards = [c for c in cards if c["individual_rid"] in visible]
            return cards

        conds: list[str] = []
        params = []
        if tenant:
            conds.append("tenant_id = %s")
            params.append(tenant)
        if class_rid:
            conds.append("class_rid = %s")
            params.append(class_rid)
        sql = "SELECT * FROM ont_object_embedding"
        if conds:
            sql += " WHERE " + " AND ".join(conds)
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
            per_individual.setdefault(r["individual_rid"], []).append(
                {
                    "property_rid": r["property_rid"],
                    "value_text": r["value_text"],
                    "score": score,
                }
            )
        cards: list[dict[str, Any]] = []
        for individual_rid, matched in per_individual.items():
            matched.sort(key=lambda m: m["score"], reverse=True)
            cards.append(build_card(individual_rid, class_of[individual_rid], matched[:3]))
        cards.sort(key=lambda c: c["score"], reverse=True)
        cards = cards[:top_k]
        if viewer_markings:
            visible = self._marking_visible_rids(
                [c["individual_rid"] for c in cards], viewer_markings
            )
            cards = [c for c in cards if c["individual_rid"] in visible]
        return cards

    def search_objects_hybrid(
        self,
        text: str,
        class_rid: str | None = None,
        top_k: int = 5,
        tenant_id: str | None = None,
        k_rrf: int = 60,
        viewer_markings: tuple[str, ...] | list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """AI-09：混合检索（关键词 + 向量 + RRF 融合，调研材料 03 §OAG）。

        RRFscore(d) = Σ 1/(k + rank_i(d))；两路各自取 top 3*top_k 后融合。
        关键词路 = value_text/token ILIKE；向量路复用 search_objects。
        """
        import re as _re

        tenant = tenant_id or self._current_tenant()
        self._ensure_schema()
        tokens = [t for t in _re.split(r"\s+", text.strip()) if len(t) >= 2][:8] or [text.strip()]
        conds: list[str] = []
        params: list[Any] = []
        if tenant:
            conds.append("tenant_id = %s")
            params.append(tenant)
        if class_rid:
            conds.append("class_rid = %s")
            params.append(class_rid)
        like_clauses = " OR ".join("value_text ILIKE %s" for _ in tokens)
        sql = (
            "SELECT * FROM ont_object_embedding WHERE ("
            + like_clauses
            + ")"
            + (" AND " + " AND ".join(conds) if conds else "")
            + " ORDER BY created_at DESC LIMIT %s"
        )
        like_params = [f"%{t}%" for t in tokens]
        kw_rows: list[dict[str, Any]] = []
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(sql, [*like_params, *params, max(top_k * 6, 12)])
                kw_rows = cur.fetchall()
        finally:
            conn.close()

        # 关键词路按 (individual, 命中位置) 排名
        kw_rank: dict[str, int] = {}
        kw_meta: dict[str, dict[str, Any]] = {}
        for _i, r in enumerate(kw_rows):
            irid = r["individual_rid"]
            if irid not in kw_rank:
                kw_rank[irid] = len(kw_rank) + 1
                kw_meta[irid] = r

        # 向量路（G6 marking 透传）
        vec_cards = self.search_objects(
            text, class_rid, top_k * 3, tenant_id, viewer_markings=viewer_markings
        )
        vec_rank: dict[str, int] = {c["individual_rid"]: i + 1 for i, c in enumerate(vec_cards)}

        all_rids = set(kw_rank) | set(vec_rank)
        class_of = {c["individual_rid"]: c["class_rid"] for c in vec_cards}
        for irid, r in kw_meta.items():
            class_of.setdefault(irid, r["class_rid"])

        def _rrf(irid: str) -> float:
            score = 0.0
            if irid in kw_rank:
                score += 1.0 / (k_rrf + kw_rank[irid])
            if irid in vec_rank:
                score += 1.0 / (k_rrf + vec_rank[irid])
            return score

        fused = sorted(all_rids, key=_rrf, reverse=True)[:top_k]
        if viewer_markings:
            visible = self._marking_visible_rids(list(all_rids), viewer_markings)
            fused = [r for r in fused if r in visible]
        cards: list[dict[str, Any]] = []
        for irid in fused:
            kw_hit = kw_meta.get(irid)
            matched = [
                {
                    "property_rid": kw_hit["property_rid"] if kw_hit else "",
                    "value_text": kw_hit["value_text"] if kw_hit else "",
                    "score": _rrf(irid),
                }
            ]
            cards.append(
                {
                    "individual_rid": irid,
                    "class_rid": class_of.get(irid, ""),
                    "score": _rrf(irid),
                    "matched": matched,
                    "card_text": f"{irid}:\n- {matched[0]['value_text']}",
                    "legs": {
                        "keyword_rank": kw_rank.get(irid),
                        "vector_rank": vec_rank.get(irid),
                    },
                }
            )
        return cards

    def reindex_object_embeddings(self, tenant_id: str | None = None) -> int:
        """存量补齐：租户内全量 Individual 重嵌入（返回索引数；tenant 显式传参优先）。"""
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            tenant = tenant_id or self._current_tenant()
            with self._cursor(conn) as cur:
                if tenant:
                    cur.execute(
                        "SELECT * FROM ont_individual WHERE tenant_id = %s",
                        (tenant,),
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

    @staticmethod
    def _proposal_tenant_id(action_rid: str) -> str:
        parts = action_rid.split(".")
        return parts[1] if len(parts) > 1 else ""

    @staticmethod
    def _append_proposal_event(
        cur: Any,
        *,
        proposal_id: str,
        tenant_id: str,
        from_status: str | None,
        to_status: str,
        actor_id: str | None,
        created_at: Any | None = None,
    ) -> None:
        cur.execute(
            """
            INSERT INTO ont_proposal_event
                (proposal_id, tenant_id, from_status, to_status, actor_id, created_at)
            VALUES (%s, %s, %s, %s, %s, COALESCE(%s, now()))
            """,
            (proposal_id, tenant_id, from_status, to_status, actor_id, created_at),
        )

    @staticmethod
    def _proposal_request_fingerprint(
        *,
        operation: str,
        proposal_id: str,
        actor_id: str | None,
    ) -> str:
        payload = json.dumps(
            {"operation": operation, "proposal_id": proposal_id, "actor_id": actor_id or ""},
            sort_keys=True,
            separators=(",", ":"),
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def _replay_idempotent_proposal(
        self,
        *,
        tenant_id: str,
        operation: str,
        idempotency_key: str | None,
        proposal_id: str,
        request_fingerprint: str,
    ) -> Any | None:
        if not idempotency_key:
            return None
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    """
                    SELECT proposal_id, request_fingerprint
                    FROM ont_proposal_idempotency
                    WHERE tenant_id = %s AND operation = %s AND idempotency_key = %s
                    """,
                    (tenant_id, operation, idempotency_key),
                )
                row = cur.fetchone()
        finally:
            conn.close()
        if row is None:
            return None
        if row["proposal_id"] != proposal_id or row["request_fingerprint"] != request_fingerprint:
            raise ValueError("idempotency key conflicts with a different proposal command")
        return self.get_proposal(proposal_id)

    def propose_action(
        self,
        action_rid: ClassRef,
        parameters: dict[str, Any],
        target_iid: str | None,
        impact_summary: str,
        expected_diff: dict[str, Any] | None = None,
        kind: str = "action",
        provenance: dict[str, Any] | None = None,
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
        # ONT-PROV-01：provenance 统一存 parameters（PG JSONB 持久化 + 引擎镜像
        # 同源）；显式传入与 parameters 自带 merge，显式优先。
        params: dict[str, Any] = dict(parameters)
        if provenance:
            params["provenance"] = {**(params.get("provenance") or {}), **provenance}
        prop = self._action_service.propose(
            action_rid=subject,
            parameters=params,
            target_iid=target_iid,
            impact_summary=impact_summary,
            expected_diff=expected_diff,
            kind=kind,
            provenance=params.get("provenance"),
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
                        self._proposal_tenant_id(subject),
                        subject,
                        target_iid,
                        json.dumps(params, default=str),
                        impact_summary,
                        json.dumps(expected_diff or {}, default=str),
                        prop.status.value,
                        kind,
                        prop.created_at,
                    ),
                )
                self._append_proposal_event(
                    cur,
                    proposal_id=prop.proposal_id,
                    tenant_id=self._proposal_tenant_id(subject),
                    from_status=None,
                    to_status=prop.status.value,
                    actor_id=None,
                    created_at=prop.created_at,
                )
            conn.commit()
            return prop
        finally:
            conn.close()

    def propose_create_instance(
        self,
        class_rid: str,
        props: dict[str, Any],
        impact_summary: str,
        expected_diff: dict[str, Any] | None = None,
        provenance: dict[str, Any] | None = None,
    ) -> Any:
        """MP-SAL-04b：文本抽取字段 → 新建实例提议（subject=class rid）。

        ONT-PROV-01：provenance 随 parameters 存提案，execute 落实例。
        """
        return self.propose_action(
            ClassRef(class_rid),
            {"props": dict(props), "provenance": dict(provenance or {})},
            None,
            impact_summary,
            expected_diff,
            kind="create_instance",
        )

    def propose_model_type(
        self,
        type_def: dict[str, Any],
        impact_summary: str,
        provenance: dict[str, Any] | None = None,
    ) -> Any:
        """MP-SAL-04b：文本→新类型定义提议（subject=新类型 rid）。

        ONT-PROV-01：provenance 随 parameters 存档（模型提案无实例载体）。
        """
        if not isinstance(type_def, dict) or "rid" not in type_def:
            raise ValueError("type_def must carry 'rid'")
        return self.propose_action(
            ClassRef(str(type_def["rid"])),
            {"type_def": type_def, "provenance": dict(provenance or {})},
            None,
            impact_summary,
            {"+type": type_def["rid"]},
            kind="model_type",
        )

    def get_proposal(self, proposal_id: str) -> Any:
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    "SELECT * FROM ont_proposal WHERE proposal_id = %s",
                    (proposal_id,),
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

    def list_proposal_events(self, proposal_id: str) -> list[dict[str, Any]]:
        """Return ordered lifecycle evidence for one tenant-scoped proposal."""
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    """
                    SELECT proposal_id, tenant_id, from_status, to_status, actor_id, created_at
                    FROM ont_proposal_event
                    WHERE proposal_id = %s
                    ORDER BY event_id ASC
                    """,
                    (proposal_id,),
                )
                rows = cur.fetchall()
        finally:
            conn.close()
        return [dict(row) for row in rows]

    # ─────────── PRD-02（MP-ACTION-CONFIRM-01）：withdraw / revert ───────────

    _REVERT_WINDOW_DAYS = 7  # FR-ACT-CONFIRM-006（对齐决策 C3）

    def withdraw_proposal(self, proposal_id: str, *, actor_id: str = "") -> dict[str, Any]:
        """pending → withdrawn（作者确认前撤回；终态）。幂等键 actor 维度。"""
        p = self.get_proposal(proposal_id)
        self._action_service.withdraw_proposal(proposal_id, by=actor_id)
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    "UPDATE ont_proposal SET status='withdrawn' WHERE proposal_id=%s",
                    (proposal_id,),
                )
                self._append_proposal_event(
                    cur,
                    proposal_id=proposal_id,
                    tenant_id=self._proposal_tenant_id(p.action_rid),
                    from_status="pending",
                    to_status="withdrawn",
                    actor_id=actor_id or None,
                )
            conn.commit()
        finally:
            conn.close()
        return {"proposal_id": proposal_id, "status": "withdrawn"}

    def revert_proposal(
        self,
        proposal_id: str,
        *,
        actor_id: str = "",
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        """executed → reverted（人审撤销 + 补偿；FR-ACT-CONFIRM-002..004/006）。

        - create_instance → 删除该实例（I1 ≃ 等价：等价于从未创建）
        - model_type / action → audit-only revert（不可数值逆写，降级 partial）
        - 超出 7 天窗口 → 拒绝（409 语义由 API 层翻译）
        """
        from datetime import UTC as _UTC
        from datetime import datetime as _dt

        p = self.get_proposal(proposal_id)
        if p.status.value != "executed":
            raise ValueError(
                f"proposal {proposal_id} is {p.status.value}; revert requires executed"
            )
        # 时窗（FR-ACT-CONFIRM-006）
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    "SELECT applied_at FROM ont_proposal WHERE proposal_id=%s",
                    (proposal_id,),
                )
                row = cur.fetchone()
        finally:
            conn.close()
        # cursor 可能是 dict 型（RealDictCursor）——两种取法都兼容
        if isinstance(row, dict):
            applied_at = row.get("applied_at")
        else:
            applied_at = row[0] if row else None
        if applied_at is not None:
            age_days = (_dt.now(_UTC) - applied_at).days
            if age_days > self._REVERT_WINDOW_DAYS:
                raise ValueError(
                    f"revert window ({self._REVERT_WINDOW_DAYS}d) exceeded: "
                    f"applied {age_days}d ago (audit-only retrival remains)"
                )

        execution = self.get_proposal_execution(proposal_id) or {}
        equivalence = "partial"  # audit-only 默认降级
        compensated: dict[str, Any] = {}

        if p.kind == "create_instance":
            ind_rid = str(execution.get("individual_rid") or "")
            if ind_rid:
                conn, _ = self._connect()
                try:
                    with self._cursor(conn) as cur:
                        cur.execute(
                            "DELETE FROM ont_individual WHERE rid=%s",
                            (ind_rid,),
                        )
                        deleted = cur.rowcount
                    conn.commit()
                finally:
                    conn.close()
                # I1 ≃ 等价判定：实例确已消失（FR-ACT-CONFIRM-004）
                try:
                    self.get_individual(ind_rid)
                    equivalence = "partial"
                except KeyError:
                    equivalence = "equivalent" if deleted else "partial"
                compensated = {"deleted_individual": ind_rid, "rows": deleted}
        elif p.kind == "merge_suggestion":
            # merge 不可数值逆写 → audit-only（partial）
            compensated = {"note": "merge reversal is audit-only"}
        elif p.kind == "edit_set" or (p.kind == "action" and execution.get("inverse")):
            # ACT-07 / ADR-0064：逆编辑补偿（执行期 invert_edits 已排除不可逆项）。
            # kind=action 经统一执行器执行的声明式/混合式，execution 同样带 inverse
            # —— 有逆编辑就按同一补偿路径（legacy function 式 execution 无 inverse，
            # 自然落 audit-only partial）。
            inverse_edits = list(execution.get("inverse") or [])
            non_inv = list(execution.get("non_invertible") or [])
            if inverse_edits:
                comp = self.apply_edit_set_now(
                    p.action_rid,
                    p.target_iid,
                    {},
                    inverse_edits,
                    actor=actor_id or "revert",
                    impact_summary=f"revert compensation for {proposal_id}",
                )
                equivalence = "equivalent" if not non_inv else "partial"
                compensated = {
                    "applied_count": comp.get("applied_count"),
                    "audit_id": comp.get("audit_id"),
                    "non_invertible": non_inv,
                }
            else:
                compensated = {"note": "nothing invertible", "non_invertible": non_inv}

        self._action_service.mark_reverted(proposal_id)
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    "UPDATE ont_proposal SET status='reverted' WHERE proposal_id=%s",
                    (proposal_id,),
                )
                self._append_proposal_event(
                    cur,
                    proposal_id=proposal_id,
                    tenant_id=self._proposal_tenant_id(p.action_rid),
                    from_status="executed",
                    to_status="reverted",
                    actor_id=actor_id or None,
                )
            conn.commit()
        finally:
            conn.close()
        result = {
            "proposal_id": proposal_id,
            "status": "reverted",
            "kind": p.kind,
            "equivalence": equivalence,
            "compensation": compensated,
        }
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    """INSERT INTO ont_proposal_execution (proposal_id, tenant_id, result)
                       VALUES (%s, %s, %s::jsonb)
                       ON CONFLICT (proposal_id) DO UPDATE SET result = EXCLUDED.result""",
                    (
                        proposal_id,
                        self._proposal_tenant_id(p.action_rid),
                        __import__("json").dumps({"revert": result}, default=str),
                    ),
                )
            conn.commit()
        finally:
            conn.close()
        return result

    def get_proposal_execution(self, proposal_id: str) -> dict[str, Any]:
        """Return the durable result emitted by a completed proposal execution."""
        self._ensure_schema()
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    "SELECT result FROM ont_proposal_execution WHERE proposal_id = %s",
                    (proposal_id,),
                )
                row = cur.fetchone()
        finally:
            conn.close()
        if row is None:
            raise KeyError(f"proposal execution not found: {proposal_id}")
        result = row["result"]
        return dict(result if isinstance(result, dict) else json.loads(result))

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

    def _persist_proposal_transition(
        self,
        prop: Any,
        *,
        from_status: str,
        actor_id: str | None,
        operation: str | None = None,
        idempotency_key: str | None = None,
        request_fingerprint: str | None = None,
        execution_result: dict[str, Any] | None = None,
    ) -> None:
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    """
                    UPDATE ont_proposal
                    SET status = %s, confirmed_by = %s, confirmed_at = %s,
                        applied_at = CASE WHEN %s = 'executed' THEN now() ELSE applied_at END
                    WHERE proposal_id = %s
                    """,
                    (
                        prop.status.value,
                        prop.confirmed_by,
                        prop.confirmed_at,
                        prop.status.value,
                        prop.proposal_id,
                    ),
                )
                self._append_proposal_event(
                    cur,
                    proposal_id=prop.proposal_id,
                    tenant_id=self._proposal_tenant_id(prop.action_rid),
                    from_status=from_status,
                    to_status=prop.status.value,
                    actor_id=actor_id,
                )
                if idempotency_key and operation and request_fingerprint:
                    cur.execute(
                        """
                        INSERT INTO ont_proposal_idempotency
                            (tenant_id, operation, idempotency_key, proposal_id, request_fingerprint)
                        VALUES (%s, %s, %s, %s, %s)
                        """,
                        (
                            self._proposal_tenant_id(prop.action_rid),
                            operation,
                            idempotency_key,
                            prop.proposal_id,
                            request_fingerprint,
                        ),
                    )
                if execution_result is not None:
                    cur.execute(
                        """
                        INSERT INTO ont_proposal_execution (proposal_id, tenant_id, result)
                        VALUES (%s, %s, %s::jsonb)
                        ON CONFLICT (proposal_id) DO UPDATE SET result = EXCLUDED.result
                        """,
                        (
                            prop.proposal_id,
                            self._proposal_tenant_id(prop.action_rid),
                            json.dumps(execution_result, default=str),
                        ),
                    )
            conn.commit()
        finally:
            conn.close()

    def confirm_proposal(
        self,
        proposal_id: str,
        confirmed_by: str = "",
        idempotency_key: str | None = None,
    ) -> Any:
        key = (idempotency_key or "").strip() or None
        current = self.get_proposal(proposal_id)
        fingerprint = self._proposal_request_fingerprint(
            operation="confirm",
            proposal_id=proposal_id,
            actor_id=confirmed_by or None,
        )
        replayed = self._replay_idempotent_proposal(
            tenant_id=self._proposal_tenant_id(current.action_rid),
            operation="confirm",
            idempotency_key=key,
            proposal_id=proposal_id,
            request_fingerprint=fingerprint,
        )
        if replayed is not None:
            return replayed
        prop = self._action_service.confirm_proposal(proposal_id, confirmed_by=confirmed_by)
        self._persist_proposal_transition(
            prop,
            from_status="pending",
            actor_id=confirmed_by or None,
            operation="confirm",
            idempotency_key=key,
            request_fingerprint=fingerprint,
        )
        return prop

    def reject_proposal(
        self,
        proposal_id: str,
        confirmed_by: str = "",
        idempotency_key: str | None = None,
    ) -> Any:
        key = (idempotency_key or "").strip() or None
        current = self.get_proposal(proposal_id)
        fingerprint = self._proposal_request_fingerprint(
            operation="reject",
            proposal_id=proposal_id,
            actor_id=confirmed_by or None,
        )
        replayed = self._replay_idempotent_proposal(
            tenant_id=self._proposal_tenant_id(current.action_rid),
            operation="reject",
            idempotency_key=key,
            proposal_id=proposal_id,
            request_fingerprint=fingerprint,
        )
        if replayed is not None:
            return replayed
        prop = self._action_service.reject_proposal(proposal_id, confirmed_by=confirmed_by)
        self._persist_proposal_transition(
            prop,
            from_status="pending",
            actor_id=confirmed_by or None,
            operation="reject",
            idempotency_key=key,
            request_fingerprint=fingerprint,
        )
        return prop

    def _execute_action_kind_proposal(
        self,
        proposal: Any,
        *,
        actor_id: str,
        idempotency_key: str | None,
        request_fingerprint: str,
        viewer_markings: tuple[str, ...] | list[str] = (),
    ) -> dict[str, Any]:
        """Execute one confirmed ActionType proposal with durable evidence.

        The ActionService remains responsible for function invocation and
        submission criteria. This repository owns the durable boundary: the
        target update, action audit, outbox evidence, proposal state,
        lifecycle event, idempotency row, and receipt commit together.

        ADR-0064：本方法 = legacy function_result 回写兼容路径（D-5 无限期保留，
        audit 打 is_compat 观察采用率）；viewer_markings 非空时同样过安全闸门
        （写一个你看不见的对象 = 泄漏写通道）。
        """
        from mate_kernel.action.engine import ProposalNotConfirmed, SubmissionContext

        if self._outbox_writer is None:
            raise RuntimeError("outbox writer unavailable for action proposal execution")
        if not proposal.target_iid:
            raise ValueError("action proposal requires target_iid")

        action_type = self.get_action_type(ClassRef(proposal.action_rid))
        target = self.get_individual(proposal.target_iid)
        target_props = {key.rid: value for key, value in target.props}
        outbox_evidence: list[tuple[str, str]] = []

        def emit_outbox(event_type: str) -> str:
            event_id = self._outbox_writer(
                event_type,
                target.tenant_id,
                {
                    "action_rid": action_type.rid.rid,
                    "target_iid": target.rid,
                    "proposal_id": proposal.proposal_id,
                },
            )
            if event_id is None:
                raise RuntimeError("outbox writer returned no event identifier")
            evidence = (event_type, str(event_id))
            outbox_evidence.append(evidence)
            return evidence[1]

        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    "SELECT status FROM ont_proposal WHERE proposal_id = %s FOR UPDATE",
                    (proposal.proposal_id,),
                )
                row = cur.fetchone()
                if row is None:
                    raise KeyError(f"proposal not found: {proposal.proposal_id}")
                if row["status"] != "confirmed":
                    raise ProposalNotConfirmed(
                        f"proposal {proposal.proposal_id} is {row['status']}; "
                        "execute requires a confirmed proposal"
                    )

                outcome = self._action_service.apply(
                    action_rid=action_type.rid.rid,
                    submission_criteria=action_type.submission_criteria,
                    # ADR-0064：legacy action 路径遇到纯声明式 ActionType（无
                    # function_ref）走 FunctionNotRegistered fail-fast——统一执行器
                    # 在 S3 按 ActionType 声明分派后不再走到这里。
                    function_ref=action_type.function_ref.rid
                    if action_type.function_ref is not None
                    else "",
                    on_rid=action_type.on[0].rid if action_type.on else "",
                    target_iid=target.rid,
                    parameters=dict(proposal.parameters),
                    side_effects=action_type.side_effects,
                    ctx=SubmissionContext(actor=actor_id, tenant_id=target.tenant_id),
                    target_props=target_props,
                    proposal_id=proposal.proposal_id,
                    side_effect_emitter=emit_outbox,
                )

                merged_props = dict(target_props)
                parameter_rids: dict[str, str] = {}
                for parameter in action_type.parameters:
                    parts = parameter.rid.rid.split(".")
                    slug = parts[-2] if parts[-1].startswith("v") else parts[-1]
                    parameter_rids[slug] = parameter.rid.rid
                for key, value in proposal.parameters.items():
                    # F2：`provenance` 是 propose 注入的**平台元数据**（ONT-PROV-01，
                    # 见 propose_action 的 params["provenance"] 合并），不是 action
                    # 声明的参数。此处必须跳过 —— 否则 execute 恒报
                    # "unknown parameter 'provenance'"（实测 404）。
                    if key in _RESERVED_PARAM_KEYS:
                        continue
                    resolved = key if key.startswith("ont.") else parameter_rids.get(key)
                    if resolved is None:
                        raise KeyError(
                            f"unknown parameter {key!r} for action={proposal.action_rid}"
                        )
                    merged_props[resolved] = value
                if isinstance(outcome.function_result, dict):
                    for slug, value in outcome.function_result.items():
                        resolved = parameter_rids.get(slug)
                        if resolved is not None and slug not in proposal.parameters:
                            merged_props[resolved] = value
                # ADR-0064 S2：legacy 路径同样过安全闸门（viewer markings 非空时）。
                # 写入面 = merged_props 相对 target_props 的变更集。
                if viewer_markings:
                    from mate_kernel.action.edit_set import EditOp
                    from mate_kernel.ontology.security_policies import (
                        check_edit_permissions,
                    )

                    gate_ops = [
                        EditOp(
                            op="set_property",
                            target=target.rid,
                            property_rid=rid,
                            value=value,
                        )
                        for rid, value in merged_props.items()
                        if target_props.get(rid) != value
                    ]
                    check_edit_permissions(
                        gate_ops,
                        viewer_markings=tuple(viewer_markings),
                        policies=self._policy_set(),
                        get_individual=lambda rid: self._individual_by_rid(rid),
                        class_marking_of=self._class_markings_of,
                        ancestors_of=self._ancestors_of_class,
                    )
                cur.execute(
                    """
                    UPDATE ont_individual
                    SET props = %s::jsonb, updated_at = %s
                    WHERE rid = %s
                    """,
                    (json.dumps(merged_props, default=str), outcome.applied_at, target.rid),
                )
                if cur.rowcount != 1:
                    raise KeyError(f"Individual not found: {target.rid}")

                result = {
                    "kind": "action",
                    "action_rid": action_type.rid.rid,
                    "target_iid": target.rid,
                    "audit_id": outcome.audit_id,
                    "outbox_event_ids": [event_id for _, event_id in outbox_evidence],
                    "side_effects_emitted": list(outcome.side_effects_emitted),
                    # ADR-0064 D-5：legacy function_result 回写路径标记（观察采用率）
                    "is_compat": True,
                }
                cur.execute(
                    """
                    INSERT INTO ont_action_audit
                        (audit_id, tenant_id, proposal_id, action_rid, target_iid, actor_id, result)
                    VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb)
                    """,
                    (
                        outcome.audit_id,
                        target.tenant_id,
                        proposal.proposal_id,
                        action_type.rid.rid,
                        target.rid,
                        actor_id,
                        json.dumps(result, default=str),
                    ),
                )
                for event_type, event_id in outbox_evidence:
                    cur.execute(
                        """
                        INSERT INTO ont_outbox_event
                            (event_id, tenant_id, proposal_id, event_type, payload)
                        VALUES (%s, %s, %s, %s, %s::jsonb)
                        """,
                        (
                            event_id,
                            target.tenant_id,
                            proposal.proposal_id,
                            event_type,
                            json.dumps(
                                {
                                    "action_rid": action_type.rid.rid,
                                    "target_iid": target.rid,
                                    "proposal_id": proposal.proposal_id,
                                },
                                default=str,
                            ),
                        ),
                    )
                cur.execute(
                    """
                    UPDATE ont_proposal
                    SET status = 'executed', applied_at = now()
                    WHERE proposal_id = %s
                    """,
                    (proposal.proposal_id,),
                )
                self._append_proposal_event(
                    cur,
                    proposal_id=proposal.proposal_id,
                    tenant_id=target.tenant_id,
                    from_status="confirmed",
                    to_status="executed",
                    actor_id=actor_id or None,
                )
                # P1-5：记录待 NOTIFY 事件（事务提交后统一 pg_notify）
                self._pending_notify.extend(str(eid) for _et, eid in outbox_evidence)
                if idempotency_key:
                    cur.execute(
                        """
                        INSERT INTO ont_proposal_idempotency
                            (tenant_id, operation, idempotency_key, proposal_id, request_fingerprint)
                        VALUES (%s, 'execute', %s, %s, %s)
                        """,
                        (
                            target.tenant_id,
                            idempotency_key,
                            proposal.proposal_id,
                            request_fingerprint,
                        ),
                    )
                cur.execute(
                    """
                    INSERT INTO ont_proposal_execution (proposal_id, tenant_id, result)
                    VALUES (%s, %s, %s::jsonb)
                    """,
                    (
                        proposal.proposal_id,
                        target.tenant_id,
                        json.dumps(result, default=str),
                    ),
                )
            conn.commit()
            # P1-5：提交成功 → pg_notify 即时推 WS 订阅者
            self._flush_notify()
            return result
        except Exception:
            conn.rollback()
            self._pending_notify.clear()  # 事务失败 → 未提交事件不 NOTIFY
            # ActionService is an in-process cache. Restore it after a failed
            # database transaction so a later retry still sees ``confirmed``.
            self._action_service._proposals[proposal.proposal_id] = proposal
            raise
        finally:
            conn.close()

    # ───── ACT-05：声明式 edit-set（propose / apply-now / 事务执行）─────

    def propose_edit_set(
        self,
        action_rid: str,
        target_iid: str | None,
        parameters: dict[str, Any],
        edit_templates: list[dict[str, Any]] | tuple[dict[str, Any], ...],
        impact_summary: str,
    ) -> Any:
        """AI/HITL 流程的 edit-set 提案（pending → 用户 confirm → execute）。"""

        return self._propose_edit_set_pg(
            action_rid,
            target_iid,
            parameters,
            edit_templates,
            impact_summary,
        )

    def _propose_edit_set_pg(
        self,
        action_rid: str,
        target_iid: str | None,
        parameters: dict[str, Any],
        edit_templates: list[dict[str, Any]] | tuple[dict[str, Any], ...],
        impact_summary: str,
    ) -> Any:
        """PG 落库版 propose（kind=edit_set；复用 ont_proposal 状态机）。"""
        import uuid as _uuid

        from mate_kernel.action.edit_set import resolve_edit_templates
        from mate_kernel.action.validation import validate_referenced_parameters

        # ACT-06：模板引用参数 fail-fast（自定义 edits 只约束引用到的参数）
        try:
            at = self.get_action_type(ClassRef(action_rid))
        except KeyError:
            at = None
        if at is not None:
            violations = validate_referenced_parameters(at.parameters, parameters, edit_templates)
            if violations:
                raise ValueError("; ".join(violations))

        ops = resolve_edit_templates(
            edit_templates,
            target_iid=target_iid,
            parameters=parameters,
        )
        # C9：body 未带 edits 时，用 ActionType.declarative_edits 预装配 diff ——
        # 否则预览恒为 0 ops（真实 op 数在执行器装配时才产生）。function 产物
        # 不在 propose 阶段求值（要真调函数，成本/副作用留到 execute）。
        preview_ops = ops
        preview_source = "body"
        if not ops and at is not None and getattr(at, "declarative_edits", ()):
            preview_ops = resolve_edit_templates(
                [dict(t) for t in at.declarative_edits],
                target_iid=target_iid,
                parameters=parameters,
            )
            preview_source = "declarative"
        elif not ops and at is not None and at.function_ref is not None:
            preview_source = "function(deferred)"
        proposal_id = f"prop-{_uuid.uuid4().hex[:12]}"
        tenant_id = (
            self._current_tenant() or action_rid.split(".")[1]
            if "." in action_rid
            else "tenant-default"
        )
        expected_diff = {
            "~ops": len(preview_ops),
            "ops": [e.op for e in preview_ops],
            # C9：预览来源（body=调用方自带 / declarative=类型模板预装配 /
            # function(deferred)=执行期才有 op 列表）
            "preview_source": preview_source,
        }
        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                cur.execute(
                    """INSERT INTO ont_proposal
                       (proposal_id, tenant_id, action_rid, target_iid, parameters,
                        impact_summary, requires_hitl, status, kind, expected_diff,
                        created_by, created_at, updated_at)
                       VALUES (%s,%s,%s,%s,%s::jsonb,%s,%s,'pending','edit_set',%s::jsonb,%s,now(),now())
                       ON CONFLICT (proposal_id) DO NOTHING""",
                    (
                        proposal_id,
                        tenant_id,
                        action_rid,
                        target_iid,
                        json.dumps({"edits": list(edit_templates), "parameters": dict(parameters)}),
                        impact_summary,
                        True,
                        json.dumps(expected_diff, default=str),
                        "ai-agent",
                    ),
                )
            conn.commit()
        finally:
            conn.close()
        return self.get_proposal(proposal_id)

    def apply_edit_set_now(
        self,
        action_rid: str,
        target_iid: str | None,
        parameters: dict[str, Any],
        edit_templates: list[dict[str, Any]] | tuple[dict[str, Any], ...],
        actor: str,
        impact_summary: str = "",
        *,
        viewer_markings: tuple[str, ...] | list[str] = (),
    ) -> dict[str, Any]:
        """D7「预览即确认」：即时 proposal（confirmed）+ 事务执行 + 审计。"""
        prop = self._propose_edit_set_pg(
            action_rid,
            target_iid,
            parameters,
            edit_templates,
            impact_summary or f"edit-set by {actor}",
        )
        self.confirm_proposal(prop.proposal_id, confirmed_by=actor)
        return self.execute_proposal(
            prop.proposal_id,
            actor_id=actor,
            idempotency_key=f"editset-{prop.proposal_id}",
            viewer_markings=viewer_markings,
        )

    def _execute_edit_set_proposal(
        self,
        p: Any,
        *,
        actor_id: str,
        idempotency_key: str | None,
        request_fingerprint: str | None,
        viewer_markings: tuple[str, ...] | list[str] = (),
    ) -> dict[str, Any]:
        """ADR-0064 S2：统一执行器 —— 声明式 edits + function 产物两规约合并单事务。

        - kind=edit_set（propose-edit-set / apply-edit-set 入口）与 kind=action
          中声明了 declarative_edits 的（S3 分派）共用本方法；
        - function 返回值规约解释见 ``mate_kernel.action.unified``；规约②转换
          打 ``is_compat`` 标记（D-5 观察采用率，legacy 直接回写路径恒 True）；
        - viewer_markings 非空 → 完整安全闸门（行/列策略 + G6 marking 合取门 +
          G7 scoped 收窄结果；空 = 与读端点同口径直通，零回归）；
        - P1-6：批量上限 ``EDIT_BATCH_LIMIT``（10000）在组装器对合并后总数校验；
          万行仍走**单事务**（原子性优先），分片不改变「任一片失败 → 整体回滚」。
        """
        import uuid as _uuid
        from dataclasses import replace as _replace
        from datetime import UTC as _UTC
        from datetime import datetime as _dt

        from mate_kernel.action.edit_set import EditSetError, invert_edits
        from mate_kernel.action.unified import assemble_unified_edits
        from mate_kernel.ontology.security_policies import check_edit_permissions

        # 统一装配：ActionType（ad-hoc 编辑可为 None）→ 声明式模板 + function
        # 两规约产物 → 合并 EditOp 序列。
        try:
            at = self.get_action_type(ClassRef(p.action_rid))
        except KeyError:
            at = None

        # submission_criteria（有 ActionType 时；与 legacy apply 同一求值器）
        if at is not None:
            target_props: dict[str, Any] = {}
            if p.target_iid:
                with suppress(KeyError):
                    t = self.get_individual(p.target_iid)
                    target_props = {k.rid: v for k, v in t.props}
            raw_crit = dict(p.parameters or {})
            if p.kind == "edit_set":
                inner = raw_crit.get("parameters")
                crit_params = dict(inner) if isinstance(inner, dict) else {}
            else:
                crit_params = {k: v for k, v in raw_crit.items() if k != "provenance"}
            for expr in at.submission_criteria:
                if not self._action_service.evaluator.evaluate(expr, crit_params, target_props):
                    raise ValueError(
                        f"submission criteria not met: {expr!r} for action={at.rid.rid}"
                    )

        def _invoke(fn_rid: str, tgt: str | None, fn_params: dict[str, Any]) -> Any:
            return self._action_service.invoke_function(fn_rid, tgt, fn_params)

        try:
            assembly = assemble_unified_edits(
                action_type=at,
                proposal_kind=p.kind,
                parameters_raw=dict(p.parameters or {}),
                target_iid=p.target_iid,
                invoke_function=(
                    _invoke if (at is not None and at.function_ref is not None) else None
                ),
                now_iso=_dt.now(_UTC).isoformat(),
            )
        except EditSetError as e:
            raise ValueError(str(e)) from e  # API 层统一 422

        ops = list(assembly.ops)
        # 安全闸门（空 viewer markings 内部直通；无策略零回归）
        check_edit_permissions(
            ops,
            viewer_markings=tuple(viewer_markings),
            policies=self._policy_set(),
            get_individual=lambda rid: self._individual_by_rid(rid),
            class_marking_of=self._class_markings_of,
            ancestors_of=self._ancestors_of_class,
        )
        applied: list[Any] = []
        created_rids: list[str] = []
        old_values: dict[str, Any] = {}
        removed_links: list[dict[str, Any]] = []
        tenant_id = self._current_tenant() or "tenant-default"
        audit_id = f"audit-{_uuid.uuid4().hex[:12]}"

        conn, _ = self._connect()
        try:
            with self._cursor(conn) as cur:
                for e in ops:
                    if e.op == "set_property":
                        cur.execute(
                            "SELECT props FROM ont_individual WHERE rid = %s FOR UPDATE",
                            (e.target,),
                        )
                        row = cur.fetchone()
                        if row is None:
                            raise EditSetError(f"set_property target not found: {e.target}")
                        old_props = row["props"] if isinstance(row["props"], dict) else {}
                        old_values[f"{e.target}#{e.property_rid}"] = old_props.get(e.property_rid)
                        new_props = dict(old_props)
                        new_props[e.property_rid] = e.value
                        cur.execute(
                            "UPDATE ont_individual SET props = %s::jsonb, "
                            "updated_at = now() WHERE rid = %s",
                            (json.dumps(new_props, default=str), e.target),
                        )
                        # writeback 双流合并：记覆盖层（管道同步不覆盖该属性）
                        cur.execute(
                            """INSERT INTO ont_edit_overlay
                               (individual_rid, property_rid, tenant_id, updated_at)
                               VALUES (%s, %s, %s, now())
                               ON CONFLICT (individual_rid, property_rid)
                               DO UPDATE SET updated_at = now()""",
                            (e.target, e.property_rid, tenant_id),
                        )
                    elif e.op == "create_object":
                        parts = e.class_rid.split(".")
                        tenant = parts[1]
                        cls_slug = parts[4] if len(parts) >= 6 else parts[3]
                        rid = f"ont.{tenant}.ind.{cls_slug}.{e.primary_key}"
                        # G6：实例继承类型 marking（含祖先 —— 写时血缘传播）
                        inherited = list(self._class_markings_of(e.class_rid))
                        cur.execute(
                            """INSERT INTO ont_individual
                               (rid, tenant_id, class_rid, props, primary_key,
                                marking, created_at, updated_at)
                               VALUES (%s, %s, %s, %s::jsonb, %s, %s, now(), now())
                               ON CONFLICT (rid) DO UPDATE SET
                                 props = EXCLUDED.props,
                                 primary_key = EXCLUDED.primary_key,
                                 updated_at = now()""",
                            (
                                rid,
                                tenant,
                                e.class_rid,
                                json.dumps(e.props, default=str),
                                str(e.primary_key),
                                inherited,
                            ),
                        )
                        created_rids.append(rid)
                    elif e.op == "delete_object":
                        cur.execute(
                            "DELETE FROM ont_link_instance WHERE src = %s OR dst = %s",
                            (e.target, e.target),
                        )
                        cur.execute("DELETE FROM ont_individual WHERE rid = %s", (e.target,))
                        if cur.rowcount != 1:
                            raise EditSetError(f"delete_object target not found: {e.target}")
                    elif e.op == "add_link":
                        lt_parts = e.link_type_rid.split(".")
                        lt_slug = lt_parts[-2] if lt_parts[-1].startswith("v") else lt_parts[-1]
                        li_rid = (
                            f"ont.{e.src.split('.')[1] if '.' in e.src else tenant_id}"
                            f".lnk.{lt_slug}.{_uuid.uuid4().hex[:10]}"
                        )
                        # LINK-CARDINALITY-CONCURRENCY：可达写入口（Action/edit-set）
                        # 与 create_link_instance 走**同一套**约束（端点锁 + 同事务校验）。
                        self._lock_link_endpoints(cur, e.link_type_rid, e.src, e.dst)
                        self._check_link_cardinality(
                            e.link_type_rid, e.src, e.dst, exclude_rid=li_rid, cur=cur
                        )
                        cur.execute(
                            """INSERT INTO ont_link_instance
                               (rid, tenant_id, link_type_rid, src, dst, props,
                                marking, created_at, updated_at)
                               VALUES (%s, %s, %s, %s, %s, '{}'::jsonb, '{}',
                                       now(), now())""",
                            (li_rid, tenant_id, e.link_type_rid, e.src, e.dst),
                        )
                        e = _replace(e, link_instance_rid=li_rid)
                    elif e.op == "remove_link":
                        cur.execute(
                            "SELECT * FROM ont_link_instance WHERE rid = %s FOR UPDATE",
                            (e.link_instance_rid,),
                        )
                        row = cur.fetchone()
                        if row is None:
                            raise EditSetError(f"remove_link not found: {e.link_instance_rid}")
                        removed_links.append(
                            {
                                "rid": row["rid"],
                                "link_type_rid": row["link_type_rid"],
                                "src": row["src"],
                                "dst": row["dst"],
                                "props": row.get("props") or {},
                            }
                        )
                        cur.execute(
                            "DELETE FROM ont_link_instance WHERE rid = %s", (e.link_instance_rid,)
                        )
                    applied.append(e)

                inverse, non_invertible = invert_edits(
                    applied,
                    old_values=old_values,
                    created_rids=created_rids,
                    removed_links=removed_links,
                )
                result = {
                    "kind": "edit_set",
                    "action_rid": p.action_rid,
                    "target_iid": p.target_iid,
                    "audit_id": audit_id,
                    "applied_count": len(applied),
                    "created_rids": created_rids,
                    "non_invertible": list(non_invertible),
                    # ADR-0064 S2：统一执行器元数据（规约②兼容转换观察 / fn 规约）
                    "is_compat": assembly.is_compat,
                    "fn_spec": assembly.fn_spec,
                    "assembly": dict(assembly.stats),
                    "inverse": [
                        {
                            "op": i.op,
                            "target": i.target,
                            "property_rid": i.property_rid,
                            "value": i.value,
                            "class_rid": i.class_rid,
                            "primary_key": i.primary_key,
                            "props": i.props,
                            "link_type_rid": i.link_type_rid,
                            "src": i.src,
                            "dst": i.dst,
                            "link_instance_rid": i.link_instance_rid,
                        }
                        for i in inverse
                    ],
                }
                cur.execute(
                    """INSERT INTO ont_action_audit
                       (audit_id, tenant_id, proposal_id, action_rid, target_iid,
                        actor_id, result)
                       VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb)""",
                    (
                        audit_id,
                        tenant_id,
                        p.proposal_id,
                        p.action_rid,
                        p.target_iid or "",
                        actor_id or "system",
                        json.dumps(result, default=str),
                    ),
                )
                event_id = f"evt-{_uuid.uuid4().hex[:12]}"
                # P1-5：记录待 NOTIFY 事件
                self._pending_notify.append(event_id)
                cur.execute(
                    """INSERT INTO ont_outbox_event
                       (event_id, tenant_id, proposal_id, event_type, payload)
                       VALUES (%s, %s, %s, %s, %s::jsonb)""",
                    (
                        event_id,
                        tenant_id,
                        p.proposal_id,
                        "edit_set.applied",
                        json.dumps(
                            {"action_rid": p.action_rid, "applied_count": len(applied)}, default=str
                        ),
                    ),
                )
                cur.execute(
                    "UPDATE ont_proposal SET status = 'executed', "
                    "applied_at = now() WHERE proposal_id = %s",
                    (p.proposal_id,),
                )
                cur.execute(
                    """INSERT INTO ont_proposal_execution
                       (proposal_id, tenant_id, executed_at, result, audit_id)
                       VALUES (%s, %s, now(), %s::jsonb, %s)
                       ON CONFLICT (proposal_id) DO UPDATE SET
                         executed_at = now(), result = EXCLUDED.result,
                         audit_id = EXCLUDED.audit_id""",
                    (p.proposal_id, tenant_id, json.dumps(result, default=str), audit_id),
                )
            conn.commit()
        except Exception:
            conn.rollback()
            self._pending_notify.clear()  # 事务失败 → 未提交事件不 NOTIFY
            raise
        finally:
            conn.close()
        # P1-5：提交成功 → pg_notify 即时推 WS 订阅者
        self._flush_notify()
        return result

    def execute_proposal(
        self,
        proposal_id: str,
        actor_id: str = "",
        idempotency_key: str | None = None,
        *,
        viewer_markings: tuple[str, ...] | list[str] = (),
    ) -> dict[str, Any]:
        """MP-SAL-04b：confirmed proposal 落库执行（create_instance / model_type）。

        ADR-0064 S2/S3：viewer_markings 非空时统一执行器走完整安全闸门
        （行/列策略 + G6 marking 门 + scoped 收窄；空 = 与读端点同口径直通）。
        """
        from datetime import UTC as _UTC
        from datetime import datetime as _dt

        from mate_kernel.action.engine import (
            ProposalNotConfirmed,
            ProposalStatus,
        )

        key = (idempotency_key or "").strip() or None
        p = self.get_proposal(proposal_id)  # 行存在 + 镜像回填
        fingerprint = self._proposal_request_fingerprint(
            operation="execute",
            proposal_id=proposal_id,
            actor_id=actor_id or None,
        )
        replayed = self._replay_idempotent_proposal(
            tenant_id=self._proposal_tenant_id(p.action_rid),
            operation="execute",
            idempotency_key=key,
            proposal_id=proposal_id,
            request_fingerprint=fingerprint,
        )
        if replayed is not None:
            return self.get_proposal_execution(proposal_id)
        if p.status is not ProposalStatus.CONFIRMED:
            raise ProposalNotConfirmed(
                f"proposal {proposal_id} is {p.status.value}; execute requires a confirmed proposal"
            )
        if p.kind == "action":
            # ADR-0064 S3：按 ActionType 声明分派 —— 声明式/混合式走统一执行器
            # （edits 是本体），纯 function 式走 legacy 回写（D-5 兼容路径）。
            try:
                at_dispatch = self.get_action_type(ClassRef(p.action_rid))
            except KeyError:
                at_dispatch = None
            if at_dispatch is not None and at_dispatch.declarative_edits:
                return self._execute_edit_set_proposal(
                    p,
                    actor_id=actor_id,
                    idempotency_key=key,
                    request_fingerprint=fingerprint,
                    viewer_markings=viewer_markings,
                )
            return self._execute_action_kind_proposal(
                p,
                actor_id=actor_id,
                idempotency_key=key,
                request_fingerprint=fingerprint,
                viewer_markings=viewer_markings,
            )
        if p.kind == "edit_set":
            result = self._execute_edit_set_proposal(
                p,
                actor_id=actor_id,
                idempotency_key=key,
                request_fingerprint=fingerprint,
                viewer_markings=viewer_markings,
            )
            return result
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
            # NOTE: 循环变量绝不能命名为 ``key`` —— 会遮蔽外层幂等键
            # ``key``，导致 create_instance 的幂等记录写入最后一个 prop slug
            # （jsonb 排序后常为 'emp-id'）并在跨 proposal 重放时撞唯一约束。
            for prop_name, prop_value in props_in.items():
                ref = slug_to_ref.get(prop_name) or (
                    ClassRef(prop_name) if prop_name.startswith("ont.") else None
                )
                if ref is None:
                    raise KeyError(f"unknown property {prop_name!r} for {p.action_rid}")
                resolved.append((ref, prop_value))
            ind = Individual(
                rid=f"ont.{tenant}.ind.{cls_slug}.{pk_value}",
                class_rid=ot.rid,
                props=tuple(resolved),
                primary_key=str(pk_value),
                created_at=_dt.now(_UTC),
                updated_at=_dt.now(_UTC),
                tenant_id=tenant,
                # ONT-PROV-01：提案级溯源落实例（AI/人工来源 + 执行链证据）
                provenance={
                    **(
                        dict(p.parameters.get("provenance") or {})
                        if isinstance(p.parameters, dict)
                        else {}
                    ),
                    "proposal_id": proposal_id,
                    "actor_id": actor_id or "",
                    "executed_at": _dt.now(_UTC).isoformat(),
                },
            )
            created = self.create_individual(ind)
            result = {"kind": "create_instance", "individual_rid": created.rid}
            self._persist_proposal_transition(
                self._action_service.mark_executed(proposal_id),
                from_status="confirmed",
                actor_id=actor_id or None,
                operation="execute",
                idempotency_key=key,
                request_fingerprint=fingerprint,
                execution_result=result,
            )
            return result
        if p.kind == "model_type":
            type_def = p.parameters["type_def"]
            ot = ObjectType(
                rid=ClassRef(str(type_def["rid"])),
                primary_key=tuple(ClassRef(pk) for pk in type_def["primary_key"]),
                properties=tuple(
                    Property(
                        rid=ClassRef(pd["rid"]),
                        type_id=pd.get("type_id", "string"),
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
            result = {"kind": "model_type", "type_rid": saved.rid.rid}
            self._persist_proposal_transition(
                self._action_service.mark_executed(proposal_id),
                from_status="confirmed",
                actor_id=actor_id or None,
                operation="execute",
                idempotency_key=key,
                request_fingerprint=fingerprint,
                execution_result=result,
            )
            return result
        if p.kind == "merge_suggestion":
            # MP-DEDUP-01：user confirm → 自动触发 merge_object_types
            source_rid = p.parameters.get("source_rid")
            target_rid = p.parameters.get("target_rid")
            if not source_rid or not target_rid:
                raise ValueError("merge_suggestion proposal requires source_rid + target_rid")
            mapping = p.parameters.get("mapping") or {}
            result = dict(self.merge_object_types(source_rid, target_rid, mapping))
            result["kind"] = "merge_suggestion"
            self._persist_proposal_transition(
                self._action_service.mark_executed(proposal_id),
                from_status="confirmed",
                actor_id=actor_id or None,
                operation="execute",
                idempotency_key=key,
                request_fingerprint=fingerprint,
                execution_result=result,
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
            "flow_json": row["flow_json"]
            if isinstance(row["flow_json"], dict)
            else json.loads(row["flow_json"]),
            "config": row["config"]
            if isinstance(row["config"], dict)
            else json.loads(row["config"]),
            "updated_at": row["updated_at"],
        }

    def put_flow_definition(
        self,
        action_rid: ClassRef,
        flow_json: dict[str, Any],
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
                        action_rid.rid,
                        tenant_id,
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

            def emitter(
                se: str,
                *,
                _w=self._outbox_writer,
                _t=ind.tenant_id,
                _a=at.rid.rid,
                _g=target_iid,
                _p=proposal_id,
            ) -> str | None:
                try:
                    return str(
                        _w(
                            se,
                            _t,
                            {
                                "action_rid": _a,
                                "target_iid": _g,
                                "proposal_id": _p,
                            },
                        )
                    )
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
