"""Published domain-prefixed fields remain distinct throughout ontology operations."""

from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime

import pytest

from mate_kernel.objectset.ir import ObjectSetQuery
from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.in_memory import InMemoryOntologyRepository
from mate_kernel.ontology.instances.individual import Individual
from mate_kernel.ontology.migration import build_migration_plan
from mate_kernel.ontology.security_policies import (
    ColumnPolicy,
    RowPolicy,
    SecurityPolicySet,
    filter_visible_individuals,
    mask_property_values,
)
from mate_kernel.ontology.types.object_type import ObjectType
from mate_kernel.ontology.types.property_ import Property, PropertyFormat
from mate_kernel.ontology.versioning_ops import diff_object_types
from mate_kernel.tooling.schema_gen import object_query_tool_schema


@pytest.fixture(params=["", ".v1"])
def model(request: pytest.FixtureRequest) -> ObjectType:
    properties = tuple(
        Property(
            rid=ClassRef(f"ont.nsp.prop.crm.{slug}{request.param}"),
            type_id="integer" if slug == "score" else "string",
            nullable=False,
            primary_key=slug == "id",
            title=slug,
            format=PropertyFormat.INTEGER if slug == "score" else PropertyFormat.STRING,
        )
        for slug in ("id", "name", "score")
    )
    return ObjectType(
        rid=ClassRef("ont.nsp.obj.crm.customer.v1"),
        primary_key=(properties[0].rid,),
        properties=properties,
    )


def individual(model: ObjectType) -> Individual:
    now = datetime.now(UTC)
    return Individual(
        rid="ont.nsp.ind.customer.c1",
        class_rid=model.rid,
        props=tuple((p.rid, v) for p, v in zip(model.properties, ("c1", "Ada", 3), strict=True)),
        primary_key="c1",
        tenant_id="nsp",
        created_at=now,
        updated_at=now,
    )


def test_query_retains_every_value_and_schema_field(model: ObjectType) -> None:
    repo = InMemoryOntologyRepository()
    repo.upsert_object_type(model)
    repo.create_individual(individual(model))
    result = repo.execute_object_query(ObjectSetQuery(source=model.rid.rid))
    assert result.rows == (
        {"__rid__": "ont.nsp.ind.customer.c1", "id": "c1", "name": "Ada", "score": 3},
    )
    assert result.result_schema is not None
    assert set(result.result_schema) == {"id", "name", "score"}
    assert result.result_schema["id"]["rid"] == model.primary_key[0].rid


def test_array_reducer_uses_its_own_field(model: ObjectType) -> None:
    model = replace(
        model,
        properties=(
            *model.properties[:2],
            replace(model.properties[2], array=True, reducer="first"),
        ),
    )
    ind = individual(model)
    ind = replace(ind, props=(*ind.props[:2], (model.properties[2].rid, [3, 9])))
    repo = InMemoryOntologyRepository()
    repo.upsert_object_type(model)
    repo.create_individual(ind)
    row = repo.execute_object_query(ObjectSetQuery(source=model.rid.rid)).rows[0]
    assert row["id"] == "c1" and row["name"] == "Ada" and row["score"] == 3


def test_confirmed_creation_resolves_each_slug_and_pk(model: ObjectType) -> None:
    repo = InMemoryOntologyRepository()
    repo.upsert_object_type(model)
    proposal = repo.propose_create_instance(
        model.rid.rid, {"id": "c1", "name": "Ada", "score": 3}, "new customer"
    )
    repo.confirm_proposal(proposal.proposal_id, confirmed_by="reviewer")
    created = repo.execute_proposal(proposal.proposal_id)
    assert created.rid == "ont.nsp.ind.customer.c1"
    assert dict(created.props) == dict(individual(model).props)


def test_version_diff_and_successor_mapping_preserve_fields(model: ObjectType) -> None:
    reduced = replace(model, properties=model.properties[:2])
    assert diff_object_types(model, reduced)["removed"] == ["score"]
    new_props = tuple(
        replace(p, rid=ClassRef(p.rid.rid.removesuffix(".v1") + ".v2")) for p in model.properties
    )
    successor = replace(model, properties=new_props, primary_key=(new_props[0].rid,))
    assert build_migration_plan(model, successor)["renames"] == {
        old.rid.rid: new.rid.rid for old, new in zip(model.properties, new_props, strict=True)
    }


def test_query_tool_exposes_all_distinct_fields(model: ObjectType) -> None:
    fields = object_query_tool_schema(model)["function"]["parameters"]["properties"]["filters"][
        "items"
    ]["properties"]["field"]["enum"]
    assert fields == ["id", "name", "score"]


def test_row_and_column_policies_still_enforce_specific_fields(model: ObjectType) -> None:
    ind = individual(model)
    policy = SecurityPolicySet(
        row_policies=(
            RowPolicy(
                class_rid=model.rid.rid,
                field="name",
                op="eq",
                value="Ada",
                bypass_markings=("admin",),
            ),
        ),
        column_policies=(
            ColumnPolicy(property_rid=model.properties[2].rid.rid, required_markings=("private",)),
        ),
    )
    assert filter_visible_individuals([ind], policy, ("ordinary",)) == [ind]
    denied = replace(policy, row_policies=(replace(policy.row_policies[0], value="Other"),))
    assert filter_visible_individuals([ind], denied, ("ordinary",)) == []
    masked = mask_property_values({"id": "c1", "name": "Ada", "score": 3}, policy, ("ordinary",))
    assert masked == {"id": "c1", "name": "Ada", "score": None}
