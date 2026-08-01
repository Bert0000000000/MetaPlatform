"""mate-tech-dw — Digital Workforce aggregation query package.

Exposes 15 endpoints under `/api/v1/dw/*` that aggregate digital
employee / knowledge base / model / tool / trace data from the
underlying mate-app-kb / mate-tech-rag / mate-tech-agent services.

P2-W3 (this batch): in-memory repository + read-only queries +
stub POST /documents/upload. Real cross-service aggregation via
mate_clients.security.BearerAuth lands in P2-W5 (TD-6).
"""
from __future__ import annotations

__all__ = ["__version__"]

__version__ = "0.1.0"
