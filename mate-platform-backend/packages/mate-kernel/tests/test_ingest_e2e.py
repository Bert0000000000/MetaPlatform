"""MP-SAL-04b: repo 级 ingest 链路（InMemory）—— 文本→实例/类型落本体库。

正路径：propose_create_instance(pending) → confirm → execute → ont_individual 新增
       propose_model_type → confirm → execute → ont_object_type 新增
negative：未确认 execute → ProposalNotConfirmed 且零创建；
         action 类 proposal 走 execute → 409 语义错误。
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from mate_kernel.action.engine import ProposalNotConfirmed
from mate_kernel.ontology.identity import ClassRef
from mate_kernel.ontology.in_memory import InMemoryOntologyRepository
from mate_kernel.ontology.types import ActionType, ObjectType, Property, PropertyFormat

_T = "ingest"
_NOW = datetime.now(UTC)


def _prop(slug: str, pk: bool = False, type_id: str = "string") -> Property:
    return Property(
        rid=ClassRef(f"ont.{_T}.prop.{slug}.v1"),
        type_id=type_id, nullable=not pk, primary_key=pk, title=slug,
        format=PropertyFormat.STRING,
    )


def _supplier_type() -> ObjectType:
    return ObjectType(
        rid=ClassRef(f"ont.{_T}.obj.supplier.v1"),
        primary_key=(ClassRef(f"ont.{_T}.prop.supplier-id.v1"),),
        properties=(
            Property(rid=ClassRef(f"ont.{_T}.prop.supplier-id.v1"), type_id="string",
                     nullable=False, primary_key=True, title="supplier_id",
                     format=PropertyFormat.STRING),
            _prop("name"), _prop("region"), _prop("rating"),
        ),
        display_name="supplier",
    )


def _repo() -> InMemoryOntologyRepository:
    repo = InMemoryOntologyRepository()
    repo.upsert_object_type(_supplier_type())
    return repo


_PROPS = {
    "supplier-id": "sup-hx-001",
    "name": "华信科技",
    "region": "华东",
    "rating": "A",
}


class TestCreateInstance:
    def test_propose_confirm_execute_creates_individual(self) -> None:
        repo = _repo()
        prop = repo.propose_create_instance(
            class_rid=f"ont.{_T}.obj.supplier.v1",
            props=_PROPS,
            impact_summary="新建供应商 华信科技（华东，评级A）",
            expected_diff={"+": "supplier sup-hx-001"},
        )
        assert prop.kind == "create_instance"
        assert prop.status.value == "pending"

        repo.confirm_proposal(prop.proposal_id, confirmed_by="rouge")
        created = repo.execute_proposal(prop.proposal_id)

        assert created.rid == f"ont.{_T}.ind.supplier.sup-hx-001"
        got = repo.get_individual(created.rid)
        assert dict(got.props)[ClassRef(f"ont.{_T}.prop.name.v1")] == "华信科技"
        assert got.tenant_id == _T
        assert repo.get_proposal(prop.proposal_id).status.value == "applied"

    def test_unconfirmed_execute_never_creates(self) -> None:
        repo = _repo()
        prop = repo.propose_create_instance(
            f"ont.{_T}.obj.supplier.v1", _PROPS, "impact",
        )
        with pytest.raises(ProposalNotConfirmed):
            repo.execute_proposal(prop.proposal_id)
        assert repo.list_individuals(None) == []

    def test_unknown_class_rejected(self) -> None:
        repo = _repo()
        with pytest.raises(KeyError):
            repo.propose_create_instance("ont.t.obj.ghost.v1", _PROPS, "impact")


class TestModelType:
    def test_propose_confirm_execute_upserts_type(self) -> None:
        repo = _repo()
        prop = repo.propose_model_type(
            type_def={
                "rid": f"ont.{_T}.obj.warehouse.v1",
                "primary_key": [f"ont.{_T}.prop.wh-id.v1"],
                "properties": [
                    {"rid": f"ont.{_T}.prop.wh-id.v1", "type_id": "string",
                     "nullable": False, "primary_key": True, "title": "wh_id",
                     "format": "string"},
                    {"rid": f"ont.{_T}.prop.addr.v1", "type_id": "string",
                     "nullable": True, "primary_key": False, "title": "addr",
                     "format": "string"},
                ],
                "display_name": "warehouse",
            },
            impact_summary="新建仓库类型（文本抽取）",
        )
        assert prop.kind == "model_type"
        repo.confirm_proposal(prop.proposal_id, confirmed_by="rouge")
        ot = repo.execute_proposal(prop.proposal_id)
        assert ot.rid.rid == f"ont.{_T}.obj.warehouse.v1"
        assert repo.get_proposal(prop.proposal_id).status.value == "applied"


class TestActionKindGuards:
    def test_action_proposal_execute_rejected(self) -> None:
        repo = _repo()
        repo.upsert_action_type(ActionType(
            rid=ClassRef(f"ont.{_T}.act.flag.v1"),
            parameters=(),
            submission_criteria=(),
            side_effects=(),
            function_ref=ClassRef(f"ont.{_T}.fn.flag.v1"),
            on=(ClassRef(f"ont.{_T}.obj.supplier.v1"),),
        ))
        prop = repo.propose_action(
            ClassRef(f"ont.{_T}.act.flag.v1"), {}, None, "impact",
        )
        repo.confirm_proposal(prop.proposal_id)
        with pytest.raises(ValueError, match="action"):
            repo.execute_proposal(prop.proposal_id)
