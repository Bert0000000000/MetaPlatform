"""G12/G13 —— 数组属性 reducer 折叠 + nearestNeighbors 入 ObjectSet IR。

G12：array+reducer 属性查询输出按声明折叠（first→首元素 / latest→末元素）。
G13：ObjectSetQuery.nearest —— 先 embedding KNN 预选 top-k，再套 filters/sort/paging
（先 KNN 后过滤）；PG 走 pgvector HNSW，InMemory 走 cosine。
"""
from __future__ import annotations

import os
import sys
from datetime import UTC, datetime

import pytest

_K = os.path.join(os.path.dirname(__file__), "..", "..", "mate-kernel", "src")
_O = os.path.join(os.path.dirname(__file__), "..", "src")
for _p in (_K, _O):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from mate_kernel.objectset.ir import Condition, NearestSpec, ObjectSetQuery, QueryOp
from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.in_memory import InMemoryOntologyRepository
from mate_kernel.ontology.instances.individual import Individual
from mate_kernel.ontology.types.object_type import ObjectType
from mate_kernel.ontology.types.property_ import Property, PropertyFormat

T = "g12g13"
OBJ = f"ont.{T}.obj.crm.tagged-doc.v1"
P_ID = f"ont.{T}.prop.did.v1"
P_TAGS = f"ont.{T}.prop.dtags.v1"
P_ALIASES = f"ont.{T}.prop.daliases.v1"


def _repo() -> InMemoryOntologyRepository:
    from mate_tech_ont.v2_kernel.object_search import HashEmbedder

    r = InMemoryOntologyRepository()
    r.set_embedder(HashEmbedder())
    r.upsert_object_type(ObjectType(
        rid=ClassRef(OBJ), primary_key=(ClassRef(P_ID),),
        properties=(
            Property(rid=ClassRef(P_ID), type_id="string", nullable=False,
                     primary_key=True, title="id", format=PropertyFormat.STRING),
            Property(rid=ClassRef(P_TAGS), type_id="string", nullable=True,
                     primary_key=False, title="tags", format=PropertyFormat.STRING,
                     array=True, reducer="first"),
            Property(rid=ClassRef(P_ALIASES), type_id="string", nullable=True,
                     primary_key=False, title="aliases", format=PropertyFormat.STRING,
                     array=True, reducer="latest"),
        ),
        display_name="doc",
    ))
    r.create_individual(Individual(
        rid=f"ont.{T}.ind.tagged-doc.d1", class_rid=ClassRef(OBJ),
        props=((ClassRef(P_ID), "d1"), (ClassRef(P_TAGS), ["urgent", "beta"]),
               (ClassRef(P_ALIASES), ["旧名", "新名"])),
        primary_key="d1", tenant_id=T,
        created_at=datetime.now(UTC), updated_at=datetime.now(UTC),
    ))
    r.create_individual(Individual(
        rid=f"ont.{T}.ind.tagged-doc.d2", class_rid=ClassRef(OBJ),
        props=((ClassRef(P_ID), "d2"), (ClassRef(P_TAGS), ["contract", "final"])),
        primary_key="d2", tenant_id=T,
        created_at=datetime.now(UTC), updated_at=datetime.now(UTC),
    ))
    return r


class TestArrayReducers:
    def test_first_and_latest_folded(self) -> None:
        r = _repo()
        result = r.execute_object_query(ObjectSetQuery(source=OBJ))
        rows = {x["did"]: x for x in result.rows}
        assert rows["d1"]["dtags"] == "urgent"
        assert rows["d1"]["daliases"] == "新名"
        assert rows["d2"]["dtags"] == "contract"


class TestNearestIR:
    def test_nearest_inmemory(self) -> None:
        r = _repo()
        result = r.execute_object_query(ObjectSetQuery(
            source=OBJ, nearest=NearestSpec(text="contract final", k=1)))
        assert len(result.rows) == 1
        assert result.rows[0]["did"] == "d2"

    def test_nearest_then_filter(self) -> None:
        r = _repo()
        result = r.execute_object_query(ObjectSetQuery(
            source=OBJ,
            filters=(Condition(field="did", op=QueryOp.EQ, value="d1"),),
            nearest=NearestSpec(text="contract final", k=2),
        ))
        # k=2 选中两个，filter did=d1 收窄到 d1（先 KNN 后过滤语义）
        assert len(result.rows) == 1
        assert result.rows[0]["did"] == "d1"


PG_DSN = os.environ.get(
    "G12G13_PG_DSN", "postgresql://meta:meta@127.0.0.1:5432/metaplatform_ont"
)


class TestPgNearest:
    def test_pg_nearest_knn_in_ir(self) -> None:
        pytest.importorskip("psycopg2")
        os.environ["ONT_VECTOR_DIM"] = "384"  # 必须在 repo 构造前（__init__ 即跑 pgvector 升级）
        from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

        r = PgOntologyRepository(dsn=PG_DSN)
        try:
            r._ensure_schema()
        except Exception as e:
            pytest.skip(f"PG unavailable: {e}")
        if not getattr(r, "_pgvector_ready", False):
            pytest.skip("pgvector not available")
        from mate_tech_ont.v2_kernel.object_search import HashEmbedder

        r.set_embedder(HashEmbedder())
        import psycopg2

        conn = psycopg2.connect(PG_DSN)
        try:
            with r.tenant_scope(T):
                mem = _repo()
                for ot in mem.list_object_types(10, 0):
                    r.upsert_object_type(ot)
                for i in mem.list_individuals(None):
                    r.create_individual(i)
                result = r.execute_object_query(ObjectSetQuery(
                    source=OBJ, nearest=NearestSpec(text="contract final", k=1)))
                assert len(result.rows) == 1
                assert result.rows[0]["did"] == "d2"
                assert result.rows[0]["dtags"] == "contract"  # G12 折叠同路径
        finally:
            with conn.cursor() as cur:
                for tbl in ("ont_object_embedding", "ont_individual",
                            "ont_object_type", "ont_axiom"):
                    cur.execute(f"DELETE FROM {tbl} WHERE tenant_id=%s", (T,))
            conn.commit()
            conn.close()
