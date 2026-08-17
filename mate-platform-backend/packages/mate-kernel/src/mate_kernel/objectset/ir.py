"""MP-SAL-01: ObjectSetQuery —— 结构化查询 IR（ADR-0043 §2.1-2.2）。

算子树取代字符串 DSL：filters（AND 条件）/ aggregation（group_by + metrics）/
traversal（link 遍历链）/ 多键 sort / paging 均为结构化字段。字符串
``filter_expr`` 降为前端糖（``parse_filter_expr`` 单向编译进 filters）。

执行语义（v1）：
- filters 作用于源类（traversal 之前）；
- traversal 链逐步切换当前类（out：src=当前 → dst=对端；in 反之）；
- aggregation / sort / paging 作用于最终集合；
- 聚合返回行集（group 键 + 度量值），结果信封 ``QueryResult{kind, rows}``；
  objects 行 = ``individual_to_row`` 的 slug 键 + ``__rid__``。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Any

from ..ontology.instances.individual import Individual
from ..ontology.instances.link_instance import LinkInstance
from ..ontology.types.object_type import ObjectType
from .compiler import CompiledFilter, FilterCompiler, individual_to_row

__all__ = [
    "Aggregation",
    "Condition",
    "InMemoryQueryExecutor",
    "MetricSpec",
    "ObjectSetQuery",
    "QueryOp",
    "QueryResult",
    "SortKey",
    "TraversalStep",
    "parse_filter_expr",
]


class QueryOp(StrEnum):
    EQ = "eq"
    NE = "ne"
    GT = "gt"
    GTE = "gte"
    LT = "lt"
    LTE = "lte"
    STARTSWITH = "startswith"
    CONTAINS = "contains"
    TRUTHY = "truthy"


@dataclass(frozen=True, slots=True)
class Condition:
    field: str
    op: QueryOp
    value: Any = None


@dataclass(frozen=True, slots=True)
class MetricSpec:
    fn: str  # sum / count / avg / min / max
    field: str | None = None
    alias: str | None = None

    def output_name(self) -> str:
        if self.alias:
            return self.alias
        return self.fn if self.field is None else f"{self.fn}_{self.field}"


@dataclass(frozen=True, slots=True)
class Aggregation:
    group_by: tuple[str, ...] = ()
    metrics: tuple[MetricSpec, ...] = ()


@dataclass(frozen=True, slots=True)
class TraversalStep:
    link_type: str  # LinkType rid
    direction: str  # "out" | "in"

    def __post_init__(self) -> None:
        if self.direction not in ("out", "in"):
            raise ValueError(f"direction must be 'out' or 'in', got {self.direction!r}")


@dataclass(frozen=True, slots=True)
class SortKey:
    field: str
    desc: bool = False


@dataclass(frozen=True, slots=True)
class ObjectSetQuery:
    source: str  # ObjectType rid
    filters: tuple[Condition, ...] = ()
    aggregation: Aggregation | None = None
    traversal: tuple[TraversalStep, ...] = ()
    sort: tuple[SortKey, ...] = ()
    paging_offset: int = 0
    paging_limit: int = 100

    def __post_init__(self) -> None:
        # 兼容 ClassRef 与 str 两种入参（DTO 层传 str，内核调用方常持 ClassRef）
        if not isinstance(self.source, str):  # pyright: ignore[reportUnnecessaryIsInstance]
            object.__setattr__(self, "source", self.source.rid)
        if self.paging_offset < 0:
            raise ValueError("paging_offset must be >= 0")
        if not 1 <= self.paging_limit <= 10000:
            raise ValueError("paging_limit must be in [1, 10000]")
        if self.aggregation is not None and self.sort:
            raise ValueError("sort with aggregation is not supported; sort the metric rows client-side")


@dataclass(frozen=True, slots=True)
class QueryResult:
    kind: str  # "objects" | "aggregates"
    rows: tuple[dict[str, Any], ...]
    result_schema: dict[str, Any] | None = None


# ─────────────────── filter_expr 前端糖 ───────────────────


def parse_filter_expr(expr: str) -> tuple[Condition, ...]:
    """字符串表达式 → AND 条件组（OR/NOT 不可表示，显式拒绝）。"""
    compiled = FilterCompiler().compile(expr)
    return _compiled_to_conditions(compiled)


def _compiled_to_conditions(cf: CompiledFilter) -> tuple[Condition, ...]:
    if cf.kind == "always":
        return ()
    if cf.kind == "logical_and":
        out: tuple[Condition, ...] = ()
        for child in cf.children:
            out += _compiled_to_conditions(child)
        return out
    if cf.kind == "logical_or":
        raise ValueError("OR is not representable in structured IR filters; restructure as separate conditions")
    if cf.kind == "negate":
        raise ValueError("NOT is not representable in structured IR filters; use the ne operator")
    op_map = {
        "compare_eq": QueryOp.EQ,
        "compare_ne": QueryOp.NE,
        "compare_gt": QueryOp.GT,
        "compare_gte": QueryOp.GTE,
        "compare_lt": QueryOp.LT,
        "compare_lte": QueryOp.LTE,
        "startswith": QueryOp.STARTSWITH,
        "contains": QueryOp.CONTAINS,
        "truthy": QueryOp.TRUTHY,
    }
    op = op_map.get(cf.kind)
    if op is None or cf.field_name is None:
        raise ValueError(f"unsupported filter node kind={cf.kind!r}")
    return (Condition(cf.field_name, op, cf.value),)


# ─────────────────── 条件求值（语义对齐 FilterEvaluator） ───────────────────


def _evaluate_condition(cond: Condition, row: dict[str, Any]) -> bool:
    v = row.get(cond.field)
    op = cond.op
    if op is QueryOp.TRUTHY:
        return bool(v)
    s_v, s_val = str(v), str(cond.value)
    str_results = {
        QueryOp.EQ: s_v == s_val,
        QueryOp.NE: s_v != s_val,
        QueryOp.STARTSWITH: s_v.startswith(s_val),
        QueryOp.CONTAINS: s_val in s_v,
    }
    if op in str_results:
        return str_results[op]
    if v is None:
        return False
    try:
        fv, target = float(v), float(cond.value)
    except (TypeError, ValueError):
        return False
    numeric_results = {
        QueryOp.GT: fv > target,
        QueryOp.GTE: fv >= target,
        QueryOp.LT: fv < target,
        QueryOp.LTE: fv <= target,
    }
    return numeric_results.get(op, False)


def _sort_rank(v: Any) -> tuple[int, float | str]:
    """混合类型排序键：bool / 数值 / 字符串 / None 四档（对齐 compiler._sort_key）。"""
    if isinstance(v, bool):
        return (2, int(v))
    if isinstance(v, (int, float)):
        return (1, float(v))
    if v is None:
        return (3, "")
    return (0, str(v))


# ─────────────────── InMemory 执行器 ───────────────────


class InMemoryQueryExecutor:
    """对已有 Individual/LinkInstance 列表执行 ObjectSetQuery。"""

    def __init__(
        self,
        individuals: tuple[Individual, ...] | list[Individual],
        links: tuple[LinkInstance, ...] | list[LinkInstance] = (),
        object_types: tuple[ObjectType, ...] | list[ObjectType] = (),
    ) -> None:
        self._individuals: tuple[Individual, ...] = tuple(individuals)
        self._links: tuple[LinkInstance, ...] = tuple(links)
        self._types: dict[str, ObjectType] = {t.rid.rid: t for t in object_types}

    def execute(self, q: ObjectSetQuery) -> QueryResult:
        if q.aggregation is not None:
            for m in q.aggregation.metrics:
                if m.fn != "count" and m.field is None:
                    raise ValueError(f"metric fn={m.fn!r} requires a field")
                if m.fn not in ("sum", "count", "avg", "min", "max"):
                    raise ValueError(f"unknown metric fn {m.fn!r}")

        current_class = q.source
        current: list[Individual] = [
            i for i in self._individuals if i.class_rid.rid == current_class
        ]

        for cond in q.filters:
            current = [
                i for i in current
                if _evaluate_condition(cond, individual_to_row(i))
            ]

        for step in q.traversal:
            rids = {i.rid for i in current}
            if step.direction == "out":
                peers = {li.dst for li in self._links
                         if li.link_type_rid.rid == step.link_type and li.src in rids}
            else:
                peers = {li.src for li in self._links
                         if li.link_type_rid.rid == step.link_type and li.dst in rids}
            current = [i for i in self._individuals if i.rid in peers]
            current_class = self._class_of_peer(step)

        rows: list[dict[str, Any]] = [individual_to_row(i) for i in current]

        if q.aggregation is not None:
            return self._aggregate(q.aggregation, rows, current_class)

        for key in reversed(q.sort):
            rows.sort(key=lambda r: _sort_rank(r.get(key.field)), reverse=key.desc)
        rows = rows[q.paging_offset : q.paging_offset + q.paging_limit]
        return QueryResult(
            kind="objects",
            rows=tuple(rows),
            result_schema=self._objects_schema(current_class),
        )

    def _class_of_peer(self, step: TraversalStep) -> str:
        """遍历后当前类不可静态推断（无 LinkType 元数据时）；按命中实例回填。"""
        for li in self._links:
            if li.link_type_rid.rid == step.link_type:
                for i in self._individuals:
                    if i.rid == (li.dst if step.direction == "out" else li.src):
                        return i.class_rid.rid
        return ""

    def _objects_schema(self, class_rid: str) -> dict[str, Any] | None:
        ot = self._types.get(class_rid)
        if ot is None:
            return None
        out: dict[str, Any] = {}
        for p in ot.properties:
            parts = p.rid.rid.split(".")
            slug = parts[3] if len(parts) >= 5 else parts[-1]
            out[slug] = {"type": p.type_id, "rid": p.rid.rid}
        return out

    def _aggregate(
        self, agg: Aggregation, rows: list[dict[str, Any]], class_rid: str,
    ) -> QueryResult:
        groups: dict[tuple[Any, ...], list[dict[str, Any]]] = {}
        for r in rows:
            key = tuple(r.get(f) for f in agg.group_by)
            groups.setdefault(key, []).append(r)

        out_rows: list[dict[str, Any]] = []
        for key, members in groups.items():
            row: dict[str, Any] = dict(zip(agg.group_by, key, strict=True))
            for m in agg.metrics:
                row[m.output_name()] = self._compute_metric(m, members)
            out_rows.append(row)

        schema: dict[str, Any] = {f: {"role": "dimension"} for f in agg.group_by}
        for m in agg.metrics:
            schema[m.output_name()] = {"fn": m.fn, "field": m.field}
        return QueryResult(kind="aggregates", rows=tuple(out_rows), result_schema=schema)

    @staticmethod
    def _compute_metric(m: MetricSpec, members: list[dict[str, Any]]) -> Any:
        if m.fn == "count":
            if m.field is None:
                return len(members)
            return sum(1 for r in members if r.get(m.field) is not None)
        assert m.field is not None
        values = [float(r[m.field]) for r in members if r.get(m.field) is not None]
        if not values:
            return None
        fns = {
            "sum": sum,
            "avg": lambda vs: sum(vs) / len(vs),
            "min": min,
            "max": max,
        }
        return fns[m.fn](values)
