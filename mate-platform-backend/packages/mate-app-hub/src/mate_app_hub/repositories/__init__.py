"""mate_app_hub.repositories — storage layer for apphub entities.

This batch exposes only an in-memory implementation. The
`ApphubApp` / `ApphubGroup` / `ApphubModule` / `ApphubPage` /
`ApphubTemplate` dataclasses are deliberately framework-agnostic
so the upcoming Paimon / Postgres adapter (v3.2) can reuse them
without leaking FastAPI types.
"""
from __future__ import annotations

from .in_memory import (
    ApphubApp,
    ApphubGroup,
    ApphubModule,
    ApphubPage,
    ApphubTemplate,
    list_apps,
    list_groups,
    list_modules,
    list_pages,
    list_templates,
)

__all__ = [
    "ApphubApp",
    "ApphubGroup",
    "ApphubModule",
    "ApphubPage",
    "ApphubTemplate",
    "list_apps",
    "list_groups",
    "list_modules",
    "list_pages",
    "list_templates",
]
