"""In-memory repository exports for the data metrics control plane.

P3-W2 (TD-5) adds ``sql_store`` alongside in_memory — callers that
need SQL persistence import ``sql_store`` directly. The in-memory
store remains the default for dev / test.
"""
from .in_memory import (
    Metric,
    compute_metric,
    create_metric,
    delete_metric,
    get_metric,
    get_metric_lineage,
    get_metric_values,
    list_metrics,
    metric_to_dict,
    reset_store,
    update_metric,
)

__all__ = [
    "Metric",
    "compute_metric",
    "create_metric",
    "delete_metric",
    "get_metric",
    "get_metric_lineage",
    "get_metric_values",
    "list_metrics",
    "metric_to_dict",
    "reset_store",
    "update_metric",
    "sql_store",
]

from . import sql_store
