"""Cross-ontology federation query engine.

支持跨多个本体的联邦查询:
1. FederationQuery — 联邦查询模型(目标本体列表 + 映射规则)
2. OntologyMapping — 本体间映射(类/属性对应关系)
3. FederationExecutor — 执行联邦查询(在多个本体上查询 + 合并结果)

合并策略:
- union       — 取并集(按 URI 去重)
- intersection— 取交集(URI 在所有结果集中均出现)
- priority    — 按本体优先级排序后取并集
"""
from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Keys used to identify a result row for deduplication (priority order).
_URI_KEYS = ("uri", "id", "@id", "subject", "s")

_MERGE_STRATEGIES = frozenset({"union", "intersection", "priority"})


# ---------------------------------------------------------------------------
# Mapping types
# ---------------------------------------------------------------------------


@dataclass
class ClassMapping:
    """类级映射: source 本体的类 ↔ target 本体的类."""

    source_class: str
    target_class: str


@dataclass
class PropertyMapping:
    """属性级映射."""

    source_property: str
    target_property: str


@dataclass
class OntologyMapping:
    """本体间映射关系.

    描述 source_ontology 与 target_ontology 之间
    的类 / 属性对应关系,用于联邦查询时的 schema 对齐。
    """

    source_ontology: str
    target_ontology: str
    class_mappings: list[ClassMapping] = field(default_factory=list)
    property_mappings: list[PropertyMapping] = field(default_factory=list)

    def map_class(self, source_class: str) -> str | None:
        """将源本体类名映射到目标本体类名;无映射返回 None."""
        for cm in self.class_mappings:
            if cm.source_class == source_class:
                return cm.target_class
        return None

    def map_property(self, source_property: str) -> str | None:
        """将源本体属性名映射到目标本体属性名."""
        for pm in self.property_mappings:
            if pm.source_property == source_property:
                return pm.target_property
        return None

    def has_class_correspondence(self, class_name: str) -> bool:
        """检查某类是否在映射中存在(任一方向)."""
        for cm in self.class_mappings:
            if cm.source_class == class_name or cm.target_class == class_name:
                return True
        return False

    def has_property_correspondence(self, prop_name: str) -> bool:
        """检查某属性是否在映射中存在(任一方向)."""
        for pm in self.property_mappings:
            if pm.source_property == prop_name or pm.target_property == prop_name:
                return True
        return False


# ---------------------------------------------------------------------------
# Query model
# ---------------------------------------------------------------------------


@dataclass
class FederationQuery:
    """联邦查询模型.

    Attributes:
        query: SPARQL 或过滤查询字符串
        target_ontologies: 目标本体 ID 列表
        mappings: 本体间映射规则
        merge_strategy: 合并策略 (union / intersection / priority)
        ontology_priority: 本体优先级 (ontology_id → int, 高 = 先)
    """

    query: str
    target_ontologies: list[str]
    mappings: list[OntologyMapping] = field(default_factory=list)
    merge_strategy: str = "union"
    ontology_priority: dict[str, int] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _result_uri(row: dict[str, Any]) -> str:
    """提取结果行的 URI / ID 用于去重."""
    for key in _URI_KEYS:
        val = row.get(key)
        if val is not None:
            return str(val)
    return repr(sorted(row.items()))


# ---------------------------------------------------------------------------
# Executor
# ---------------------------------------------------------------------------

QueryFn = Callable[[str, str], list[dict[str, Any]]]


class FederationExecutor:
    """联邦查询执行器.

    在多个本体上执行查询并按指定策略合并结果。
    通过 ``query_fn`` 回调或 ``load_ontology`` 加载的数据提供查询能力。
    """

    def __init__(self, query_fn: QueryFn | None = None) -> None:
        self._mappings: dict[str, OntologyMapping] = {}
        self._query_fn = query_fn
        self._ontology_data: dict[str, list[dict[str, Any]]] = {}

    # -- mapping management --

    def register_mapping(
        self,
        mapping: OntologyMapping,
        tenant_id: str = "",
    ) -> None:
        """注册本体映射(按租户隔离存储)."""
        key = f"{tenant_id}:{mapping.source_ontology}->{mapping.target_ontology}"
        self._mappings[key] = mapping
        logger.info(
            "federation.mapping_registered",
            tenant=tenant_id,
            source=mapping.source_ontology,
            target=mapping.target_ontology,
            classes=len(mapping.class_mappings),
            properties=len(mapping.property_mappings),
        )

    def get_mapping(
        self,
        source: str,
        target: str,
        tenant_id: str = "",
    ) -> OntologyMapping | None:
        return self._mappings.get(f"{tenant_id}:{source}->{target}")

    def list_mappings(self, tenant_id: str = "") -> list[OntologyMapping]:
        prefix = f"{tenant_id}:"
        return [v for k, v in self._mappings.items() if k.startswith(prefix)]

    def clear_mappings(self) -> None:
        self._mappings.clear()

    # -- data loading --

    def load_ontology(
        self,
        ontology_id: str,
        data: list[dict[str, Any]],
    ) -> None:
        """加载本体数据(用于无 query_fn 时的内存查询)."""
        self._ontology_data[ontology_id] = list(data)

    def clear_data(self) -> None:
        self._ontology_data.clear()

    # -- execution --

    def execute(self, query: FederationQuery) -> list[dict[str, Any]]:
        """在多个本体上执行查询并合并结果."""
        per_ontology: list[list[dict[str, Any]]] = []
        for ont_id in query.target_ontologies:
            results = self._query_single(ont_id, query.query)
            per_ontology.append(results)

        # Convert ontology_id-based priority to index-based for merge_results
        index_priority: dict[int, int] = {}
        for i, ont_id in enumerate(query.target_ontologies):
            index_priority[i] = query.ontology_priority.get(ont_id, 0)

        merged = self.merge_results(
            per_ontology,
            query.merge_strategy,
            index_priority,
        )
        logger.info(
            "federation.executed",
            ontologies=query.target_ontologies,
            strategy=query.merge_strategy,
            total=sum(len(r) for r in per_ontology),
            merged=len(merged),
        )
        return merged

    def merge_results(
        self,
        results: list[list[dict[str, Any]]],
        strategy: str = "union",
        priority: dict[int, int] | None = None,
    ) -> list[dict[str, Any]]:
        """合并多个本体的查询结果.

        Args:
            results: 每个本体一组结果 (index-aligned with target_ontologies)
            strategy: union | intersection | priority
            priority: 结果组索引 → 优先级 (仅 priority 策略; 高 = 先)
        """
        if strategy not in _MERGE_STRATEGIES:
            raise ValueError(f"Unknown merge strategy: {strategy}")

        if strategy == "union":
            return self._merge_union(results)
        if strategy == "intersection":
            return self._merge_intersection(results)
        return self._merge_priority(results, priority or {})

    # -- internals --

    def _query_single(
        self,
        ontology_id: str,
        query: str,
    ) -> list[dict[str, Any]]:
        if self._query_fn is not None:
            return self._query_fn(ontology_id, query)
        return list(self._ontology_data.get(ontology_id, []))

    @staticmethod
    def _merge_union(
        results: list[list[dict[str, Any]]],
    ) -> list[dict[str, Any]]:
        """并集去重(按 URI)."""
        seen: set[str] = set()
        out: list[dict[str, Any]] = []
        for group in results:
            for row in group:
                uri = _result_uri(row)
                if uri not in seen:
                    seen.add(uri)
                    out.append(row)
        return out

    @staticmethod
    def _merge_intersection(
        results: list[list[dict[str, Any]]],
    ) -> list[dict[str, Any]]:
        """交集: URI 在所有组中均出现."""
        if not results:
            return []
        uri_sets: list[set[str]] = []
        uri_to_row: dict[str, dict[str, Any]] = {}
        for group in results:
            group_uris: set[str] = set()
            for row in group:
                uri = _result_uri(row)
                group_uris.add(uri)
                if uri not in uri_to_row:
                    uri_to_row[uri] = row
            uri_sets.append(group_uris)
        common = uri_sets[0]
        for s in uri_sets[1:]:
            common &= s
        return [uri_to_row[u] for u in common]

    @staticmethod
    def _merge_priority(
        results: list[list[dict[str, Any]]],
        priority: dict[int, int],
    ) -> list[dict[str, Any]]:
        """按优先级排序后并集去重(高优先级的结果先出现)."""
        indexed = list(enumerate(results))
        indexed.sort(
            key=lambda pair: priority.get(pair[0], 0),
            reverse=True,
        )
        sorted_groups = [group for _, group in indexed]
        seen: set[str] = set()
        out: list[dict[str, Any]] = []
        for group in sorted_groups:
            for row in group:
                uri = _result_uri(row)
                if uri not in seen:
                    seen.add(uri)
                    out.append(row)
        return out


# ---------------------------------------------------------------------------
# API router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/api/v1/ont/federation", tags=["federation"])

# Module-level executor (mirrors _engine pattern in shacl_api.py)
_executor = FederationExecutor()


def _tenant_id(request: Request) -> str:
    """Extract tenant_id from auth context (raises 401 / 403 on failure)."""
    ctx = getattr(request.state, "ctx", None)
    if ctx is None:
        raise HTTPException(status_code=401, detail="no auth context")
    tid = getattr(ctx, "tenant_id", None)
    if tid is None:
        raise HTTPException(status_code=403, detail="missing tenant")
    return str(tid)


# -- Pydantic request / response models --


class ClassMappingSpec(BaseModel):
    source_class: str
    target_class: str


class PropertyMappingSpec(BaseModel):
    source_property: str
    target_property: str


class CreateMappingRequest(BaseModel):
    source_ontology: str
    target_ontology: str
    class_mappings: list[ClassMappingSpec] = Field(default_factory=list)
    property_mappings: list[PropertyMappingSpec] = Field(default_factory=list)


class MappingResponse(BaseModel):
    source_ontology: str
    target_ontology: str
    class_mappings: list[ClassMappingSpec] = Field(default_factory=list)
    property_mappings: list[PropertyMappingSpec] = Field(default_factory=list)


class FederationQueryRequest(BaseModel):
    query: str
    target_ontologies: list[str]
    merge_strategy: str = "union"
    ontology_priority: dict[str, int] = Field(default_factory=dict)


class FederationQueryResponse(BaseModel):
    results: list[dict[str, Any]] = Field(default_factory=list)
    count: int = 0


# -- Endpoints --


@router.post("/query", response_model=FederationQueryResponse)
async def federation_query_endpoint(
    payload: FederationQueryRequest,
    request: Request,
) -> FederationQueryResponse:
    """跨本体联邦查询 — 在多个本体上执行查询并按策略合并结果."""
    tid = _tenant_id(request)
    fq = FederationQuery(
        query=payload.query,
        target_ontologies=payload.target_ontologies,
        merge_strategy=payload.merge_strategy,
        ontology_priority=payload.ontology_priority,
    )
    try:
        results = _executor.execute(fq)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error("federation.query.failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e)) from e

    logger.info(
        "federation.query.outbox",
        tenant=tid,
        ontologies=payload.target_ontologies,
        strategy=payload.merge_strategy,
        result_count=len(results),
    )
    return FederationQueryResponse(results=results, count=len(results))


@router.post("/mappings", response_model=MappingResponse)
async def create_mapping_endpoint(
    payload: CreateMappingRequest,
    request: Request,
) -> MappingResponse:
    """创建本体间映射."""
    tid = _tenant_id(request)
    mapping = OntologyMapping(
        source_ontology=payload.source_ontology,
        target_ontology=payload.target_ontology,
        class_mappings=[
            ClassMapping(cm.source_class, cm.target_class)
            for cm in payload.class_mappings
        ],
        property_mappings=[
            PropertyMapping(pm.source_property, pm.target_property)
            for pm in payload.property_mappings
        ],
    )
    _executor.register_mapping(mapping, tenant_id=tid)

    logger.info(
        "federation.mapping.created.outbox",
        tenant=tid,
        source=payload.source_ontology,
        target=payload.target_ontology,
    )
    return MappingResponse(
        source_ontology=mapping.source_ontology,
        target_ontology=mapping.target_ontology,
        class_mappings=payload.class_mappings,
        property_mappings=payload.property_mappings,
    )


@router.get("/mappings", response_model=list[MappingResponse])
async def list_mappings_endpoint(request: Request) -> list[MappingResponse]:
    """列出当前租户的所有本体映射."""
    tid = _tenant_id(request)
    mappings = _executor.list_mappings(tenant_id=tid)
    logger.info("federation.mappings.listed", tenant=tid, count=len(mappings))
    return [
        MappingResponse(
            source_ontology=m.source_ontology,
            target_ontology=m.target_ontology,
            class_mappings=[
                ClassMappingSpec(
                    source_class=cm.source_class,
                    target_class=cm.target_class,
                )
                for cm in m.class_mappings
            ],
            property_mappings=[
                PropertyMappingSpec(
                    source_property=pm.source_property,
                    target_property=pm.target_property,
                )
                for pm in m.property_mappings
            ],
        )
        for m in mappings
    ]
