"""Mate Platform - APP-A2A package.

The A2A (Agent-to-Agent) protocol center exposes inter-agent
delegation, external (federated) agent discovery, and task routing
under `/api/v1/a2a/*` (FR-APP-A2A-001..010).

Backend storage is in-memory for the P2-W3 batch; persistent
storage (Paimon / Postgres) lands in v3.2.
"""
from __future__ import annotations

__version__ = "0.1.0"
