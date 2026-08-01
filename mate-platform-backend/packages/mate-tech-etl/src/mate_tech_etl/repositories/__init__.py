"""In-memory repository exports for the ETL task control plane.

P3-W2 (TD-5) adds ``sql_store`` alongside in_memory — callers that
need SQL persistence import ``sql_store`` directly. The in-memory
store remains the default for dev / test.
"""
from .in_memory import (
    EtlTask,
    create_etl_task,
    delete_etl_task,
    get_etl_task,
    list_etl_tasks,
    reset_store,
    run_etl_task,
    set_etl_task_status,
    stop_etl_task,
    task_to_dict,
    update_etl_task,
)

__all__ = [
    "EtlTask",
    "create_etl_task",
    "delete_etl_task",
    "get_etl_task",
    "list_etl_tasks",
    "reset_store",
    "run_etl_task",
    "set_etl_task_status",
    "stop_etl_task",
    "task_to_dict",
    "update_etl_task",
    "sql_store",
]

from . import sql_store
