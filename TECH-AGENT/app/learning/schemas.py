"""Pydantic schemas for digital worker self-learning (V15-03)."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class FeedbackType(str, Enum):
    """User feedback on a task execution."""

    THUMB_UP = "thumb_up"
    THUMB_DOWN = "thumb_down"
    SUGGESTION = "suggestion"


class KnowledgeType(str, Enum):
    """Type of knowledge extracted from feedback."""

    PROMPT_FRAGMENT = "prompt_fragment"
    TOOL_RULE = "tool_rule"
    PARAMETER_TEMPLATE = "parameter_template"
    EXPERIENCE = "experience"


class ExecutionResult(str, Enum):
    """Execution outcome of a task."""

    SUCCESS = "success"
    FAILED = "failed"
    PARTIAL = "partial"


class FeedbackRecord(BaseModel):
    """A single feedback record for a task execution."""

    id: str
    employee_id: str
    task_id: str
    task_title: str = ""
    execution_result: ExecutionResult = ExecutionResult.SUCCESS
    feedback_type: FeedbackType = FeedbackType.THUMB_UP
    suggestion: str = ""
    tags: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None


class LearnedKnowledge(BaseModel):
    """A knowledge fragment extracted from feedback records."""

    id: str
    employee_id: str
    knowledge_type: KnowledgeType = KnowledgeType.EXPERIENCE
    title: str
    content: str
    source_feedback_ids: List[str] = Field(default_factory=list)
    task_pattern: str = ""
    tags: List[str] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0, default=0.8)
    synced_to_kb: bool = False
    kb_document_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None


class LearningStats(BaseModel):
    """Learning statistics for an employee."""

    employee_id: str
    total_feedback: int = 0
    thumb_up: int = 0
    thumb_down: int = 0
    suggestions: int = 0
    knowledge_fragments: int = 0
    synced_fragments: int = 0
    success_rate: float = 0.0
    top_tags: List[str] = Field(default_factory=list)


class FeedbackCreateRequest(BaseModel):
    """Request body for recording feedback."""

    employee_id: str = Field(min_length=1)
    task_id: str = Field(min_length=1)
    task_title: str = ""
    execution_result: ExecutionResult = ExecutionResult.SUCCESS
    feedback_type: FeedbackType = FeedbackType.THUMB_UP
    suggestion: str = ""
    tags: List[str] = Field(default_factory=list)


class KnowledgeExtractRequest(BaseModel):
    """Request body for manually triggering knowledge extraction."""

    employee_id: str = Field(min_length=1)
    feedback_ids: Optional[List[str]] = None


class KnowledgeSyncResult(BaseModel):
    """Result of syncing knowledge to RAG knowledge base."""

    employee_id: str
    synced_count: int = 0
    document_ids: List[str] = Field(default_factory=list)


def feedback_to_dict(record: FeedbackRecord) -> dict[str, Any]:
    return {
        "feedbackId": record.id,
        "employeeId": record.employee_id,
        "taskId": record.task_id,
        "taskTitle": record.task_title,
        "executionResult": record.execution_result.value,
        "feedbackType": record.feedback_type.value,
        "suggestion": record.suggestion,
        "tags": record.tags,
        "createdAt": record.created_at,
        "updatedAt": record.updated_at,
    }


def knowledge_to_dict(knowledge: LearnedKnowledge) -> dict[str, Any]:
    return {
        "knowledgeId": knowledge.id,
        "employeeId": knowledge.employee_id,
        "knowledgeType": knowledge.knowledge_type.value,
        "title": knowledge.title,
        "content": knowledge.content,
        "sourceFeedbackIds": knowledge.source_feedback_ids,
        "taskPattern": knowledge.task_pattern,
        "tags": knowledge.tags,
        "confidence": knowledge.confidence,
        "syncedToKb": knowledge.synced_to_kb,
        "kbDocumentId": knowledge.kb_document_id,
        "createdAt": knowledge.created_at,
        "updatedAt": knowledge.updated_at,
    }


def stats_to_dict(stats: LearningStats) -> dict[str, Any]:
    return {
        "employeeId": stats.employee_id,
        "totalFeedback": stats.total_feedback,
        "thumbUp": stats.thumb_up,
        "thumbDown": stats.thumb_down,
        "suggestions": stats.suggestions,
        "knowledgeFragments": stats.knowledge_fragments,
        "syncedFragments": stats.synced_fragments,
        "successRate": stats.success_rate,
        "topTags": stats.top_tags,
    }
