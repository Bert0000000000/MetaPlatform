"""Core ontology discovery logic."""

from __future__ import annotations

import json
import re
import uuid
from typing import Any, Optional

import httpx

from app.common.errors import ExternalServiceError, NotFoundError
from app.config import settings
from app.models.schemas import (
    CandidateAttribute,
    CandidateConcept,
    CandidateRelation,
    DataSourceMetadata,
    DiscoveryResult,
    ImportRequest,
    ImportResult,
    SuggestRequest,
    SuggestResponse,
)
from app.services.mock_catalog import get_source, list_sources


_SQL_TO_ONTOLOGY_TYPE: dict[str, str] = {
    "bigint": "Long",
    "int": "Integer",
    "integer": "Integer",
    "smallint": "Integer",
    "serial": "Integer",
    "bigserial": "Long",
    "varchar": "String",
    "text": "String",
    "char": "String",
    "boolean": "Boolean",
    "bool": "Boolean",
    "timestamp": "DateTime",
    "timestamptz": "DateTime",
    "date": "Date",
    "datetime": "DateTime",
    "decimal": "Decimal",
    "numeric": "Decimal",
    "double": "Double",
    "float": "Double",
    "json": "JSON",
    "jsonb": "JSON",
}


def _to_snake_upper(name: str) -> str:
    """Convert a table/column name to an ontology code."""
    cleaned = re.sub(r"[^a-zA-Z0-9]", "_", name)
    return cleaned.upper()


def _map_data_type(sql_type: str) -> str:
    lowered = sql_type.lower().split("(")[0].strip()
    return _SQL_TO_ONTOLOGY_TYPE.get(lowered, "String")


def _human_name(code: str) -> str:
    """Derive a readable Chinese-ish name from a snake_upper code."""
    parts = [p for p in code.lower().split("_") if p]
    if not parts:
        return code
    return "".join(parts)


def _attribute_name(column: str) -> str:
    """Derive a human-readable attribute name from a column name."""
    parts = [p for p in column.lower().split("_") if p]
    return "".join(parts)


def analyze_source(source_id: str, tables: Optional[list[str]] = None) -> DiscoveryResult:
    """Analyze a data source and return candidate concepts/relations."""

    source = get_source(source_id)
    if source is None:
        raise NotFoundError(f"数据源不存在: {source_id}", data={"sourceId": source_id})

    selected_tables = source.tables
    if tables:
        table_set = set(tables)
        selected_tables = [t for t in source.tables if t.name in table_set]
        missing = table_set - {t.name for t in selected_tables}
        if missing:
            raise NotFoundError(
                f"部分表不存在: {', '.join(sorted(missing))}",
                data={"missing": sorted(missing)},
            )

    table_by_name = {t.name: t for t in selected_tables}
    concepts: list[CandidateConcept] = []
    relations: list[CandidateRelation] = []

    for table in selected_tables:
        concept_id = f"concept-{uuid.uuid4().hex[:8]}"
        concept_code = _to_snake_upper(table.name)
        attributes: list[CandidateAttribute] = []
        for col in table.columns:
            attributes.append(
                CandidateAttribute(
                    tempId=f"attr-{uuid.uuid4().hex[:8]}",
                    code=_to_snake_upper(col.name),
                    name=_attribute_name(col.name),
                    dataType=_map_data_type(col.type),
                    required=not col.nullable,
                    unique=col.is_primary_key,
                    sourceColumn=col.name,
                    description=f"源字段: {col.name} ({col.type})",
                )
            )

        concepts.append(
            CandidateConcept(
                tempId=concept_id,
                sourceTable=table.name,
                code=concept_code,
                name=_human_name(concept_code),
                description=table.comment or f"从表 {table.name} 自动发现的概念",
                attributes=attributes,
                selected=True,
            )
        )

    for table in selected_tables:
        source_concept = next(c for c in concepts if c.source_table == table.name)
        for col in table.columns:
            if not col.is_foreign_key or not col.referenced_table:
                continue
            target_table = table_by_name.get(col.referenced_table)
            if target_table is None:
                continue
            target_concept = next(
                (c for c in concepts if c.source_table == target_table.name), None
            )
            if target_concept is None:
                continue

            relation_code = (
                f"REL_{source_concept.code}_{_to_snake_upper(col.name)}"
            )
            relations.append(
                CandidateRelation(
                    tempId=f"rel-{uuid.uuid4().hex[:8]}",
                    sourceTable=table.name,
                    sourceColumn=col.name,
                    targetTable=target_table.name,
                    targetColumn=col.referenced_column or "id",
                    code=relation_code,
                    name=f"{source_concept.name}→{target_concept.name}",
                    description=(
                        f"外键 {col.name} 引用 {target_table.name}."
                        f"{col.referenced_column or 'id'}"
                    ),
                    cardinality="N-1",
                    selected=True,
                )
            )

    return DiscoveryResult(sourceId=source_id, concepts=concepts, relations=relations)


def list_data_sources() -> list[dict[str, Any]]:
    """Return lightweight data-source list."""
    return [
        {
            "id": s.source_id,
            "name": s.source_name,
            "type": s.source_type,
            "tableCount": len(s.tables),
        }
        for s in list_sources()
    ]


class LlmSuggestionClient:
    """Client that asks TECH-LLMGW to enrich candidate names/semantics."""

    def __init__(self, base_url: str = settings.llmgw_api_base_url) -> None:
        self.base_url = base_url.rstrip("/")

    async def suggest(self, request: SuggestRequest) -> SuggestResponse:
        prompt = self._build_prompt(request)
        messages = [
            {"role": "system", "content": "You are an ontology modeling assistant."},
            {"role": "user", "content": prompt},
        ]
        payload: dict[str, Any] = {
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 1024,
        }
        if settings.llm_model and settings.llm_model != "auto":
            payload["model"] = settings.llm_model
        else:
            payload["autoRoute"] = True

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    json=payload,
                    headers={"Content-Type": "application/json"},
                )
                resp.raise_for_status()
                body = resp.json()
                data = body.get("data", body)
                content = data["choices"][0]["message"]["content"]
                parsed = json.loads(self._extract_json(content))
                return self._apply_suggestions(request, parsed)
        except Exception as exc:
            # Degrade gracefully: return deterministic mock suggestions.
            return self._fallback_suggest(request)

    def _build_prompt(self, request: SuggestRequest) -> str:
        concepts = [c.model_dump(by_alias=True) for c in request.concepts]
        relations = [r.model_dump(by_alias=True) for r in request.relations]
        return (
            "请为以下从数据库表自动发现的本体候选概念和关系提供中文显示名与简短语义描述。"
            "只返回 JSON，不要解释。JSON 格式："
            '{"concepts":[{"tempId":"...","name":"...","description":"..."}],'
            '"relations":[{"tempId":"...","name":"...","description":"...","cardinality":"N-1"}]}\n\n'
            f"concepts={json.dumps(concepts, ensure_ascii=False)}\n"
            f"relations={json.dumps(relations, ensure_ascii=False)}"
        )

    def _extract_json(self, content: str) -> str:
        content = content.strip()
        if content.startswith("```"):
            lines = content.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            content = "\n".join(lines).strip()
        return content

    def _apply_suggestions(
        self, request: SuggestRequest, parsed: dict[str, Any]
    ) -> SuggestResponse:
        concept_map = {c.get("tempId") or c.get("temp_id"): c for c in parsed.get("concepts", [])}
        relation_map = {r.get("tempId") or r.get("temp_id"): r for r in parsed.get("relations", [])}

        out_concepts: list[CandidateConcept] = []
        for c in request.concepts:
            sugg = concept_map.get(c.temp_id, {})
            out_concepts.append(
                c.model_copy(
                    update={
                        "name": sugg.get("name") or c.name,
                        "description": sugg.get("description") or c.description,
                    }
                )
            )

        out_relations: list[CandidateRelation] = []
        for r in request.relations:
            sugg = relation_map.get(r.temp_id, {})
            out_relations.append(
                r.model_copy(
                    update={
                        "name": sugg.get("name") or r.name,
                        "description": sugg.get("description") or r.description,
                        "cardinality": sugg.get("cardinality") or r.cardinality,
                    }
                )
            )

        return SuggestResponse(concepts=out_concepts, relations=out_relations)

    def _fallback_suggest(self, request: SuggestRequest) -> SuggestResponse:
        """Deterministic fallback when LLM is unavailable."""
        concepts = [
            c.model_copy(
                update={
                    "name": _human_name(c.code),
                    "description": c.description or f"AI 建议：{c.name}",
                }
            )
            for c in request.concepts
        ]
        relations = [
            r.model_copy(
                update={
                    "name": f"{r.source_table}_{r.source_column}",
                    "description": r.description or "外键关系",
                }
            )
            for r in request.relations
        ]
        return SuggestResponse(concepts=concepts, relations=relations)


class OntologyClient:
    """Client that creates concepts/attributes/relations in TECH-ONT."""

    def __init__(self, base_url: str = settings.ont_api_base_url) -> None:
        self.base_url = base_url.rstrip("/")

    async def import_candidates(
        self, request: ImportRequest
    ) -> ImportResult:
        selected_concepts = [c for c in request.concepts if c.selected]
        selected_relations = [r for r in request.relations if r.selected]

        concept_ids: list[str] = []
        relation_ids: list[str] = []
        created_attributes = 0
        failed: list[dict[str, Any]] = []

        concept_code_to_id: dict[str, str] = {}

        async with httpx.AsyncClient(timeout=30.0) as client:
            for concept in selected_concepts:
                attribute_ids: list[str] = []
                for attr in concept.attributes:
                    if not attr.selected:
                        continue
                    try:
                        resp = await client.post(
                            f"{self.base_url}/attributes",
                            json={
                                "code": attr.code,
                                "name": attr.name,
                                "description": attr.description,
                                "dataType": attr.data_type,
                                "required": attr.required,
                                "unique": attr.unique,
                            },
                        )
                        resp.raise_for_status()
                        attr_id = resp.json()["data"].get(
                            "attributeId", f"attr-{uuid.uuid4().hex[:8]}"
                        )
                        attribute_ids.append(attr_id)
                        created_attributes += 1
                    except Exception as exc:
                        failed.append(
                            {
                                "type": "attribute",
                                "code": attr.code,
                                "reason": str(exc),
                            }
                        )

                try:
                    resp = await client.post(
                        f"{self.base_url}/concepts",
                        json={
                            "code": concept.code,
                            "name": concept.name,
                            "description": concept.description,
                            "attributeIds": attribute_ids,
                        },
                    )
                    resp.raise_for_status()
                    concept_id = resp.json()["data"].get(
                        "conceptId", f"concept-{uuid.uuid4().hex[:8]}"
                    )
                    concept_ids.append(concept_id)
                    concept_code_to_id[concept.code] = concept_id
                except Exception as exc:
                    failed.append(
                        {"type": "concept", "code": concept.code, "reason": str(exc)}
                    )

            for rel in selected_relations:
                source_id = concept_code_to_id.get(_to_snake_upper(rel.source_table))
                target_id = concept_code_to_id.get(_to_snake_upper(rel.target_table))
                if not source_id or not target_id:
                    failed.append(
                        {
                            "type": "relation",
                            "code": rel.code,
                            "reason": "源概念或目标概念未成功创建",
                        }
                    )
                    continue
                try:
                    resp = await client.post(
                        f"{self.base_url}/relations/types",
                        json={
                            "code": rel.code,
                            "name": rel.name,
                            "description": rel.description,
                            "sourceConceptId": source_id,
                            "targetConceptId": target_id,
                            "cardinality": rel.cardinality,
                        },
                    )
                    resp.raise_for_status()
                    relation_id = resp.json()["data"].get(
                        "relationTypeId", f"rel-{uuid.uuid4().hex[:8]}"
                    )
                    relation_ids.append(relation_id)
                except Exception as exc:
                    failed.append(
                        {"type": "relation", "code": rel.code, "reason": str(exc)}
                    )

        if not concept_ids and not relation_ids and failed:
            raise ExternalServiceError(
                "导入本体失败", data={"failed": failed}
            )

        return ImportResult(
            createdConcepts=len(concept_ids),
            createdAttributes=created_attributes,
            createdRelations=len(relation_ids),
            conceptIds=concept_ids,
            relationIds=relation_ids,
            failed=failed,
        )
