"""ONT-G21 — 推理层级对 ObjectSet 可见（真实 PG 门控测试）。

按已注册 subclass 公理，evaluate_object_set(祖先类) 必须命中后代类实例：
  manager ⊑ employee ⊑ person（employee 边用完整 rid，manager 边用 slug，
  两种公理写法都要支持）。
  查 person → 3 实例（alice/bob/carol）；查 employee → 2（bob/carol）；
  查 manager → 1（carol）。
子类继承父类属性（name 属性 rid 三类共用）——过滤器按父类属性编译后
对后代实例依然成立，这正是层级本体对查询的语义承诺。
前置：本地 PG（mate-postgres，5432 meta/meta，库 metaplatform_ont）；
PG 不可达 → skip（与 test_objectset_parity.py 同一约定）。
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
from mate_kernel.ontology.instances.individual import Individual
from mate_kernel.ontology.query.object_set import ObjectSet
from mate_kernel.ontology.types.object_type import ObjectType
from mate_kernel.ontology.types.property_ import Property, PropertyFormat

PG_DSN = os.environ.get(
    "PARITY_PG_DSN", "postgresql://meta:meta@127.0.0.1:5432/metaplatform_ont"
)

T = "t-g21"
OBJ_P = f"ont.{T}.obj.person.v1"
OBJ_E = f"ont.{T}.obj.employee.v1"
OBJ_M = f"ont.{T}.obj.manager.v1"
# 属性继承：三个类的 name 属性共用同一 Property rid（子类继承父类属性）
PROP_P = f"ont.{T}.prop.person-name.v1"


def _type(rid: str, name: str) -> ObjectType:
    return ObjectType(
        rid=ClassRef(rid),
        display_name=name,
        primary_key=(ClassRef(PROP_P),),
        properties=(
            Property(rid=ClassRef(PROP_P), type_id="string", nullable=False,
                     primary_key=True, title="name",
                     format=PropertyFormat.STRING),
        ),
    )


def _ind(rid: str, class_rid: str, name: str) -> Individual:
    return Individual(
        rid=rid, class_rid=ClassRef(class_rid),
        props=((ClassRef(PROP_P), name),),
        primary_key=name, tenant_id=T,
        created_at=datetime.now(UTC), updated_at=datetime.now(UTC),
    )


@pytest.fixture(scope="module")
def repo():
    pytest.importorskip("psycopg2")
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

    r = PgOntologyRepository(dsn=PG_DSN)
    try:
        r._ensure_schema()
    except Exception as e:  # PG 不可达 → 跳过而非失败
        pytest.skip(f"PG unavailable: {e}")

    with r.tenant_scope(T):
        for ot in (_type(OBJ_P, "person"), _type(OBJ_E, "employee"),
                   _type(OBJ_M, "manager")):
            r.upsert_object_type(ot)
        r.create_individual(_ind(f"ont.{T}.ind.person.alice", OBJ_P, "alice"))
        r.create_individual(_ind(f"ont.{T}.ind.employee.bob", OBJ_E, "bob"))
        r.create_individual(_ind(f"ont.{T}.ind.manager.carol", OBJ_M, "carol"))
        # employee⊑person 用完整 rid；manager⊑employee 用 slug —— 两种写法
        r.upsert_axiom_record(
            f"ont.{T}.ax.sub-employee-person.v1", "subclass",
            [OBJ_E, OBJ_P], tenant_id=T, enabled=True)
        r.upsert_axiom_record(
            f"ont.{T}.ax.sub-manager-employee.v1", "subclass",
            ["manager", "employee"], tenant_id=T, enabled=True)
    yield r
    # 清理
    import psycopg2

    conn = psycopg2.connect(PG_DSN)
    with conn.cursor() as cur:
        cur.execute("DELETE FROM ont_individual WHERE tenant_id=%s", (T,))
        cur.execute("DELETE FROM ont_axiom WHERE tenant_id=%s", (T,))
        cur.execute("DELETE FROM ont_object_type WHERE rid LIKE %s",
                    (f"ont.{T}.obj.%",))
    conn.commit()
    conn.close()


def _query(r, class_rid: str) -> set[str]:
    # name 属性的 slug = rid 第 4 段（person-name），DSL 按 slug 或完整 rid 寻址
    with r.tenant_scope(T):
        results = r.evaluate_object_set(
            ObjectSet(class_rid=ClassRef(class_rid), filter_expr="person-name")
        )
    return {ind.primary_key for ind in results}


class TestInferredObjectSet:
    def test_ancestor_query_hits_all_descendants(self, repo) -> None:
        assert _query(repo, OBJ_P) == {"alice", "bob", "carol"}

    def test_middle_query_hits_subclass(self, repo) -> None:
        assert _query(repo, OBJ_E) == {"bob", "carol"}

    def test_leaf_query_exact_only(self, repo) -> None:
        assert _query(repo, OBJ_M) == {"carol"}

    def test_disabled_axiom_falls_back_to_exact(self, repo) -> None:
        """禁用公理后祖先查询退回精确匹配（enabled_only 语义）。"""
        with repo.tenant_scope(T):
            repo.upsert_axiom_record(
                f"ont.{T}.ax.sub-employee-person.v1", "subclass",
                [OBJ_E, OBJ_P], tenant_id=T, enabled=False)
        try:
            assert _query(repo, OBJ_P) == {"alice"}
        finally:
            with repo.tenant_scope(T):
                repo.upsert_axiom_record(
                    f"ont.{T}.ax.sub-employee-person.v1", "subclass",
                    [OBJ_E, OBJ_P], tenant_id=T, enabled=True)
