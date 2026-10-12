"""Repository selection for the data platform control plane.

Default: in-memory (dev / test). When ``MATE_DB_URL`` or ``DATABASE_URL`` is
set, prefer the SQL-backed ``sql_store`` so CDC tasks / data sources / data
products persist in PostgreSQL. Probe/schema resolve the selected store record
and call the real connector. Shared serializers redact server-only credentials.
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
    reset_store,
    source_to_dict,
    task_to_dict,
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


def get_source_schema(tenant_id: str, source_id: str):
    from ..services.source_connector import discover

    source = get_source(tenant_id, source_id)
    return discover(source) if source is not None else None


def test_source_connection(tenant_id: str, source_id: str):
    from ..services.source_connector import probe

    source = get_source(tenant_id, source_id)
    return probe(source) if source is not None else None
