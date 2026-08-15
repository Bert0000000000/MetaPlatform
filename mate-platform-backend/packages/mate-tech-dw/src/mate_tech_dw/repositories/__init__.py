"""Repository package for mate_tech_dw — storage layer for dw entities.

Storage selection (DW_STORE env, mirrors mate-app-kb's KB_STORE pattern):
  - ``memory`` (default): in-memory store — fast, resets on restart. This
    is what the test suite runs against (no env set in conftest).
  - ``sql``: SQLAlchemy store (mate_tech_db engine → MATE_DB_URL /
    DATABASE_URL / sqlite fallback). All 14 entities + employee
    conversations / messages survive restarts.

Both stores expose the same function signatures over the same frozen
dataclasses (``in_memory.DwEmployee`` etc. — sql_store imports them from
in_memory, so the types are shared), meaning callers import the CRUD
surface from this package and stay storage-agnostic. The api layer
(mate_tech_dw.api.app) imports everything from here; switching backends
requires zero API-layer changes.
"""
from __future__ import annotations

import os

# ORM models register on the shared mate_tech_db Base regardless of the
# selected backend (tests + mate_tech_db.create_all rely on this).
from . import sql_models as sql_models
from . import sql_store as sql_store
from .in_memory import (
    DwAuthLogin,
    DwCollaboration,
    DwCommit,
    DwDocument,
    DwEmployee,
    DwEmployeeConversation,
    DwEmployeeMessage,
    DwEmployeeTask,
    DwEvaluation,
    DwExtract,
    DwKnowledgeBase,
    DwLearningExtract,
    DwLearningFeedback,
    DwModel,
    DwTool,
    DwTrace,
)

_STORE = os.environ.get("DW_STORE", "memory").lower()

if _STORE == "sql":
    from .sql_store import (
        append_collaboration,
        append_document,
        append_employee_task,
        append_evaluation,
        append_learning_feedback,
        create_employee,
        delete_document,
        delete_employee,
        get_employee,
        get_employee_conversation,
        get_employee_task,
        get_learning_feedback,
        list_auth_logins,
        list_collaborations,
        list_commits,
        list_documents,
        list_employee_conversations,
        list_employee_messages,
        list_employee_tasks,
        list_employees,
        list_evaluations,
        list_extracts,
        list_knowledge_bases,
        list_learning_extracts,
        list_learning_feedback,
        list_models,
        list_tools,
        list_traces,
        next_employee_message_sequence,
        put_employee_conversation,
        put_employee_message,
        update_employee,
        update_employee_task,
        update_learning_feedback,
    )
    from .sql_store import (
        seed_from_inmemory as seed_from_inmemory,
    )
else:
    from .in_memory import (
        append_collaboration,
        append_document,
        append_employee_task,
        append_evaluation,
        append_learning_feedback,
        create_employee,
        delete_document,
        delete_employee,
        get_employee,
        get_employee_conversation,
        get_employee_task,
        get_learning_feedback,
        list_auth_logins,
        list_collaborations,
        list_commits,
        list_documents,
        list_employee_conversations,
        list_employee_messages,
        list_employee_tasks,
        list_employees,
        list_evaluations,
        list_extracts,
        list_knowledge_bases,
        list_learning_extracts,
        list_learning_feedback,
        list_models,
        list_tools,
        list_traces,
        next_employee_message_sequence,
        put_employee_conversation,
        put_employee_message,
        update_employee,
        update_employee_task,
        update_learning_feedback,
    )

__all__ = [
    "DwAuthLogin",
    "DwCollaboration",
    "DwCommit",
    "DwDocument",
    "DwEmployee",
    "DwEmployeeConversation",
    "DwEmployeeMessage",
    "DwEmployeeTask",
    "DwEvaluation",
    "DwExtract",
    "DwKnowledgeBase",
    "DwLearningExtract",
    "DwLearningFeedback",
    "DwModel",
    "DwTool",
    "DwTrace",
    "append_collaboration",
    "append_document",
    "append_employee_task",
    "append_evaluation",
    "append_learning_feedback",
    "create_employee",
    "delete_document",
    "delete_employee",
    "get_employee",
    "get_employee_conversation",
    "get_employee_task",
    "get_learning_feedback",
    "list_auth_logins",
    "list_collaborations",
    "list_commits",
    "list_documents",
    "list_employee_conversations",
    "list_employee_messages",
    "list_employee_tasks",
    "list_employees",
    "list_evaluations",
    "list_extracts",
    "list_knowledge_bases",
    "list_learning_extracts",
    "list_learning_feedback",
    "list_models",
    "list_tools",
    "list_traces",
    "next_employee_message_sequence",
    "put_employee_conversation",
    "put_employee_message",
    "sql_models",
    "sql_store",
    "update_employee",
    "update_employee_task",
    "update_learning_feedback",
]
