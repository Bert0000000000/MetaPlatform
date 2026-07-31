"""mate_app_copilot.repositories — storage layer for copilot entities.

Two backends:
  - in_memory (default): dict-of-dicts, seeded per-tenant, zero-config
  - sql_store (v3.2): SQLAlchemy 2.0 ORM, Postgres/SQLite

When MATE_DB_URL env var is set, the app startup hook calls
sql_store.seed_from_inmemory() to bootstrap, and handlers that need
persistence can use sql_store.list_* / put_* directly.

The dataclasses are framework-agnostic so both backends reuse them.
"""
from __future__ import annotations

from . import in_memory, sql_store
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
    list_assets,
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
    "in_memory",
    "list_actions",
    "list_assets",
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
    "sql_store",
]
