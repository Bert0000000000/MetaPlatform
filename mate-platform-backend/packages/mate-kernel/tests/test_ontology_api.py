"""KERNEL-01 服务层（OntologyRepository + InMemory 实现）测试。"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from mate_kernel.ontology import (
    ActionType,
    Axiom,
    AxiomKind,
    Cardinality,
    ClassRef,
    Directionality,
    Function,
    FunctionLanguage,
    InMemoryOntologyRepository,
    Individual,
    Interface,
    LinkInstance,
    LinkType,
    ObjectSet,
    ObjectType,
    OntologyRepository,
    Property,
    PropertyFormat,
)


def _repo() -> InMemoryOntologyRepository:
    return InMemoryOntologyRepository()


def _pk_property(rid: str = "ont.acme.prop.string.order_id") -> Property:
    return Property(
        rid=ClassRef(rid),
        type_id="string",
        nullable=False,
        primary_key=True,
        title="Order ID",
        format=PropertyFormat.STRING,
    )


def _order_type() -> ObjectType:
    pk = _pk_property()
    return ObjectType(
        rid=ClassRef("ont.acme.obj.order"),
        primary_key=(pk.rid,),
        properties=(pk,),
        interfaces=(),
        display_name="Order",
    )


# ───── Protocol / structural typing (2 tests) ─────


class TestProtocol:
    def test_in_memory_satisfies_protocol(self) -> None:
        repo = _repo()
        assert isinstance(repo, OntologyRepository)

    def test_protocol_has_all_methods(self) -> None:
        required = {
            "resolve_class_ref", "snapshot_version", "list_versions",
            "upsert_property", "upsert_object_type", "upsert_link_type",
            "upsert_action_type", "upsert_interface",
            "list_object_types", "list_link_types", "list_action_types",
            "list_interfaces", "get_object_type", "get_link_type", "get_action_type",
            "create_individual", "get_individual", "list_individuals",
            "create_link_instance", "list_link_instances",
            "upsert_axiom", "list_axioms", "upsert_function", "list_functions",
            "evaluate_object_set", "apply_action",
        }
        for name in required:
            assert hasattr(OntologyRepository, name), f"missing {name}"


# ───── types (5 tests) ─────


class TestTypesCRUD:
    def test_upsert_object_type_registers_pk_property(self) -> None:
        repo = _repo()
        ot = _order_type()
        repo.upsert_object_type(ot)
        assert repo.get_object_type(ot.rid).display_name == "Order"

    def test_upsert_link_type(self) -> None:
        repo = _repo()
        lt = LinkType(
            rid=ClassRef("ont.acme.link.user_has_order"),
            src=ClassRef("ont.acme.obj.user"),
            dst=ClassRef("ont.acme.obj.order"),
            cardinality=Cardinality.ONE_TO_MANY,
            directionality=Directionality.DIRECTED,
            link_properties=(),
        )
        repo.upsert_link_type(lt)
        assert repo.get_link_type(lt.rid).cardinality == Cardinality.ONE_TO_MANY

    def test_upsert_action_type(self) -> None:
        repo = _repo()
        at = ActionType(
            rid=ClassRef("ont.acme.act.approve_order"),
            parameters=(_pk_property(),),
            submission_criteria=("status == 'pending'",),
            side_effects=("notify_approver",),
            function_ref=ClassRef("ont.acme.fn.approve.v1"),
            on=(ClassRef("ont.acme.obj.order"),),
        )
        repo.upsert_action_type(at)
        assert repo.get_action_type(at.rid).side_effects == ("notify_approver",)

    def test_upsert_interface(self) -> None:
        repo = _repo()
        i = Interface(
            rid=ClassRef("ont.acme.if.approvable"),
            properties=(),
            required_links=(),
            polymorphic_action_constraints=("must_have_approve",),
        )
        repo.upsert_interface(i)
        assert len(repo.list_interfaces()) == 1

    def test_list_object_types_paging(self) -> None:
        repo = _repo()
        for i in range(5):
            pk = _pk_property(f"ont.acme.prop.string.t{i}_id")
            ot = ObjectType(
                rid=ClassRef(f"ont.acme.obj.t{i}"),
                primary_key=(pk.rid,),
                properties=(pk,),
                interfaces=(),
                display_name=f"T{i}",
            )
            repo.upsert_object_type(ot)
        assert len(repo.list_object_types(limit=2, offset=0)) == 2
        assert len(repo.list_object_types(limit=2, offset=4)) == 1


# ───── instances (3 tests) ─────


class TestInstancesCRUD:
    def test_create_and_get_individual(self) -> None:
        repo = _repo()
        ind = Individual(
            rid="ont.acme.ind.order.10086",
            class_rid=ClassRef("ont.acme.obj.order"),
            props=((ClassRef("ont.acme.prop.string.order_id"), "10086"),),
            primary_key="10086",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            tenant_id="acme",
            marking=(),
        )
        repo.create_individual(ind)
        assert repo.get_individual("ont.acme.ind.order.10086").primary_key == "10086"

    def test_list_individuals_filter_by_class(self) -> None:
        repo = _repo()
        ind_a = Individual(
            rid="ont.acme.ind.order.1",
            class_rid=ClassRef("ont.acme.obj.order"),
            props=(),
            primary_key="1",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            tenant_id="acme",
            marking=(),
        )
        repo.create_individual(ind_a)
        items = repo.list_individuals(class_rid=ClassRef("ont.acme.obj.order"))
        assert len(items) == 1
        items_other = repo.list_individuals(class_rid=ClassRef("ont.acme.obj.user"))
        assert items_other == []

    def test_link_instance_roundtrip(self) -> None:
        repo = _repo()
        li = LinkInstance(
            rid="ont.acme.lnk.user_has_order.u1.o1",
            link_type_rid=ClassRef("ont.acme.link.user_has_order"),
            src="ont.acme.ind.user.u1",
            dst="ont.acme.ind.order.o1",
            props=(),
            created_at=datetime.now(timezone.utc),
            tenant_id="acme",
            marking=(),
        )
        repo.create_link_instance(li)
        assert len(repo.list_link_instances()) == 1


# ───── reasoning (2 tests) ─────


class TestReasoningCRUD:
    def test_upsert_axiom(self) -> None:
        repo = _repo()
        ax = Axiom(
            rid=ClassRef("ont.acme.ax.subclass.employee_person"),
            kind=AxiomKind.SUBCLASS,
            operands=(ClassRef("ont.acme.cls.employee"), ClassRef("ont.acme.cls.person")),
            rule_ref="rdfs:subClassOf",
            metadata=(),
        )
        repo.upsert_axiom(ax)
        assert repo.list_axioms()[0].kind == AxiomKind.SUBCLASS

    def test_upsert_function(self) -> None:
        repo = _repo()
        f = Function(
            rid=ClassRef("ont.acme.fn.notify.v1"),
            language=FunctionLanguage.PYTHON,
            version="1.0.0",
            source_ref="s3://acme/fn/notify.py",
            signatures=(("approve_order", "ActionType"),),
        )
        repo.upsert_function(f)
        assert repo.list_functions()[0].language == FunctionLanguage.PYTHON


# ───── query / apply (3 tests) ─────


class TestQueryAndApply:
    def test_evaluate_object_set_by_class(self) -> None:
        repo = _repo()
        for i in range(3):
            ind = Individual(
                rid=f"ont.acme.ind.order.{i}",
                class_rid=ClassRef("ont.acme.obj.order"),
                props=(),
                primary_key=str(i),
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
                tenant_id="acme",
                marking=(),
            )
            repo.create_individual(ind)
        os_ = ObjectSet(
            class_rid=ClassRef("ont.acme.obj.order"),
            filter_expr="",
            sort=(),
            paging_offset=0,
            paging_limit=10,
            view_config=None,
        )
        assert len(repo.evaluate_object_set(os_)) == 3

    def test_apply_action_returns_side_effects(self) -> None:
        repo = _repo()
        at = ActionType(
            rid=ClassRef("ont.acme.act.notify"),
            parameters=(),
            submission_criteria=(),
            side_effects=("notify_email", "audit_log"),
            function_ref=ClassRef("ont.acme.fn.notify.v1"),
            on=(ClassRef("ont.acme.obj.order"),),
        )
        repo.upsert_action_type(at)
        # ACTION-03：apply 需要目标 individual 存在
        repo.create_individual(Individual(
            rid="ont.acme.ind.order.1",
            class_rid=ClassRef("ont.acme.obj.order"),
            props=(),
            primary_key="1",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            tenant_id="acme",
        ))
        now, se = repo.apply_action(
            ClassRef("ont.acme.act.notify"),
            target_iid="ont.acme.ind.order.1",
            parameters={},
            provenance={"actor": "alice"},
        )
        assert se == ["notify_email", "audit_log"]

    def test_apply_unknown_action_raises(self) -> None:
        repo = _repo()
        with pytest.raises(KeyError, match="action not found"):
            repo.apply_action(
                ClassRef("ont.acme.act.does_not_exist"),
                target_iid="x",
                parameters={},
                provenance={},
            )


# ───── version snapshot (2 tests) ─────


class TestVersioning:
    def test_first_version_has_no_parent(self) -> None:
        repo = _repo()
        v = repo.snapshot_version(
            class_rid=ClassRef("ont.acme.cls.order"),
            author="alice",
            parent=None,
            change_set=("init",),
        )
        assert v.parent_rid is None
        assert v.rid.endswith(".v1")

    def test_subsequent_version_chains(self) -> None:
        repo = _repo()
        v1 = repo.snapshot_version(ClassRef("ont.acme.cls.order"), "a", None, ("init",))
        v2 = repo.snapshot_version(ClassRef("ont.acme.cls.order"), "b", v1.rid, ("tweak",))
        versions = repo.list_versions(ClassRef("ont.acme.cls.order"))
        assert len(versions) == 2
        assert v2.parent_rid == v1.rid
        assert v2.rid.endswith(".v2")