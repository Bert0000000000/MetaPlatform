"""PgOntologyRepository 单元 / 集成测试。

需要 env: PG_DSN（默认 postgresql://localhost/metaplatform_ont_test）
跳过规则：连不上 PG 时 skip（CI 无 PG 时不阻塞）。
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

import pytest

from mate_kernel.ontology.identity import ClassRef
from mate_kernel.ontology.instances import Individual
from mate_kernel.ontology.query import ObjectSet
from mate_kernel.ontology.types import (
    ActionType,
    ObjectType,
    Property,
    PropertyFormat,
)

PG_DSN = os.getenv("PG_DSN", "postgresql://meta:meta@localhost:5432/metaplatform_ont_test")


def _pg_available() -> bool:
    try:
        import psycopg2  # type: ignore
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
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository
    return PgOntologyRepository(dsn=PG_DSN)


@pytest.fixture(autouse=True)
def _clean_pg(repo) -> None:
    """每个测试前清表：先确保 schema 存在再 DELETE。"""
    repo._ensure_schema()  # noqa: SLF001
    import psycopg2  # type: ignore
    conn = psycopg2.connect(PG_DSN)
    try:
        with conn.cursor() as cur:
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
            (ClassRef("ont.acme.prop.po-id.v1"), rid.split(".")[-1]),
            (ClassRef("ont.acme.prop.po-qty.v1"), qty),
        ),
        primary_key=rid.split(".")[-1],
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
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
    repo.upsert_object_type(_po_ot())
    repo.upsert_action_type(
        ActionType(
            rid=ClassRef("ont.acme.act.approve.v1"),
            parameters=(),
            submission_criteria=(),
            side_effects=(),
            function_ref=ClassRef("ont.acme.fn.approve.v1"),
            on=(ClassRef("ont.acme.obj.po.v1"),),
        )
    )
    repo.create_individual(_individual("ont.acme.ind.po.0", 5))

    applied_at, side_effects = repo.apply_action(
        action_rid=ClassRef("ont.acme.act.approve.v1"),
        target_iid="ont.acme.ind.po.0",
        parameters={"reason": "test"},
        provenance={"actor": "alice"},
    )
    assert applied_at is not None
    assert any("actor=alice" in s for s in side_effects)
    assert any("target=ont.acme.ind.po.0" in s for s in side_effects)


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