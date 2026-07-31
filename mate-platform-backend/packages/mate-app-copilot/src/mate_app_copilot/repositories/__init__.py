"""mate_app_copilot.repositories — storage layer for copilot entities.

This batch exposes only an in-memory implementation. The dataclasses
are framework-agnostic so a future Postgres / Paimon adapter (v3.2)
can reuse them without leaking FastAPI types.
"""
from __future__ import annotations

from .in_memory import (
    Action,
    AssetRecord,
    CodeGen,
    Conversation,
    Datasource,
    Intent,
    KnowledgeBase,
    ModelInfo,
    Plan,
    QueryLog,
    Template,
    get_asset,
    list_actions,
    list_conversations,
    list_datasources,
    list_intents,
    list_knowledge_bases,
    list_models,
    list_plans,
    list_queries,
    list_templates,
    put_asset,
    reset_store,
)

__all__ = [
    "Action",
    "AssetRecord",
    "CodeGen",
    "Conversation",
    "Datasource",
    "Intent",
    "KnowledgeBase",
    "ModelInfo",
    "Plan",
    "QueryLog",
    "Template",
    "get_asset",
    "list_actions",
    "list_conversations",
    "list_datasources",
    "list_intents",
    "list_knowledge_bases",
    "list_models",
    "list_plans",
    "list_queries",
    "list_templates",
    "put_asset",
    "reset_store",
]
