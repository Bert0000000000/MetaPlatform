"""mate_app_hub.shortlink — short-link module (APPHUB-RUNTIME-01 phase C).

Public API:
  - generator:  generate_code
  - repository: ShortlinkEntry / InMemoryShortlinkStore
  - resolver:   resolve
  - service:    create_shortlink / resolve_shortlink / list_shortlinks /
                revoke_shortlink / get_default_store
"""
from __future__ import annotations

from .generator import ALPHABET, generate_code
from .repository import InMemoryShortlinkStore, ShortlinkEntry
from .resolver import resolve
from .service import (
    create_shortlink,
    get_default_store,
    list_shortlinks,
    resolve_shortlink,
    revoke_shortlink,
)

__all__ = [
    "ALPHABET",
    "InMemoryShortlinkStore",
    "ShortlinkEntry",
    "create_shortlink",
    "generate_code",
    "get_default_store",
    "list_shortlinks",
    "resolve",
    "resolve_shortlink",
    "revoke_shortlink",
]
