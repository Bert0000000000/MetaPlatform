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
    ApphubGroup,
    ApphubModule,
    ApphubPage,
    ApphubTemplate,
    delete_app,
    delete_group,
    get_app,
    get_group,
    get_module,
    get_template,
    list_apps,
    list_groups,
    list_modules,
    list_pages,
    list_templates,
    put_app,
    put_group,
    put_module,
    put_page,
    put_template,
)

__all__ = [
    "ApphubApp",
    "ApphubGroup",
    "ApphubModule",
    "ApphubPage",
    "ApphubTemplate",
    "delete_app",
    "delete_group",
    "get_app",
    "get_group",
    "get_module",
    "get_template",
    "list_apps",
    "list_groups",
    "list_modules",
    "list_pages",
    "list_templates",
    "put_app",
    "put_group",
    "put_module",
    "put_page",
    "put_template",
    "sql_store",
]
