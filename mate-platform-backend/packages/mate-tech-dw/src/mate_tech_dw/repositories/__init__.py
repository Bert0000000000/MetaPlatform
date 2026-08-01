"""mate_tech_dw.repositories — storage layer for dw entities.

This batch exposes only an in-memory implementation. The 14
dataclasses (DwAuthLogin / DwCollaboration / DwCommit / DwDocument /
DwEmployee / DwEmployeeTask / DwEvaluation / DwExtract /
DwKnowledgeBase / DwLearningExtract / DwLearningFeedback /
DwModel / DwTool / DwTrace) are deliberately framework-agnostic
so the upcoming Paimon / Postgres adapter (v3.2) can reuse them
without leaking FastAPI types.
"""
from __future__ import annotations

from .in_memory import (
    DwAuthLogin,
    DwCollaboration,
    DwCommit,
    DwDocument,
    DwEmployee,
    DwEmployeeTask,
    DwEvaluation,
    DwExtract,
    DwKnowledgeBase,
    DwLearningExtract,
    DwLearningFeedback,
    DwModel,
    DwTool,
    DwTrace,
    list_auth_logins,
    list_collaborations,
    list_commits,
    list_documents,
    append_document,
    list_employees,
    list_employee_tasks,
    list_evaluations,
    list_extracts,
    list_knowledge_bases,
    list_learning_extracts,
    list_learning_feedback,
    list_models,
    list_tools,
    list_traces,
)

__all__ = [
    "DwAuthLogin", "DwCollaboration", "DwCommit", "DwDocument",
    "DwEmployee", "DwEmployeeTask", "DwEvaluation", "DwExtract",
    "DwKnowledgeBase", "DwLearningExtract", "DwLearningFeedback",
    "DwModel", "DwTool", "DwTrace",
    "list_auth_logins", "list_collaborations", "list_commits",
    "list_documents", "append_document", "list_employees",
    "list_employee_tasks", "list_evaluations", "list_extracts",
    "list_knowledge_bases", "list_learning_extracts",
    "list_learning_feedback", "list_models", "list_tools",
    "list_traces",
]
