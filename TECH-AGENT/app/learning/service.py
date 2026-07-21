"""Digital worker self-learning service (V15-03).

Stores feedback records and learned knowledge in memory. In production this
should be backed by a persistent store and wired to TECH-RAG via the RAGClient.
"""

from __future__ import annotations

import uuid
from collections import Counter
from datetime import datetime, timezone
from typing import Dict, List, Optional

from app.clients.rag import RAGClient
from app.learning.schemas import (
    ExecutionResult,
    FeedbackCreateRequest,
    FeedbackRecord,
    FeedbackType,
    KnowledgeSyncResult,
    KnowledgeType,
    LearnedKnowledge,
    LearningStats,
)


class LearningService:
    """Service for recording feedback, extracting knowledge and syncing to RAG."""

    def __init__(self, rag_client: Optional[RAGClient] = None) -> None:
        self._rag_client = rag_client
        self._feedback: Dict[str, FeedbackRecord] = {}
        self._knowledge: Dict[str, LearnedKnowledge] = {}

    def clear(self) -> None:
        """Clear in-memory state. Useful for tests."""
        self._feedback.clear()
        self._knowledge.clear()

    async def record_feedback(
        self,
        request: FeedbackCreateRequest,
    ) -> FeedbackRecord:
        """Record user feedback for a task execution."""

        record = FeedbackRecord(
            id=f"fb-{uuid.uuid4().hex[:12]}",
            employee_id=request.employee_id,
            task_id=request.task_id,
            task_title=request.task_title,
            execution_result=request.execution_result,
            feedback_type=request.feedback_type,
            suggestion=request.suggestion,
            tags=list(request.tags),
        )
        self._feedback[record.id] = record
        return record

    def get_feedback(self, feedback_id: str) -> Optional[FeedbackRecord]:
        return self._feedback.get(feedback_id)

    def list_feedback(
        self,
        employee_id: Optional[str] = None,
        task_id: Optional[str] = None,
    ) -> List[FeedbackRecord]:
        records = list(self._feedback.values())
        if employee_id:
            records = [r for r in records if r.employee_id == employee_id]
        if task_id:
            records = [r for r in records if r.task_id == task_id]
        return sorted(records, key=lambda r: r.created_at, reverse=True)

    async def extract_knowledge(
        self,
        feedback_records: List[FeedbackRecord],
    ) -> List[LearnedKnowledge]:
        """Extract knowledge fragments from feedback records.

        This is a rule-based implementation. In production it may call an LLM
        via TECH-LLMGW to summarize patterns.
        """

        created: List[LearnedKnowledge] = []
        for record in feedback_records:
            if record.id in self._extracted_feedback_ids():
                continue

            knowledge = self._build_knowledge(record)
            if knowledge:
                self._knowledge[knowledge.id] = knowledge
                created.append(knowledge)
        return created

    def _extracted_feedback_ids(self) -> set[str]:
        ids: set[str] = set()
        for knowledge in self._knowledge.values():
            ids.update(knowledge.source_feedback_ids)
        return ids

    def _build_knowledge(self, record: FeedbackRecord) -> Optional[LearnedKnowledge]:
        if record.feedback_type == FeedbackType.THUMB_UP:
            title = f"成功经验：{record.task_title or record.task_id}"
            content = (
                f"任务「{record.task_title or record.task_id}」执行成功。"
                f"执行结果：{record.execution_result.value}。"
                "可作为后续相似任务的参考。"
            )
            knowledge_type = KnowledgeType.EXPERIENCE
            confidence = 0.9
        elif record.feedback_type == FeedbackType.THUMB_DOWN:
            title = f"改进建议：{record.task_title or record.task_id}"
            content = (
                f"任务「{record.task_title or record.task_id}」执行未达预期。"
                f"执行结果：{record.execution_result.value}。"
                f"用户反馈：{record.suggestion or '无详细说明'}。"
                "执行相似任务时应避免相同问题。"
            )
            knowledge_type = KnowledgeType.EXPERIENCE
            confidence = 0.85
        elif record.suggestion.strip():
            title = f"参数/规则建议：{record.task_title or record.task_id}"
            content = (
                f"用户针对任务「{record.task_title or record.task_id}」提出建议："
                f"{record.suggestion}"
            )
            knowledge_type = (
                KnowledgeType.PARAMETER_TEMPLATE
                if "参数" in record.suggestion or "template" in record.suggestion.lower()
                else KnowledgeType.TOOL_RULE
            )
            confidence = 0.75
        else:
            return None

        return LearnedKnowledge(
            id=f"kn-{uuid.uuid4().hex[:12]}",
            employee_id=record.employee_id,
            knowledge_type=knowledge_type,
            title=title,
            content=content,
            source_feedback_ids=[record.id],
            task_pattern=record.task_title or "",
            tags=list(record.tags),
            confidence=confidence,
        )

    def list_knowledge(
        self,
        employee_id: str,
        synced_only: bool = False,
    ) -> List[LearnedKnowledge]:
        items = [
            k for k in self._knowledge.values() if k.employee_id == employee_id
        ]
        if synced_only:
            items = [k for k in items if k.synced_to_kb]
        return sorted(items, key=lambda k: k.created_at, reverse=True)

    async def sync_to_knowledge_base(
        self,
        employee_id: str,
    ) -> KnowledgeSyncResult:
        """Mock sync of unsynced knowledge fragments to TECH-RAG knowledge base.

        Returns document IDs generated locally. A real implementation would call
        ``self._rag_client.index_documents(...)`` or the TECH-RAG HTTP API.
        """

        pending = [k for k in self._knowledge.values() if k.employee_id == employee_id and not k.synced_to_kb]
        document_ids: List[str] = []
        now = datetime.now(timezone.utc)
        for knowledge in pending:
            doc_id = f"doc-{uuid.uuid4().hex[:12]}"
            knowledge.synced_to_kb = True
            knowledge.kb_document_id = doc_id
            knowledge.updated_at = now
            document_ids.append(doc_id)

        if self._rag_client is not None and document_ids:
            # Mock external call shape; real implementation indexes documents.
            pass

        return KnowledgeSyncResult(
            employee_id=employee_id,
            synced_count=len(document_ids),
            document_ids=document_ids,
        )

    def get_stats(self, employee_id: str) -> LearningStats:
        records = self.list_feedback(employee_id=employee_id)
        knowledge = self.list_knowledge(employee_id)

        total = len(records)
        thumb_up = sum(1 for r in records if r.feedback_type == FeedbackType.THUMB_UP)
        thumb_down = sum(1 for r in records if r.feedback_type == FeedbackType.THUMB_DOWN)
        suggestions = sum(1 for r in records if r.feedback_type == FeedbackType.SUGGESTION)
        synced = sum(1 for k in knowledge if k.synced_to_kb)

        success_rate = 0.0
        if total > 0:
            success = sum(
                1 for r in records if r.execution_result == ExecutionResult.SUCCESS
            )
            success_rate = round(success / total, 2)

        tag_counts = Counter(tag for r in records for tag in r.tags)
        top_tags = [tag for tag, _ in tag_counts.most_common(5)]

        return LearningStats(
            employee_id=employee_id,
            total_feedback=total,
            thumb_up=thumb_up,
            thumb_down=thumb_down,
            suggestions=suggestions,
            knowledge_fragments=len(knowledge),
            synced_fragments=synced,
            success_rate=success_rate,
            top_tags=top_tags,
        )

    def update_feedback_tags(
        self,
        feedback_id: str,
        tags: List[str],
    ) -> Optional[FeedbackRecord]:
        record = self._feedback.get(feedback_id)
        if record is None:
            return None
        record.tags = list(tags)
        record.updated_at = datetime.now(timezone.utc)
        return record
