"""MP-SAL-05: 流程编排定义持久化 —— repo 级测试（InMemory dev 语义）。"""

from __future__ import annotations

import pytest

from mate_kernel.ontology.identity import ClassRef
from mate_kernel.ontology.in_memory import InMemoryOntologyRepository
from mate_kernel.ontology.types import ActionType, ObjectType, Property, PropertyFormat


def _repo() -> InMemoryOntologyRepository:
    repo = InMemoryOntologyRepository()
    repo.upsert_object_type(ObjectType(
        rid=ClassRef("ont.t.obj.order.v1"),
        primary_key=(ClassRef("ont.t.prop.oid.v1"),),
        properties=(Property(rid=ClassRef("ont.t.prop.oid.v1"), type_id="string",
                             nullable=False, primary_key=True, title="oid",
                             format=PropertyFormat.STRING),),
        display_name="order",
    ))
    repo.upsert_action_type(ActionType(
        rid=ClassRef("ont.t.act.flag.v1"),
        parameters=(), submission_criteria=(), side_effects=(),
        function_ref=ClassRef("ont.t.fn.flag.v1"),
        on=(ClassRef("ont.t.obj.order.v1"),),
    ))
    return repo


class TestFlowDefinition:
    def test_put_then_get_roundtrip(self) -> None:
        repo = _repo()
        flow = {"nodes": [{"id": "input", "type": "flow-input"}],
                "edges": [{"sourceNodeID": "input", "targetNodeID": "output"}]}
        config = {"input": {"id": {"label": "节点 ID", "value": "node-input-99"}}}
        repo.put_flow_definition(ClassRef("ont.t.act.flag.v1"), flow, config)
        got = repo.get_flow_definition(ClassRef("ont.t.act.flag.v1"))
        assert got["action_rid"] == "ont.t.act.flag.v1"
        assert got["flow_json"]["nodes"][0]["id"] == "input"
        assert got["config"]["input"]["id"]["value"] == "node-input-99"

    def test_get_missing_raises_keyerror(self) -> None:
        repo = _repo()
        with pytest.raises(KeyError):
            repo.get_flow_definition(ClassRef("ont.t.act.flag.v1"))

    def test_put_upserts(self) -> None:
        repo = _repo()
        repo.put_flow_definition(ClassRef("ont.t.act.flag.v1"), {"nodes": []})
        repo.put_flow_definition(ClassRef("ont.t.act.flag.v1"), {"nodes": [{"id": "v2"}]})
        got = repo.get_flow_definition(ClassRef("ont.t.act.flag.v1"))
        assert got["flow_json"]["nodes"][0]["id"] == "v2"
