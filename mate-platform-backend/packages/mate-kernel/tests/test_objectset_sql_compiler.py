"""RUNTIME-OPT: SQLCompiler 单元测试。"""

from __future__ import annotations

from mate_kernel.objectset.compiler import FilterCompiler
from mate_kernel.objectset.sql_compiler import SQLCompiler


def _sql(expr: str) -> tuple[str, list]:
    cf = FilterCompiler().compile(expr)
    return SQLCompiler().compile_where(cf)


def test_always() -> None:
    sql, params = _sql("")
    assert sql == "TRUE"
    assert params == []


def test_compare_eq_string() -> None:
    sql, params = _sql("status == 'open'")
    assert sql == "((props ->> %s) = %s)"
    assert params == ["status", "open"]


def test_compare_eq_number() -> None:
    sql, params = _sql("qty == 5")
    assert sql == "(((props ->> %s))::numeric = %s)"
    assert params == ["qty", 5]


def test_compare_gte_number() -> None:
    sql, params = _sql("qty >= 15")
    assert sql == "(((props ->> %s))::numeric >= %s)"
    assert params == ["qty", 15]


def test_compare_lt() -> None:
    sql, params = _sql("price < 100")
    assert sql == "(((props ->> %s))::numeric < %s)"
    assert params == ["price", 100]


def test_logical_and() -> None:
    sql, params = _sql("status == 'open' AND qty >= 5")
    assert "AND" in sql
    assert params == ["status", "open", "qty", 5]


def test_logical_or() -> None:
    sql, params = _sql("status == 'open' OR status == 'pending'")
    assert "OR" in sql
    assert params == ["status", "open", "status", "pending"]


def test_negate() -> None:
    sql, params = _sql("NOT status == 'closed'")
    assert sql.startswith("NOT ((")
    assert params == ["status", "closed"]


def test_startswith() -> None:
    sql, params = _sql("name startswith 'order-'")
    assert sql == "((props ->> %s) LIKE %s)"
    assert params == ["name", "order-%"]


def test_contains() -> None:
    sql, params = _sql("name contains 'rush'")
    assert params == ["name", "%rush%"]


def test_hyphen_slug() -> None:
    sql, params = _sql("po-qty >= 15")
    assert params == ["po-qty", 15]


def test_truthy() -> None:
    sql, params = _sql("active")
    assert "IS NOT NULL" in sql
    assert params == ["active"]


def test_ne_string() -> None:
    sql, params = _sql("status != 'closed'")
    assert "<>" in sql
    assert params == ["status", "closed"]


def test_params_independent_per_child() -> None:
    """复合表达式每个 atom 都有自己的 params（不能合并）。"""
    sql, params = _sql("a == 1 AND b == 2")
    assert params == ["a", 1, "b", 2]
    # 占位符 %s 数量必须等于 len(params)
    assert sql.count("%s") == len(params)


def test_full_rid_field_name() -> None:
    """完整 rid 作为字段名（RUNTIME-OPT 真实 PG 落地）。"""
    sql, params = _sql("ont.acme.prop.po-qty.v1 >= 15")
    # field_name 必须是完整 rid，不是 slug
    assert params[0] == "ont.acme.prop.po-qty.v1"
    assert params[1] == 15
    assert sql.count("%s") == 2