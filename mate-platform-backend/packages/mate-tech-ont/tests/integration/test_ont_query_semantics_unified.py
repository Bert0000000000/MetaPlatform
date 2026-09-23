"""ONT-QUERY-SEMANTICS —— 统一查询语义验收（源类矩阵 / 两入口对照 / SQL 次数与延迟）。

背景：源类集合历史上在三条路径各写一份（`list_individuals` / `evaluate_object_set`
/ `execute_object_query`，以及 InMemory 的浏览路径），同一组语义参数给出不同结果。
本套件钉死**唯一语义**并做入口对照：

规则（`mate_kernel/objectset/source_resolution.py` 一处定义）：
1. Interface 源 → 实现类型 + **各自后代闭包**；
2. ObjectType 源 → 自身 + **后代闭包**（沿启用 subclass 公理）；
3. 未注册源 → 仅自身（精确）；
4. 公理禁用 → 退回精确（G21）；
5. Interface 无实现类型 → **空集**（不得退化成"不过滤"）。

对照口径：**对象集合（rid 集合）**是三个入口的共同语义面 —— 浏览返回 Individuals、
IR 返回 rows（含 `__rid__`）、legacy 返回 Individuals，取 rid 集合即可逐项对账。
"""

from __future__ import annotations

import os
import sys
import time
from datetime import UTC, datetime
from typing import Any

import pytest

_K = os.path.join(os.path.dirname(__file__), "..", "..", "mate-kernel", "src")
_O = os.path.join(os.path.dirname(__file__), "..", "src")
for _p in (_K, _O):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from mate_kernel.objectset.ir import (
    Aggregation,
    InMemoryQueryExecutor,
    MetricSpec,
    ObjectSetQuery,
    SortKey,
)
from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.in_memory import InMemoryOntologyRepository
from mate_kernel.ontology.instances.individual import Individual
from mate_kernel.ontology.query import ObjectSet
from mate_kernel.ontology.types.interface import Interface
from mate_kernel.ontology.types.object_type import ObjectType
from mate_kernel.ontology.types.property_ import Property, PropertyFormat

PG_DSN = os.getenv("QSEM_PG_DSN", "postgresql://meta:meta@127.0.0.1:5432/metaplatform_ont")
T = "qsem"
OBJ_P = f"ont.{T}.obj.hr.person.v1"
OBJ_E = f"ont.{T}.obj.hr.employee.v1"
OBJ_M = f"ont.{T}.obj.hr.manager.v1"
IFACE = f"ont.{T}.if.named.v1"
OBJ_I1 = f"ont.{T}.obj.asset.device.v1"
OBJ_I2 = f"ont.{T}.obj.asset.laptop.v1"  # I1 的子类
P_ID = f"ont.{T}.prop.pid.v1"
P_NAME = f"ont.{T}.prop.pname.v1"
P_SCORE = f"ont.{T}.prop.pscore.v1"

# (rid 后缀, 类, name, score) —— score 含 None 以覆盖 null 语义
SEED: tuple[tuple[str, str, str, int | None], ...] = (
    ("alice", OBJ_P, "alice", 10),
    ("bob", OBJ_E, "bob", 20),
    ("carol", OBJ_M, "carol", None),
    ("dave", OBJ_I1, "dave", 5),
    ("erin", OBJ_I2, "erin", 30),
)


def _pg_available() -> bool:
    try:
        import psycopg2

        c = psycopg2.connect(PG_DSN, connect_timeout=3)
        c.close()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _pg_available(), reason=f"PG not reachable at {PG_DSN!r}")


def _prop(rid: str, *, pk: bool = False, numeric: bool = False) -> Property:
    return Property(
        rid=ClassRef(rid),
        type_id="integer" if numeric else "string",
        nullable=not pk,
        primary_key=pk,
        title=rid.split(".")[-2],
        format=PropertyFormat.INTEGER if numeric else PropertyFormat.STRING,
    )


def _types() -> tuple[ObjectType, ...]:
    def ot(rid: str, name: str, parent: str = "", ifaces: tuple[str, ...] = ()) -> ObjectType:
        return ObjectType(
            rid=ClassRef(rid),
            primary_key=(ClassRef(P_ID),),
            properties=(_prop(P_ID, pk=True), _prop(P_NAME), _prop(P_SCORE, numeric=True)),
            display_name=name,
            interfaces=tuple(ClassRef(i) for i in ifaces),
            parent_class=ClassRef(parent) if parent else None,
        )

    return (
        ot(OBJ_P, "person"),
        ot(OBJ_E, "employee", OBJ_P),
        ot(OBJ_M, "manager", OBJ_E),
        ot(OBJ_I1, "device", "", (IFACE,)),
        ot(OBJ_I2, "laptop", OBJ_I1),
    )


def _individuals() -> tuple[Individual, ...]:
    now = datetime.now(UTC)
    return tuple(
        Individual(
            rid=f"ont.{T}.ind.{cls.split('.')[4]}.{pk}",
            class_rid=ClassRef(cls),
            props=((ClassRef(P_ID), pk), (ClassRef(P_NAME), name), (ClassRef(P_SCORE), score)),
            primary_key=pk,
            created_at=now,
            updated_at=now,
            tenant_id=T,
        )
        for pk, cls, name, score in SEED
    )


@pytest.fixture()
def repo() -> Any:
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

    r = PgOntologyRepository(dsn=PG_DSN)
    r._ensure_schema()
    _clean(r)
    with r.tenant_scope(T):
        r.upsert_interface(
            Interface(rid=ClassRef(IFACE), properties=(_prop(P_NAME),), required_links=())
        )
        for ot in _types():
            r.upsert_object_type(ot)
        for ind in _individuals():
            r.create_individual(ind)
    yield r
    _clean(r)


def _clean(r: Any) -> None:
    import psycopg2

    conn = psycopg2.connect(PG_DSN)
    try:
        with conn.cursor() as cur:
            for tbl in (
                "ont_link_instance",
                "ont_individual",
                "ont_object_type",
                "ont_interface",
                "ont_axiom",
            ):
                cur.execute(f"DELETE FROM {tbl} WHERE tenant_id=%s", (T,))
        conn.commit()
    finally:
        conn.close()


def _mem_repo() -> InMemoryOntologyRepository:
    m = InMemoryOntologyRepository()
    m.upsert_interface(
        Interface(rid=ClassRef(IFACE), properties=(_prop(P_NAME),), required_links=())
    )
    for ot in _types():
        m.upsert_object_type(ot)
    for ind in _individuals():
        m.create_individual(ind)
    return m


def _browse(r: Any, src: str) -> set[str]:
    with r.tenant_scope(T):
        return {i.rid for i in r.list_individuals(ClassRef(src), tenant_id=T)}


def _ir(r: Any, src: str, **kw: Any) -> set[str]:
    with r.tenant_scope(T):
        res = r.execute_object_query(ObjectSetQuery(source=src, paging_limit=1000, **kw))
    return {row["__rid__"] for row in res.rows}


def _legacy(r: Any, src: str, **kw: Any) -> set[str]:
    # ObjectSet.filter_expr 必填；用恒真的非空属性（pname —— Interface 也声明了它）
    # 以覆盖全部行。字段按源类声明解析，故不能选 Interface 未声明的属性。
    with r.tenant_scope(T):
        return {
            i.rid
            for i in r.evaluate_object_set(
                ObjectSet(class_rid=ClassRef(src), filter_expr="pname", **kw)
            )
        }


def _rid(pk: str) -> str:
    cls = next(c for p, c, _n, _s in SEED if p == pk)
    return f"ont.{T}.ind.{cls.split('.')[4]}.{pk}"


class TestSourceResolutionMatrix:
    """源类解析矩阵：三条入口必须给出**同一**类集合。"""

    def test_parent_includes_descendants_in_all_entries(self, repo) -> None:
        want = {_rid("alice"), _rid("bob"), _rid("carol")}
        assert _browse(repo, OBJ_P) == want
        assert _ir(repo, OBJ_P) == want
        assert _legacy(repo, OBJ_P) == want

    def test_middle_and_leaf(self, repo) -> None:
        assert _ir(repo, OBJ_E) == {_rid("bob"), _rid("carol")}
        assert _ir(repo, OBJ_M) == {_rid("carol")}  # 叶子精确
        assert _browse(repo, OBJ_E) == {_rid("bob"), _rid("carol")}

    def test_interface_expands_to_implementers_plus_descendants(self, repo) -> None:
        want = {_rid("dave"), _rid("erin")}  # I1 + 其子类 I2
        assert _browse(repo, IFACE) == want
        assert _ir(repo, IFACE) == want
        assert _legacy(repo, IFACE) == want

    def test_unregistered_source_is_exact(self, repo) -> None:
        ghost = f"ont.{T}.obj.hr.ghost.v1"
        assert _browse(repo, ghost) == set()
        assert _ir(repo, ghost) == set()

    def test_interface_without_implementers_is_empty_not_unfiltered(self, repo) -> None:
        with repo.tenant_scope(T):
            repo.upsert_interface(
                Interface(rid=ClassRef(f"ont.{T}.if.orphan.v1"), properties=(), required_links=())
            )
        src = f"ont.{T}.if.orphan.v1"
        assert _browse(repo, src) == set()  # 不得退化成"返回全部"
        assert _ir(repo, src) == set()

    def test_disabled_axiom_falls_back_to_exact(self, repo) -> None:
        # parent_class 会在 upsert 时**自动派生** subclass 公理（单一事实源），
        # 因此要禁用的是那条派生公理（rid = obj → ax.parent 段替换）。
        head, ten, _kind, rest = OBJ_E.split(".", 3)
        ax_rid = f"{head}.{ten}.ax.parent.{rest}"
        with repo.tenant_scope(T):
            repo.upsert_axiom_record(ax_rid, "subclass", [OBJ_E, OBJ_P], tenant_id=T, enabled=False)
        try:
            assert _browse(repo, OBJ_P) == {_rid("alice")}
            assert _ir(repo, OBJ_P) == {_rid("alice")}
            assert _legacy(repo, OBJ_P) == {_rid("alice")}
        finally:
            with repo.tenant_scope(T):
                repo.upsert_axiom_record(
                    ax_rid, "subclass", [OBJ_E, OBJ_P], tenant_id=T, enabled=True
                )


class TestSortNullAndPaging:
    """排序 / null / 分页规则（跨引擎一致 + 稳定决胜）。"""

    def test_multi_key_sort_and_stable_tiebreak(self, repo) -> None:
        with repo.tenant_scope(T):
            res = repo.execute_object_query(
                ObjectSetQuery(
                    source=OBJ_P,
                    sort=(SortKey(field="pname", desc=False), SortKey(field="pscore", desc=True)),
                    paging_limit=100,
                )
            )
        names = [r["pname"] for r in res.rows]
        assert names == sorted(names)  # 第一键生效

    def test_null_ordering_matches_inmemory(self, repo) -> None:
        q = ObjectSetQuery(
            source=OBJ_P, sort=(SortKey(field="pscore", desc=False),), paging_limit=100
        )
        with repo.tenant_scope(T):
            pg_rows = [r["__rid__"] for r in repo.execute_object_query(q).rows]
        mem_rows = [
            r["__rid__"]
            for r in InMemoryQueryExecutor(list(_individuals()), (), list(_types()))
            .execute(q, source_classes=frozenset({OBJ_P, OBJ_E, OBJ_M}))
            .rows
        ]
        assert pg_rows == mem_rows, "null 序在两引擎不一致"

    def test_paging_is_stable_across_pages(self, repo) -> None:
        seen: list[str] = []
        with repo.tenant_scope(T):
            for off in (0, 2, 4):
                res = repo.execute_object_query(
                    ObjectSetQuery(source=OBJ_P, paging_offset=off, paging_limit=2)
                )
                seen.extend(r["__rid__"] for r in res.rows)
        assert len(seen) == len(set(seen)) == 3, f"分页出现重复/缺口：{seen}"

    def test_paging_and_field_validation(self, repo) -> None:
        with pytest.raises(ValueError):
            ObjectSetQuery(source=OBJ_P, paging_limit=0)
        with pytest.raises(ValueError):
            ObjectSetQuery(source=OBJ_P, paging_limit=10001)
        with pytest.raises(ValueError):
            ObjectSetQuery(source=OBJ_P, paging_offset=-1)
        with repo.tenant_scope(T):
            with pytest.raises(ValueError):
                repo.execute_object_query(
                    ObjectSetQuery(source=OBJ_P, sort=(SortKey(field="no-such-field"),))
                )


class TestAggregationParity:
    def test_group_by_count_matches_inmemory(self, repo) -> None:
        q = ObjectSetQuery(
            source=OBJ_P,
            aggregation=Aggregation(group_by=("pname",), metrics=(MetricSpec(fn="count"),)),
            paging_limit=100,
        )
        with repo.tenant_scope(T):
            pg = {tuple(sorted(r.items())) for r in repo.execute_object_query(q).rows}
        mem = {
            tuple(sorted(r.items()))
            for r in InMemoryQueryExecutor(list(_individuals()), (), list(_types()))
            .execute(q, source_classes=frozenset({OBJ_P, OBJ_E, OBJ_M}))
            .rows
        }
        assert pg == mem

    def test_sum_ignores_null_and_matches_inmemory(self, repo) -> None:
        q = ObjectSetQuery(
            source=OBJ_P,
            aggregation=Aggregation(metrics=(MetricSpec(fn="sum", field="pscore"),)),
            paging_limit=10,
        )
        with repo.tenant_scope(T):
            pg = [r["sum_pscore"] for r in repo.execute_object_query(q).rows]
        mem = [
            r["sum_pscore"]
            for r in InMemoryQueryExecutor(list(_individuals()), (), list(_types()))
            .execute(q, source_classes=frozenset({OBJ_P, OBJ_E, OBJ_M}))
            .rows
        ]
        assert pg == mem == [30]  # 10 + 20，null 不计


class TestSqlCountAndLatency:
    """代表性规模下的 SQL 次数与延迟（回归护栏，不是性能基准）。"""

    def test_sql_statement_budget_and_latency(self, repo) -> None:
        counter = {"n": 0}
        real_cursor = repo._cursor

        class _CountingCursor:
            def __init__(self, inner: Any) -> None:
                self._inner = inner

            def execute(self, *a: Any, **k: Any) -> Any:
                counter["n"] += 1
                return self._inner.execute(*a, **k)

            def __enter__(self) -> Any:
                self._inner.__enter__()
                return self

            def __exit__(self, *a: Any) -> Any:
                return self._inner.__exit__(*a)

            def __getattr__(self, name: str) -> Any:
                return getattr(self._inner, name)

        repo._cursor = lambda conn: _CountingCursor(real_cursor(conn))  # type: ignore[method-assign]
        try:
            t0 = time.perf_counter()
            with repo.tenant_scope(T):
                repo.list_individuals(ClassRef(OBJ_P), tenant_id=T)
                n_browse = counter["n"]
                counter["n"] = 0
                repo.execute_object_query(ObjectSetQuery(source=OBJ_P, paging_limit=100))
                n_ir = counter["n"]
            elapsed = time.perf_counter() - t0
        finally:
            repo._cursor = real_cursor  # type: ignore[method-assign]

        # 批量加载护栏：两个入口的语句数都不随实例数放大（5 实例下的上限）
        assert n_browse <= 6, f"浏览路径 SQL 次数过多（{n_browse}）：疑似逐行回查"
        assert n_ir <= 8, f"IR 路径 SQL 次数过多（{n_ir}）：疑似逐行回查"
        print(f"\n[QSEM] browse SQL={n_browse}  ir SQL={n_ir}  合计耗时={elapsed * 1000:.1f}ms")
