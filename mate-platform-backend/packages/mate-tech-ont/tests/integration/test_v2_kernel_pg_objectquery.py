"""MP-SAL-01: PgOntologyRepository.execute_object_query —— PG 侧 IR 执行（ADR-0043 §2.1）。

三层策略（沿 test_v2_kernel_pg_objectset.py 约定）：
1. mock 连接捕获 SQL —— CI 恒跑：聚合 GROUP BY / 遍历 JOIN ont_link_instance /
   多键 ORDER BY / marking 列持久化；
2. PG 可达时（PG_DSN）—— 真跑，并与 InMemoryQueryExecutor 同数据对拍
   （双后端一致性 = IR 单一事实源的直接证明）；
3. 实现前本文件为红（execute_object_query / ir 模块不存在）。
"""

from __future__ import annotations

import os
import threading
from datetime import UTC, datetime
from typing import Any

import pytest

from mate_kernel.objectset.ir import (
    Aggregation,
    Condition,
    InMemoryQueryExecutor,
    MetricSpec,
    ObjectSetQuery,
    QueryOp,
    SortKey,
    TraversalStep,
)
from mate_kernel.ontology.identity import ClassRef
from mate_kernel.ontology.instances import Individual, LinkInstance
from mate_kernel.ontology.types import ObjectType, Property, PropertyFormat
from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

_T = "salpg"
_NOW = datetime.now(UTC)
LINK_OWNS = f"ont.{_T}.link.owns.v1"


def _prop(slug: str, fmt: PropertyFormat = PropertyFormat.STRING, type_id: str = "string") -> Property:
    return Property(
        rid=ClassRef(f"ont.{_T}.prop.{slug}.v1"),
        type_id=type_id, nullable=True, primary_key=False, title=slug, format=fmt,
    )


def _ot_order() -> ObjectType:
    return ObjectType(
        rid=ClassRef(f"ont.{_T}.obj.order.v1"),
        primary_key=(ClassRef(f"ont.{_T}.prop.oid.v1"),),
        properties=(
            Property(rid=ClassRef(f"ont.{_T}.prop.oid.v1"), type_id="string",
                     nullable=False, primary_key=True, title="oid",
                     format=PropertyFormat.STRING),
            _prop("amount", PropertyFormat.INTEGER, "integer"),
            _prop("status"),
            _prop("region"),
        ),
        display_name="order",
    )


def _ot_customer() -> ObjectType:
    return ObjectType(
        rid=ClassRef(f"ont.{_T}.obj.customer.v1"),
        primary_key=(ClassRef(f"ont.{_T}.prop.cid.v1"),),
        properties=(
            Property(rid=ClassRef(f"ont.{_T}.prop.cid.v1"), type_id="string",
                     nullable=False, primary_key=True, title="cid",
                     format=PropertyFormat.STRING),
            _prop("tier"),
        ),
        display_name="customer",
    )


def _order(oid: str, amount: int, status: str, region: str) -> Individual:
    return Individual(
        rid=f"ont.{_T}.ind.order.{oid}",
        class_rid=ClassRef(f"ont.{_T}.obj.order.v1"),
        props=(
            (ClassRef(f"ont.{_T}.prop.oid.v1"), oid),
            (ClassRef(f"ont.{_T}.prop.amount.v1"), amount),
            (ClassRef(f"ont.{_T}.prop.status.v1"), status),
            (ClassRef(f"ont.{_T}.prop.region.v1"), region),
        ),
        primary_key=oid, created_at=_NOW, updated_at=_NOW, tenant_id=_T, marking=(),
    )


def _customer(cid: str, tier: str) -> Individual:
    return Individual(
        rid=f"ont.{_T}.ind.customer.{cid}",
        class_rid=ClassRef(f"ont.{_T}.obj.customer.v1"),
        props=(
            (ClassRef(f"ont.{_T}.prop.cid.v1"), cid),
            (ClassRef(f"ont.{_T}.prop.tier.v1"), tier),
        ),
        primary_key=cid, created_at=_NOW, updated_at=_NOW, tenant_id=_T, marking=(),
    )


def _link(src_rid: str, dst_rid: str) -> LinkInstance:
    return LinkInstance(
        rid=f"ont.{_T}.lnk.{src_rid.rsplit('.', maxsplit=1)[-1]}-{dst_rid.rsplit('.', maxsplit=1)[-1]}",
        link_type_rid=ClassRef(LINK_OWNS),
        src=src_rid, dst=dst_rid,
        props=(), created_at=_NOW, tenant_id=_T, marking=(),
    )


_ORDER_ROWS = (
    ("o1", 100, "open", "north"),
    ("o2", 250, "open", "south"),
    ("o3", 50, "closed", "north"),
    ("o4", 300, "open", "north"),
)


def _seed_data() -> tuple[tuple[Individual, ...], tuple[Individual, ...], tuple[LinkInstance, ...]]:
    orders = tuple(_order(*row) for row in _ORDER_ROWS)
    customers = (_customer("c1", "gold"), _customer("c2", "silver"))
    links = (
        _link(f"ont.{_T}.ind.order.o1", f"ont.{_T}.ind.customer.c1"),
        _link(f"ont.{_T}.ind.order.o2", f"ont.{_T}.ind.customer.c2"),
        _link(f"ont.{_T}.ind.order.o3", f"ont.{_T}.ind.customer.c1"),
        _link(f"ont.{_T}.ind.order.o4", f"ont.{_T}.ind.customer.c2"),
    )
    return orders, customers, links


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
    repo = PgOntologyRepository.__new__(PgOntologyRepository)
    repo._dsn = "postgresql://mock/mock"
    repo._lock = threading.Lock()
    repo._initialized = True
    repo._tenant_local = threading.local()

    from mate_kernel.action.engine import ActionService  # noqa: PLC0415
    from mate_kernel.ontology.function_resolver import (  # noqa: PLC0415
        InMemoryFunctionResolver,
    )
    repo._action_service = ActionService()
    repo._function_resolver = InMemoryFunctionResolver()
    repo._function_executor = None

    conn = _CaptureConn()

    def _fake_connect() -> tuple[_CaptureConn, Any]:
        return conn, None

    monkeypatch.setattr(repo, "_connect", _fake_connect)
    monkeypatch.setattr(repo, "get_object_type", lambda rid: _ot_order())
    return repo, conn.cursor_obj


def _placeholders(sql: str) -> int:
    return sql.count("%s")


class TestAggregateSql:
    def test_group_by_and_sum_compiled(self, capture_repo: tuple[PgOntologyRepository, _CaptureCursor]) -> None:
        repo, cur = capture_repo
        repo.execute_object_query(ObjectSetQuery(
            source=_ot_order().rid,
            aggregation=Aggregation(
                group_by=("region",),
                metrics=(MetricSpec(fn="sum", field="amount"),),
            ),
        ))
        sql, params = cur.executed[-1]
        assert "GROUP BY" in sql
        assert f"(props ->> 'ont.{_T}.prop.region.v1')" in sql
        assert "sum_amount" in sql
        assert f"SUM((props ->> 'ont.{_T}.prop.amount.v1')::numeric)" in sql
        assert _placeholders(sql) == len(params)

    def test_count_star_without_field(self, capture_repo: tuple[PgOntologyRepository, _CaptureCursor]) -> None:
        repo, cur = capture_repo
        repo.execute_object_query(ObjectSetQuery(
            source=_ot_order().rid,
            aggregation=Aggregation(metrics=(MetricSpec(fn="count"),)),
        ))
        sql, _ = cur.executed[-1]
        assert "COUNT(*)" in sql


class TestTraversalSql:
    def test_out_traversal_joins_link_instance(self, capture_repo: tuple[PgOntologyRepository, _CaptureCursor]) -> None:
        repo, cur = capture_repo
        repo.execute_object_query(ObjectSetQuery(
            source=_ot_order().rid,
            filters=(Condition("status", QueryOp.EQ, "open"),),
            traversal=(TraversalStep(link_type=LINK_OWNS, direction="out"),),
        ))
        sql, params = cur.executed[-1]
        assert "ont_link_instance" in sql
        assert f"ont.{_T}.link.owns.v1" in params or LINK_OWNS in sql
        assert _placeholders(sql) == len(params)


class TestMultiKeySortSql:
    def test_two_key_order_by(self, capture_repo: tuple[PgOntologyRepository, _CaptureCursor]) -> None:
        repo, cur = capture_repo
        repo.execute_object_query(ObjectSetQuery(
            source=_ot_order().rid,
            sort=(SortKey("status"), SortKey("amount", desc=True)),
        ))
        sql, _ = cur.executed[-1]
        assert sql.count("ORDER BY") == 1
        assert "ASC" in sql and "DESC" in sql


# ─────────────────── PG 可达：真跑 + 与 InMemory 对拍 ───────────────────

PG_DSN = os.getenv("PG_DSN", "postgresql://meta:meta@localhost:5432/metaplatform_ont_test")


def _pg_available() -> bool:
    try:
        import psycopg2  # type: ignore  # noqa: PLC0415
        conn = psycopg2.connect(PG_DSN, connect_timeout=2)
        conn.close()
        return True
    except Exception:
        return False


def _normalized(rows: list[dict[str, Any]]) -> list[str]:
    """行集 → 可比较的规范串（排序后 JSON）。"""
    import json  # noqa: PLC0415
    return sorted(json.dumps(r, sort_keys=True, default=str) for r in rows)


@pytest.mark.skipif(not _pg_available(), reason=f"PG not reachable at {PG_DSN!r}")
class TestRealPgParity:
    def test_inmemory_and_pg_agree(self) -> None:
        import psycopg2  # type: ignore  # noqa: PLC0415

        repo = PgOntologyRepository(dsn=PG_DSN)
        repo._ensure_schema()
        conn = psycopg2.connect(PG_DSN)
        try:
            with conn.cursor() as cur:
                for tbl in ("ont_link_instance", "ont_individual", "ont_object_type"):
                    cur.execute(f"DELETE FROM {tbl} WHERE tenant_id = %s", (_T,))  # noqa: S608
            conn.commit()
        finally:
            conn.close()

        orders, customers, links = _seed_data()
        repo.upsert_object_type(_ot_order())
        repo.upsert_object_type(_ot_customer())
        for ind in (*orders, *customers):
            repo.create_individual(ind)
        for lnk in links:
            repo.create_link_instance(lnk)

        mem = InMemoryQueryExecutor(
            individuals=(*orders, *customers), links=links,
            object_types=(_ot_order(), _ot_customer()),
        )

        cases: list[ObjectSetQuery] = [
            ObjectSetQuery(
                source=_ot_order().rid,
                filters=(Condition("status", QueryOp.EQ, "open"),),
                sort=(SortKey("amount", desc=True),),
            ),
            ObjectSetQuery(
                source=_ot_order().rid,
                aggregation=Aggregation(
                    group_by=("region",),
                    metrics=(MetricSpec(fn="sum", field="amount"), MetricSpec(fn="count")),
                ),
            ),
            ObjectSetQuery(
                source=_ot_order().rid,
                filters=(Condition("status", QueryOp.EQ, "open"),),
                traversal=(TraversalStep(link_type=LINK_OWNS, direction="out"),),
            ),
        ]
        for q in cases:
            pg_res = repo.execute_object_query(q)
            mem_res = mem.execute(q)
            assert pg_res.kind == mem_res.kind, q
            assert _normalized(list(pg_res.rows)) == _normalized(list(mem_res.rows)), q

        # marking 上抬一级：类型级标记持久化往返
        marked = ObjectType(
            rid=ClassRef(f"ont.{_T}.obj.ledger.v1"),
            primary_key=(ClassRef(f"ont.{_T}.prop.lid.v1"),),
            properties=(
                Property(rid=ClassRef(f"ont.{_T}.prop.lid.v1"), type_id="string",
                         nullable=False, primary_key=True, title="lid",
                         format=PropertyFormat.STRING),
            ),
            display_name="ledger",
            marking=("domain:finance",),
        )
        repo.upsert_object_type(marked)
        got = repo.get_object_type(marked.rid)
        assert got.marking == ("domain:finance",)

        conn = psycopg2.connect(PG_DSN)
        try:
            with conn.cursor() as cur:
                for tbl in ("ont_link_instance", "ont_individual", "ont_object_type"):
                    cur.execute(f"DELETE FROM {tbl} WHERE tenant_id = %s", (_T,))  # noqa: S608
            conn.commit()
        finally:
            conn.close()
