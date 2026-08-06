"""OBJECTSET-04: ObjectSet 编译器。

把 `ObjectSet`（KERNEL-01 已定义的查询计划）编译到具体存储：
- SQL 后端（PG / SQLite）—— 占位实现
- InMemory 后端 —— 全功能（已存在 InMemoryOntologyRepository.evaluate_object_set）

DSL 表达式（filter_expr）：
- `status == 'open'`（相等）
- `amount > 1000`（数值比较）
- `status == 'open' AND amount > 1000`（逻辑与）
- `status == 'open' OR status == 'pending'`（逻辑或）
- `NOT status == 'closed'`（非）
- `name startswith 'order-'`（前缀）
- `name contains 'rush'`（包含）

不实现 SQL parser；M2 只起骨架，runtime 在 M3 接入。
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable

from mate_kernel.ontology.instances.individual import Individual
from mate_kernel.ontology.query.object_set import ObjectSet


# ─────────────────── 表达式求值 ───────────────────


@dataclass(frozen=True, slots=True)
class CompiledFilter:
    """编译结果 —— 求值器接受 row dict，返回 bool。"""
    kind: str  # "always" / "compare_eq" / "compare_gt" / "logical_and" / "logical_or" / "negate" / "startswith" / "contains"
    field_name: str | None = None
    value: object = None
    children: tuple["CompiledFilter", ...] = field(default_factory=tuple)


class FilterCompiler:
    """filter_expr → CompiledFilter。"""

    _TOK_AND = " AND "
    _TOK_OR = " OR "

    def compile(self, expr: str) -> CompiledFilter:
        if not expr.strip():
            return CompiledFilter(kind="always")
        or_parts = self._split_top_level(expr, self._TOK_OR)
        if len(or_parts) > 1:
            return CompiledFilter(
                kind="logical_or",
                children=tuple(self.compile(p) for p in or_parts),
            )
        and_parts = self._split_top_level(or_parts[0], self._TOK_AND)
        if len(and_parts) > 1:
            return CompiledFilter(
                kind="logical_and",
                children=tuple(self.compile(p) for p in and_parts),
            )
        return self._compile_atom(and_parts[0].strip())

    def _split_top_level(self, expr: str, sep: str) -> list[str]:
        """按顶层 sep 拆分（不进入括号 / 字符串）。"""
        out: list[str] = []
        depth = 0
        in_str: str | None = None
        i = 0
        while i < len(expr):
            ch = expr[i]
            if in_str:
                if ch == in_str and expr[i - 1] != "\\":
                    in_str = None
            else:
                if ch in ("'", '"'):
                    in_str = ch
                elif ch == "(":
                    depth += 1
                elif ch == ")":
                    depth -= 1
                elif depth == 0 and expr[i:i + len(sep)] == sep:
                    out.append(expr[:i])
                    expr = expr[i + len(sep):]
                    i = 0
                    continue
            i += 1
        out.append(expr)
        return out

    def _compile_atom(self, atom: str) -> CompiledFilter:
        # NOT prefix
        if atom.startswith("NOT "):
            return CompiledFilter(
                kind="negate",
                children=(self.compile(atom[4:].strip()),),
            )
        # strip outer parens
        if atom.startswith("(") and atom.endswith(")"):
            return self.compile(atom[1:-1])
        # slug 含 `-`（rid 第 4 段，e.g. `po-qty`）；\w 不够，用 [A-Za-z0-9_\-]+
        SLUG = r"[A-Za-z0-9_\-]+"
        # contains
        m = re.match(rf"^({SLUG})\s+contains\s+['\"](.+?)['\"]$", atom)
        if m:
            return CompiledFilter(kind="contains", field_name=m.group(1), value=m.group(2))
        # startswith
        m = re.match(rf"^({SLUG})\s+startswith\s+['\"](.+?)['\"]$", atom)
        if m:
            return CompiledFilter(kind="startswith", field_name=m.group(1), value=m.group(2))
        # == 'literal'
        m = re.match(rf"^({SLUG})\s*==\s*['\"](.+?)['\"]$", atom)
        if m:
            return CompiledFilter(kind="compare_eq", field_name=m.group(1), value=m.group(2))
        # == number
        m = re.match(rf"^({SLUG})\s*==\s*(-?\d+(?:\.\d+)?)$", atom)
        if m:
            return CompiledFilter(kind="compare_eq", field_name=m.group(1), value=float(m.group(2)))
        # > number
        m = re.match(rf"^({SLUG})\s*>\s*(-?\d+(?:\.\d+)?)$", atom)
        if m:
            return CompiledFilter(kind="compare_gt", field_name=m.group(1), value=float(m.group(2)))
        # >= number
        m = re.match(rf"^({SLUG})\s*>=\s*(-?\d+(?:\.\d+)?)$", atom)
        if m:
            return CompiledFilter(kind="compare_gte", field_name=m.group(1), value=float(m.group(2)))
        # < number
        m = re.match(rf"^({SLUG})\s*<\s*(-?\d+(?:\.\d+)?)$", atom)
        if m:
            return CompiledFilter(kind="compare_lt", field_name=m.group(1), value=float(m.group(2)))
        # <= number
        m = re.match(rf"^({SLUG})\s*<=\s*(-?\d+(?:\.\d+)?)$", atom)
        if m:
            return CompiledFilter(kind="compare_lte", field_name=m.group(1), value=float(m.group(2)))
        # != literal
        m = re.match(rf"^({SLUG})\s*!=\s*['\"](.+?)['\"]$", atom)
        if m:
            return CompiledFilter(kind="compare_ne", field_name=m.group(1), value=m.group(2))
        # truthy field
        return CompiledFilter(kind="truthy", field_name=atom)


class FilterEvaluator:
    """CompiledFilter → row dict → bool。"""

    def evaluate(self, f: CompiledFilter, row: dict[str, Any]) -> bool:
        kind = f.kind
        if kind == "always":
            return True
        if kind == "truthy":
            return bool(row.get(f.field_name))
        if kind == "compare_eq":
            return str(row.get(f.field_name)) == str(f.value)
        if kind == "compare_ne":
            return str(row.get(f.field_name)) != str(f.value)
        if kind == "compare_gt":
            v = row.get(f.field_name)
            return v is not None and float(v) > f.value
        if kind == "compare_gte":
            v = row.get(f.field_name)
            return v is not None and float(v) >= f.value
        if kind == "compare_lt":
            v = row.get(f.field_name)
            return v is not None and float(v) < f.value
        if kind == "compare_lte":
            v = row.get(f.field_name)
            return v is not None and float(v) <= f.value
        if kind == "startswith":
            return str(row.get(f.field_name, "")).startswith(str(f.value))
        if kind == "contains":
            return str(f.value) in str(row.get(f.field_name, ""))
        if kind == "negate":
            return not self.evaluate(f.children[0], row)
        if kind == "logical_and":
            return all(self.evaluate(c, row) for c in f.children)
        if kind == "logical_or":
            return any(self.evaluate(c, row) for c in f.children)
        return False


# ─────────────────── 行 ↔ Individual 互转 ───────────────────


def individual_to_row(ind: Individual) -> dict[str, Any]:
    """Individual.props (tuple[(ClassRef, obj), ...]) → flat dict[str, str]。

    Property rid 形如 `ont.<tenant>.prop.<slug>.<version>`，抽第 4 段作 row key。
    """
    row: dict[str, Any] = {"__rid__": ind.rid}
    for k, v in ind.props:
        parts = k.rid.split(".")
        # ont.<tenant>.prop.<slug>.<version>
        slug = parts[3] if len(parts) >= 5 else parts[-1]
        row[slug] = v
    return row


# ─────────────────── Executor ───────────────────


@runtime_checkable
class ObjectSetExecutor(Protocol):
    """ObjectSet 后端抽象（PG / InMemory / Neo4j …）。"""

    def execute(self, plan: ObjectSet) -> list[Individual]: ...


class InMemoryObjectSetExecutor:
    """用 FilterEvaluator 在已有 Individual 列表上执行。"""

    def __init__(self, source: list[Individual]) -> None:
        self.source = source

    def execute(self, plan: ObjectSet) -> list[Individual]:
        compiler = FilterCompiler()
        compiled = compiler.compile(plan.filter_expr)
        ev = FilterEvaluator()
        out: list[Individual] = []
        for ind in self.source:
            if ind.class_rid.rid != plan.class_rid.rid:
                continue
            row = individual_to_row(ind)
            if not ev.evaluate(compiled, row):
                continue
            out.append(ind)
        # sort
        if plan.sort:
            # 支持 "field" 或 "-field"（降序）
            reverse = plan.sort[0].startswith("-")
            key_name = plan.sort[0].lstrip("-")

            def _sort_key(i: Individual) -> tuple[int, object]:
                v = individual_to_row(i).get(key_name)
                # 数字 → 数值比较；其余 → 字典序；混合类型用 (type_rank, value)
                if isinstance(v, bool):
                    return (2, int(v))
                if isinstance(v, (int, float)):
                    return (1, float(v))
                if v is None:
                    return (3, "")
                return (0, str(v))

            out.sort(key=_sort_key, reverse=reverse)
        return out[plan.paging_offset : plan.paging_offset + plan.paging_limit]


class SQLObjectSetExecutor:
    """SQL 后端占位 —— 真实生成 SQL 在 M3。"""

    def execute(self, plan: ObjectSet) -> list[Individual]:
        raise NotImplementedError(
            "SQLObjectSetExecutor.execute is not implemented in M2; "
            "see OBJECTSET-04 design — runtime delivery in M3 / MANAGER-05."
        )


__all__ = [
    "CompiledFilter",
    "FilterCompiler",
    "FilterEvaluator",
    "ObjectSetExecutor",
    "InMemoryObjectSetExecutor",
    "SQLObjectSetExecutor",
    "individual_to_row",
]
