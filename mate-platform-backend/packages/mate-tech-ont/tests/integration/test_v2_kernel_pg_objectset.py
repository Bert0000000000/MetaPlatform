"""RUNTIME-PG-03 回归：PgOntologyRepository.evaluate_object_set 的三个真实 PG bug。

修复的 bug（均在 2026-08-16 真实 PG 冒烟中复现）：
1. truthy 过滤（裸字段名）→ 上游 SQLCompiler 渲染 col_expr 两次但参数只
   extend 一次 → psycopg2 ``IndexError: list index out of range``。
   修复：pg_repo._RepoSQLCompiler 子类补齐参数。
2. 简写 slug 字段名（``days >= 1``）→ JSONB 键存完整 Property rid →
   ``props ->> 'days'`` 恒 NULL → 过滤结果恒空（InMemory 路径支持 slug，
   individual_to_row 用 rid 第 4 段作 key；PG 路径未对齐）。
   修复：_rewrite_filter_fields 按 ObjectType.properties 做 slug→rid 归一化。
3. sort 一律 ``::numeric`` → 字符串字段排序直接 DataError；且 sort 键未做
   slug→rid 归一化（同样恒 NULL）。
   修复：cast 按 Property.type_id 分支（数值 ::numeric / 其余 ::text），
   键经 ``_SAFE_JSON_KEY`` 白名单校验。

测试策略：mock 连接（无需 PG，CI 恒跑）+ PG 可达时的真实执行门控用例
（PG_DSN 不可达即 skip，与 test_v2_kernel_pg_e2e.py 同一约定）。
"""

from __future__ import annotations

import os
import threading
from datetime import UTC, datetime
from typing import Any

import pytest

from mate_kernel.objectset.compiler import FilterCompiler
from mate_kernel.objectset.sql_compiler import SQLCompiler
from mate_kernel.ontology.identity import ClassRef
from mate_kernel.ontology.instances import Individual
from mate_kernel.ontology.query import ObjectSet
from mate_kernel.ontology.types import ObjectType, Property, PropertyFormat
from mate_tech_ont.v2_kernel.pg_repo import (
    PgOntologyRepository,
    _prop_slug,
    _RepoSQLCompiler,
    _rewrite_filter_fields,
)

_T = "slugtest"


def _ot() -> ObjectType:
    return ObjectType(
        rid=ClassRef(f"ont.{_T}.obj.widget.v1"),
        primary_key=(ClassRef(f"ont.{_T}.prop.wid.v1"),),
        properties=(
            Property(
                rid=ClassRef(f"ont.{_T}.prop.wid.v1"),
                type_id="string",
                nullable=False,
                primary_key=True,
                title="id",
                format=PropertyFormat.STRING,
            ),
            Property(
                rid=ClassRef(f"ont.{_T}.prop.amount.v1"),
                type_id="integer",
                nullable=True,
                primary_key=False,
                title="amount",
                format=PropertyFormat.INTEGER,
            ),
            Property(
                rid=ClassRef(f"ont.{_T}.prop.status.v1"),
                type_id="string",
                nullable=True,
                primary_key=False,
                title="status",
                format=PropertyFormat.STRING,
            ),
        ),
        display_name="widget",
    )


def _individual(rid_suffix: str, amount: int, status: str) -> Individual:
    now = datetime.now(UTC)
    rid = f"ont.{_T}.ind.widget.{rid_suffix}"
    return Individual(
        rid=rid,
        class_rid=ClassRef(f"ont.{_T}.obj.widget.v1"),
        props=(
            (ClassRef(f"ont.{_T}.prop.wid.v1"), rid_suffix),
            (ClassRef(f"ont.{_T}.prop.amount.v1"), amount),
            (ClassRef(f"ont.{_T}.prop.status.v1"), status),
        ),
        primary_key=rid_suffix,
        created_at=now,
        updated_at=now,
        tenant_id=_T,
        marking=(),
    )


# ─────────────────── mock 连接：捕获 SQL + params ───────────────────


class _CaptureCursor:
    def __init__(self) -> None:
        self.executed: list[tuple[str, list[Any]]] = []

    def __enter__(self) -> _CaptureCursor:
        return self

    def __exit__(self, *exc: object) -> None:
        return None

    def execute(self, sql: str, params: list[Any] | None = None) -> None:
        self.executed.append((sql, list(params or [])))

    def fetchall(self) -> list[dict[str, Any]]:
        return []

    def fetchone(self) -> dict[str, Any] | None:
        return None


class _CaptureConn:
    def __init__(self) -> None:
        self.cursor_obj = _CaptureCursor()

    def cursor(self, cursor_factory: Any = None) -> _CaptureCursor:
        return self.cursor_obj

    def commit(self) -> None:
        return None

    def close(self) -> None:
        return None


@pytest.fixture
def capture_repo(monkeypatch: pytest.MonkeyPatch) -> tuple[PgOntologyRepository, _CaptureCursor]:
    """PgOntologyRepository，_connect 替换为捕获连接（不触 PG）。"""
    from mate_kernel.action.engine import ActionService  # noqa: PLC0415
    from mate_kernel.ontology.function_resolver import (  # noqa: PLC0415
        InMemoryFunctionResolver,
    )

    repo = PgOntologyRepository.__new__(PgOntologyRepository)
    repo._dsn = "postgresql://mock/mock"
    repo._lock = threading.Lock()
    repo._initialized = True
    repo._tenant_local = threading.local()
    repo._action_service = ActionService()
    repo._function_resolver = InMemoryFunctionResolver()
    repo._function_executor = None

    conn = _CaptureConn()

    def _fake_connect() -> tuple[_CaptureConn, Any]:
        return conn, None

    monkeypatch.setattr(repo, "_connect", _fake_connect)
    monkeypatch.setattr(repo, "get_object_type", lambda rid: _ot())
    return repo, conn.cursor_obj


def _placeholders(sql: str) -> int:
    return sql.count("%s")


# ─────────────────── bug 1：truthy 占位符/参数配平 ───────────────────


class TestTruthyPlaceholder:
    def test_repo_compiler_extends_params_twice(self) -> None:
        """truthy 渲染 col_expr 两次 → 参数必须两份（原为 1 份 → IndexError）。"""
        cf = FilterCompiler().compile("status")
        sqlc = _RepoSQLCompiler()
        where, params = sqlc.compile_where(cf)
        assert _placeholders(where) == len(params) == 2

    def test_truthy_filter_executes_without_indexerror(
        self, capture_repo: tuple[PgOntologyRepository, _CaptureCursor],
    ) -> None:
        repo, cur = capture_repo
        os_ = ObjectSet(class_rid=_ot().rid, filter_expr="status")
        repo.evaluate_object_set(os_)  # 修复前：IndexError: list index out of range
        sql, params = cur.executed[-1]
        assert _placeholders(sql) == len(params)
        assert params.count(f"ont.{_T}.prop.status.v1") == 2  # slug 已归一化为 rid

    def test_upstream_compiler_still_broken_upstream_shape(self) -> None:
        """上游 SQLCompiler truthy 分支占位符 2 / 参数 1 —— 锁定子类修复的根因。"""
        cf = FilterCompiler().compile("status")
        where, params = SQLCompiler().compile_where(cf)
        assert _placeholders(where) == 2
        assert len(params) == 1


# ─────────────────── bug 2：slug → 完整 rid 归一化 ───────────────────


class TestSlugNormalization:
    def test_rewrite_maps_slug_to_rid(self) -> None:
        cf = FilterCompiler().compile("amount > 10 AND status == 'open'")
        out = _rewrite_filter_fields(cf, {p: f"ont.{_T}.prop.{p}.v1" for p in ("amount", "status")})
        _where, params = _RepoSQLCompiler().compile_where(out)
        assert f"ont.{_T}.prop.amount.v1" in params
        assert f"ont.{_T}.prop.status.v1" in params
        assert "amount" not in params and "status" not in params

    def test_rewrite_keeps_unknown_fields(self) -> None:
        cf = FilterCompiler().compile("mystery >= 1")
        out = _rewrite_filter_fields(cf, {"amount": f"ont.{_T}.prop.amount.v1"})
        assert out.field_name == "mystery"

    def test_rewrite_descends_children(self) -> None:
        cf = FilterCompiler().compile("amount > 1 OR (status == 'x' AND amount < 9)")
        mapping = {p: f"ont.{_T}.prop.{p}.v1" for p in ("amount", "status")}
        _where, params = _RepoSQLCompiler().compile_where(
            _rewrite_filter_fields(cf, mapping)
        )
        assert params.count(f"ont.{_T}.prop.amount.v1") == 2
        assert params.count(f"ont.{_T}.prop.status.v1") == 1

    def test_full_rid_filter_unchanged(
        self, capture_repo: tuple[PgOntologyRepository, _CaptureCursor],
    ) -> None:
        repo, cur = capture_repo
        repo.evaluate_object_set(ObjectSet(
            class_rid=_ot().rid,
            filter_expr=f"ont.{_T}.prop.amount.v1 >= 15",
        ))
        _, params = cur.executed[-1]
        assert f"ont.{_T}.prop.amount.v1" in params

    def test_prop_slug_rule(self) -> None:
        assert _prop_slug(f"ont.{_T}.prop.po-qty.v1") == "po-qty"
        assert _prop_slug("shortname") == "shortname"


# ─────────────────── bug 3：sort 键归一化 + cast 分支 ───────────────────


class TestSortCompilation:
    def test_numeric_sort_uses_numeric_cast(
        self, capture_repo: tuple[PgOntologyRepository, _CaptureCursor],
    ) -> None:
        repo, cur = capture_repo
        repo.evaluate_object_set(ObjectSet(
            class_rid=_ot().rid, filter_expr="", sort=("-amount",),
        ))
        sql, _ = cur.executed[-1]
        assert f"(props ->> 'ont.{_T}.prop.amount.v1')::numeric DESC" in sql

    def test_text_sort_uses_text_cast(
        self, capture_repo: tuple[PgOntologyRepository, _CaptureCursor],
    ) -> None:
        """status 是 string —— 旧版 ::numeric 会让任何非数值行 DataError。"""
        repo, cur = capture_repo
        repo.evaluate_object_set(ObjectSet(
            class_rid=_ot().rid, filter_expr="", sort=("status",),
        ))
        sql, _ = cur.executed[-1]
        assert f"(props ->> 'ont.{_T}.prop.status.v1')::text ASC" in sql

    def test_unknown_sort_field_defaults_to_text(
        self, capture_repo: tuple[PgOntologyRepository, _CaptureCursor],
    ) -> None:
        repo, cur = capture_repo
        repo.evaluate_object_set(ObjectSet(
            class_rid=_ot().rid, filter_expr="", sort=("mystery",),
        ))
        sql, _ = cur.executed[-1]
        assert "(props ->> 'mystery')::text ASC" in sql

    def test_unsafe_sort_field_rejected(
        self, capture_repo: tuple[PgOntologyRepository, _CaptureCursor],
    ) -> None:
        repo, _cur = capture_repo
        with pytest.raises(ValueError, match="unsafe sort field"):
            repo.evaluate_object_set(ObjectSet(
                class_rid=_ot().rid,
                filter_expr="",
                sort=("x'); DROP TABLE ont_individual; --",),
            ))


# ─────────────────── PG 可达时的真实执行（skip 规则同 pg_e2e） ───────────────────

PG_DSN = os.getenv("PG_DSN", "postgresql://meta:meta@localhost:5432/metaplatform_ont_test")


def _pg_available() -> bool:
    try:
        import psycopg2  # type: ignore  # noqa: PLC0415
        conn = psycopg2.connect(PG_DSN, connect_timeout=2)
        conn.close()
        return True
    except Exception:
        return False


@pytest.mark.skipif(not _pg_available(), reason=f"PG not reachable at {PG_DSN!r}")
class TestRealPgSlugQuery:
    """PG_DSN 可达时：slug 过滤 + 数值/文本排序在真实 PG 上执行。"""

    def test_slug_filter_and_sorts_on_real_pg(self) -> None:
        import psycopg2  # type: ignore  # noqa: PLC0415

        repo = PgOntologyRepository(dsn=PG_DSN)
        repo._ensure_schema()
        # 只清理本测试租户的数据，不动其它租户（seed 等）
        conn = psycopg2.connect(PG_DSN)
        try:
            with conn.cursor() as cur:
                for tbl in ("ont_individual", "ont_object_type"):
                    cur.execute(f"DELETE FROM {tbl} WHERE tenant_id = %s", (_T,))  # noqa: S608
            conn.commit()
        finally:
            conn.close()

        repo.upsert_object_type(_ot())
        repo.create_individual(_individual("a", amount=5, status="open"))
        repo.create_individual(_individual("b", amount=15, status="closed"))
        repo.create_individual(_individual("c", amount=25, status="open"))

        # slug 数值过滤（修复前恒空）
        got = repo.evaluate_object_set(ObjectSet(
            class_rid=_ot().rid, filter_expr="amount >= 15",
        ))
        assert {i.primary_key for i in got} == {"b", "c"}

        # slug 过滤 + slug 降序排序（修复前 sort 键恒 NULL + ::numeric）
        got = repo.evaluate_object_set(ObjectSet(
            class_rid=_ot().rid, filter_expr="status == 'open'", sort=("-amount",),
        ))
        assert [i.primary_key for i in got] == ["c", "a"]

        # 文本字段排序不 DataError（修复前 ::numeric 直接炸）
        got = repo.evaluate_object_set(ObjectSet(
            class_rid=_ot().rid, filter_expr="", sort=("status",),
        ))
        assert [i.primary_key for i in got] == ["b", "a", "c"]

        # truthy 裸字段（修复前 IndexError）
        got = repo.evaluate_object_set(ObjectSet(
            class_rid=_ot().rid, filter_expr="status",
        ))
        assert len(got) == 3

        # 清理
        conn = psycopg2.connect(PG_DSN)
        try:
            with conn.cursor() as cur:
                for tbl in ("ont_individual", "ont_object_type"):
                    cur.execute(f"DELETE FROM {tbl} WHERE tenant_id = %s", (_T,))  # noqa: S608
                cur.execute("DELETE FROM ont_action_type WHERE tenant_id = %s", (_T,))
            conn.commit()
        finally:
            conn.close()
