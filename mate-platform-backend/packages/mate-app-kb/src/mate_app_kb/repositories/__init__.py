"""Repository package for mate-app-kb (P3-W4 TD-5).

Storage selection (KB_STORE env):
  - ``memory`` (default): in-memory store — fast, resets on restart. This is
    what the test suite runs against (no env set in conftest).
  - ``sql``: SQLAlchemy store (mate_tech_db engine → MATE_DB_URL / DATABASE_URL
    / sqlite fallback). Collections / documents / search logs AND the
    retrieval-config + its version snapshots survive restarts.

Both stores expose the same function signatures over the same dataclasses
(``in_memory.KbCollection`` etc.), so callers import the CRUD surface from
this package and stay storage-agnostic.

NOTE (2026-08-16): ``api/app.py`` still binds the four retrieval-config
helpers directly from ``.in_memory``. Until that import is flipped to this
package, the HTTP endpoints keep per-process in-memory retrieval config
even under KB_STORE=sql; everything imported from THIS package (selection
layer) already routes to SQL.
"""
from __future__ import annotations

import os

# Entity dataclasses are shared by both backends; in_memory stays the
# single source of truth for the shapes (sql_store imports them from
# there too).
from .in_memory import KbRetrievalConfig, KbRetrievalConfigSnapshot

_STORE = os.environ.get("KB_STORE", "memory").lower()

if _STORE == "sql":
    from .sql_store import (
        delete_collection,
        delete_document,
        delete_search_log,
        get_collection,
        get_document,
        get_retrieval_config,
        get_search_log,
        list_collections,
        list_documents,
        list_retrieval_config_snapshots,
        list_search_logs,
        put_collection,
        put_document,
        put_retrieval_config,
        put_retrieval_config_snapshot,
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
        get_retrieval_config,
        get_search_log,
        list_collections,
        list_documents,
        list_retrieval_config_snapshots,
        list_search_logs,
        put_collection,
        put_document,
        put_retrieval_config,
        put_retrieval_config_snapshot,
        put_search_log,
    )

# Selection-layer re-export surface (sibling packages like mate-tech-mcp
# declare the same). ``seed_from_inmemory`` is sql-branch-only and stays out
# (it is imported explicitly by api/app.py under KB_STORE=sql).
__all__ = [
    "KbRetrievalConfig",
    "KbRetrievalConfigSnapshot",
    "delete_collection",
    "delete_document",
    "delete_search_log",
    "get_collection",
    "get_document",
    "get_retrieval_config",
    "get_search_log",
    "list_collections",
    "list_documents",
    "list_retrieval_config_snapshots",
    "list_search_logs",
    "put_collection",
    "put_document",
    "put_retrieval_config",
    "put_retrieval_config_snapshot",
    "put_search_log",
]
