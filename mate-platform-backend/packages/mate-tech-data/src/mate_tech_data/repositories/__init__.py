"""Repository selection for the data platform control plane.

Default: in-memory (dev / test). When ``MATE_DB_URL`` or ``DATABASE_URL`` is
set, prefer the SQL-backed ``sql_store`` so CDC tasks / data sources / data
products persist in PostgreSQL. The dynamic helpers (``get_source_schema`` /
``test_source_connection``) and the ``*_to_dict`` serializers always come from
``in_memory`` because they operate on the same domain dataclasses.
"""
from __future__ import annotations

import os

from .in_memory import (
    DATA_PRODUCT_MODALITIES,
    DATA_PRODUCT_STATUSES,
    CdcTask,
    DataProduct,
    DataSource,
    data_product_to_dict,
    get_source_schema,
    reset_store,
    source_to_dict,
    task_to_dict,
    test_source_connection,
)


def _use_sql() -> bool:
    return bool(os.environ.get("MATE_DB_URL") or os.environ.get("DATABASE_URL"))


if _use_sql():
    from .sql_store import (
        catalog_search,
        create_cdc_task,
        create_data_product,
        create_lineage_edge,
        create_quality_rule,
        create_source,
        delete_cdc_task,
        delete_data_product,
        delete_source,
        get_cdc_task,
        get_data_product,
        get_source,
        lineage_graph,
        list_cdc_tasks,
        list_data_products,
        list_lineage_edges,
        list_quality_results,
        list_quality_rules,
        list_sources,
        run_quality_rules,
        save_quality_results,
        set_cdc_task_status,
        set_data_product_status,
        update_cdc_task,
        update_data_product,
        update_source,
    )
else:
    from .in_memory import (
        catalog_search,
        create_cdc_task,
        create_data_product,
        create_lineage_edge,
        create_quality_rule,
        create_source,
        delete_cdc_task,
        delete_data_product,
        delete_source,
        get_cdc_task,
        get_data_product,
        get_source,
        lineage_graph,
        list_cdc_tasks,
        list_data_products,
        list_lineage_edges,
        list_quality_results,
        list_quality_rules,
        list_sources,
        run_quality_rules,
        set_cdc_task_status,
        set_data_product_status,
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
    "LineageEdge",
    "QualityResult",
    "QualityRule",
    "catalog_search",
    "create_cdc_task",
    "create_data_product",
    "create_lineage_edge",
    "create_quality_rule",
    "create_source",
    "data_product_to_dict",
    "delete_cdc_task",
    "delete_data_product",
    "delete_source",
    "get_cdc_task",
    "get_data_product",
    "get_source",
    "get_source_schema",
    "lineage_graph",
    "list_cdc_tasks",
    "list_data_products",
    "list_lineage_edges",
    "list_quality_results",
    "list_quality_rules",
    "list_sources",
    "reset_store",
    "run_quality_rules",
    "save_quality_results",
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
