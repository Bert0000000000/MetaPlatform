"""mate_app_wfe.repositories — storage layer for wfe entities.

This batch exposes an in-memory implementation plus a SQL backend
(P3-W3 TD-5) backed by SQLAlchemy 2.0 ORM. The ``FlowDefinition`` /
``FlowValidation`` / ``FlowTestRun`` dataclasses are deliberately
framework-agnostic so the upcoming Flowable 8.0 adapter (P2-W6) can
reuse them without leaking FastAPI types.
"""
from __future__ import annotations

from . import sql_store
from .in_memory import (
    FlowDefinition,
    FlowTestRun,
    FlowValidation,
    append_test_run,
    append_validation,
    get_flow,
    list_flows,
    list_test_runs,
    list_validations,
    reset_store,
    validate_bpmn,
)

__all__ = [
    "FlowDefinition",
    "FlowTestRun",
    "FlowValidation",
    "append_test_run",
    "append_validation",
    "get_flow",
    "list_flows",
    "list_test_runs",
    "list_validations",
    "reset_store",
    "sql_store",
    "validate_bpmn",
]
