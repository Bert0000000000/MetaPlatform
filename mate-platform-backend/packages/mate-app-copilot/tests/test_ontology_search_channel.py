"""MP-SAL-02: copilot OAG 通道 —— search_objects 工具 + 对象卡片注入 system prompt。"""

from __future__ import annotations

from typing import Any

from mate_app_copilot.agent_loop import build_system_prompt
from mate_app_copilot.ontology_tools import build_ontology_tools, execute_ontology_tool
from mate_kernel.ontology.identity import ClassRef
from mate_kernel.ontology.types import ObjectType, Property, PropertyFormat

_T = "oagcop"


def _ot() -> ObjectType:
    return ObjectType(
        rid=ClassRef(f"ont.{_T}.obj.order.v1"),
        primary_key=(ClassRef(f"ont.{_T}.prop.oid.v1"),),
        properties=(
            Property(rid=ClassRef(f"ont.{_T}.prop.oid.v1"), type_id="string",
                     nullable=False, primary_key=True, title="oid",
                     format=PropertyFormat.STRING),
        ),
        display_name="order",
    )


class _FakeRepo:
    def list_object_types(self, limit: int = 10000, offset: int = 0) -> list[ObjectType]:
        return [_ot()]

    def get_object_type(self, rid: ClassRef) -> ObjectType:
        return _ot()

    def list_link_instances(self) -> tuple:
        return ()

    def execute_object_query(self, q: Any) -> Any:  # pragma: no cover - not used here
        raise AssertionError

    def propose_action(
        self, action_rid, parameters, target_iid, impact_summary, expected_diff=None,
    ):
        raise AssertionError("propose not under test here")

    def search_objects(
        self, text: str, class_rid: str | None = None, top_k: int = 5,
    ) -> list[dict[str, Any]]:
        return [{
            "individual_rid": f"ont.{_T}.ind.order.o1",
            "class_rid": f"ont.{_T}.obj.order.v1",
            "score": 0.9,
            "matched": [{
                "property_rid": f"ont.{_T}.prop.memo.v1",
                "value_text": "rush shipment",
                "score": 0.9,
            }],
            "card_text": "order o1: rush shipment",
        }]


class TestSearchObjectsTool:
    def test_search_tool_in_registry(self) -> None:
        tools = build_ontology_tools(_FakeRepo())
        names = [t["function"]["name"] for t in tools]
        assert "search_objects" in names and "propose_action" in names

    def test_execute_search_returns_cards(self) -> None:
        out = execute_ontology_tool(_FakeRepo(), "search_objects", {"text": "rush"})
        assert out["cards"][0]["individual_rid"].endswith("order.o1")
        assert out["cards"][0]["matched"][0]["property_rid"].endswith("memo.v1")


class TestSystemPromptInjection:
    def test_cards_appended_with_rids(self) -> None:
        cards = [{
            "individual_rid": f"ont.{_T}.ind.order.o1",
            "class_rid": f"ont.{_T}.obj.order.v1",
            "score": 0.9,
            "matched": [{"property_rid": f"ont.{_T}.prop.memo.v1",
                         "value_text": "rush shipment", "score": 0.9}],
            "card_text": "order o1: rush shipment",
        }]
        prompt = build_system_prompt([{"role": "workflow", "name": "W", "capabilities": []}],
                                     object_cards=cards)
        assert "相关对象上下文" in prompt
        assert f"ont.{_T}.ind.order.o1" in prompt  # rid 可追溯进上下文

    def test_no_cards_unchanged(self) -> None:
        base = build_system_prompt([{"role": "workflow", "name": "W", "capabilities": []}])
        no_cards = build_system_prompt(
            [{"role": "workflow", "name": "W", "capabilities": []}], object_cards=[],
        )
        assert base == no_cards
