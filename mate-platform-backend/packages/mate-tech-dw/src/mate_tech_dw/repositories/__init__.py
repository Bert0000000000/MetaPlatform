"""mate_tech_dw.repositories — storage layer for dw entities.

P3-W3 (TD-5) adds a SQL-backed implementation (sql_store) alongside
the in-memory implementation. The 14 dataclasses (DwAuthLogin /
DwCollaboration / DwCommit / DwDocument / DwEmployee / DwEmployeeTask /
DwEvaluation / DwExtract / DwKnowledgeBase / DwLearningExtract /
DwLearningFeedback / DwModel / DwTool / DwTrace) are deliberately
framework-agnostic so the upcoming Paimon / Postgres adapter (v3.2)
can reuse them without leaking FastAPI types.
"""
from __future__ import annotations

from . import sql_store  # noqa: F401
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
    get_employee,
    list_employee_tasks,
    append_employee_task,
    get_employee_task,
    update_employee_task,
    list_evaluations,
    append_evaluation,
    list_extracts,
    list_knowledge_bases,
    list_learning_extracts,
    list_learning_feedback,
    append_learning_feedback,
    list_models,
    list_tools,
    list_traces,
    append_collaboration,
)

__all__ = [
    "DwAuthLogin", "DwCollaboration", "DwCommit", "DwDocument",
    "DwEmployee", "DwEmployeeTask", "DwEvaluation", "DwExtract",
    "DwKnowledgeBase", "DwLearningExtract", "DwLearningFeedback",
    "DwModel", "DwTool", "DwTrace",
    "list_auth_logins", "list_collaborations", "list_commits",
    "list_documents", "append_document", "list_employees",
    "get_employee", "list_employee_tasks",
    "append_employee_task", "get_employee_task", "update_employee_task",
    "list_evaluations", "append_evaluation", "list_extracts",
    "list_knowledge_bases", "list_learning_extracts",
    "list_learning_feedback", "append_learning_feedback",
    "list_models", "list_tools", "list_traces",
    "append_collaboration",
    "sql_store",
]
