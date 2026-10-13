"""Materialized schema retains business labels independently of serialized row keys."""

from datetime import UTC, datetime

from mate_kernel.ontology import (
    ClassRef,
    Individual,
    InMemoryOntologyRepository,
    ObjectType,
    Property,
    PropertyFormat,
)
from mate_tech_ont.v2_kernel.backing_datasources import materialize_object_type


def test_materialization_schema_exposes_property_business_title():
    repo = InMemoryOntologyRepository()
    rid = ClassRef("ont.sample.obj.crm.customer.v1")
    prop = Property(
        rid=ClassRef("ont.sample.prop.crm.customer-id.v1"),
        type_id="string",
        nullable=False,
        primary_key=True,
        title="客户编号",
        format=PropertyFormat.STRING,
    )
    repo.upsert_object_type(ObjectType(rid=rid, primary_key=(prop.rid,), properties=(prop,)))
    now = datetime.now(UTC)
    repo.create_individual(
        Individual(
            rid="ont.sample.ind.customer.c1",
            class_rid=rid,
            props=((prop.rid, "c1"),),
            primary_key="c1",
            tenant_id="sample",
            created_at=now,
            updated_at=now,
        )
    )
    actual = materialize_object_type(repo, rid.rid)
    assert actual["count"] == 1
    assert actual["rows"][0]["customer-id"] == "c1"
    assert actual["schema"][prop.rid.rid].get("title") == "客户编号"
