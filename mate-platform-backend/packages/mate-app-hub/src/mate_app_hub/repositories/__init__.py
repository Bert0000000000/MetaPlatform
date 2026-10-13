"""mate_app_hub.repositories — storage layer for apphub entities.

This batch exposes an in-memory implementation (default) and a SQL
implementation (P3-W3 TD-5) backed by SQLAlchemy 2.0 + mate-tech-db.
The `ApphubApp` / `ApphubGroup` / `ApphubModule` / `ApphubPage` /
`ApphubTemplate` dataclasses are deliberately framework-agnostic
so the upcoming Paimon / Postgres adapter (v3.2) can reuse them
without leaking FastAPI types.
"""

from __future__ import annotations

from . import sql_store
from .in_memory import (
    ApphubApp,
    ApphubDomain,
    ApphubGroup,
    ApphubModule,
    ApphubPage,
    ApphubTemplate,
    delete_app,
    delete_domain,
    delete_group,
    get_app,
    get_domain,
    get_group,
    get_module,
    get_template,
    list_apps,
    list_domains,
    list_groups,
    list_modules,
    list_pages,
    list_templates,
    put_app,
    put_domain,
    put_group,
    put_module,
    put_page,
    put_template,
)

__all__ = [
    "ApphubApp",
    "ApphubDomain",
    "ApphubGroup",
    "ApphubModule",
    "ApphubPage",
    "ApphubTemplate",
    "delete_app",
    "delete_domain",
    "delete_group",
    "get_app",
    "get_domain",
    "get_group",
    "get_module",
    "get_template",
    "list_apps",
    "list_domains",
    "list_groups",
    "list_modules",
    "list_pages",
    "list_templates",
    "put_app",
    "put_domain",
    "put_group",
    "put_module",
    "put_page",
    "put_template",
    "sql_store",
]

# Select at call time so application factories and test hosts share one explicit
# DB configuration. No default dev database silently becomes production storage.
import os

from . import in_memory


def uses_sql() -> bool:
    return bool((os.getenv("MATE_DB_URL") or os.getenv("DATABASE_URL") or "").strip())


def _dispatch(name):
    def operation(*args, **kwargs):
        store = sql_store if uses_sql() else in_memory
        return getattr(store, name)(*args, **kwargs)

    operation.__name__ = name
    return operation


for _name in (
    "list_apps",
    "get_app",
    "put_app",
    "delete_app",
    "list_groups",
    "get_group",
    "put_group",
    "insert_group",
    "delete_group",
    "list_domains",
    "get_domain",
    "put_domain",
    "delete_domain",
    "list_modules",
    "get_module",
    "put_module",
    "list_pages",
    "put_page",
    "list_templates",
    "get_template",
    "put_template",
):
    globals()[_name] = _dispatch(_name)
