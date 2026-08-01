"""In-memory repository exports for the data platform control plane.

P3-W2 (TD-5) adds ``sql_store`` alongside in_memory — callers that
need SQL persistence import ``sql_store`` directly. The in-memory
store remains the default for dev / test.
"""
from .in_memory import (
    CdcTask,
    DataSource,
    create_cdc_task,
    create_source,
    delete_cdc_task,
    delete_source,
    get_cdc_task,
    get_source,
    get_source_schema,
    list_cdc_tasks,
    list_sources,
    reset_store,
    set_cdc_task_status,
    source_to_dict,
    task_to_dict,
    test_source_connection,
    update_cdc_task,
    update_source,
)

__all__ = [
    "CdcTask",
    "DataSource",
    "create_cdc_task",
    "create_source",
    "delete_cdc_task",
    "delete_source",
    "get_cdc_task",
    "get_source",
    "get_source_schema",
    "list_cdc_tasks",
    "list_sources",
    "reset_store",
    "set_cdc_task_status",
    "source_to_dict",
    "task_to_dict",
    "test_source_connection",
    "update_cdc_task",
    "update_source",
    "sql_store",
]

from . import sql_store
