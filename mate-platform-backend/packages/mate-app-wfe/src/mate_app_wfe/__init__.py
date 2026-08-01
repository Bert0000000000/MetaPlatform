"""mate-app-wfe — Workflow Engine center package.

Exposes 2 endpoints under `/api/v1/wfe/*`:
  * `POST /flows/test`      — dry-run a BPMN flow definition
  * `GET  /flows/validate`  — list flow validation results

P2-W5 (this batch): in-memory repository + BPMN structural checks.
Real Flowable 8.0 engine integration lands in P2-W6 via
`mate_clients.security.BearerAuth` (ADR-0014 step 4).
"""
from __future__ import annotations

__all__ = ["__version__"]

__version__ = "0.1.0"
