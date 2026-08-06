"""OBJECTSET-04 ObjectSet 编译器测试。"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.instances.individual import Individual
from mate_kernel.ontology.query.object_set import ObjectSet
from mate_kernel.objectset.compiler import (
    CompiledFilter,
    FilterCompiler,
    FilterEvaluator,
    InMemoryObjectSetExecutor,
    SQLObjectSetExecutor,
    individual_to_row,
)


def _cls(slug: str = "order") -> ClassRef:
    return ClassRef(rid=f"ont.acme.cls.{slug}.v1")


def _prop(slug: str) -> ClassRef:
    return ClassRef(rid=f"ont.acme.prop.{slug}.v1")


def _ind(pk: str, props: dict[str, object]) -> Individual:
    cls = _cls()
    return Individual(
        rid=f"ont.acme.ind.order.{pk}",
        class_rid=cls,
        props=tuple(
            (_prop(name), value) for name, value in props.items()  # type: ignore[arg-type]
        ),
        primary_key=pk,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        tenant_id="acme",
    )


# ─────────────────── FilterCompiler ───────────────────


class TestFilterCompiler:
    def _c(self) -> FilterCompiler:
        return FilterCompiler()

    def test_empty_is_always(self) -> None:
        assert self._c().compile("").kind == "always"

    def test_eq_string(self) -> None:
        f = self._c().compile("status == 'open'")
        assert f.kind == "compare_eq"
        assert f.field_name == "status"
        assert f.value == "open"

    def test_eq_number(self) -> None:
        f = self._c().compile("amount == 100")
        assert f.value == 100.0

    def test_gt(self) -> None:
        f = self._c().compile("amount > 1000")
        assert f.kind == "compare_gt" and f.value == 1000.0

    def test_gte(self) -> None:
        f = self._c().compile("amount >= 1000")
        assert f.kind == "compare_gte"

    def test_lt(self) -> None:
        f = self._c().compile("amount < 5")
        assert f.kind == "compare_lt"

    def test_startswith(self) -> None:
        f = self._c().compile("name startswith 'order-'")
        assert f.kind == "startswith" and f.value == "order-"

    def test_contains(self) -> None:
        f = self._c().compile("name contains 'rush'")
        assert f.kind == "contains"

    def test_negate(self) -> None:
        f = self._c().compile("NOT status == 'closed'")
        assert f.kind == "negate"

    def test_and(self) -> None:
        f = self._c().compile("status == 'open' AND amount > 1000")
        assert f.kind == "logical_and" and len(f.children) == 2

    def test_or(self) -> None:
        f = self._c().compile("status == 'open' OR status == 'pending'")
        assert f.kind == "logical_or" and len(f.children) == 2

    def test_precedence_and_binds_tighter_than_or(self) -> None:
        f = self._c().compile("a == '1' OR b == '2' AND c == '3'")
        # OR 拆顶层 → children 第一个 a==1，第二个再 AND b,c
        assert f.kind == "logical_or"
        assert f.children[0].kind == "compare_eq"
        assert f.children[1].kind == "logical_and"

    def test_parens(self) -> None:
        f = self._c().compile("(a == '1' OR b == '2') AND c == '3'")
        assert f.kind == "logical_and"
        assert f.children[0].kind == "logical_or"

    def test_string_with_spaces_preserved(self) -> None:
        f = self._c().compile("note == 'hello world'")
        assert f.value == "hello world"


# ─────────────────── FilterEvaluator ───────────────────


class TestFilterEvaluator:
    def _e(self) -> FilterEvaluator:
        return FilterEvaluator()

    def test_always(self) -> None:
        assert self._e().evaluate(CompiledFilter(kind="always"), {})

    def test_eq(self) -> None:
        f = CompiledFilter(kind="compare_eq", field_name="status", value="open")
        assert self._e().evaluate(f, {"status": "open"})
        assert not self._e().evaluate(f, {"status": "closed"})

    def test_gt(self) -> None:
        f = CompiledFilter(kind="compare_gt", field_name="amount", value=100.0)
        assert self._e().evaluate(f, {"amount": 200})
        assert not self._e().evaluate(f, {"amount": 50})

    def test_startswith(self) -> None:
        f = CompiledFilter(kind="startswith", field_name="name", value="order-")
        assert self._e().evaluate(f, {"name": "order-1"})
        assert not self._e().evaluate(f, {"name": "inv-1"})

    def test_contains(self) -> None:
        f = CompiledFilter(kind="contains", field_name="name", value="rush")
        assert self._e().evaluate(f, {"name": "rush-order"})

    def test_negate(self) -> None:
        f = CompiledFilter(
            kind="negate",
            children=(CompiledFilter(kind="compare_eq", field_name="s", value="x"),),
        )
        assert self._e().evaluate(f, {"s": "y"})

    def test_and(self) -> None:
        f = CompiledFilter(
            kind="logical_and",
            children=(
                CompiledFilter(kind="compare_eq", field_name="s", value="open"),
                CompiledFilter(kind="compare_gt", field_name="a", value=10.0),
            ),
        )
        assert self._e().evaluate(f, {"s": "open", "a": 20})
        assert not self._e().evaluate(f, {"s": "open", "a": 5})

    def test_or(self) -> None:
        f = CompiledFilter(
            kind="logical_or",
            children=(
                CompiledFilter(kind="compare_eq", field_name="s", value="open"),
                CompiledFilter(kind="compare_eq", field_name="s", value="pending"),
            ),
        )
        assert self._e().evaluate(f, {"s": "pending"})

    def test_truthy_field(self) -> None:
        f = CompiledFilter(kind="truthy", field_name="active")
        assert self._e().evaluate(f, {"active": True})
        assert not self._e().evaluate(f, {"active": False})


# ─────────────────── InMemoryObjectSetExecutor ───────────────────


class TestInMemoryExecutor:
    def _plan(self, expr: str = "", sort=(), limit: int = 100) -> ObjectSet:
        return ObjectSet(
            class_rid=_cls(),
            filter_expr=expr,
            sort=sort,
            paging_offset=0,
            paging_limit=limit,
        )

    def test_returns_matching(self) -> None:
        source = [
            _ind("1", {"status": "open", "amount": 2000}),
            _ind("2", {"status": "closed", "amount": 500}),
            _ind("3", {"status": "open", "amount": 100}),
        ]
        result = InMemoryObjectSetExecutor(source).execute(self._plan("status == 'open'"))
        assert len(result) == 2
        assert {r.primary_key for r in result} == {"1", "3"}

    def test_filter_class(self) -> None:
        cls_order = _cls("order")
        cls_inv = _cls("invoice")
        orders = [
            Individual(
                rid="ont.acme.ind.order.1", class_rid=cls_order,
                props=((cls_order, "1"),), primary_key="1",
                created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc),
                tenant_id="acme",
            )
        ]
        invs = [
            Individual(
                rid="ont.acme.ind.invoice.1", class_rid=cls_inv,
                props=((cls_inv, "1"),), primary_key="1",
                created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc),
                tenant_id="acme",
            )
        ]
        plan = ObjectSet(class_rid=cls_order, filter_expr="")
        result = InMemoryObjectSetExecutor(orders + invs).execute(plan)
        assert len(result) == 1
        assert result[0].class_rid.rid.endswith(".order.v1")

    def test_sort(self) -> None:
        source = [
            _ind("3", {"amount": 300}),
            _ind("1", {"amount": 100}),
            _ind("2", {"amount": 200}),
        ]
        plan = self._plan(expr="amount > 0", sort=("amount",))
        result = InMemoryObjectSetExecutor(source).execute(plan)
        assert [r.primary_key for r in result] == ["1", "2", "3"]

    def test_sort_desc(self) -> None:
        source = [
            _ind("1", {"amount": 100}),
            _ind("3", {"amount": 300}),
            _ind("2", {"amount": 200}),
        ]
        plan = self._plan(expr="amount > 0", sort=("-amount",))
        result = InMemoryObjectSetExecutor(source).execute(plan)
        assert [r.primary_key for r in result] == ["3", "2", "1"]

    def test_paging(self) -> None:
        source = [_ind(str(i), {"amount": float(i)}) for i in range(10)]
        plan = ObjectSet(
            class_rid=_cls(),
            filter_expr="amount >= 0",
            paging_offset=3,
            paging_limit=2,
        )
        result = InMemoryObjectSetExecutor(source).execute(plan)
        assert [r.primary_key for r in result] == ["3", "4"]

    def test_complex_expr(self) -> None:
        source = [
            _ind("1", {"status": "open", "amount": 2000}),
            _ind("2", {"status": "open", "amount": 100}),
            _ind("3", {"status": "closed", "amount": 3000}),
        ]
        plan = self._plan("status == 'open' AND amount > 1000")
        result = InMemoryObjectSetExecutor(source).execute(plan)
        assert [r.primary_key for r in result] == ["1"]


class TestIndividualToRow:
    def test_basic(self) -> None:
        cls = _cls()
        ind = _ind("42", {"status": "open"})
        row = individual_to_row(ind)
        assert row["__rid__"] == "ont.acme.ind.order.42"


class TestSQLExecutorStub:
    def _plan(self, expr: str = "") -> ObjectSet:
        return ObjectSet(class_rid=_cls(), filter_expr=expr)

    def test_raises_not_implemented(self) -> None:
        with pytest.raises(NotImplementedError, match="SQLObjectSetExecutor"):
            SQLObjectSetExecutor().execute(self._plan())


class TestHyphenSlugRegression:
    """Bug B 回归：rid 第 4 段含连字符的 slug（e.g. `po-qty`）。"""

    def test_compare_gte_hyphen(self) -> None:
        fc, ev = FilterCompiler(), FilterEvaluator()
        cf = fc.compile("po-qty >= 15")
        assert cf.kind == "compare_gte"
        assert cf.field_name == "po-qty"
        assert ev.evaluate(cf, {"po-qty": 20})
        assert not ev.evaluate(cf, {"po-qty": 10})

    def test_compare_lte_hyphen(self) -> None:
        fc, ev = FilterCompiler(), FilterEvaluator()
        cf = fc.compile("po-qty <= 5")
        assert cf.kind == "compare_lte"
        assert ev.evaluate(cf, {"po-qty": 5})
        assert not ev.evaluate(cf, {"po-qty": 6})

    def test_logical_and_hyphen(self) -> None:
        fc, ev = FilterCompiler(), FilterEvaluator()
        cf = fc.compile("po-qty >= 10 AND po-qty < 25")
        rows = [{"po-qty": v} for v in (5, 10, 15, 20, 25)]
        out = [r for r in rows if ev.evaluate(cf, r)]
        assert out == [{"po-qty": 10}, {"po-qty": 15}, {"po-qty": 20}]

    def test_startswith_hyphen(self) -> None:
        fc, ev = FilterCompiler(), FilterEvaluator()
        cf = fc.compile("po-id startswith 'PO-'")
        assert cf.kind == "startswith"
        assert cf.field_name == "po-id"
        assert ev.evaluate(cf, {"po-id": "PO-001"})
        assert not ev.evaluate(cf, {"po-id": "SO-001"})


class TestRepoEvaluateFilterRegression:
    """Bug A 回归：InMemoryRepository.evaluate_object_set 必须消费 filter_expr。"""

    def _seed(self):
        from mate_kernel.ontology.in_memory import InMemoryOntologyRepository
        from mate_kernel.ontology.types.property_ import Property, PropertyFormat
        from mate_kernel.ontology.types.object_type import ObjectType

        repo = InMemoryOntologyRepository()
        cls = _cls("po")
        prop_pk = Property(
            rid=ClassRef(rid="ont.acme.prop.po-id.v1"),
            type_id="string", nullable=False, primary_key=True,
            title="id", format=PropertyFormat.STRING,
        )
        prop_qty = Property(
            rid=ClassRef(rid="ont.acme.prop.po-qty.v1"),
            type_id="integer", nullable=False, primary_key=False,
            title="qty", format=PropertyFormat.INTEGER,
        )
        repo.upsert_object_type(ObjectType(
            rid=cls, primary_key=(prop_pk.rid,),
            properties=(prop_pk, prop_qty), display_name="PO",
        ))
        now = datetime.now(timezone.utc)
        for i, q in enumerate([5, 10, 15, 20, 25]):
            repo.create_individual(Individual(
                rid=f"ont.acme.ind.po.{i}", class_rid=cls,
                props=((prop_qty.rid, q),), primary_key=str(i),
                created_at=now, updated_at=now, tenant_id="acme",
            ))
        return repo, cls

    def test_filter_expr_now_consumed(self) -> None:
        repo, cls = self._seed()
        res = repo.evaluate_object_set(ObjectSet(class_rid=cls, filter_expr="po-qty >= 15"))
        assert {i.primary_key for i in res} == {"2", "3", "4"}

    def test_sort_desc(self) -> None:
        repo, cls = self._seed()
        res = repo.evaluate_object_set(ObjectSet(
            class_rid=cls, filter_expr="po-qty >= 10", sort=("-po-qty",),
        ))
        assert [i.primary_key for i in res] == ["4", "3", "2", "1"]

    def test_paging(self) -> None:
        repo, cls = self._seed()
        res = repo.evaluate_object_set(ObjectSet(
            class_rid=cls, filter_expr="po-qty >= 5", paging_limit=2, paging_offset=1,
        ))
        assert len(res) == 2
