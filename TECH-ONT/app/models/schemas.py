"""Pydantic schemas for ontology discovery."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class ColumnInfo(BaseModel):
    name: str
    type: str
    nullable: bool = True
    is_primary_key: bool = Field(default=False, alias="isPrimaryKey")
    is_foreign_key: bool = Field(default=False, alias="isForeignKey")
    referenced_table: Optional[str] = Field(default=None, alias="referencedTable")
    referenced_column: Optional[str] = Field(default=None, alias="referencedColumn")

    model_config = {"populate_by_name": True}


class TableInfo(BaseModel):
    name: str
    schema_name: Optional[str] = Field(default=None, alias="schemaName")
    columns: list[ColumnInfo]
    comment: Optional[str] = None

    model_config = {"populate_by_name": True}


class DataSourceMetadata(BaseModel):
    source_id: str = Field(alias="sourceId")
    source_name: str = Field(alias="sourceName")
    source_type: str = Field(alias="sourceType")
    tables: list[TableInfo]

    model_config = {"populate_by_name": True}


class CandidateAttribute(BaseModel):
    temp_id: str = Field(alias="tempId")
    code: str
    name: str
    data_type: str = Field(alias="dataType")
    required: bool = False
    unique: bool = False
    description: Optional[str] = None
    source_column: str = Field(alias="sourceColumn")
    selected: bool = True

    model_config = {"populate_by_name": True}


class CandidateConcept(BaseModel):
    temp_id: str = Field(alias="tempId")
    source_table: str = Field(alias="sourceTable")
    code: str
    name: str
    description: Optional[str] = None
    attributes: list[CandidateAttribute]
    selected: bool = True

    model_config = {"populate_by_name": True}


class CandidateRelation(BaseModel):
    temp_id: str = Field(alias="tempId")
    source_table: str = Field(alias="sourceTable")
    source_column: str = Field(alias="sourceColumn")
    target_table: str = Field(alias="targetTable")
    target_column: str = Field(alias="targetColumn")
    code: str
    name: str
    description: Optional[str] = None
    cardinality: str = "N-1"
    selected: bool = True

    model_config = {"populate_by_name": True}


class DiscoveryResult(BaseModel):
    source_id: str = Field(alias="sourceId")
    concepts: list[CandidateConcept]
    relations: list[CandidateRelation]

    model_config = {"populate_by_name": True}


class SuggestRequest(BaseModel):
    concepts: list[CandidateConcept]
    relations: list[CandidateRelation]


class SuggestResponse(BaseModel):
    concepts: list[CandidateConcept]
    relations: list[CandidateRelation]


class ImportRequest(BaseModel):
    source_id: str = Field(alias="sourceId")
    concepts: list[CandidateConcept]
    relations: list[CandidateRelation]


class ImportResult(BaseModel):
    created_concepts: int = Field(alias="createdConcepts")
    created_attributes: int = Field(alias="createdAttributes")
    created_relations: int = Field(alias="createdRelations")
    concept_ids: list[str] = Field(alias="conceptIds")
    relation_ids: list[str] = Field(alias="relationIds")
    failed: list[dict[str, Any]] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class AnalyzeRequest(BaseModel):
    source_id: str = Field(alias="sourceId")
    tables: Optional[list[str]] = None

    model_config = {"populate_by_name": True}
