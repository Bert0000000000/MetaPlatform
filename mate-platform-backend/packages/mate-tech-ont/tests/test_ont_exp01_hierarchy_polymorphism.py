"""EXP-01 —— 层级一等化 + Interface 多态查询源（D2 拍板 2026-09-10）。

覆盖：
1. ObjectType.parent_class 浅声明 → upsert 自动生成 subclass 公理（单一事实源）；
2. 清空 parent_class → 公理禁用（祖先查询退回精确匹配）；
3. parent 环检测（A→B→A 拒绝）；
4. Interface 作为 ObjectSet / ObjectSetQuery 查询源 → 展开为实现类型实例集合；
5. Interface 源 + subclass 后代闭包叠加；
6. Interface 属性签名 fail-fast（已注册 Interface 属性缺失 → ValueError）；
7. get_type_hierarchy 树正确嵌套；
8. （PG 可达时）同语义真库验证。
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

from mate_kernel.objectset.ir import ObjectSetQuery  # noqa: E402
from mate_kernel.ontology.identity.class_ref import ClassRef  # noqa: E402
from mate_kernel.ontology.in_memory import InMemoryOntologyRepository  # noqa: E402
from mate_kernel.ontology.instances.individual import Individual  # noqa: E402
from mate_kernel.ontology.query.object_set import ObjectSet  # noqa: E402
from mate_kernel.ontology.types.interface import Interface  # noqa: E402
from mate_kernel.ontology.types.object_type import ObjectType  # noqa: E402
from mate_kernel.ontology.types.property_ import Property, PropertyFormat  # noqa: E402

T = "exp01"
OBJ_BASE = f"ont.{T}.obj.core.base-entity.v1"
OBJ_CHILD = f"ont.{T}.obj.core.sub-entity.v1"
IFC = f"ont.{T}.if.core.trackable.v1"
IFC_IMPL_A = f"ont.{T}.obj.crm.customer.v1"
IFC_IMPL_B = f"ont.{T}.obj.scm.supplier.v1"
PROP_NAME = f"ont.{T}.prop.shared-name.v1"


def _prop() -> Property:
    return Property(
        rid=ClassRef(PROP_NAME), type_id="string", nullable=False,
        primary_key=True, title="name", format=PropertyFormat.STRING,
    )


def _type(rid: str, parent: str | None = None, interfaces: tuple = ()) -> ObjectType:
    return ObjectType(
        rid=ClassRef(rid),
        primary_key=(ClassRef(PROP_NAME),),
        properties=(_prop(),),
        interfaces=interfaces,
        display_name=rid.split(".")[-2],
        parent_class=ClassRef(parent) if parent else None,
    )


def _ind(rid: str, class_rid: str, name: str) -> Individual:
    return Individual(
        rid=rid, class_rid=ClassRef(class_rid),
        props=((ClassRef(PROP_NAME), name),),
        primary_key=name, tenant_id=T,
        created_at=datetime.now(UTC), updated_at=datetime.now(UTC),
    )


@pytest.fixture()
def repo() -> InMemoryOntologyRepository:
    r = InMemoryOntologyRepository()
    r.upsert_object_type(_type(OBJ_BASE))
    r.upsert_object_type(_type(OBJ_CHILD, parent=OBJ_BASE))
    # Interface trackable：共享属性 name；两个实现类型
    r.upsert_interface(Interface(
        rid=ClassRef(IFC),
        properties=(_prop(),),
    ))
    r.upsert_object_type(_type(IFC_IMPL_A, interfaces=(ClassRef(IFC),)))
    r.upsert_object_type(_type(IFC_IMPL_B, interfaces=(ClassRef(IFC),)))
    r.create_individual(_ind(f"ont.{T}.ind.base-entity.root1", OBJ_BASE, "root1"))
    r.create_individual(_ind(f"ont.{T}.ind.sub-entity.leaf1", OBJ_CHILD, "leaf1"))
    r.create_individual(_ind(f"ont.{T}.ind.customer.c1", IFC_IMPL_A, "c1"))
    r.create_individual(_ind(f"ont.{T}.ind.supplier.s1", IFC_IMPL_B, "s1"))
    return r


class TestParentClassAxiomSync:
    def test_parent_generates_subclass_axiom(self, repo) -> None:
        pairs = repo._subclass_pairs()
        assert (OBJ_CHILD, OBJ_BASE) in pairs

    def test_ancestor_query_hits_descendant(self, repo) -> None:
        names = {
            i.primary_key
            for i in repo.evaluate_object_set(ObjectSet(filter_expr="", class_rid=ClassRef(OBJ_BASE)))
        }
        assert names == {"root1", "leaf1"}

    def test_clearing_parent_disables_axiom(self, repo) -> None:
        repo.upsert_object_type(_type(OBJ_CHILD))  # 不带 parent → 公理禁用
        assert (OBJ_CHILD, OBJ_BASE) not in repo._subclass_pairs()
        names = {
            i.primary_key
            for i in repo.evaluate_object_set(ObjectSet(filter_expr="", class_rid=ClassRef(OBJ_BASE)))
        }
        assert names == {"root1"}

    def test_cycle_rejected(self, repo) -> None:
        with pytest.raises(ValueError, match="cycle"):
            repo.upsert_object_type(_type(OBJ_BASE, parent=OBJ_CHILD))

    def test_self_parent_rejected_at_dataclass(self) -> None:
        with pytest.raises(ValueError, match="self-parent"):
            _type(OBJ_BASE, parent=OBJ_BASE)


class TestInterfacePolymorphicSource:
    def test_interface_source_expands_to_implementations(self, repo) -> None:
        names = {
            i.primary_key
            for i in repo.evaluate_object_set(ObjectSet(filter_expr="", class_rid=ClassRef(IFC)))
        }
        assert names == {"c1", "s1"}

    def test_interface_source_ir_path(self, repo) -> None:
        result = repo.execute_object_query(ObjectSetQuery(source=IFC))
        assert result.kind == "objects"
        assert {r["__rid__"] for r in result.rows} == {
            f"ont.{T}.ind.customer.c1", f"ont.{T}.ind.supplier.s1",
        }

    def test_interface_implementations_listing(self, repo) -> None:
        from mate_kernel.ontology.types.interface import interface_source_rids

        impls = interface_source_rids(IFC, repo.list_object_types(100, 0))
        assert sorted(impls) == sorted([IFC_IMPL_A, IFC_IMPL_B])

    def test_interface_source_with_descendants(self, repo) -> None:
        # customer 实现接口并挂一个子类 → 查接口也要命中子类实例
        OBJ_SUB_CUSTOMER = f"ont.{T}.obj.crm.vip-customer.v1"
        repo.upsert_object_type(_type(OBJ_SUB_CUSTOMER, parent=IFC_IMPL_A,
                                      interfaces=(ClassRef(IFC),)))
        repo.create_individual(_ind(f"ont.{T}.ind.vip-customer.v1x", OBJ_SUB_CUSTOMER, "v1x"))
        names = {
            i.primary_key
            for i in repo.evaluate_object_set(ObjectSet(filter_expr="", class_rid=ClassRef(IFC)))
        }
        assert names == {"c1", "s1", "v1x"}


class TestInterfaceConstraints:
    def test_registered_interface_missing_property_rejected(self, repo) -> None:
        OTHER_PK = ClassRef(f"ont.{T}.prop.other.pk.v1")
        with pytest.raises(ValueError, match="requires property"):
            repo.upsert_object_type(ObjectType(
                rid=ClassRef(f"ont.{T}.obj.crm.bad-impl.v1"),
                primary_key=(OTHER_PK,),
                properties=(Property(rid=OTHER_PK, type_id="string",
                                     nullable=False, primary_key=True,
                                     title="pk", format=PropertyFormat.STRING),),
                interfaces=(ClassRef(IFC),),  # 缺接口要求的 name 属性
            ))

    def test_unregistered_interface_stays_lenient(self, repo) -> None:
        UNKNOWN_IFC = f"ont.{T}.if.core.ghost.v1"
        repo.upsert_object_type(_type(
            f"ont.{T}.obj.crm.ghost-impl.v1", interfaces=(ClassRef(UNKNOWN_IFC),),
        ))


class TestHierarchyTree:
    def test_tree_nests_children(self, repo) -> None:
        tree = repo.get_type_hierarchy()
        # OBJ_CHILD 挂在 OBJ_BASE 下；Interface 实现类型为根
        base_node = next(n for n in tree if n["rid"] == OBJ_BASE)
        assert [c["rid"] for c in base_node["children"]] == [OBJ_CHILD]
        root_rids = {n["rid"] for n in tree}
        assert {OBJ_BASE, IFC_IMPL_A, IFC_IMPL_B} <= root_rids
        assert OBJ_CHILD not in root_rids


# ─────────────────── PG 真库同语义（可达时）───────────────────

PG_DSN = os.environ.get(
    "EXP01_PG_DSN", "postgresql://meta:meta@127.0.0.1:5432/metaplatform_ont"
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
            r.upsert_object_type(_type(OBJ_BASE))
            r.upsert_object_type(_type(OBJ_CHILD, parent=OBJ_BASE))
            r.upsert_interface(Interface(rid=ClassRef(IFC), properties=(_prop(),)))
            r.upsert_object_type(_type(IFC_IMPL_A, interfaces=(ClassRef(IFC),)))
            r.upsert_object_type(_type(IFC_IMPL_B, interfaces=(ClassRef(IFC),)))
            r.create_individual(_ind(f"ont.{T}.ind.base-entity.proot", OBJ_BASE, "proot"))
            r.create_individual(_ind(f"ont.{T}.ind.sub-entity.pleaf", OBJ_CHILD, "pleaf"))
            r.create_individual(_ind(f"ont.{T}.ind.customer.pc1", IFC_IMPL_A, "pc1"))
            r.create_individual(_ind(f"ont.{T}.ind.supplier.ps1", IFC_IMPL_B, "ps1"))
        yield r
        import psycopg2

        conn = psycopg2.connect(PG_DSN)
        with conn.cursor() as cur:
            cur.execute("DELETE FROM ont_individual WHERE tenant_id=%s", (T,))
            cur.execute("DELETE FROM ont_axiom WHERE tenant_id=%s", (T,))
            cur.execute("DELETE FROM ont_interface WHERE tenant_id=%s", (T,))
            cur.execute("DELETE FROM ont_object_type WHERE tenant_id=%s", (T,))
        conn.commit()
        conn.close()

    def test_pg_parent_axiom_and_interface_source(self, pg_repo) -> None:
        with pg_repo.tenant_scope(T):
            axioms = pg_repo.list_axiom_records(T, enabled_only=True)
            assert any(
                a.get("kind") == "subclass"
                and list(a.get("operands") or []) == [OBJ_CHILD, OBJ_BASE]
                for a in axioms
            ), f"parent_class axiom missing: {axioms}"
            names = {
                i.primary_key
                for i in pg_repo.evaluate_object_set(
                    ObjectSet(filter_expr="", class_rid=ClassRef(OBJ_BASE)))
            }
            assert names == {"proot", "pleaf"}
            iface_names = {
                i.primary_key
                for i in pg_repo.evaluate_object_set(
                    ObjectSet(filter_expr="", class_rid=ClassRef(IFC)))
            }
            assert iface_names == {"pc1", "ps1"}
            tree = pg_repo.get_type_hierarchy()
            base_node = next(n for n in tree if n["rid"] == OBJ_BASE)
            assert [c["rid"] for c in base_node["children"]] == [OBJ_CHILD]

    def test_pg_cycle_rejected(self, pg_repo) -> None:
        with pytest.raises(ValueError, match="cycle"), pg_repo.tenant_scope(T):
            pg_repo.upsert_object_type(_type(OBJ_BASE, parent=OBJ_CHILD))
