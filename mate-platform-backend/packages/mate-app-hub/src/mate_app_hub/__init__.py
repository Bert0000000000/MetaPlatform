"""Mate Platform - APP-HUB package.

The hub exposes the platform's application registry, grouping,
module catalog, page templates, and workflow / form templates.
Five read-only GET endpoints live under `/api/v1/apphub/*`
(FR-APP-HUB-001..005).

Backend storage is in-memory for the P2-W2 batch; persistent
storage (Paimon / Postgres) lands in v3.2.
"""
from __future__ import annotations

__version__ = "0.1.0"
