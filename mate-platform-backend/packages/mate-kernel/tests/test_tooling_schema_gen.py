"""MP-SAL-01: schema_gen —— ObjectType → LLM 工具 schema 生成器（ADR-0043 §2.3-2.6）。

红测试先行：`mate_kernel.tooling.schema_gen` 实现前不存在。
- 每类型专用工具 `query_<slug>`：字段枚举进参数 schema（Palantir token 效率形态）；
- 固定辅助工具 list_classes / inspect_class；
- markings 可见性：可见工具 = 类型标记 ⊆ agent required_markings。
"""

from __future__ import annotations

from datetime import UTC, datetime

from mate_kernel.ontology.identity import ClassRef
from mate_kernel.ontology.instances import LinkInstance
from mate_kernel.ontology.types import ObjectType, Property, PropertyFormat
from mate_kernel.tooling.schema_gen import (
    inspect_class_tool_schema,
    list_classes_tool_schema,
    object_query_tool_schema,
    tool_name_for,
    visible_object_types,
)

_T = "tooltest"
_NOW = datetime.now(UTC)


def _prop(slug: str, fmt: PropertyFormat = PropertyFormat.STRING, type_id: str = "string") -> Property:
    return Property(
        rid=ClassRef(f"ont.{_T}.prop.{slug}.v1"),
        type_id=type_id,
        nullable=True,
        primary_key=False,
        title=slug,
        format=fmt,
    )


def _ot(slug: str, marking: tuple[str, ...] = ()) -> ObjectType:
    return ObjectType(
        rid=ClassRef(f"ont.{_T}.obj.{slug}.v1"),
        primary_key=(ClassRef(f"ont.{_T}.prop.{slug}-id.v1"),),
        properties=(
            Property(
                rid=ClassRef(f"ont.{_T}.prop.{slug}-id.v1"),
                type_id="string",
                nullable=False,
                primary_key=True,
                title="id",
                format=PropertyFormat.STRING,
            ),
            _prop("amount", PropertyFormat.INTEGER, "integer"),
            _prop("status"),
        ),
        display_name=slug,
        marking=marking,
    )


class TestToolName:
    def test_name_from_slug(self) -> None:
        assert tool_name_for(_ot("order")) == "query_order"

    def test_hyphenated_slug_sanitized(self) -> None:
        assert tool_name_for(_ot("purchase-order")) == "query_purchase_order"


class TestObjectQueryToolSchema:
    def test_basic_shape(self) -> None:
        schema = object_query_tool_schema(_ot("order"))
        fn = schema["function"]
        assert fn["name"] == "query_order"
        assert fn["description"]
        params = fn["parameters"]["properties"]
        assert set(params) >= {"filters", "aggregation", "sort", "paging_limit"}

    def test_field_enum_baked_in(self) -> None:
        """字段枚举直接进 schema（token 效率，Palantir 形态）。"""
        schema = object_query_tool_schema(_ot("order"))
        filter_items = schema["function"]["parameters"]["properties"]["filters"]["items"]
        assert set(filter_items["properties"]["field"]["enum"]) == {
            "order-id", "amount", "status",
        }
        assert "eq" in filter_items["properties"]["op"]["enum"]

    def test_traversal_enum_from_links(self) -> None:
        links = (
            LinkInstance(
                rid=f"ont.{_T}.lnk.l1",
                link_type_rid=ClassRef(f"ont.{_T}.link.owns.v1"),
                src="x", dst="y",
                props=(), created_at=_NOW, tenant_id=_T, marking=(),
            ),
        )
        schema = object_query_tool_schema(_ot("order"), links=links)
        trav = schema["function"]["parameters"]["properties"]["traversal"]["items"]
        assert trav["properties"]["link_type"]["enum"] == [f"ont.{_T}.link.owns.v1"]
        assert trav["properties"]["direction"]["enum"] == ["out", "in"]

    def test_no_traversal_param_without_links(self) -> None:
        schema = object_query_tool_schema(_ot("order"))
        assert "traversal" not in schema["function"]["parameters"]["properties"]


class TestFixedTools:
    def test_list_classes_shape(self) -> None:
        schema = list_classes_tool_schema()
        assert schema["function"]["name"] == "list_classes"

    def test_inspect_class_shape(self) -> None:
        schema = inspect_class_tool_schema()
        assert schema["function"]["name"] == "inspect_class"
        props = schema["function"]["parameters"]["properties"]
        assert "class_rid" in props


class TestVisibility:
    def test_unmarked_type_always_visible(self) -> None:
        visible = visible_object_types((_ot("order"),), agent_markings=())
        assert [t.rid.rid for t in visible] == [f"ont.{_T}.obj.order.v1"]

    def test_marked_type_visible_with_marking(self) -> None:
        visible = visible_object_types(
            (_ot("ledger", marking=("domain:finance",)),),
            agent_markings=("domain:finance",),
        )
        assert len(visible) == 1

    def test_marked_type_hidden_without_marking(self) -> None:
        visible = visible_object_types(
            (_ot("ledger", marking=("domain:finance",)),),
            agent_markings=("domain:marketing",),
        )
        assert visible == ()

    def test_mixed_batch_filters_per_type(self) -> None:
        visible = visible_object_types(
            (_ot("order"), _ot("ledger", marking=("domain:finance",))),
            agent_markings=(),
        )
        assert [t.rid.rid for t in visible] == [f"ont.{_T}.obj.order.v1"]
