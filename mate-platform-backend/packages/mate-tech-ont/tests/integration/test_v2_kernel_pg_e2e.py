"""PgOntologyRepository 单元 / 集成测试。

需要 env: PG_DSN（默认 postgresql://localhost/metaplatform_ont_test）
跳过规则：连不上 PG 时 skip（CI 无 PG 时不阻塞）。
"""

from __future__ import annotations

import os
from datetime import UTC, datetime

import pytest

from mate_kernel.action.engine import SubmissionCriteriaFailed
from mate_kernel.ontology.identity import ClassRef
from mate_kernel.ontology.instances import Individual, LinkInstance
from mate_kernel.ontology.query import ObjectSet
from mate_kernel.ontology.reasoning import Axiom, AxiomKind, Function, FunctionLanguage
from mate_kernel.ontology.types import (
    ActionType,
    Interface,
    LinkType,
    ObjectType,
    Property,
    PropertyFormat,
)
from mate_kernel.ontology.types.link_type import Cardinality, Directionality

PG_DSN = os.getenv("PG_DSN", "postgresql://meta:meta@localhost:5432/metaplatform_ont_test")


def _pg_available() -> bool:
    try:
        import psycopg2  # type: ignore  # noqa: PLC0415
        conn = psycopg2.connect(PG_DSN, connect_timeout=2)
        conn.close()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not _pg_available(),
    reason=f"PG not reachable at {PG_DSN!r}",
)


@pytest.fixture
def repo() -> object:
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository  # noqa: PLC0415
    return PgOntologyRepository(dsn=PG_DSN)


@pytest.fixture(autouse=True)
def _clean_pg(repo) -> None:
    """每个测试前清表：先确保 schema 存在再 DELETE。"""
    repo._ensure_schema()
    import psycopg2  # type: ignore  # noqa: PLC0415
    conn = psycopg2.connect(PG_DSN)
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM ont_link_instance")
            cur.execute("DELETE FROM ont_link_type")
            cur.execute("DELETE FROM ont_interface")
            cur.execute("DELETE FROM ont_property")
            cur.execute("DELETE FROM ont_axiom")
            cur.execute("DELETE FROM ont_function")
            cur.execute("DELETE FROM ont_individual")
            cur.execute("DELETE FROM ont_object_type")
            cur.execute("DELETE FROM ont_action_type")
        conn.commit()
    finally:
        conn.close()


def _po_ot() -> ObjectType:
    return ObjectType(
        rid=ClassRef("ont.acme.obj.po.v1"),
        primary_key=(ClassRef("ont.acme.prop.po-id.v1"),),
        properties=(
            Property(
                rid=ClassRef("ont.acme.prop.po-id.v1"),
                type_id="string",
                nullable=False,
                primary_key=True,
                title="id",
                format=PropertyFormat.STRING,
            ),
            Property(
                rid=ClassRef("ont.acme.prop.po-qty.v1"),
                type_id="integer",
                nullable=False,
                primary_key=False,
                title="qty",
                format=PropertyFormat.INTEGER,
            ),
        ),
        display_name="PO",
    )


def _individual(rid: str, qty: int) -> Individual:
    return Individual(
        rid=rid,
        class_rid=ClassRef("ont.acme.obj.po.v1"),
        props=(
            (ClassRef("ont.acme.prop.po-id.v1"), rid.rsplit(".", maxsplit=1)[-1]),
            (ClassRef("ont.acme.prop.po-qty.v1"), qty),
        ),
        primary_key=rid.rsplit(".", maxsplit=1)[-1],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
        tenant_id="acme",
    )


def test_upsert_object_type_creates_schema_and_persists(repo) -> None:
    ot = _po_ot()
    repo.upsert_object_type(ot)

    got = repo.get_object_type(ClassRef("ont.acme.obj.po.v1"))
    assert got.rid.rid == "ont.acme.obj.po.v1"
    assert got.display_name == "PO"
    assert len(got.properties) == 2


def test_individual_round_trip(repo) -> None:
    repo.upsert_object_type(_po_ot())
    repo.create_individual(_individual("ont.acme.ind.po.0", 5))
    repo.create_individual(_individual("ont.acme.ind.po.1", 15))

    got = repo.get_individual("ont.acme.ind.po.1")
    assert got.rid == "ont.acme.ind.po.1"
    assert got.tenant_id == "acme"


def test_evaluate_object_set_runs_real_pg_filter(repo) -> None:
    repo.upsert_object_type(_po_ot())
    for i, qty in enumerate([5, 10, 15, 20, 25]):
        repo.create_individual(_individual(f"ont.acme.ind.po.{i}", qty))

    os_ = ObjectSet(
        class_rid=ClassRef("ont.acme.obj.po.v1"),
        filter_expr="ont.acme.prop.po-qty.v1 >= 15",
        paging_limit=100,
    )
    results = repo.evaluate_object_set(os_)
    qtys = sorted(
        v
        for ind in results
        for k, v in ind.props
        if k.rid == "ont.acme.prop.po-qty.v1"
    )
    assert qtys == [15, 20, 25], f"got {qtys}"


def test_apply_action_updates_individual(repo) -> None:
    """GOVERN-04: PG apply_action 走 ActionService，与 InMemory 行为对齐。

    - side_effects 包含 at.side_effects 声明（为空 → 空列表）
    - 不在 at.parameters 声明的 parameters 字段（'reason'）会被忽略并通过 ActionService
      落 audit log 但不写回 individual.props（参数白名单由 ActionType.parameters 控制）
    """
    reason_prop = Property(
        rid=ClassRef("ont.acme.prop.reason.v1"),
        type_id="string",
        nullable=False,
        primary_key=False,
        title="reason",
        format=PropertyFormat.STRING,
    )
    repo.upsert_object_type(_po_ot())
    repo.upsert_action_type(
        ActionType(
            rid=ClassRef("ont.acme.act.approve.v1"),
            parameters=(reason_prop,),
            submission_criteria=(),
            side_effects=("emit.outbox.audit",),
            function_ref=ClassRef("ont.acme.fn.approve.v1"),
            on=(ClassRef("ont.acme.obj.po.v1"),),
        )
    )
    repo.create_individual(_individual("ont.acme.ind.po.0", 5))

    applied_at, side_effects = repo.apply_action(
        action_rid=ClassRef("ont.acme.act.approve.v1"),
        target_iid="ont.acme.ind.po.0",
        parameters={"reason": "approved by alice"},
        provenance={"actor": "alice"},
    )
    assert applied_at is not None
    assert "emit.outbox.audit" in side_effects
    assert any("actor=alice" in s for s in side_effects)
    assert any("target=ont.acme.ind.po.0" in s for s in side_effects)
    # 字段值写到 individual.props（按 reason 短名 → at.parameters 声明的 rid）
    got = repo.get_individual("ont.acme.ind.po.0")
    prop_rids = {k.rid: v for k, v in got.props}
    assert prop_rids.get("ont.acme.prop.reason.v1") == "approved by alice"


def test_unknown_action_raises_keyerror(repo) -> None:
    repo.upsert_object_type(_po_ot())
    repo.create_individual(_individual("ont.acme.ind.po.0", 5))

    with pytest.raises(KeyError):
        repo.apply_action(
            action_rid=ClassRef("ont.acme.act.nonexistent.v1"),
            target_iid="ont.acme.ind.po.0",
            parameters={},
            provenance={},
        )


# ────────────────────────────────────────────────────────────────────
# GOVERN-04: 5 stub 真接后的基元 + apply_action 行为对齐
# ────────────────────────────────────────────────────────────────────


def _link_prop_rid(slug: str) -> ClassRef:
    return ClassRef(f"ont.acme.prop.{slug}.v1")


def _lt(slug: str = "order_customer") -> LinkType:
    return LinkType(
        rid=ClassRef(f"ont.acme.lnk.{slug}.v1"),
        src=ClassRef("ont.acme.obj.po.v1"),
        dst=ClassRef("ont.acme.obj.customer.v1"),
        cardinality=Cardinality.MANY_TO_ONE,
        directionality=Directionality.DIRECTED,
        link_properties=(
            Property(
                rid=_link_prop_rid("note"),
                type_id="string",
                nullable=True,
                primary_key=False,
                title="note",
                format=PropertyFormat.STRING,
            ),
        ),
    )


def _interface(slug: str = "auditable") -> Interface:
    return Interface(
        rid=ClassRef(f"ont.acme.if.{slug}.v1"),
        properties=(
            Property(
                rid=ClassRef("ont.acme.prop.audited-by.v1"),
                type_id="string",
                nullable=False,
                primary_key=False,
                title="audited-by",
                format=PropertyFormat.STRING,
            ),
        ),
        required_links=(ClassRef("ont.acme.lnk.order_customer.v1"),),
        polymorphic_action_constraints=("must have audit log",),
    )


def test_upsert_link_type_round_trip(repo) -> None:
    lt = _lt()
    repo.upsert_link_type(lt)
    got = repo.get_link_type(ClassRef(lt.rid.rid))
    assert got.rid == lt.rid
    assert got.src == lt.src
    assert got.dst == lt.dst
    assert got.cardinality == Cardinality.MANY_TO_ONE
    assert got.directionality == Directionality.DIRECTED
    assert len(got.link_properties) == 1


def test_get_link_type_missing_raises_keyerror(repo) -> None:
    with pytest.raises(KeyError):
        repo.get_link_type(ClassRef("ont.acme.lnk.nonexistent.v1"))


def test_list_link_types_returns_seeded(repo) -> None:
    repo.upsert_link_type(_lt("a"))
    repo.upsert_link_type(_lt("b"))
    repo.upsert_link_type(_lt("c"))
    items = repo.list_link_types()
    assert {x.rid.rid for x in items} >= {
        "ont.acme.lnk.a.v1",
        "ont.acme.lnk.b.v1",
        "ont.acme.lnk.c.v1",
    }


def test_upsert_interface_round_trip(repo) -> None:
    i = _interface()
    repo.upsert_interface(i)
    items = repo.list_interfaces()
    assert len(items) == 1
    got = items[0]
    assert got.rid == i.rid
    assert len(got.properties) == 1
    assert got.required_links == (ClassRef("ont.acme.lnk.order_customer.v1"),)
    assert got.polymorphic_action_constraints == ("must have audit log",)


def test_upsert_property_round_trip(repo) -> None:
    p = Property(
        rid=ClassRef("ont.acme.prop.standalone.v1"),
        type_id="integer",
        nullable=False,
        primary_key=False,
        title="standalone",
        format=PropertyFormat.INTEGER,
    )
    repo.upsert_property(p)
    conn = __import__("psycopg2").connect(PG_DSN)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT type_id, nullable, format FROM ont_property WHERE rid = %s",
                ("ont.acme.prop.standalone.v1",),
            )
            row = cur.fetchone()
    finally:
        conn.close()
    assert row == ("integer", False, "integer")


def _li() -> LinkInstance:
    return LinkInstance(
        rid="ont.acme.lnk.rel.po0-c0.v1",
        link_type_rid=ClassRef("ont.acme.lnk.order_customer.v1"),
        src="ont.acme.ind.po.0",
        dst="ont.acme.ind.cust.0",
        props=((_link_prop_rid("note"), "first order"),),
        created_at=datetime.now(UTC),
        tenant_id="acme",
    )


def test_create_link_instance_round_trip(repo) -> None:
    li = _li()
    repo.create_link_instance(li)
    items = repo.list_link_instances()
    assert len(items) == 1
    got = items[0]
    assert got.rid == li.rid
    assert got.src == li.src
    assert got.dst == li.dst
    assert got.link_type_rid == li.link_type_rid
    assert got.tenant_id == "acme"


def test_upsert_axiom_round_trip(repo) -> None:
    ax = Axiom(
        rid=ClassRef("ont.acme.ax.po-customer-subclass.v1"),
        kind=AxiomKind.SUBCLASS,
        operands=(ClassRef("ont.acme.obj.po.v1"), ClassRef("ont.acme.obj.customer.v1")),
        rule_ref="builtin:subclass",
        metadata=(("added-by", "govern-04"),),
    )
    repo.upsert_axiom(ax)
    items = repo.list_axioms()
    assert len(items) == 1
    got = items[0]
    assert got.rid == ax.rid
    assert got.kind == AxiomKind.SUBCLASS
    assert got.operands == ax.operands
    assert got.rule_ref == "builtin:subclass"
    assert ("added-by", "govern-04") in got.metadata


def test_list_axioms_returns_seeded(repo) -> None:
    repo.upsert_axiom(
        Axiom(
            rid=ClassRef("ont.acme.ax.a.v1"),
            kind=AxiomKind.PROPERTY,
            operands=(ClassRef("ont.acme.obj.po.v1"),),
            rule_ref="builtin:prop",
        )
    )
    repo.upsert_axiom(
        Axiom(
            rid=ClassRef("ont.acme.ax.b.v1"),
            kind=AxiomKind.TRANSITIVITY,
            operands=(ClassRef("ont.acme.obj.po.v1"), ClassRef("ont.acme.obj.customer.v1")),
            rule_ref="builtin:trans",
        )
    )
    items = repo.list_axioms()
    assert {a.rid.rid for a in items} >= {
        "ont.acme.ax.a.v1",
        "ont.acme.ax.b.v1",
    }


def test_upsert_function_round_trip(repo) -> None:
    f = Function(
        rid=ClassRef("ont.acme.fn.approve.v1"),
        language=FunctionLanguage.PYTHON,
        version=1,
        source_ref="git:sha-abc123",
        signatures=(("approve", "(target, parameters) -> bool"),),
    )
    repo.upsert_function(f)
    items = repo.list_functions()
    assert len(items) == 1
    got = items[0]
    assert got.rid == f.rid
    assert got.language == FunctionLanguage.PYTHON
    assert got.version == 1
    assert got.source_ref == "git:sha-abc123"
    assert ("approve", "(target, parameters) -> bool") in got.signatures


def test_list_functions_returns_seeded(repo) -> None:
    repo.upsert_function(
        Function(
            rid=ClassRef("ont.acme.fn.a.v1"),
            language=FunctionLanguage.PYTHON,
            version=1,
            source_ref="git:sha-a",
        )
    )
    repo.upsert_function(
        Function(
            rid=ClassRef("ont.acme.fn.b.v1"),
            language=FunctionLanguage.SQL,
            version=2,
            source_ref="oci:foo@sha256:deadbeef",
        )
    )
    items = repo.list_functions()
    assert {f.rid.rid for f in items} >= {
        "ont.acme.fn.a.v1",
        "ont.acme.fn.b.v1",
    }
    assert {f.language for f in items} >= {
        FunctionLanguage.PYTHON,
        FunctionLanguage.SQL,
    }


def test_apply_action_submission_criteria_failed(repo) -> None:
    """submission_criteria 不通过 → SubmissionCriteriaFailed（与 InMemory 对齐）。"""
    repo.upsert_object_type(_po_ot())
    repo.upsert_action_type(
        ActionType(
            rid=ClassRef("ont.acme.act.approve.v1"),
            parameters=(),
            submission_criteria=("status == 'pending'",),
            side_effects=(),
            function_ref=ClassRef("ont.acme.fn.approve.v1"),
            on=(ClassRef("ont.acme.obj.po.v1"),),
        )
    )
    repo.create_individual(_individual("ont.acme.ind.po.0", 5))

    with pytest.raises(SubmissionCriteriaFailed):
        repo.apply_action(
            action_rid=ClassRef("ont.acme.act.approve.v1"),
            target_iid="ont.acme.ind.po.0",
            parameters={},  # 没有 status 参数
            provenance={"actor": "alice"},
        )


def test_apply_action_unknown_parameter_raises_keyerror(repo) -> None:
    """parameters 字段不在 at.parameters 声明中 → KeyError（与 InMemory 对齐）。"""
    repo.upsert_object_type(_po_ot())
    repo.upsert_action_type(
        ActionType(
            rid=ClassRef("ont.acme.act.approve.v1"),
            parameters=(),  # 没声明任何参数
            submission_criteria=(),
            side_effects=(),
            function_ref=ClassRef("ont.acme.fn.approve.v1"),
            on=(ClassRef("ont.acme.obj.po.v1"),),
        )
    )
    repo.create_individual(_individual("ont.acme.ind.po.0", 5))

    with pytest.raises(KeyError, match="unknown parameter"):
        repo.apply_action(
            action_rid=ClassRef("ont.acme.act.approve.v1"),
            target_iid="ont.acme.ind.po.0",
            parameters={"not_declared": "x"},
            provenance={"actor": "alice"},
        )
