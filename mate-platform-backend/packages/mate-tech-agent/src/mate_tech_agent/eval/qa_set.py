"""QA evaluation set (TC-5.7.12).

10 个对话场景（S1 single-agent）：
- expected_mode: AUTO/FACTUAL/ENTITY
- expected_keywords: 答案应含关键词
"""
from __future__ import annotations

from typing import TypedDict


class QAItem(TypedDict):
    id: str
    query: str
    scenario: str
    expected_mode: str
    expected_keywords: list[str]
    expected_chunk_count_min: int


QA_SET: list[QAItem] = [
    {
        "id": "qa-001",
        "query": "What is the backend framework?",
        "scenario": "S1",
        "expected_mode": "AUTO",
        "expected_keywords": ["Python", "FastAPI", "Mate Platform"],
        "expected_chunk_count_min": 1,
    },
    {
        "id": "qa-002",
        "query": "How does MatePlatform handle multi-tenancy?",
        "scenario": "S1",
        "expected_mode": "AUTO",
        "expected_keywords": ["MatePlatform", "multi-tenant"],
        "expected_chunk_count_min": 1,
    },
    {
        "id": "qa-003",
        "query": "What is LightRAG used for?",
        "scenario": "S1",
        "expected_mode": "AUTO",
        "expected_keywords": ["LightRAG", "thematic"],
        "expected_chunk_count_min": 1,
    },
    {
        "id": "qa-004",
        "query": "What external AI engines are integrated?",
        "scenario": "S1",
        "expected_mode": "ENTITY",
        "expected_keywords": ["RAGFlow", "LightRAG", "Flowable"],
        "expected_chunk_count_min": 1,
    },
    {
        "id": "qa-005",
        "query": "Explain the infrastructure stack",
        "scenario": "S1",
        "expected_mode": "AUTO",
        "expected_keywords": ["PostgreSQL", "Neo4j", "Milvus"],
        "expected_chunk_count_min": 1,
    },
    {
        "id": "qa-006",
        "query": "What is the purpose of LangChain?",
        "scenario": "S1",
        "expected_mode": "AUTO",
        "expected_keywords": ["LangChain"],
        "expected_chunk_count_min": 1,
    },
    {
        "id": "qa-007",
        "query": "FastAPI vs Flask",
        "scenario": "S1",
        "expected_mode": "ENTITY",
        "expected_keywords": ["FastAPI"],
        "expected_chunk_count_min": 1,
    },
    {
        "id": "qa-008",
        "query": "What is the recommended deployment architecture?",
        "scenario": "S1",
        "expected_mode": "AUTO",
        "expected_keywords": ["Mate Platform"],
        "expected_chunk_count_min": 1,
    },
    {
        "id": "qa-009",
        "query": "MatePlatform feature list",
        "scenario": "S1",
        "expected_mode": "AUTO",
        "expected_keywords": ["MatePlatform"],
        "expected_chunk_count_min": 1,
    },
    {
        "id": "qa-010",
        "query": "Architecture overview of the platform",
        "scenario": "S1",
        "expected_mode": "AUTO",
        "expected_keywords": ["Mate Platform"],
        "expected_chunk_count_min": 1,
    },
]