"""RUNTIME-OPT: filter_expr → SQL WHERE + ORDER BY + LIMIT/OFFSET 编译。

OBJECTSET-04 的 SQLObjectSetExecutor 真实现：
- FilterCompiler 已在 M2 收口
- 本文件加 SQLVisitor，把 CompiledFilter 转 psycopg2 参数化 SQL

支撑 PgOntologyRepository 真在 PG 上跑 ObjectSet.evaluate，
不再委托 InMemoryObjectSetExecutor（dev profile 仍走 InMemory）。
"""

from __future__ import annotations

import re
from typing import Any

from .compiler import CompiledFilter


class SQLCompiler:
    """CompiledFilter → 参数化 SQL 片段（不含 WHERE / ORDER BY 关键字）。

    返回 (where_sql, params)。params 是 psycopg2 %s 占位 list。
    field_name → 列名（默认 JSONB path）。接受完整 rid（`ont.<t>.prop.<slug>.v<n>`）
    或简写 slug（`<slug>`，含连字符）。用 ::text -> ::numeric cast 处理数值。
    """

    def __init__(self, column_for_field: dict[str, str] | None = None) -> None:
        self._column_for_field = column_for_field or {}

    def _column_expr(self, field_name: str) -> tuple[str, list[Any]]:
        """返回 (col_expr, [params]) —— col_expr 含 (props ->> '...') 或自定义列。"""
        params: list[Any] = []
        col = self._column_for_field.get(field_name)
        if col:
            return col, params
        params.append(field_name)
        return "(props ->> %s)", params

    def compile_where(self, cf: CompiledFilter) -> tuple[str, list[Any]]:
        params: list[Any] = []
        sql = self._render(cf, params)
        return sql, params

    def _column(self, field_name: str) -> str:
        return self._column_for_field.get(field_name, f"(props ->> %s)")

    def _render(self, cf: CompiledFilter, params: list[Any]) -> str:
        k = cf.kind
        if k == "always":
            return "TRUE"
        if k == "truthy":
            col_expr, extra = self._column_expr(cf.field_name or "")
            params.extend(extra)
            return f"({col_expr}) IS NOT NULL AND ({col_expr}) != ''"
        if k == "compare_eq":
            return self._cmp(cf, params, "=")
        if k == "compare_ne":
            return self._cmp(cf, params, "<>")
        if k == "compare_gt":
            return self._cmp(cf, params, ">")
        if k == "compare_gte":
            return self._cmp(cf, params, ">=")
        if k == "compare_lt":
            return self._cmp(cf, params, "<")
        if k == "compare_lte":
            return self._cmp(cf, params, "<=")
        if k == "startswith":
            return self._like(cf, params, prefix=True)
        if k == "contains":
            return self._like(cf, params, prefix=False, both=True)
        if k == "negate":
            inner = self._render(cf.children[0], params)
            return f"NOT ({inner})"
        if k == "logical_and":
            parts = [f"({self._render(c, params)})" for c in cf.children]
            return " AND ".join(parts)
        if k == "logical_or":
            parts = [f"({self._render(c, params)})" for c in cf.children]
            return " OR ".join(parts)
        raise ValueError(f"unknown CompiledFilter.kind={k!r}")

    def _cmp(self, cf: CompiledFilter, params: list[Any], op: str) -> str:
        col_expr, extra = self._column_expr(cf.field_name or "")
        params.extend(extra)
        if isinstance(cf.value, (int, float)):
            # JSONB ->> 返回 text；数值比较 → cast numeric
            params.append(cf.value)
            return f"(({col_expr})::numeric {op} %s)"
        params.append(cf.value)
        return f"({col_expr} {op} %s)"

    def _like(self, cf: CompiledFilter, params: list[Any], prefix: bool, both: bool = False) -> str:
        col_expr, extra = self._column_expr(cf.field_name or "")
        params.extend(extra)
        v = str(cf.value).replace("\\", "\\\\").replace("%", r"\%").replace("_", r"\_")
        if both:
            pat = f"%{v}%"
        elif prefix:
            pat = f"{v}%"
        else:
            pat = f"%{v}"
        params.append(pat)
        return f"({col_expr} LIKE %s)"


_SAFE_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def is_safe_identifier(s: str) -> bool:
    """防止 SQL 注入：filter_expr 的字段名只接受标识符字符。"""
    return bool(_SAFE_IDENT.match(s))


__all__ = ["SQLCompiler", "is_safe_identifier"]