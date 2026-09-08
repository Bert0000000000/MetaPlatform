"""ONT-G1 收口 — 双后端对拍：PG execute_object_query vs InMemory 执行器。

同一份数据（测试自建类型+实例+link，写进真 PG）、同一 ObjectSetQuery IR，
两后端结果必须一致（aggregate / traversal / filter 三面）。
前置：本地 PG（mate-postgres，5432 meta/meta，库 metaplatform）。
"""
from __future__ import annotations

import os
import sys

import pytest

_K = os.path.join(os.path.dirname(__file__), "..", "..", "mate-kernel", "src")
_O = os.path.join(os.path.dirname(__file__), "..", "src")
for _p in (_K, _O):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from mate_kernel.objectset.ir import (  # noqa: E402
    Aggregation, Condition, MetricSpec, ObjectSetQuery, QueryOp, TraversalStep,
)
from mate_kernel.ontology.identity.class_ref import ClassRef  # noqa: E402
from mate_kernel.ontology.types.object_type import ObjectType  # noqa: E402
from mate_kernel.ontology.types.property_ import Property, PropertyFormat  # noqa: E402
from mate_kernel.ontology.instances.link_instance import LinkInstance  # noqa: E402

PG_DSN = os.environ.get(
    "PARITY_PG_DSN", "postgresql://meta:meta@127.0.0.1:5432/metaplatform_ont"
)

T = "t-parity"
OBJ = f"ont.{T}.obj.item.v1"
P1 = f"ont.{T}.prop.item-cat.v1"
P2 = f"ont.{T}.prop.item-qty.v1"
LINK = f"ont.{T}.link.item-rel.v1"


@pytest.fixture(scope="module")
def repo():
    pytest.importorskip("psycopg2")
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

    r = PgOntologyRepository(dsn=PG_DSN)
    try:
        r._ensure_schema()
    except Exception as e:  # PG 不可达 → 跳过而非失败
        pytest.skip(f"PG unavailable: {e}")
    ot = ObjectType(
        rid=ClassRef(OBJ), display_name="item",
        primary_key=(ClassRef(P1),),
        properties=(Property(rid=ClassRef(P1), type_id="string", nullable=False,
                             primary_key=True, title="cat",
                             format=PropertyFormat.STRING),
                    Property(rid=ClassRef(P2), type_id="integer", nullable=False,
                             primary_key=False, title="qty",
                             format=PropertyFormat.INTEGER)),
    )
    with r.tenant_scope(T):
        r.upsert_object_type(ot)
    yield r
    # 清理
    import psycopg2

    conn = psycopg2.connect(PG_DSN)
    with conn.cursor() as cur:
        cur.execute("DELETE FROM ont_individual WHERE class_rid=%s", (OBJ,))
        cur.execute("DELETE FROM ont_link_instance WHERE link_type_rid=%s", (LINK,))
        cur.execute("DELETE FROM ont_object_type WHERE rid=%s", (OBJ,))
    conn.commit()
    conn.close()


def _seed(repo):
    """建 4 实例（cat a×2 qty 10/20, cat b×1 qty 5, cat c×1 qty 7）+ a→b link。"""
    from mate_kernel.ontology.instances.individual import Individual

    ids = []
    from datetime import UTC as _U
    from datetime import datetime as _dt

    for i, (cat, qty) in enumerate([("a", 10), ("a", 20), ("b", 5), ("c", 7)]):
        ind = Individual(
            rid=f"ont.{T}.ind.item.p{i}", class_rid=ClassRef(OBJ),
            props=((ClassRef(P1), cat), (ClassRef(P2), qty)),
            primary_key=f"p{i}", tenant_id=T,
            created_at=_dt.now(_U), updated_at=_dt.now(_U),
        )
        r = repo.create_individual(ind)
        rid = r.rid.rid if hasattr(r.rid, 'rid') else r.rid
        ids.append(rid)
    repo.create_link_instance(LinkInstance(
        rid=f"ont.{T}.lnk.item-rel.{ids[0][-2:]}.{ids[2][-2:]}", link_type_rid=ClassRef(LINK),
        src=ids[0], dst=ids[2], props=(), created_at=_dt.now(_U), tenant_id=T,
    ))
    return ids





def _inmemory(repo, q):
    from datetime import UTC as _U
    from datetime import datetime as _dt

    from mate_kernel.objectset.ir import InMemoryQueryExecutor
    from mate_kernel.ontology.instances.link_instance import LinkInstance

    with repo.tenant_scope(T):
        inds = list(repo.list_individuals(ClassRef(OBJ)))
    import psycopg2

    conn = psycopg2.connect(PG_DSN)
    with conn.cursor() as cur:
        cur.execute(
            "SELECT rid, src, dst FROM ont_link_instance WHERE link_type_rid=%s",
            (LINK,))
        rows = cur.fetchall()
    conn.close()
    links = [LinkInstance(
        rid=r, link_type_rid=ClassRef(LINK), src=src, dst=dst,
        props=(), created_at=_dt.now(_U), tenant_id=T,
    ) for r, src, dst in rows]
    ot = repo.get_object_type(ClassRef(OBJ))
    return InMemoryQueryExecutor(inds, links, [ot]).execute(q)


class TestParity:
    def test_filter_parity(self, repo) -> None:
        _seed(repo)
        q = ObjectSetQuery(
            source=OBJ,
            filters=(Condition(field="item-cat", op=QueryOp.EQ, value="a"),),
            paging_limit=10,
        )
        with repo.tenant_scope(T):
            pg = repo.execute_object_query(q)
        mem = _inmemory(repo, q)
        assert pg.kind == mem.kind == "objects"
        assert sorted(r["item-cat"] for r in pg.rows) == sorted(
            r["item-cat"] for r in mem.rows) == ["a", "a"]

    def test_aggregate_parity(self, repo) -> None:
        _seed(repo)
        q = ObjectSetQuery(
            source=OBJ,
            aggregation=Aggregation(
                group_by=("item-cat",),
                metrics=(MetricSpec(fn="sum", field="item-qty", alias="total"),
                         MetricSpec(fn="count", alias="n")),
            ),
        )
        with repo.tenant_scope(T):
            pg = repo.execute_object_query(q)
        mem = _inmemory(repo, q)
        key = lambda rows: {r["item-cat"]: (r["total"], r["n"]) for r in rows}
        assert key(pg.rows) == key(mem.rows) == {
            "a": (30, 2), "b": (5, 1), "c": (7, 1)}

    def test_traversal_parity(self, repo) -> None:
        ids = _seed(repo)
        q = ObjectSetQuery(
            source=OBJ,
            filters=(Condition(field="item-cat", op=QueryOp.EQ, value="a"),),
            traversal=(TraversalStep(link_type=LINK, direction="out"),),
            paging_limit=10,
        )
        with repo.tenant_scope(T):
            pg = repo.execute_object_query(q)
        mem = _inmemory(repo, q)
        # a→b 唯一一条 link；两后端都应只到 p2（cat b）
        assert sorted(r.get("item-cat") for r in pg.rows) == sorted(
            r.get("item-cat") for r in mem.rows) == ["b"]
