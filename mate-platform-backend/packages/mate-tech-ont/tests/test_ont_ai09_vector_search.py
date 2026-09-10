"""AI-09 —— 向量检索生产化：pgvector halfvec+HNSW / KNN / hybrid RRF。

覆盖：
1. pgvector 升级：embedding_vec 列 + HNSW 索引就绪（扩展可用时）；
2. 写路径：create_individual → embedding_vec 落列；
3. KNN 检索：search_objects 走 HNSW（与 JSONB cosine 同语义 —— top 命中一致）；
4. hybrid：关键词 + 向量双路命中融合（RRF），legs 携带两路排名；
5. InMemory hybrid 同语义。
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

from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.in_memory import InMemoryOntologyRepository
from mate_kernel.ontology.instances.individual import Individual
from mate_kernel.ontology.types.object_type import ObjectType
from mate_kernel.ontology.types.property_ import Property, PropertyFormat

T = "ai09"
OBJ_CUST = f"ont.{T}.obj.crm.customer.v1"
P_NAME = f"ont.{T}.prop.cname.v1"
P_CITY = f"ont.{T}.prop.city.v1"


def _ot() -> ObjectType:
    return ObjectType(
        rid=ClassRef(OBJ_CUST),
        primary_key=(ClassRef(P_NAME),),
        properties=(
            Property(
                rid=ClassRef(P_NAME),
                type_id="string",
                nullable=False,
                primary_key=True,
                title="name",
                format=PropertyFormat.STRING,
            ),
            Property(
                rid=ClassRef(P_CITY),
                type_id="string",
                nullable=True,
                primary_key=False,
                title="city",
                format=PropertyFormat.STRING,
            ),
        ),
        display_name="customer",
    )


def _ind(pk: str, name: str, city: str) -> Individual:
    return Individual(
        rid=f"ont.{T}.ind.customer.{pk}",
        class_rid=ClassRef(OBJ_CUST),
        props=((ClassRef(P_NAME), name), (ClassRef(P_CITY), city)),
        primary_key=pk,
        tenant_id=T,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


class TestInMemoryHybrid:
    def test_rrf_fusion_and_legs(self) -> None:
        from mate_tech_ont.v2_kernel.object_search import HashEmbedder

        r = InMemoryOntologyRepository()
        r.set_embedder(HashEmbedder())
        r.upsert_object_type(_ot())
        r.create_individual(_ind("c1", "华东重工集团", "上海"))
        r.create_individual(_ind("c2", "华南轻工集团", "广州"))
        cards = r.search_objects_hybrid("上海 重工", top_k=2)
        assert cards, "hybrid should return cards"
        top = cards[0]
        assert top["legs"]["keyword_rank"] is not None
        assert top["legs"]["vector_rank"] is not None
        # 双路命中的对象 RRF 分应高于单路
        if len(cards) > 1:
            assert top["score"] >= cards[1]["score"]

    def test_vector_only_query(self) -> None:
        from mate_tech_ont.v2_kernel.object_search import HashEmbedder

        r = InMemoryOntologyRepository()
        r.set_embedder(HashEmbedder())
        r.upsert_object_type(_ot())
        r.create_individual(_ind("c1", "华东重工集团", "上海"))
        cards = r.search_objects_hybrid("华东重工集团", top_k=1)
        assert cards and cards[0]["individual_rid"].endswith("c1")


PG_DSN = os.environ.get("AI09_PG_DSN", "postgresql://meta:meta@127.0.0.1:5432/metaplatform_ont")


class TestPgVector:
    @pytest.fixture(scope="class")
    def pg_repo(self):
        pytest.importorskip("psycopg2")
        os.environ["ONT_VECTOR_DIM"] = "384"  # HashEmbedder 维度（列随 env 重建）
        from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

        r = PgOntologyRepository(dsn=PG_DSN)
        try:
            r._ensure_schema()
        except Exception as e:
            pytest.skip(f"PG unavailable: {e}")
        if not r._pgvector_ready:
            pytest.skip("pgvector extension not available")
        from mate_tech_ont.v2_kernel.object_search import HashEmbedder

        r.set_embedder(HashEmbedder())
        with r.tenant_scope(T):
            r.upsert_object_type(_ot())
            r.create_individual(_ind("p1", "华东重工集团", "上海"))
            r.create_individual(_ind("p2", "华南轻工集团", "广州"))
        yield r
        import psycopg2

        conn = psycopg2.connect(PG_DSN)
        with conn.cursor() as cur:
            cur.execute("DELETE FROM ont_object_embedding WHERE tenant_id=%s", (T,))
            cur.execute("DELETE FROM ont_individual WHERE tenant_id=%s", (T,))
            cur.execute("DELETE FROM ont_object_type WHERE tenant_id=%s", (T,))
            cur.execute("DELETE FROM ont_axiom WHERE tenant_id=%s", (T,))
        conn.commit()
        conn.close()

    def test_embedding_vec_written_and_knn(self, pg_repo) -> None:
        import psycopg2

        conn = psycopg2.connect(PG_DSN)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM ont_object_embedding "
                "WHERE tenant_id=%s AND embedding_vec IS NOT NULL",
                (T,),
            )
            assert cur.fetchone()[0] >= 2, "embedding_vec should be populated"
        conn.commit()
        conn.close()
        with pg_repo.tenant_scope(T):
            cards = pg_repo.search_objects("华东重工", top_k=2)
            assert cards, "KNN search should return cards"
            assert cards[0]["individual_rid"].endswith("p1")

    def test_hybrid_pg(self, pg_repo) -> None:
        with pg_repo.tenant_scope(T):
            cards = pg_repo.search_objects_hybrid("上海 重工", top_k=2)
            assert cards
            assert any(c["legs"].get("keyword_rank") for c in cards)
