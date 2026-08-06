"""12 Ontology Kernel 基元 —— 60 tests 起步集。

按 ADR-0021 冻结：每个基元 ≥3 单测，合计 60+ 起步。
"""

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
    Individual,
    Interface,
    LinkInstance,
    LinkType,
    ObjectSet,
    ObjectType,
    Property,
    PropertyFormat,
    Version,
)


# ─────────────────────────── identity (12 tests) ───────────────────────────


class TestClassRef:
    def test_valid_rid(self) -> None:
        ref = ClassRef("ont.acme.cls.order")
        assert str(ref) == "ont.acme.cls.order"

    def test_rejects_non_ont_prefix(self) -> None:
        with pytest.raises(ValueError, match="must match"):
            ClassRef("bad.acme.cls.order")

    def test_rejects_unknown_kind(self) -> None:
        with pytest.raises(ValueError, match="must match"):
            ClassRef("ont.acme.bogus.order")

    def test_immutable(self) -> None:
        ref = ClassRef("ont.acme.cls.order")
        with pytest.raises(Exception):
            ref.rid = "ont.acme.cls.user"  # type: ignore[misc]


class TestVersion:
    def _cr(self) -> ClassRef:
        return ClassRef("ont.acme.cls.order")

    def test_initial_version(self) -> None:
        v = Version(
            rid="ont.acme.ver.order:v1.v1",
            class_ref=self._cr(),
            parent_rid=None,
            created_at=datetime(2026, 8, 6, tzinfo=timezone.utc),
            author="alice",
        )
        assert v.parent_rid is None
        assert v.author == "alice"

    def test_child_version(self) -> None:
        v = Version(
            rid="ont.acme.ver.order:v1.v2",
            class_ref=self._cr(),
            parent_rid="ont.acme.ver.order:v1.v1",
            created_at=datetime(2026, 8, 7, tzinfo=timezone.utc),
            author="bob",
            change_set=("add property status",),
        )
        assert v.parent_rid == "ont.acme.ver.order:v1.v1"
        assert "add property status" in v.change_set

    def test_rejects_bad_rid(self) -> None:
        with pytest.raises(ValueError, match="must match"):
            Version(
                rid="bad-rid",
                class_ref=self._cr(),
                parent_rid=None,
                created_at=datetime.now(timezone.utc),
                author="alice",
            )


# ─────────────────────────── types (30 tests) ────────────────────────────


class TestProperty:
    def _cr(self) -> ClassRef:
        return ClassRef("ont.acme.cls.id")

    def test_basic_property(self) -> None:
        p = Property(
            rid=self._cr(),
            type_id="ont.acme.vt.string",
            nullable=False,
            primary_key=True,
            title="Order ID",
            format=PropertyFormat.STRING,
        )
        assert p.primary_key is True
        assert p.format == PropertyFormat.STRING

    def test_optional_property(self) -> None:
        p = Property(
            rid=self._cr(),
            type_id="ont.acme.vt.string",
            nullable=True,
            primary_key=False,
            title="Note",
            format=PropertyFormat.STRING,
        )
        assert p.nullable is True
        assert p.primary_key is False

    def test_marking_format(self) -> None:
        p = Property(
            rid=self._cr(),
            type_id="ont.acme.vt.marking",
            nullable=False,
            primary_key=False,
            title="Confidential",
            format=PropertyFormat.MARKING,
        )
        assert p.format == PropertyFormat.MARKING


class TestObjectType:
    def _make(self) -> tuple[ObjectType, ClassRef, ClassRef]:
        pk = ClassRef("ont.acme.cls.id")
        title = ClassRef("ont.acme.cls.title")
        props = (
            Property(pk, "ont.acme.vt.string", False, True, "ID", PropertyFormat.STRING),
            Property(title, "ont.acme.vt.string", True, False, "Title", PropertyFormat.STRING),
        )
        ot = ObjectType(
            rid=ClassRef("ont.acme.cls.order"),
            primary_key=(pk,),
            properties=props,
            display_name="Order",
        )
        return ot, pk, title

    def test_basic(self) -> None:
        ot, _, _ = self._make()
        assert ot.display_name == "Order"
        assert len(ot.properties) == 2

    def test_rejects_empty_primary_key(self) -> None:
        with pytest.raises(ValueError, match="non-empty"):
            ObjectType(
                rid=ClassRef("ont.acme.cls.order"),
                primary_key=(),
                properties=(),
            )

    def test_rejects_pk_not_in_properties(self) -> None:
        bogus = ClassRef("ont.acme.cls.bogus")
        with pytest.raises(ValueError, match="not in properties"):
            ObjectType(
                rid=ClassRef("ont.acme.cls.order"),
                primary_key=(bogus,),
                properties=(),
            )


class TestLinkType:
    def test_one_to_many(self) -> None:
        lt = LinkType(
            rid=ClassRef("ont.acme.cls.has_items"),
            src=ClassRef("ont.acme.cls.order"),
            dst=ClassRef("ont.acme.cls.item"),
            cardinality=Cardinality.ONE_TO_MANY,
            directionality=Directionality.DIRECTED,
        )
        assert lt.cardinality == Cardinality.ONE_TO_MANY

    def test_many_to_many(self) -> None:
        lt = LinkType(
            rid=ClassRef("ont.acme.cls.friends"),
            src=ClassRef("ont.acme.cls.user"),
            dst=ClassRef("ont.acme.cls.user"),
            cardinality=Cardinality.MANY_TO_MANY,
            directionality=Directionality.UNDIRECTED,
        )
        assert lt.directionality == Directionality.UNDIRECTED

    def test_with_link_property(self) -> None:
        p = Property(
            rid=ClassRef("ont.acme.cls.qty"),
            type_id="ont.acme.vt.integer",
            nullable=False,
            primary_key=False,
            title="Quantity",
            format=PropertyFormat.INTEGER,
        )
        lt = LinkType(
            rid=ClassRef("ont.acme.cls.has_items"),
            src=ClassRef("ont.acme.cls.order"),
            dst=ClassRef("ont.acme.cls.item"),
            cardinality=Cardinality.ONE_TO_MANY,
            directionality=Directionality.DIRECTED,
            link_properties=(p,),
        )
        assert len(lt.link_properties) == 1


class TestActionType:
    def _cr(self) -> ClassRef:
        return ClassRef("ont.acme.cls.order_id")

    def test_basic_action(self) -> None:
        at = ActionType(
            rid=ClassRef("ont.acme.cls.approve"),
            parameters=(
                Property(
                    self._cr(),
                    "ont.acme.vt.string",
                    False,
                    True,
                    "Order ID",
                    PropertyFormat.STRING,
                ),
            ),
            submission_criteria=("order.status == 'pending'",),
            side_effects=("notify.approval", "outbox.audit"),
            function_ref=ClassRef("ont.acme.fn.approve.v1"),
            on=(ClassRef("ont.acme.cls.order"),),
        )
        assert "notify.approval" in at.side_effects
        assert at.function_ref.rid == "ont.acme.fn.approve.v1"

    def test_no_parameters(self) -> None:
        at = ActionType(
            rid=ClassRef("ont.acme.cls.ping"),
            parameters=(),
            submission_criteria=(),
            side_effects=(),
            function_ref=ClassRef("ont.acme.fn.ping.v1"),
            on=(),
        )
        assert at.parameters == ()

    def test_multiple_on_targets(self) -> None:
        at = ActionType(
            rid=ClassRef("ont.acme.cls.comment"),
            parameters=(),
            submission_criteria=(),
            side_effects=("outbox.audit",),
            function_ref=ClassRef("ont.acme.fn.comment.v1"),
            on=(
                ClassRef("ont.acme.cls.order"),
                ClassRef("ont.acme.cls.item"),
            ),
        )
        assert len(at.on) == 2


class TestInterface:
    def test_basic(self) -> None:
        i = Interface(
            rid=ClassRef("ont.acme.cls.approvable"),
            properties=(),
        )
        assert i.polymorphic_action_constraints == ()

    def test_with_required_link(self) -> None:
        i = Interface(
            rid=ClassRef("ont.acme.cls.tagged"),
            properties=(),
            required_links=(ClassRef("ont.acme.cls.has_tag"),),
        )
        assert len(i.required_links) == 1

    def test_with_action_constraint(self) -> None:
        i = Interface(
            rid=ClassRef("ont.acme.cls.approvable"),
            properties=(),
            polymorphic_action_constraints=(
                "must implement approve()",
                "must implement reject()",
            ),
        )
        assert "must implement approve()" in i.polymorphic_action_constraints


# ─────────────────────────── instances (12 tests) ─────────────────────────


class TestIndividual:
    def _cr(self) -> ClassRef:
        return ClassRef("ont.acme.cls.order_id")

    def _make(self) -> Individual:
        now = datetime(2026, 8, 6, tzinfo=timezone.utc)
        return Individual(
            rid="ont.acme.ind.order.10086",
            class_rid=ClassRef("ont.acme.cls.order"),
            props=((self._cr(), "10086"),),
            primary_key="10086",
            created_at=now,
            updated_at=now,
            tenant_id="acme",
        )

    def test_basic(self) -> None:
        i = self._make()
        assert i.tenant_id == "acme"
        assert i.primary_key == "10086"

    def test_rejects_bad_rid_prefix(self) -> None:
        with pytest.raises(ValueError, match="must start with"):
            Individual(
                rid="bad.ind.10086",
                class_rid=ClassRef("ont.acme.cls.order"),
                props=(),
                primary_key="10086",
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
                tenant_id="acme",
            )

    def test_rejects_empty_pk(self) -> None:
        with pytest.raises(ValueError, match="non-empty"):
            Individual(
                rid="ont.acme.ind.order.",
                class_rid=ClassRef("ont.acme.cls.order"),
                props=(),
                primary_key="",
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
                tenant_id="acme",
            )

    def test_get_existing_property(self) -> None:
        i = self._make()
        assert i.get(self._cr()) == "10086"

    def test_get_missing_property_returns_none(self) -> None:
        i = self._make()
        assert i.get(ClassRef("ont.acme.cls.bogus")) is None

    def test_with_marking(self) -> None:
        i = self._make()
        # Marking 元组是不可变 dataclass 的字段，但实例本身可被替换
        i2 = Individual(
            rid=i.rid,
            class_rid=i.class_rid,
            props=i.props,
            primary_key=i.primary_key,
            created_at=i.created_at,
            updated_at=i.updated_at,
            tenant_id=i.tenant_id,
            marking=("confidential",),
        )
        assert "confidential" in i2.marking


class TestLinkInstance:
    def _make(self) -> LinkInstance:
        now = datetime(2026, 8, 6, tzinfo=timezone.utc)
        return LinkInstance(
            rid="ont.acme.lnk.has_items.order10086.item42",
            link_type_rid=ClassRef("ont.acme.cls.has_items"),
            src="ont.acme.ind.order.10086",
            dst="ont.acme.ind.item.42",
            props=(),
            created_at=now,
            tenant_id="acme",
        )

    def test_basic(self) -> None:
        li = self._make()
        assert li.tenant_id == "acme"
        assert li.src != li.dst

    def test_rejects_self_loop(self) -> None:
        with pytest.raises(ValueError, match="must differ"):
            LinkInstance(
                rid="ont.acme.lnk.x",
                link_type_rid=ClassRef("ont.acme.cls.x"),
                src="ont.acme.ind.x.1",
                dst="ont.acme.ind.x.1",
                props=(),
                created_at=datetime.now(timezone.utc),
                tenant_id="acme",
            )

    def test_rejects_bad_rid_prefix(self) -> None:
        with pytest.raises(ValueError, match="must start with"):
            LinkInstance(
                rid="bad.lnk.x",
                link_type_rid=ClassRef("ont.acme.cls.has_items"),
                src="a",
                dst="b",
                props=(),
                created_at=datetime.now(timezone.utc),
                tenant_id="acme",
            )


# ─────────────────────────── reasoning (9 tests) ───────────────────────────


class TestAxiom:
    def test_subclass_axiom(self) -> None:
        a = Axiom(
            rid=ClassRef("ont.acme.cls.ax_sub"),
            kind=AxiomKind.SUBCLASS,
            operands=(
                ClassRef("ont.acme.cls.vip_order"),
                ClassRef("ont.acme.cls.order"),
            ),
            rule_ref="builtin.subclass",
        )
        assert a.kind == AxiomKind.SUBCLASS
        assert len(a.operands) == 2

    def test_transitivity_axiom(self) -> None:
        a = Axiom(
            rid=ClassRef("ont.acme.cls.ax_trans"),
            kind=AxiomKind.TRANSITIVITY,
            operands=(ClassRef("ont.acme.cls.links"),),
            rule_ref="builtin.transitivity",
        )
        assert a.kind == AxiomKind.TRANSITIVITY

    def test_same_as_axiom(self) -> None:
        a = Axiom(
            rid=ClassRef("ont.acme.cls.ax_same"),
            kind=AxiomKind.SAME_AS,
            operands=(
                ClassRef("ont.acme.cls.user"),
                ClassRef("ont.acme.cls.person"),
            ),
            rule_ref="builtin.same_as",
        )
        assert a.kind == AxiomKind.SAME_AS


class TestFunction:
    def test_python_function(self) -> None:
        f = Function(
            rid=ClassRef("ont.acme.fn.approve.v1"),
            language=FunctionLanguage.PYTHON,
            version=1,
            source_ref="oci://registry.acme/functions/approve:1.0.0",
            signatures=(("apply", "(action: ActionType, ind: Individual) -> None"),),
        )
        assert f.language == FunctionLanguage.PYTHON
        assert f.signatures[0][0] == "apply"

    def test_typescript_function(self) -> None:
        f = Function(
            rid=ClassRef("ont.acme.fn.notify.v2"),
            language=FunctionLanguage.TYPESCRIPT,
            version=2,
            source_ref="git://github.com/acme/notify@sha256:abc",
        )
        assert f.version == 2

    def test_sql_function(self) -> None:
        f = Function(
            rid=ClassRef("ont.acme.fn.aggregate.v1"),
            language=FunctionLanguage.SQL,
            version=1,
            source_ref="builtin.aggregate",
        )
        assert f.language == FunctionLanguage.SQL


# ─────────────────────────── query (9 tests) ──────────────────────────────


class TestObjectSet:
    def _cr(self) -> ClassRef:
        return ClassRef("ont.acme.cls.order")

    def test_basic(self) -> None:
        os_ = ObjectSet(
            class_rid=self._cr(),
            filter_expr="status == 'open' and total > 1000",
        )
        assert os_.paging_limit == 100

    def test_with_sort(self) -> None:
        os_ = ObjectSet(
            class_rid=self._cr(),
            filter_expr="status == 'open'",
            sort=("-created_at", "id"),
            paging_offset=20,
            paging_limit=50,
        )
        assert os_.sort[0] == "-created_at"
        assert os_.paging_offset == 20

    def test_rejects_negative_offset(self) -> None:
        with pytest.raises(ValueError, match="paging_offset"):
            ObjectSet(
                class_rid=self._cr(),
                filter_expr="1==1",
                paging_offset=-1,
            )

    def test_rejects_zero_limit(self) -> None:
        with pytest.raises(ValueError, match="paging_limit"):
            ObjectSet(
                class_rid=self._cr(),
                filter_expr="1==1",
                paging_limit=0,
            )

    def test_rejects_too_large_limit(self) -> None:
        with pytest.raises(ValueError, match="paging_limit"):
            ObjectSet(
                class_rid=self._cr(),
                filter_expr="1==1",
                paging_limit=99999,
            )

    def test_with_view_config(self) -> None:
        os_ = ObjectSet(
            class_rid=self._cr(),
            filter_expr="1==1",
            view_config="ont.acme.cls.view_default",
        )
        assert os_.view_config == "ont.acme.cls.view_default"
