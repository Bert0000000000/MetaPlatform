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
    FlowDeployment,
    FlowTestRun,
    FlowValidation,
    append_test_run,
    append_validation,
    delete_flow,
    deploy_flow,
    get_flow,
    list_deployments,
    list_flows,
    list_test_runs,
    list_validations,
    put_flow,
    reset_store,
    update_flow_status,
    validate_bpmn,
)

__all__ = [
    "FlowDefinition",
    "FlowDeployment",
    "FlowTestRun",
    "FlowValidation",
    "append_test_run",
    "append_validation",
    "delete_flow",
    "deploy_flow",
    "get_flow",
    "list_deployments",
    "list_flows",
    "list_test_runs",
    "list_validations",
    "put_flow",
    "reset_store",
    "sql_store",
    "update_flow_status",
    "validate_bpmn",
]
