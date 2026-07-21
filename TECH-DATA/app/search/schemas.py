"""Global search schemas (P3-DASH-07)."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class SearchCategory(str, Enum):
    APP = "app"
    KNOWLEDGE = "knowledge"
    ONTOLOGY = "ontology"
    TASK = "task"


class SearchResult(BaseModel):
    category: SearchCategory
    id: str
    title: str
    description: str
    link: str


class SearchRequest(BaseModel):
    keyword: str = Field(min_length=1, max_length=128)
    categories: list[SearchCategory] = Field(default_factory=list)
    limit: int = Field(default=20, ge=1, le=100)
