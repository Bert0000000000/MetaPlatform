"""In-memory repository for the data platform control plane (P2-W6).

Data shape:
    _CDC_TASKS / _SOURCES:
        outer key = tenant_id (string)
        inner key = entity_id (string)
        value    = entity dataclass

The store is intentionally tenant-scoped: callers MUST pass the
tenant binding (`ctx.tenant_id`) and the lookup rejects entities
that don't belong to that tenant. This is the layer at which the
ADR-0014 cross-tenant rule is enforced.

Seed data:
    >= 3 data sources + >= 3 CDC tasks per tenant. Tests rely on
    these minima; bumping them is allowed but tests assert `>= N`
    rather than equality.

Both ``CdcTask`` and ``DataSource`` are mutable (not frozen) so
that update / status-patch operations can mutate fields in place.
"""
from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Any


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------
@dataclass
class CdcTask:
    """Mutable: pause/resume/update patch status / fields in place."""

    id: str
    tenant_id: str
    name: str
    source_id: str
    target_table: str
    status: str = "running"  # running | paused | stopped | failed
    config: dict[str, Any] = field(default_factory=dict)
    created_at: str = ""
    updated_at: str = ""


@dataclass
class DataSource:
    """Mutable: update patches connection_config / status in place."""

    id: str
    tenant_id: str
    name: str
    type: str  # mysql | postgres | kafka | mongodb | ...
    connection_config: dict[str, Any] = field(default_factory=dict)
    status: str = "connected"  # connected | disconnected | error
    created_at: str = ""
    updated_at: str = ""


@dataclass
class DataProduct:
    """Data Product (Iceberg ADS) entity — mutable.

    Lifecycle status: draft | published | certified | suspended.
    Modality: structured | embedding | chunk | mixed.
    ``version`` is bumped on publish to record lifecycle milestones;
    v1 keeps a single ``history`` entry for past versions (latest only).
    """

    id: str
    tenant_id: str
    name: str
    source_paimon_table: str
    target_iceberg_table: str
    version: int = 1
    modality: str = "structured"  # structured | embedding | chunk | mixed
    status: str = "draft"  # draft | published | certified | suspended
    owner: str = ""
    description: str = ""
    tags: list[str] = field(default_factory=list)
    history: list[dict[str, Any]] = field(default_factory=list)
    created_at: str = ""
    updated_at: str = ""


# Valid value sets — kept here so the router can reuse them when validating
# payloads. They are intentionally module-private dataclass attributes that
# match the constraints in the companion OpenAPI spec.
DATA_PRODUCT_MODALITIES: tuple[str, ...] = (
    "structured",
    "embedding",
    "chunk",
    "mixed",
)
DATA_PRODUCT_STATUSES: tuple[str, ...] = (
    "draft",
    "published",
    "certified",
    "suspended",
)


# ---------------------------------------------------------------------------
# Seed builders
# ---------------------------------------------------------------------------
def _seed_sources(tenant_id: str) -> dict[str, DataSource]:
    catalog: list[tuple[str, str, str]] = [
        ("src-mysql-orders", "MySQL Orders", "mysql"),
        ("src-postgres-users", "Postgres Users", "postgres"),
        ("src-kafka-events", "Kafka Events", "kafka"),
    ]
    now = _now()
    return {
        sid: DataSource(
            id=sid,
            tenant_id=tenant_id,
            name=name,
            type=typ,
            connection_config={"host": f"{typ}.example.com", "port": 3306},
            status="connected",
            created_at=now,
            updated_at=now,
        )
        for sid, name, typ in catalog
    }


def _seed_cdc_tasks(tenant_id: str) -> dict[str, CdcTask]:
    catalog: list[tuple[str, str, str, str]] = [
        ("cdc-orders-sync", "Orders Sync", "src-mysql-orders", "ods_orders"),
        ("cdc-users-sync", "Users Sync", "src-postgres-users", "ods_users"),
        ("cdc-events-stream", "Events Stream", "src-kafka-events", "ods_events"),
    ]
    now = _now()
    return {
        tid: CdcTask(
            id=tid,
            tenant_id=tenant_id,
            name=name,
            source_id=source_id,
            target_table=table,
            status="running",
            config={"mode": "incremental"},
            created_at=now,
            updated_at=now,
        )
        for tid, name, source_id, table in catalog
    }


def _seed_schemas(tenant_id: str) -> dict[str, dict[str, Any]]:
    """Per-source schema catalog used by GET /sources/{id}/schema."""
    return {
        "src-mysql-orders": {
            "source_id": "src-mysql-orders",
            "tables": [
                {
                    "name": "orders",
                    "columns": [
                        {"name": "id", "type": "bigint"},
                        {"name": "amount", "type": "decimal(12,2)"},
                        {"name": "created_at", "type": "datetime"},
                    ],
                },
                {
                    "name": "order_items",
                    "columns": [
                        {"name": "id", "type": "bigint"},
                        {"name": "order_id", "type": "bigint"},
                        {"name": "sku", "type": "varchar(64)"},
                    ],
                },
            ],
        },
        "src-postgres-users": {
            "source_id": "src-postgres-users",
            "tables": [
                {
                    "name": "users",
                    "columns": [
                        {"name": "id", "type": "bigint"},
                        {"name": "email", "type": "varchar(255)"},
                        {"name": "created_at", "type": "timestamp"},
                    ],
                },
            ],
        },
        "src-kafka-events": {
            "source_id": "src-kafka-events",
            "tables": [
                {
                    "name": "events",
                    "columns": [
                        {"name": "topic", "type": "string"},
                        {"name": "partition", "type": "int"},
                        {"name": "offset", "type": "long"},
                        {"name": "payload", "type": "bytes"},
                    ],
                },
            ],
        },
    }


def _seed_data_products(tenant_id: str) -> dict[str, DataProduct]:
    """Per-tenant data product seed catalog (>= 3 entries)."""
    catalog: list[tuple[str, str, str, str]] = [
        (
            "dp-orders-summary",
            "Orders Daily Summary",
            "paimon.ods.orders",
            "iceberg.ads.orders_summary",
        ),
        (
            "dp-user-profile",
            "User Profile",
            "paimon.ods.users",
            "iceberg.dim.user_profile",
        ),
        (
            "dp-events-stream",
            "Events Stream",
            "paimon.ods.events",
            "iceberg.ads.events_stream",
        ),
    ]
    now = _now()
    return {
        pid: DataProduct(
            id=pid,
            tenant_id=tenant_id,
            name=name,
            source_paimon_table=src,
            target_iceberg_table=tgt,
            modality="structured",
            status="published",
            owner=f"owner-{tenant_id}",
            description="Seeded data product.",
            tags=["seed"],
            history=[
                {"version": 1, "status": "draft", "at": now},
                {"version": 1, "status": "published", "at": now},
            ],
            created_at=now,
            updated_at=now,
        )
        for pid, name, src, tgt in catalog
    }


# ---------------------------------------------------------------------------
# Tenant-scoped stores
# ---------------------------------------------------------------------------
_CDC_TASKS: dict[str, dict[str, CdcTask]] = {}
_SOURCES: dict[str, dict[str, DataSource]] = {}
_SCHEMAS: dict[str, dict[str, dict[str, Any]]] = {}
_DATA_PRODUCTS: dict[str, dict[str, DataProduct]] = {}


def _ensure_tenant(tenant_id: str) -> None:
    """Idempotently seed the store for a given tenant."""
    if not tenant_id:
        return  # anonymous lookups return empty, see list_*() functions
    if tenant_id not in _SOURCES:
        _SOURCES[tenant_id] = _seed_sources(tenant_id)
    if tenant_id not in _CDC_TASKS:
        _CDC_TASKS[tenant_id] = _seed_cdc_tasks(tenant_id)
    if tenant_id not in _SCHEMAS:
        _SCHEMAS[tenant_id] = _seed_schemas(tenant_id)
    if tenant_id not in _DATA_PRODUCTS:
        _DATA_PRODUCTS[tenant_id] = _seed_data_products(tenant_id)
    _LINEAGE_EDGES.setdefault(tenant_id, {})
    _QUALITY_RULES.setdefault(tenant_id, {})
    _QUALITY_RESULTS.setdefault(tenant_id, [])


def _now() -> str:
    """UTC timestamp string (ISO-8601, seconds precision)."""
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


# ---------------------------------------------------------------------------
# Public read API — CDC tasks
# ---------------------------------------------------------------------------
def list_cdc_tasks(
    tenant_id: str, status: str | None = None,
) -> list[CdcTask]:
    """Return the CDC tasks for a tenant, optionally filtered by status."""
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    tasks = list(_CDC_TASKS[tenant_id].values())
    if status:
        tasks = [t for t in tasks if t.status == status]
    return sorted(tasks, key=lambda t: t.id)


def get_cdc_task(tenant_id: str, task_id: str) -> CdcTask | None:
    """Return a single CDC task by id, or None if not found."""
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _CDC_TASKS[tenant_id].get(task_id)


# ---------------------------------------------------------------------------
# Public read API — data sources
# ---------------------------------------------------------------------------
def list_sources(
    tenant_id: str, type_filter: str | None = None,
) -> list[DataSource]:
    """Return the data sources for a tenant, optionally filtered by type."""
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    sources = list(_SOURCES[tenant_id].values())
    if type_filter:
        sources = [s for s in sources if s.type == type_filter]
    return sorted(sources, key=lambda s: s.id)


def get_source(tenant_id: str, source_id: str) -> DataSource | None:
    """Return a single data source by id, or None if not found."""
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _SOURCES[tenant_id].get(source_id)


def get_source_schema(
    tenant_id: str, source_id: str,
) -> dict[str, Any] | None:
    """Return the discovered schema for a source, or None if not found."""
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _SCHEMAS[tenant_id].get(source_id)


def test_source_connection(
    tenant_id: str, source_id: str,
) -> dict[str, Any] | None:
    """Probe a source connection. Returns None if the source is unknown.

    The in-memory stub simulates a successful probe for connected
    sources and a failure for disconnected/error sources; the real
    CDC engine integration lands in a later batch.
    """
    source = get_source(tenant_id, source_id)
    if source is None:
        return None
    started = time.monotonic()
    latency_ms = int((time.monotonic() - started) * 1000) + 1
    ok = source.status == "connected"
    return {
        "source_id": source_id,
        "ok": ok,
        "latency_ms": latency_ms,
        "error": "" if ok else f"source status is {source.status}",
    }


# ---------------------------------------------------------------------------
# Public write API — CDC tasks
# ---------------------------------------------------------------------------
def create_cdc_task(
    tenant_id: str,
    name: str,
    source_id: str,
    target_table: str,
    config: dict[str, Any] | None = None,
) -> CdcTask:
    """Create a new CDC task and store it."""
    _ensure_tenant(tenant_id)
    task_id = f"cdc-{uuid.uuid4().hex[:8]}"
    now = _now()
    task = CdcTask(
        id=task_id,
        tenant_id=tenant_id,
        name=name,
        source_id=source_id,
        target_table=target_table,
        status="running",
        config=dict(config or {}),
        created_at=now,
        updated_at=now,
    )
    _CDC_TASKS[tenant_id][task_id] = task
    return task


def update_cdc_task(
    tenant_id: str,
    task_id: str,
    *,
    name: str | None = None,
    source_id: str | None = None,
    target_table: str | None = None,
    config: dict[str, Any] | None = None,
) -> CdcTask | None:
    """Patch mutable fields of an existing CDC task. Returns None if missing."""
    _ensure_tenant(tenant_id)
    task = _CDC_TASKS[tenant_id].get(task_id)
    if task is None:
        return None
    if name is not None:
        task.name = name
    if source_id is not None:
        task.source_id = source_id
    if target_table is not None:
        task.target_table = target_table
    if config is not None:
        task.config = dict(config)
    task.updated_at = _now()
    return task


def delete_cdc_task(tenant_id: str, task_id: str) -> bool:
    """Delete a CDC task. Returns True if removed, False if not found."""
    _ensure_tenant(tenant_id)
    return _CDC_TASKS[tenant_id].pop(task_id, None) is not None


def set_cdc_task_status(
    tenant_id: str, task_id: str, status: str,
) -> CdcTask | None:
    """Set the status of a CDC task (used by pause/resume). Returns None if missing."""
    _ensure_tenant(tenant_id)
    task = _CDC_TASKS[tenant_id].get(task_id)
    if task is None:
        return None
    task.status = status
    task.updated_at = _now()
    return task


# ---------------------------------------------------------------------------
# Public write API — data sources
# ---------------------------------------------------------------------------
def create_source(
    tenant_id: str,
    name: str,
    type: str,
    connection_config: dict[str, Any] | None = None,
) -> DataSource:
    """Create a new data source and store it."""
    _ensure_tenant(tenant_id)
    source_id = f"src-{uuid.uuid4().hex[:8]}"
    now = _now()
    source = DataSource(
        id=source_id,
        tenant_id=tenant_id,
        name=name,
        type=type,
        connection_config=dict(connection_config or {}),
        status="connected",
        created_at=now,
        updated_at=now,
    )
    _SOURCES[tenant_id][source_id] = source
    return source


def update_source(
    tenant_id: str,
    source_id: str,
    *,
    name: str | None = None,
    type: str | None = None,
    connection_config: dict[str, Any] | None = None,
) -> DataSource | None:
    """Patch mutable fields of an existing data source. Returns None if missing."""
    _ensure_tenant(tenant_id)
    source = _SOURCES[tenant_id].get(source_id)
    if source is None:
        return None
    if name is not None:
        source.name = name
    if type is not None:
        source.type = type
    if connection_config is not None:
        source.connection_config = dict(connection_config)
    source.updated_at = _now()
    return source


def delete_source(tenant_id: str, source_id: str) -> bool:
    """Delete a data source. Returns True if removed, False if not found."""
    _ensure_tenant(tenant_id)
    _SCHEMAS[tenant_id].pop(source_id, None)
    return _SOURCES[tenant_id].pop(source_id, None) is not None


# ---------------------------------------------------------------------------
# Public read API — Data Products
# ---------------------------------------------------------------------------
def list_data_products(
    tenant_id: str,
    status: str | None = None,
    modality: str | None = None,
) -> list[DataProduct]:
    """Return the DataProducts for a tenant, optionally filtered by status/modality."""
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    products = list(_DATA_PRODUCTS[tenant_id].values())
    if status:
        products = [p for p in products if p.status == status]
    if modality:
        products = [p for p in products if p.modality == modality]
    return sorted(products, key=lambda p: p.id)


def get_data_product(tenant_id: str, product_id: str) -> DataProduct | None:
    """Return a single DataProduct by id, or None if not found."""
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _DATA_PRODUCTS[tenant_id].get(product_id)


# ---------------------------------------------------------------------------
# Public write API — Data Products
# ---------------------------------------------------------------------------
def create_data_product(
    tenant_id: str,
    name: str,
    source_paimon_table: str,
    target_iceberg_table: str,
    *,
    modality: str = "structured",
    owner: str = "",
    description: str = "",
    tags: list[str] | None = None,
) -> DataProduct:
    """Create a new DataProduct and store it."""
    _ensure_tenant(tenant_id)
    product_id = f"dp-{uuid.uuid4().hex[:8]}"
    now = _now()
    normalised_modality = modality if modality in DATA_PRODUCT_MODALITIES else "structured"
    product = DataProduct(
        id=product_id,
        tenant_id=tenant_id,
        name=name,
        source_paimon_table=source_paimon_table,
        target_iceberg_table=target_iceberg_table,
        version=1,
        modality=normalised_modality,
        status="draft",
        owner=owner,
        description=description,
        tags=list(tags or []),
        history=[{"version": 1, "status": "draft", "at": now}],
        created_at=now,
        updated_at=now,
    )
    _DATA_PRODUCTS[tenant_id][product_id] = product
    return product


def update_data_product(
    tenant_id: str,
    product_id: str,
    **fields: Any,
) -> DataProduct | None:
    """Patch mutable fields of an existing DataProduct. Returns None if missing.

    Allowed patch fields: ``name``, ``source_paimon_table``, ``target_iceberg_table``,
    ``modality``, ``owner``, ``description``, ``tags``. Lifecycle state
    (``status``, ``version``) is governed by the explicit transition handlers
    (``set_data_product_status``) and cannot be patched through this entry.
    """
    _ensure_tenant(tenant_id)
    product = _DATA_PRODUCTS[tenant_id].get(product_id)
    if product is None:
        return None
    mutable_fields = {
        "name",
        "source_paimon_table",
        "target_iceberg_table",
        "modality",
        "owner",
        "description",
        "tags",
    }
    for key, value in fields.items():
        if key not in mutable_fields:
            continue
        if key == "modality" and value not in DATA_PRODUCT_MODALITIES:
            continue  # ignore unsupported modality; keep prior value
        if key == "tags" and value is not None:
            product.tags = list(value)
            continue
        setattr(product, key, value)
    product.updated_at = _now()
    return product


def delete_data_product(tenant_id: str, product_id: str) -> bool:
    """Delete a DataProduct. Returns True if removed, False if not found."""
    _ensure_tenant(tenant_id)
    return _DATA_PRODUCTS[tenant_id].pop(product_id, None) is not None


def set_data_product_status(
    tenant_id: str, product_id: str, status: str,
    *,
    bump_version: bool = False,
    require_owner: bool = False,
) -> DataProduct | None:
    """Transition a DataProduct's lifecycle status.

    - ``bump_version=True`` increments ``version`` (used by /publish).
    - ``require_owner=True`` rejects the transition when ``owner`` is empty
      (used by /certify).
    Returns None if the product is missing or constraints fail.
    """
    _ensure_tenant(tenant_id)
    product = _DATA_PRODUCTS[tenant_id].get(product_id)
    if product is None:
        return None
    if status not in DATA_PRODUCT_STATUSES:
        return None
    if require_owner and not product.owner:
        return None
    now = _now()
    if bump_version:
        product.version += 1
    product.status = status
    product.history.append({"version": product.version, "status": status, "at": now})
    product.updated_at = now
    return product


# ---------------------------------------------------------------------------
# Serialization helper
# ---------------------------------------------------------------------------
def task_to_dict(task: CdcTask) -> dict[str, Any]:
    """Serialize a CdcTask to a JSON-friendly dict."""
    return {
        "id": task.id,
        "tenant_id": task.tenant_id,
        "name": task.name,
        "source_id": task.source_id,
        "target_table": task.target_table,
        "status": task.status,
        "config": dict(task.config),
        "created_at": task.created_at,
        "updated_at": task.updated_at,
    }


def source_to_dict(source: DataSource) -> dict[str, Any]:
    """Serialize a DataSource to a JSON-friendly dict."""
    return {
        "id": source.id,
        "tenant_id": source.tenant_id,
        "name": source.name,
        "type": source.type,
        "connection_config": dict(source.connection_config),
        "status": source.status,
        "created_at": source.created_at,
        "updated_at": source.updated_at,
    }


def data_product_to_dict(product: DataProduct) -> dict[str, Any]:
    """Serialize a DataProduct to a JSON-friendly dict."""
    return {
        "id": product.id,
        "tenant_id": product.tenant_id,
        "name": product.name,
        "version": product.version,
        "source_paimon_table": product.source_paimon_table,
        "target_iceberg_table": product.target_iceberg_table,
        "modality": product.modality,
        "status": product.status,
        "owner": product.owner,
        "description": product.description,
        "tags": list(product.tags),
        "history": [dict(entry) for entry in product.history],
        "created_at": product.created_at,
        "updated_at": product.updated_at,
    }


# ---------------------------------------------------------------------------
# Test helpers — DO NOT call from production code paths
# ---------------------------------------------------------------------------
def reset_store() -> None:
    """Drop all seeded data. Used by tests to keep cases isolated."""
    _CDC_TASKS.clear()
    _SOURCES.clear()
    _SCHEMAS.clear()
    _DATA_PRODUCTS.clear()
    _LINEAGE_EDGES.clear()
    _QUALITY_RULES.clear()
    _QUALITY_RESULTS.clear()


# ---------------------------------------------------------------------------
# DATA-D6/D7 — lineage / quality / catalog（治理面）
# ---------------------------------------------------------------------------
@dataclass
class LineageEdge:
    """实体依赖边：source_entity --edge_type--> target_entity。"""

    id: str
    tenant_id: str
    source_entity: str
    target_entity: str
    edge_type: str = "derived_from"  # derived_from | copies | feeds
    created_at: str = ""


@dataclass
class QualityRule:
    """对 source schema 的字段级断言：required（列存在）/ type（类型匹配）。"""

    id: str
    tenant_id: str
    entity_id: str  # source id
    field: str  # column name
    rule_type: str = "required"  # required | type
    params: dict[str, Any] = field(default_factory=dict)  # {"table": ..., "type": ...}
    enabled: bool = True
    created_at: str = ""


@dataclass
class QualityResult:
    """单条规则一次执行的结果。"""

    id: str
    tenant_id: str
    rule_id: str
    entity_id: str
    field: str
    rule_type: str
    passed: bool
    detail: str = ""
    ran_at: str = ""


_LINEAGE_EDGES: dict[str, dict[str, LineageEdge]] = {}
_QUALITY_RULES: dict[str, dict[str, QualityRule]] = {}
_QUALITY_RESULTS: dict[str, list[QualityResult]] = {}


def create_lineage_edge(
    tenant_id: str, source_entity: str, target_entity: str,
    edge_type: str = "derived_from",
) -> LineageEdge:
    _ensure_tenant(tenant_id)
    edge = LineageEdge(
        id=f"lnge-{uuid.uuid4().hex[:8]}",
        tenant_id=tenant_id,
        source_entity=source_entity,
        target_entity=target_entity,
        edge_type=edge_type,
        created_at=_now(),
    )
    _LINEAGE_EDGES[tenant_id][edge.id] = edge
    return edge


def list_lineage_edges(tenant_id: str) -> list[LineageEdge]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return list(_LINEAGE_EDGES[tenant_id].values())


def lineage_graph(tenant_id: str, entity: str | None = None) -> dict[str, Any]:
    """返回 {nodes, edges} 依赖图；entity 给定时只保留与该实体相连的子图。"""
    edges = list_lineage_edges(tenant_id)
    if entity:
        edges = [e for e in edges
                 if e.source_entity == entity or e.target_entity == entity]
    nodes: dict[str, None] = {}
    for e in edges:
        nodes[e.source_entity] = None
        nodes[e.target_entity] = None
    return {
        "nodes": [{"id": n} for n in sorted(nodes)],
        "edges": [
            {"source": e.source_entity, "target": e.target_entity,
             "edge_type": e.edge_type, "id": e.id}
            for e in edges
        ],
    }


def create_quality_rule(
    tenant_id: str, entity_id: str, field: str, rule_type: str,
    params: dict[str, Any] | None = None,
) -> QualityRule:
    _ensure_tenant(tenant_id)
    rule = QualityRule(
        id=f"dqr-{uuid.uuid4().hex[:8]}",
        tenant_id=tenant_id,
        entity_id=entity_id,
        field=field,
        rule_type=rule_type,
        params=dict(params or {}),
        created_at=_now(),
    )
    _QUALITY_RULES[tenant_id][rule.id] = rule
    return rule


def list_quality_rules(
    tenant_id: str, entity_id: str | None = None, enabled_only: bool = False,
) -> list[QualityRule]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    rules = list(_QUALITY_RULES[tenant_id].values())
    if entity_id:
        rules = [r for r in rules if r.entity_id == entity_id]
    if enabled_only:
        rules = [r for r in rules if r.enabled]
    return rules


def _quality_check(rule: QualityRule, schema: dict[str, Any] | None) -> QualityResult:
    """对 source schema 执行一条规则（required 列存在 / type 类型匹配）。"""
    detail = ""
    passed = False
    if schema is None:
        detail = "source schema not found"
    else:
        table_name = str(rule.params.get("table", ""))
        table = next((t for t in schema.get("tables", [])
                      if t.get("name") == table_name), None) if table_name else None
        columns: dict[str, str] = {}
        if table is not None:
            columns = {c.get("name", ""): c.get("type", "")
                       for c in table.get("columns", [])}
        if table_name and table is None:
            detail = f"table {table_name!r} not found in schema"
        elif rule.field not in columns:
            detail = f"column {rule.field!r} not found"
        elif rule.rule_type == "type":
            expect = str(rule.params.get("type", ""))
            actual = columns[rule.field]
            passed = actual == expect
            detail = f"expects type {expect!r}, found {actual!r}"
        else:  # required
            passed = True
            detail = f"column {rule.field!r} present (type {columns[rule.field]!r})"
    return QualityResult(
        id=f"dqr-res-{uuid.uuid4().hex[:8]}",
        tenant_id=rule.tenant_id,
        rule_id=rule.id,
        entity_id=rule.entity_id,
        field=rule.field,
        rule_type=rule.rule_type,
        passed=passed,
        detail=detail,
        ran_at=_now(),
    )


def run_quality_rules(tenant_id: str) -> dict[str, Any]:
    """执行本租户全部 enabled 规则（对 source schema），结果持久化。"""
    rules = list_quality_rules(tenant_id, enabled_only=True)
    results: list[QualityResult] = []
    for rule in rules:
        schema = get_source_schema(tenant_id, rule.entity_id)
        result = _quality_check(rule, schema)
        results.append(result)
    _QUALITY_RESULTS.setdefault(tenant_id, []).extend(results)
    return {
        "rules_executed": len(rules),
        "passed": sum(1 for r in results if r.passed),
        "failed": sum(1 for r in results if not r.passed),
        "results": results,
    }


def list_quality_results(tenant_id: str, limit: int = 50) -> list[QualityResult]:
    if not tenant_id:
        return []
    return list(reversed(_QUALITY_RESULTS.get(tenant_id, [])))[:limit]


def catalog_search(tenant_id: str, q: str) -> list[dict[str, Any]]:
    """跨 sources + data products 的名称/描述检索（catalog 面）。"""
    q_lower = (q or "").lower()
    items: list[dict[str, Any]] = []
    for s in list_sources(tenant_id):
        hay = f"{s.name} {s.type}".lower()
        if q_lower in hay:
            items.append({"kind": "source", "id": s.id, "name": s.name,
                          "detail": s.type})
    for p in list_data_products(tenant_id):
        hay = f"{p.name} {p.description} {p.modality}".lower()
        if q_lower in hay:
            items.append({"kind": "product", "id": p.id, "name": p.name,
                          "detail": p.modality, "status": p.status})
    return items
