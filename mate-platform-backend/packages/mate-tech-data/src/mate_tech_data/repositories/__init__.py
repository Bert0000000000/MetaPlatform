"""In-memory repository exports for the data platform control plane.

P3-W2 (TD-5) adds ``sql_store`` alongside in_memory — callers that
need SQL persistence import ``sql_store`` directly. The in-memory
store remains the default for dev / test.

v3.1 adds the Iceberg ADS ``DataProduct`` aggregate alongside the
existing CDC task + DataSource siblings.
"""
from .in_memory import (
    DATA_PRODUCT_MODALITIES,
    DATA_PRODUCT_STATUSES,
    CdcTask,
    DataProduct,
    DataSource,
    create_cdc_task,
    create_data_product,
    create_source,
    data_product_to_dict,
    delete_cdc_task,
    delete_data_product,
    delete_source,
    get_cdc_task,
    get_data_product,
    get_source,
    get_source_schema,
    list_cdc_tasks,
    list_data_products,
    list_sources,
    reset_store,
    set_cdc_task_status,
    set_data_product_status,
    source_to_dict,
    task_to_dict,
    test_source_connection,
    update_cdc_task,
    update_data_product,
    update_source,
)

__all__ = [
    "DATA_PRODUCT_MODALITIES",
    "DATA_PRODUCT_STATUSES",
    "CdcTask",
    "DataProduct",
    "DataSource",
    "create_cdc_task",
    "create_data_product",
    "create_source",
    "data_product_to_dict",
    "delete_cdc_task",
    "delete_data_product",
    "delete_source",
    "get_cdc_task",
    "get_data_product",
    "get_source",
    "get_source_schema",
    "list_cdc_tasks",
    "list_data_products",
    "list_sources",
    "reset_store",
    "set_cdc_task_status",
    "set_data_product_status",
    "source_to_dict",
    "sql_store",
    "task_to_dict",
    "test_source_connection",
    "update_cdc_task",
    "update_data_product",
    "update_source",
]

from . import sql_store
