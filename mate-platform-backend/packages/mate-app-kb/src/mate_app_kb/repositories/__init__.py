"""Repository package for mate-app-kb (P3-W4 TD-5).

Storage selection (KB_STORE env):
  - ``memory`` (default): in-memory store — fast, resets on restart. This is
    what the test suite runs against (no env set in conftest).
  - ``sql``: SQLAlchemy store (mate_tech_db engine → MATE_DB_URL / DATABASE_URL
    / sqlite fallback). Collections / documents / search logs survive
    restarts. Retrieval-config + snapshots remain in-memory (per-run config).

Both stores expose the same function signatures over the same dataclasses
(``in_memory.KbCollection`` etc.), so callers import the CRUD surface from
this package and stay storage-agnostic.
"""
from __future__ import annotations

import os

# Retrieval config + version snapshots: in-memory only (both modes).
from .in_memory import (
    KbRetrievalConfig,
    KbRetrievalConfigSnapshot,
    get_retrieval_config,
    list_retrieval_config_snapshots,
    put_retrieval_config,
    put_retrieval_config_snapshot,
)

_STORE = os.environ.get("KB_STORE", "memory").lower()

if _STORE == "sql":
    from .sql_store import (
        delete_collection,
        delete_document,
        delete_search_log,
        get_collection,
        get_document,
        get_search_log,
        list_collections,
        list_documents,
        list_search_logs,
        put_collection,
        put_document,
        put_search_log,
        seed_from_inmemory,
    )
else:
    from .in_memory import (  # noqa: F811
        delete_collection,
        delete_document,
        delete_search_log,
        get_collection,
        get_document,
        get_search_log,
        list_collections,
        list_documents,
        list_search_logs,
        put_collection,
        put_document,
        put_search_log,
    )
