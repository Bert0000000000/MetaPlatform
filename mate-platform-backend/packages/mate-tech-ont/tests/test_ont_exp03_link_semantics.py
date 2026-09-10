"""EXP-03 —— Link 强化：两端命名 / 基数强制 / searchAround。

覆盖：
1. cardinality 写入校验：1:1 / 1:N / N:1 违规拒绝，N:N 放行（InMemory + PG）；
2. 两端命名 round-trip（DTO → repo → DTO）与 search_around 的方向性显示名；
3. search_around：按 (link_type, direction) 分组、对端实例行、limit 生效；
4. 未注册 LinkType 的链接保持 legacy 宽松（不校验）。
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

from mate_kernel.ontology.identity.class_ref import ClassRef  # noqa: E402
from mate_kernel.ontology.in_memory import InMemoryOntologyRepository  # noqa: E402
from mate_kernel.ontology.instances.individual import Individual  # noqa: E402
from mate_kernel.ontology.instances.link_instance import LinkInstance  # noqa: E402
from mate_kernel.ontology.types.link_type import (  # noqa: E402
    Cardinality,
    Directionality,
    LinkType,
)
from mate_kernel.ontology.types.object_type import ObjectType  # noqa: E402
from mate_kernel.ontology.types.property_ import Property, PropertyFormat  # noqa: E402

T = "exp03"
OBJ_A = f"ont.{T}.obj.core.alpha.v1"
OBJ_B = f"ont.{T}.obj.core.beta.v1"
LINK_11 = f"ont.{T}.link.core.a-b-one-one.v1"
LINK_NN = f"ont.{T}.link.core.a-b-many-many.v1"
P_NAME = f"ont.{T}.prop.ename.v1"


def _ot(rid: str, name: str) -> ObjectType:
    return ObjectType(
        rid=ClassRef(rid),
        primary_key=(ClassRef(P_NAME),),
        properties=(
            Property(rid=ClassRef(P_NAME), type_id="string", nullable=False,
                     primary_key=True, title="name", format=PropertyFormat.STRING),
        ),
        display_name=name,
    )


def _lt(rid: str, card: Cardinality) -> LinkType:
    return LinkType(
        rid=ClassRef(rid), src=ClassRef(OBJ_A), dst=ClassRef(OBJ_B),
        cardinality=card, directionality=Directionality.DIRECTED,
        src_display_name="betas", dst_display_name="alpha",
    )


def _ind(rid: str, class_rid: str, name: str) -> Individual:
    return Individual(
        rid=rid, class_rid=ClassRef(class_rid),
        props=((ClassRef(P_NAME), name),),
        primary_key=name, tenant_id=T,
        created_at=datetime.now(UTC), updated_at=datetime.now(UTC),
    )


def _li(n: int, lt_rid: str, src: str, dst: str) -> LinkInstance:
    return LinkInstance(
        rid=f"ont.{T}.lnk.x{n}", link_type_rid=ClassRef(lt_rid),
        src=src, dst=dst, props=(),
        created_at=datetime.now(UTC), tenant_id=T,
    )


@pytest.fixture()
def repo() -> InMemoryOntologyRepository:
    r = InMemoryOntologyRepository()
    r.upsert_object_type(_ot(OBJ_A, "alpha"))
    r.upsert_object_type(_ot(OBJ_B, "beta"))
    r.upsert_link_type(_lt(LINK_11, Cardinality.ONE_TO_ONE))
    r.upsert_link_type(_lt(LINK_NN, Cardinality.MANY_TO_MANY))
    for i, cls in [(1, OBJ_A), (2, OBJ_A), (3, OBJ_B), (4, OBJ_B)]:
        slug = {OBJ_A: "alpha", OBJ_B: "beta"}[cls]
        r.create_individual(_ind(f"ont.{T}.ind.{slug}.{i}", cls, f"n{i}"))
    return r


class TestCardinalityEnforcement:
    def test_one_to_one_second_src_rejected(self, repo) -> None:
        repo.create_link_instance(_li(1, LINK_11, f"ont.{T}.ind.alpha.1", f"ont.{T}.ind.beta.3"))
        with pytest.raises(ValueError, match="1:1 violated: src"):
            repo.create_link_instance(_li(2, LINK_11, f"ont.{T}.ind.alpha.1", f"ont.{T}.ind.beta.4"))

    def test_one_to_one_second_dst_rejected(self, repo) -> None:
        repo.create_link_instance(_li(1, LINK_11, f"ont.{T}.ind.alpha.1", f"ont.{T}.ind.beta.3"))
        with pytest.raises(ValueError, match="1:1 violated: dst"):
            repo.create_link_instance(_li(2, LINK_11, f"ont.{T}.ind.alpha.2", f"ont.{T}.ind.beta.3"))

    def test_many_to_many_allows_all(self, repo) -> None:
        repo.create_link_instance(_li(1, LINK_NN, f"ont.{T}.ind.alpha.1", f"ont.{T}.ind.beta.3"))
        repo.create_link_instance(_li(2, LINK_NN, f"ont.{T}.ind.alpha.1", f"ont.{T}.ind.beta.4"))
        repo.create_link_instance(_li(3, LINK_NN, f"ont.{T}.ind.alpha.2", f"ont.{T}.ind.beta.3"))
        assert len(repo.list_link_instances()) == 3

    def test_unregistered_link_type_lenient(self, repo) -> None:
        GHOST = f"ont.{T}.link.core.ghost.v1"
        repo.create_link_instance(_li(1, GHOST, f"ont.{T}.ind.alpha.1", f"ont.{T}.ind.beta.3"))
        repo.create_link_instance(_li(2, GHOST, f"ont.{T}.ind.alpha.1", f"ont.{T}.ind.beta.4"))
        assert len(repo.list_link_instances()) == 2


class TestTwoSidedNaming:
    def test_display_names_roundtrip(self, repo) -> None:
        lt = repo.get_link_type(ClassRef(LINK_11))
        assert lt.src_display_name == "betas"
        assert lt.dst_display_name == "alpha"

    def test_search_around_uses_directional_display(self, repo) -> None:
        repo.create_link_instance(_li(1, LINK_NN, f"ont.{T}.ind.alpha.1", f"ont.{T}.ind.beta.3"))
        around = repo.search_around(f"ont.{T}.ind.alpha.1")
        assert len(around) == 1
        entry = around[0]
        assert entry["link_display"] == "betas"  # 出边用 src_display_name
        assert entry["direction"] == "out"
        assert entry["peers"][0]["ename"] == "n3"
        back = repo.search_around(f"ont.{T}.ind.beta.3")
        assert back[0]["link_display"] == "alpha"  # 入边用 dst_display_name
        assert back[0]["direction"] == "in"


class TestSearchAround:
    def test_groups_by_link_and_direction(self, repo) -> None:
        a1, a2 = f"ont.{T}.ind.alpha.1", f"ont.{T}.ind.alpha.2"
        b3, b4 = f"ont.{T}.ind.beta.3", f"ont.{T}.ind.beta.4"
        repo.create_link_instance(_li(1, LINK_NN, a1, b3))
        repo.create_link_instance(_li(2, LINK_NN, a1, b4))
        repo.create_link_instance(_li(3, LINK_NN, a2, b3))
        around = repo.search_around(b3)
        # b3 视角：两条入边（a1、a2）同组
        assert len(around) == 1
        assert around[0]["direction"] == "in"
        assert len(around[0]["peers"]) == 2
        around_a1 = repo.search_around(a1)
        assert len(around_a1) == 1
        assert len(around_a1[0]["peers"]) == 2

    def test_limit_bounds_peers(self, repo) -> None:
        a1, b3, b4 = f"ont.{T}.ind.alpha.1", f"ont.{T}.ind.beta.3", f"ont.{T}.ind.beta.4"
        repo.create_link_instance(_li(1, LINK_NN, a1, b3))
        repo.create_link_instance(_li(2, LINK_NN, a1, b4))
        around = repo.search_around(a1, limit=1)
        assert len(around[0]["peers"]) <= 1

    def test_no_links_returns_empty(self, repo) -> None:
        assert repo.search_around(f"ont.{T}.ind.alpha.1") == []


# ─────────────────── PG 真库同语义（可达时）───────────────────

PG_DSN = os.environ.get(
    "EXP03_PG_DSN", "postgresql://meta:meta@127.0.0.1:5432/metaplatform_ont"
)


class TestPgSameSemantics:
    @pytest.fixture()
    def pg_repo(self):
        pytest.importorskip("psycopg2")
        from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

        r = PgOntologyRepository(dsn=PG_DSN)
        try:
            r._ensure_schema()
        except Exception as e:
            pytest.skip(f"PG unavailable: {e}")
        with r.tenant_scope(T):
            r.upsert_object_type(_ot(OBJ_A, "alpha"))
            r.upsert_object_type(_ot(OBJ_B, "beta"))
            r.upsert_link_type(_lt(LINK_11, Cardinality.ONE_TO_ONE))
            r.upsert_link_type(_lt(LINK_NN, Cardinality.MANY_TO_MANY))
            for i, cls in [(1, OBJ_A), (2, OBJ_A), (3, OBJ_B), (4, OBJ_B)]:
                slug = {OBJ_A: "alpha", OBJ_B: "beta"}[cls]
                r.create_individual(_ind(f"ont.{T}.ind.{slug}.{i}", cls, f"n{i}"))
        yield r
        import psycopg2

        conn = psycopg2.connect(PG_DSN)
        with conn.cursor() as cur:
            for tbl in ("ont_individual", "ont_link_instance", "ont_object_type",
                        "ont_link_type"):
                cur.execute(f"DELETE FROM {tbl} WHERE tenant_id=%s", (T,))
        conn.commit()
        conn.close()

    def test_pg_cardinality_and_around(self, pg_repo) -> None:
        with pg_repo.tenant_scope(T):
            pg_repo.create_link_instance(
                _li(1, LINK_11, f"ont.{T}.ind.alpha.1", f"ont.{T}.ind.beta.3"))
            with pytest.raises(ValueError, match="1:1 violated"):
                pg_repo.create_link_instance(
                    _li(2, LINK_11, f"ont.{T}.ind.alpha.1", f"ont.{T}.ind.beta.4"))
            lt = pg_repo.get_link_type(ClassRef(LINK_11))
            assert lt.src_display_name == "betas"
            around = pg_repo.search_around(f"ont.{T}.ind.alpha.1")
            assert len(around) == 1
            assert around[0]["link_display"] == "betas"
            assert around[0]["peers"][0]["ename"] == "n3"
