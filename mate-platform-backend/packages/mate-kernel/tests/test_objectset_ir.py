"""MP-SAL-01: ObjectSetQuery 结构化 IR —— InMemory 后端行为测试（ADR-0043 §2.1-2.2）。

红测试先行：本文件 import 的 `mate_kernel.objectset.ir` 在实现前不存在。
语义约定（v1）：
- filters 是源类上的 AND 条件（8 操作符，对齐 filter_expr 能力减 OR/NOT）；
- traversal 链在 filters 之后执行，sort/paging/aggregation 作用于最终集合；
- 聚合返回行集（group 键 + 度量值），不是 Individual —— 结果信封 {kind, rows}。
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from mate_kernel.objectset.ir import (
    Aggregation,
    Condition,
    InMemoryQueryExecutor,
    MetricSpec,
    ObjectSetQuery,
    QueryOp,
    SortKey,
    TraversalStep,
    parse_filter_expr,
)
from mate_kernel.ontology.identity import ClassRef
from mate_kernel.ontology.instances import Individual, LinkInstance
from mate_kernel.ontology.types import ObjectType, Property, PropertyFormat

_T = "irtest"
_NOW = datetime.now(UTC)


def _prop(slug: str, fmt: PropertyFormat, type_id: str, pk: bool = False) -> Property:
    return Property(
        rid=ClassRef(f"ont.{_T}.prop.{slug}.v1"),
        type_id=type_id,
        nullable=not pk,
        primary_key=pk,
        title=slug,
        format=fmt,
    )


def _ot_order() -> ObjectType:
    return ObjectType(
        rid=ClassRef(f"ont.{_T}.obj.order.v1"),
        primary_key=(ClassRef(f"ont.{_T}.prop.oid.v1"),),
        properties=(
            _prop("oid", PropertyFormat.STRING, "string", pk=True),
            _prop("amount", PropertyFormat.INTEGER, "integer"),
            _prop("status", PropertyFormat.STRING, "string"),
            _prop("region", PropertyFormat.STRING, "string"),
        ),
        display_name="order",
    )


def _ot_customer() -> ObjectType:
    return ObjectType(
        rid=ClassRef(f"ont.{_T}.obj.customer.v1"),
        primary_key=(ClassRef(f"ont.{_T}.prop.cid.v1"),),
        properties=(
            _prop("cid", PropertyFormat.STRING, "string", pk=True),
            _prop("tier", PropertyFormat.STRING, "string"),
        ),
        display_name="customer",
    )


def _order(oid: str, amount: int, status: str, region: str) -> Individual:
    return Individual(
        rid=f"ont.{_T}.ind.order.{oid}",
        class_rid=ClassRef(f"ont.{_T}.obj.order.v1"),
        props=(
            (ClassRef(f"ont.{_T}.prop.oid.v1"), oid),
            (ClassRef(f"ont.{_T}.prop.amount.v1"), amount),
            (ClassRef(f"ont.{_T}.prop.status.v1"), status),
            (ClassRef(f"ont.{_T}.prop.region.v1"), region),
        ),
        primary_key=oid,
        created_at=_NOW,
        updated_at=_NOW,
        tenant_id=_T,
        marking=(),
    )


def _customer(cid: str, tier: str) -> Individual:
    return Individual(
        rid=f"ont.{_T}.ind.customer.{cid}",
        class_rid=ClassRef(f"ont.{_T}.obj.customer.v1"),
        props=(
            (ClassRef(f"ont.{_T}.prop.cid.v1"), cid),
            (ClassRef(f"ont.{_T}.prop.tier.v1"), tier),
        ),
        primary_key=cid,
        created_at=_NOW,
        updated_at=_NOW,
        tenant_id=_T,
        marking=(),
    )


def _link(link_type_slug: str, src_rid: str, dst_rid: str) -> LinkInstance:
    return LinkInstance(
        rid=f"ont.{_T}.lnk.{link_type_slug}.{src_rid.rsplit('.', maxsplit=1)[-1]}-{dst_rid.rsplit('.', maxsplit=1)[-1]}",
        link_type_rid=ClassRef(f"ont.{_T}.link.{link_type_slug}.v1"),
        src=src_rid,
        dst=dst_rid,
        props=(),
        created_at=_NOW,
        tenant_id=_T,
        marking=(),
    )


LINK_OWNS = f"ont.{_T}.link.owns.v1"


def _executor() -> InMemoryQueryExecutor:
    orders = (
        _order("o1", 100, "open", "north"),
        _order("o2", 250, "open", "south"),
        _order("o3", 50, "closed", "north"),
        _order("o4", 300, "open", "north"),
    )
    customers = (_customer("c1", "gold"), _customer("c2", "silver"))
    links = (
        _link("owns", f"ont.{_T}.ind.order.o1", f"ont.{_T}.ind.customer.c1"),
        _link("owns", f"ont.{_T}.ind.order.o2", f"ont.{_T}.ind.customer.c2"),
        _link("owns", f"ont.{_T}.ind.order.o3", f"ont.{_T}.ind.customer.c1"),
        _link("owns", f"ont.{_T}.ind.order.o4", f"ont.{_T}.ind.customer.c2"),
    )
    return InMemoryQueryExecutor(
        individuals=(*orders, *customers),
        links=links,
        object_types=(_ot_order(), _ot_customer()),
    )


class TestFilters:
    def test_eq_and_gt_combined(self) -> None:
        res = _executor().execute(ObjectSetQuery(
            source=ClassRef(f"ont.{_T}.obj.order.v1"),
            filters=(
                Condition("status", QueryOp.EQ, "open"),
                Condition("amount", QueryOp.GT, 100),
            ),
        ))
        assert res.kind == "objects"
        assert sorted(r["oid"] for r in res.rows) == ["o2", "o4"]

    def test_startswith_and_contains(self) -> None:
        res = _executor().execute(ObjectSetQuery(
            source=ClassRef(f"ont.{_T}.obj.order.v1"),
            filters=(Condition("oid", QueryOp.STARTSWITH, "o"),),
        ))
        assert len(res.rows) == 4
        res2 = _executor().execute(ObjectSetQuery(
            source=ClassRef(f"ont.{_T}.obj.order.v1"),
            filters=(Condition("region", QueryOp.CONTAINS, "ort"),),
        ))
        assert {r["oid"] for r in res2.rows} == {"o1", "o3", "o4"}

    def test_truthy(self) -> None:
        res = _executor().execute(ObjectSetQuery(
            source=ClassRef(f"ont.{_T}.obj.order.v1"),
            filters=(Condition("status", QueryOp.TRUTHY, None),),
        ))
        assert len(res.rows) == 4


class TestSortAndPaging:
    def test_multi_key_sort(self) -> None:
        res = _executor().execute(ObjectSetQuery(
            source=ClassRef(f"ont.{_T}.obj.order.v1"),
            sort=(SortKey("status"), SortKey("amount", desc=True)),
        ))
        assert [r["oid"] for r in res.rows] == ["o3", "o4", "o2", "o1"]

    def test_paging(self) -> None:
        res = _executor().execute(ObjectSetQuery(
            source=ClassRef(f"ont.{_T}.obj.order.v1"),
            sort=(SortKey("amount"),),
            paging_offset=1,
            paging_limit=2,
        ))
        assert [r["oid"] for r in res.rows] == ["o1", "o2"]


class TestAggregation:
    def test_group_by_sum(self) -> None:
        res = _executor().execute(ObjectSetQuery(
            source=ClassRef(f"ont.{_T}.obj.order.v1"),
            aggregation=Aggregation(
                group_by=("region",),
                metrics=(MetricSpec(fn="sum", field="amount"),),
            ),
        ))
        assert res.kind == "aggregates"
        rows = {r["region"]: r["sum_amount"] for r in res.rows}
        assert rows == {"north": 450, "south": 250}

    def test_count_and_avg(self) -> None:
        res = _executor().execute(ObjectSetQuery(
            source=ClassRef(f"ont.{_T}.obj.order.v1"),
            filters=(Condition("status", QueryOp.EQ, "open"),),
            aggregation=Aggregation(
                metrics=(MetricSpec(fn="count"), MetricSpec(fn="avg", field="amount")),
            ),
        ))
        assert len(res.rows) == 1
        assert res.rows[0]["count"] == 3
        assert res.rows[0]["avg_amount"] == (100 + 250 + 300) / 3

    def test_min_max_with_alias(self) -> None:
        res = _executor().execute(ObjectSetQuery(
            source=ClassRef(f"ont.{_T}.obj.order.v1"),
            aggregation=Aggregation(
                group_by=("status",),
                metrics=(
                    MetricSpec(fn="min", field="amount", alias="lo"),
                    MetricSpec(fn="max", field="amount", alias="hi"),
                ),
            ),
        ))
        by_status = {r["status"]: (r["lo"], r["hi"]) for r in res.rows}
        assert by_status == {"open": (100, 300), "closed": (50, 50)}

    def test_sum_without_field_rejected(self) -> None:
        with pytest.raises(ValueError, match="field"):
            _executor().execute(ObjectSetQuery(
                source=ClassRef(f"ont.{_T}.obj.order.v1"),
                aggregation=Aggregation(
                    metrics=(MetricSpec(fn="sum"),),
                ),
            ))


class TestTraversal:
    def test_traverse_out_to_customers(self) -> None:
        res = _executor().execute(ObjectSetQuery(
            source=ClassRef(f"ont.{_T}.obj.order.v1"),
            filters=(Condition("status", QueryOp.EQ, "open"),),
            traversal=(TraversalStep(link_type=LINK_OWNS, direction="out"),),
        ))
        assert res.kind == "objects"
        assert sorted(r["cid"] for r in res.rows) == ["c1", "c2"]

    def test_traverse_in_from_customers(self) -> None:
        res = _executor().execute(ObjectSetQuery(
            source=ClassRef(f"ont.{_T}.obj.customer.v1"),
            filters=(Condition("tier", QueryOp.EQ, "gold"),),
            traversal=(TraversalStep(link_type=LINK_OWNS, direction="in"),),
        ))
        assert sorted(r["oid"] for r in res.rows) == ["o1", "o3"]

    def test_bad_direction_rejected(self) -> None:
        with pytest.raises(ValueError, match="direction"):
            _executor().execute(ObjectSetQuery(
                source=ClassRef(f"ont.{_T}.obj.order.v1"),
                traversal=(TraversalStep(link_type=LINK_OWNS, direction="sideways"),),
            ))


class TestResultSchema:
    def test_objects_result_schema_maps_slugs_to_rids(self) -> None:
        res = _executor().execute(ObjectSetQuery(
            source=ClassRef(f"ont.{_T}.obj.order.v1"),
        ))
        assert res.result_schema is not None
        assert res.result_schema["amount"]["rid"] == f"ont.{_T}.prop.amount.v1"
        assert res.result_schema["amount"]["type"] == "integer"

    def test_aggregates_result_schema_carries_fn(self) -> None:
        res = _executor().execute(ObjectSetQuery(
            source=ClassRef(f"ont.{_T}.obj.order.v1"),
            aggregation=Aggregation(
                group_by=("region",),
                metrics=(MetricSpec(fn="sum", field="amount"),),
            ),
        ))
        assert res.result_schema is not None
        assert res.result_schema["sum_amount"]["fn"] == "sum"


class TestFilterExprSugar:
    def test_and_expression_compiles_to_conditions(self) -> None:
        conds = parse_filter_expr("amount > 100 AND status == 'open'")
        assert conds == (
            Condition("amount", QueryOp.GT, 100.0),
            Condition("status", QueryOp.EQ, "open"),
        )

    def test_single_atom(self) -> None:
        conds = parse_filter_expr("region startswith 'n'")
        assert conds == (Condition("region", QueryOp.STARTSWITH, "n"),)

    def test_empty_expr_is_no_conditions(self) -> None:
        assert parse_filter_expr("") == ()

    def test_or_not_representable(self) -> None:
        with pytest.raises(ValueError, match="OR"):
            parse_filter_expr("status == 'open' OR status == 'pending'")
