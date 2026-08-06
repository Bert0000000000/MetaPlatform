"""Ontology 12 基元 serde + rid codec 测试。"""

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
from mate_kernel.ontology.serde import (
    decode_rid,
    encode_rid,
    from_dict,
    rid_join,
    rid_split,
    to_dict,
)


# ──────────────────────── rid codec (8 tests) ────────────────────────


class TestRidCodec:
    def test_encode_basic(self) -> None:
        assert encode_rid("ont.acme.cls.order") == "ont%2Eacme%2Ecls%2Eorder"

    def test_encode_with_colon(self) -> None:
        assert encode_rid("ont.acme.prop.alias:display") == (
            "ont%2Eacme%2Eprop%2Ealias%3Adisplay"
        )

    def test_encode_with_dash_underscore(self) -> None:
        # `:` 和 `.` 必然被编码；`-_` 也编码以保证 URL 安全
        assert encode_rid("ont.acme.ind.order-10086_v2") == (
            "ont%2Eacme%2Eind%2Eorder%2D10086%5Fv2"
        )

    def test_decode_roundtrip(self) -> None:
        for rid in [
            "ont.acme.cls.order",
            "ont.acme.fn.notify.v2",
            "ont.acme.ind.order-10086",
            "ont.acme.prop.alias:display",
        ]:
            assert decode_rid(encode_rid(rid)) == rid

    def test_split_basic(self) -> None:
        parts = rid_split("ont.acme.cls.order")
        assert parts.tenant == "acme"
        assert parts.kind == "cls"
        assert parts.rest == "order"

    def test_split_with_dotted_rest(self) -> None:
        parts = rid_split("ont.acme.ind.order.10086")
        assert parts.kind == "ind"
        assert parts.rest == "order.10086"

    def test_split_rejects_bad_prefix(self) -> None:
        with pytest.raises(ValueError, match="invalid rid"):
            rid_split("acme.cls.order")

    def test_split_rejects_unknown_kind(self) -> None:
        with pytest.raises(ValueError, match="unknown rid kind"):
            rid_split("ont.acme.bogus.x")

    def test_join_basic(self) -> None:
        assert rid_join("acme", "cls", "order") == "ont.acme.cls.order"

    def test_join_rejects_bad_tenant(self) -> None:
        with pytest.raises(ValueError, match="invalid tenant"):
            rid_join("acme.co", "cls", "order")  # 含 `.`

    def test_join_rejects_unknown_kind(self) -> None:
        with pytest.raises(ValueError, match="unknown kind"):
            rid_join("acme", "bogus", "order")


# ──────────────────────── 12 基元 round-trip (12 tests) ────────────────────────


def _ts() -> datetime:
    return datetime(2026, 8, 6, 12, 0, 0, tzinfo=timezone.utc)


class TestSerdeRoundTrip:
    def test_class_ref(self) -> None:
        cr = ClassRef("ont.acme.cls.order")
        assert from_dict("class_ref", to_dict(cr)) == cr

    def test_version(self) -> None:
        v = Version(
            rid="ont.acme.ver.cls-order.v1",
            class_ref=ClassRef("ont.acme.cls.order"),
            parent_rid=None,
            created_at=_ts(),
            author="alice",
            change_set=("init",),
        )
        assert from_dict("version", to_dict(v)) == v

    def test_property(self) -> None:
        p = Property(
            rid=ClassRef("ont.acme.prop.string.display_name"),
            type_id="string",
            nullable=True,
            primary_key=False,
            title="Display Name",
            format=PropertyFormat.STRING,
        )
        assert from_dict("property", to_dict(p)) == p

    def test_object_type(self) -> None:
        pk = Property(
            rid=ClassRef("ont.acme.prop.string.order_id"),
            type_id="string",
            nullable=False,
            primary_key=True,
            title="Order ID",
            format=PropertyFormat.STRING,
        )
        ot = ObjectType(
            rid=ClassRef("ont.acme.obj.order"),
            primary_key=(pk.rid,),
            properties=(pk,),
            interfaces=(),
            display_name="Order",
        )
        assert from_dict("object_type", to_dict(ot)) == ot

    def test_link_type(self) -> None:
        lt = LinkType(
            rid=ClassRef("ont.acme.link.user_has_order"),
            src=ClassRef("ont.acme.obj.user"),
            dst=ClassRef("ont.acme.obj.order"),
            cardinality=Cardinality.ONE_TO_MANY,
            directionality=Directionality.DIRECTED,
            link_properties=(),
        )
        assert from_dict("link_type", to_dict(lt)) == lt

    def test_action_type(self) -> None:
        at = ActionType(
            rid=ClassRef("ont.acme.act.approve_order"),
            parameters=(
                Property(
                    rid=ClassRef("ont.acme.prop.string.order_id"),
                    type_id="string",
                    nullable=False,
                    primary_key=False,
                    title="Order ID",
                    format=PropertyFormat.STRING,
                ),
            ),
            submission_criteria=("status == 'pending'",),
            side_effects=("update_status",),
            function_ref=ClassRef("ont.acme.fn.approve_order.v1"),
            on=(ClassRef("ont.acme.obj.order"),),
        )
        assert from_dict("action_type", to_dict(at)) == at

    def test_interface(self) -> None:
        i = Interface(
            rid=ClassRef("ont.acme.if.approvable"),
            properties=(),
            required_links=(),
            polymorphic_action_constraints=("must have approve",),
        )
        assert from_dict("interface", to_dict(i)) == i

    def test_individual(self) -> None:
        ind = Individual(
            rid="ont.acme.ind.order.10086",
            class_rid=ClassRef("ont.acme.obj.order"),
            props=((ClassRef("ont.acme.prop.uuid.order_id"), "10086"),),
            primary_key="10086",
            created_at=_ts(),
            updated_at=_ts(),
            tenant_id="acme",
            marking=("PII",),
        )
        assert from_dict("individual", to_dict(ind)) == ind

    def test_link_instance(self) -> None:
        li = LinkInstance(
            rid="ont.acme.lnk.user_has_order.u1.o1",
            link_type_rid=ClassRef("ont.acme.link.user_has_order"),
            src="ont.acme.ind.user.u1",
            dst="ont.acme.ind.order.o1",
            props=(),
            created_at=_ts(),
            tenant_id="acme",
            marking=(),
        )
        assert from_dict("link_instance", to_dict(li)) == li

    def test_axiom(self) -> None:
        ax = Axiom(
            rid=ClassRef("ont.acme.ax.subclass.employee_person"),
            kind=AxiomKind.SUBCLASS,
            operands=(
                ClassRef("ont.acme.cls.employee"),
                ClassRef("ont.acme.cls.person"),
            ),
            rule_ref="rdfs:subClassOf",
            metadata=(),
        )
        assert from_dict("axiom", to_dict(ax)) == ax

    def test_function(self) -> None:
        f = Function(
            rid=ClassRef("ont.acme.fn.notify.v1"),
            language=FunctionLanguage.PYTHON,
            version="1.0.0",
            source_ref="s3://acme/fn/notify.py",
            signatures=(("approve_order", "ActionType"),),
        )
        assert from_dict("function", to_dict(f)) == f

    def test_object_set(self) -> None:
        os_ = ObjectSet(
            class_rid=ClassRef("ont.acme.obj.order"),
            filter_expr="status == 'pending'",
            sort=("-created_at",),
            paging_offset=0,
            paging_limit=50,
            view_config=None,
        )
        assert from_dict("object_set", to_dict(os_)) == os_


# ──────────────────────── 错误路径 (4 tests) ────────────────────────


class TestSerdeErrors:
    def test_unknown_kind(self) -> None:
        with pytest.raises(ValueError, match="unknown kind"):
            from_dict("bogus", {})

    def test_unsupported_type_to_dict(self) -> None:
        with pytest.raises(TypeError, match="unsupported type"):
            to_dict(42)  # type: ignore[arg-type]

    def test_from_dict_missing_field(self) -> None:
        with pytest.raises(KeyError):
            from_dict("property", {"rid": "ont.acme.prop.x.display_name"})

    def test_from_dict_bad_enum_value(self) -> None:
        with pytest.raises(ValueError):
            from_dict(
                "link_type",
                {
                    "rid": "ont.acme.link.x",
                    "src": "ont.acme.obj.a",
                    "dst": "ont.acme.obj.b",
                    "cardinality": "BOGUS",
                    "directionality": "FORWARD",
                    "link_properties": [],
                },
            )


# ──────────────────────── 跨基元交互 (1 test) ────────────────────────


class TestSerdeCrossPrimitive:
    def test_embedded_classref_via_version(self) -> None:
        """Version 嵌套 ClassRef —— round-trip 必须保持引用一致。"""
        v = Version(
            rid="ont.acme.ver.cls-order.v2",
            class_ref=ClassRef("ont.acme.cls.order"),
            parent_rid="ont.acme.ver.cls-order.v1",
            created_at=_ts(),
            author="bob",
            change_set=("add field", "fix bug"),
        )
        d = to_dict(v)
        v2 = from_dict("version", d)
        # nested ClassRef 必须仍是 ClassRef 实例 + rid 一致
        assert isinstance(v2.class_ref, ClassRef)
        assert v2.class_ref.rid == "ont.acme.cls.order"
        assert v2 == v
