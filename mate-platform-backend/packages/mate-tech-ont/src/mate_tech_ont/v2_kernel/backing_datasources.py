"""DATA-14/15 + CDC 腿：数据平面绑定 —— backing datasources + 索引管道 + materialization。

Palantir 语义（调研材料 06 §5 / 00 §L0）：
- ObjectType 由 datasets/streams **索引**成对象（Funnel）；本体坐在数据平面之上；
- MDO：一个类型多个数据源拼接，字段级优先级合并；
- materialization：对象最新状态回流数据平面供下游管道消费；
- 双流合并：管道数据 + 用户编辑（user edits）合并为最新表示。

Mate v1（D1 拍板全量纳入）：
- ``BackingDatasource``：{name, kind: pg_table, dsn_env, table, pk_column,
  field_mapping: prop_rid → 列名, priority}；
- ``sync_backing_datasource``：**keyset 分页**读源表 → 按 mapping 写 Individual
  （多源按 priority 升序，字段级：低优先级**永不**覆盖高优先级已写字段）；
- ``apply_cdc_changes``：debezium / mate-tech-etl 变更事件 → 对象平面；
- ``materialize_object_type``：对象当前状态导出为行集（回流读端点形态）。

一致性契约（DATA-SYNC-INTEGRITY）：
1. **不漏行**：分页读到源穷尽（keyset，按 pk 或 (ts,pk)），不是单批 LIMIT。
2. **不丢更新**：游标只推进到**已可靠处理的源端边界**（(ts,pk)），绝不写成目标端
   ``now()``；同时间戳靠 pk 决胜；同步期间新增（ts > 边界）下一轮自然读到。
3. **不静默失败**：单行失败登记并**停止推进游标**（下一轮重读 = 自动重试），
   返回结构带 ``failed``；调用方不得据此报整体成功。
4. **字段优先级跨批次**：按 (source, priority) 记录字段归属（``props_src``），
   低优先级增量不覆盖高优先级；同源/同级可覆盖（重跑幂等）。
5. **字段语义**：列**缺失**（不在行内）→ 保持原值；**显式 NULL** → 清空（受优先级
   约束）；CDC ``op=delete`` / 全量 tombstone → 删实例；用户编辑覆盖层 → 管道不写。

v1 边界：定时调度挂 Scheduler；debezium engine 的事件订阅接线在
mate-tech-etl 侧（本模块提供无状态入口）。
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import UTC, datetime
from typing import Any

import structlog

from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.instances.individual import Individual

logger = structlog.get_logger(__name__)

__all__ = [
    "BackingDatasource",
    "apply_cdc_changes",
    "materialize_object_type",
    "sync_backing_datasource",
]


class BackingSyncBusyError(ValueError):
    """A mapping cannot change while its object type is synchronizing."""


@dataclass(frozen=True, slots=True)
class BackingDatasource:
    """对象类型的背挂数据源（v1: 同实例 PG 表）。"""

    name: str
    kind: str = "pg_table"  # v1 仅 pg_table（csv/cdc 走 apply_cdc_changes）
    dsn_env: str = "ONT_SOURCE_DSN"  # 源库 DSN 环境变量名（secret 不进 git）
    table: str = ""
    pk_column: str = ""
    field_mapping: dict[str, str] = field(default_factory=dict)  # prop_rid → 列
    source_id: str | None = None
    tenant_id: str = ""
    ts_column: str | None = None
    priority: int = 100  # 小 = 优先（MDO 字段合并序）
    source_snapshot: Any = field(default=None, repr=False, compare=False)
    connection_dsn: str | None = field(default=None, repr=False, compare=False)
    resolved_table: tuple[str, str] | None = field(default=None, repr=False, compare=False)

    def __post_init__(self) -> None:
        if self.kind not in {"pg_table", "csv"}:
            raise ValueError(f"BackingDatasource.kind v1 supports pg_table only: {self.kind!r}")
        if not self.table or not self.pk_column:
            raise ValueError("BackingDatasource requires table + pk_column")
        if not self.field_mapping:
            raise ValueError("BackingDatasource requires field_mapping (non-empty)")


def _connect_source(ds: BackingDatasource) -> Any:
    import os

    import psycopg2

    if ds.source_id:
        from mate_tech_data.services.source_connector import connect_postgres

        return connect_postgres(_registered_source(ds))
    dsn = ds.connection_dsn if ds.connection_dsn is not None else os.environ.get(ds.dsn_env, "")
    if not dsn:
        raise ValueError(f"env {ds.dsn_env} not set (backing datasource {ds.name})")
    return psycopg2.connect(dsn)


def _registered_source(ds: BackingDatasource):
    from mate_tech_data.repositories import get_source
    from mate_tech_data.services.source_connector import SourceError

    if not ds.tenant_id:
        raise SourceError(
            "PERMISSION", "A verified tenant is required to resolve a registered source"
        )
    source = (
        ds.source_snapshot
        if ds.source_snapshot is not None
        else get_source(ds.tenant_id, ds.source_id)
    )
    if source is None:
        raise SourceError("PERMISSION", "Registered source is unavailable in this tenant")
    expected = {"csv"} if ds.kind == "csv" else {"postgres", "postgresql", "pg_table"}
    if source.type.lower() not in expected:
        raise SourceError("SCHEMA", "Registered source type does not match mapping kind")
    return source


def _relation_parts(ds: BackingDatasource) -> tuple[str, ...]:
    from mate_tech_data.services.source_connector import SourceError

    if ds.resolved_table:
        return ds.resolved_table
    if ds.source_id:
        schema = _registered_source(ds).connection_config.get("schema") or "public"
        prefix = schema + "."
        if not ds.table.startswith(prefix) or not ds.table[len(prefix) :]:
            raise SourceError(
                "SCHEMA", "PostgreSQL table must be schema-qualified in the configured schema"
            )
        # The discovered name can itself contain dots; never split that identifier.
        return schema, ds.table[len(prefix) :]
    return tuple(ds.table.split("."))


def snapshot_source(ds: BackingDatasource) -> BackingDatasource:
    """Pin server-only configuration once for preflight and every read in this run."""
    import copy
    import os

    if ds.source_id:
        if ds.source_snapshot is None:
            return replace(ds, source_snapshot=copy.deepcopy(_registered_source(ds)))
        return ds
    if ds.connection_dsn is None:
        return replace(ds, connection_dsn=os.environ.get(ds.dsn_env, ""))
    return ds


def prepare_checkpoint_source(
    ds: BackingDatasource, *, time_column: str | None = None
) -> tuple[BackingDatasource, str | None]:
    """Resolve an exact relation and fingerprint non-secret effective dataset identity."""
    import hashlib
    import json

    from mate_tech_data.services.source_connector import SourceError
    from psycopg2 import sql

    ds = snapshot_source(ds)
    if ds.kind == "csv":
        return ds, None  # CSV has no persistent incremental checkpoint.
    conn = _connect_source(ds)
    try:
        parts = _relation_parts(ds)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT current_database(), current_user, n.nspname, c.relname, c.oid::text "
                "FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace "
                "WHERE c.oid=to_regclass(%s)",
                (sql.Identifier(*parts).as_string(conn),),
            )
            relation = cur.fetchone()
            if relation is None:
                raise SourceError("SCHEMA", "Mapped source relation does not exist")
        params = conn.get_dsn_parameters()
        identity = {
            # Exclude credentials, display names, SSL credentials and raw DSNs.
            "endpoint": {k: params.get(k) for k in ("host", "hostaddr", "port")},
            "relation": list(relation),
            "kind": ds.kind,
            "pk": ds.pk_column,
            "time": time_column if time_column is not None else ds.ts_column,
            "mapping": ds.field_mapping,
        }
        digest = hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()
        return replace(ds, resolved_table=(relation[2], relation[3])), digest
    finally:
        conn.close()


def current_checkpoint_identity(
    ds: BackingDatasource, *, time_column: str | None = None
) -> str | None:
    return prepare_checkpoint_source(
        replace(ds, source_snapshot=None, connection_dsn=None, resolved_table=None),
        time_column=time_column,
    )[1]


def preflight(ds: BackingDatasource, ot: Any | None = None) -> dict:
    """Validate actual columns before mapping or writing; never return sample fields."""
    from mate_tech_data.services.source_connector import SourceError, discover

    if ds.kind == "pg_table":
        _relation_parts(ds)
    schema = discover(_registered_source(ds))
    table = next(
        (
            t
            for t in schema["tables"]
            if ds.table == (f"{t['schema']}.{t['name']}" if ds.kind == "pg_table" else t["name"])
        ),
        None,
    )
    if table is None:
        raise SourceError("SCHEMA", "Mapped table is not present in discovered schema")
    columns = {c["name"]: c for c in table["columns"]}
    required = {ds.pk_column, *ds.field_mapping.values()}
    if ds.ts_column:
        required.add(ds.ts_column)
    missing = sorted(required - columns.keys())
    if missing:
        raise SourceError("SCHEMA", "Unknown source columns: " + ", ".join(missing))
    if ds.kind == "pg_table":
        keys = [c["name"] for c in table["columns"] if c.get("primary_key")]
        if keys != [ds.pk_column]:
            raise SourceError(
                "SCHEMA",
                "Select the table's single stable primary key; composite keys are unsupported",
            )
        if ds.ts_column and (
            columns[ds.ts_column].get("nullable")
            or not columns[ds.ts_column]["type"].startswith("timestamp")
        ):
            raise SourceError("SCHEMA", "Incremental time column must be a non-null timestamp")
    if ot is not None:
        properties = {p.rid.rid: p for p in ot.properties}
        unknown = sorted(set(ds.field_mapping) - properties.keys())
        if unknown:
            raise SourceError("SCHEMA", "Unknown target properties: " + ", ".join(unknown))
        for prop in ot.properties:
            key = prop.rid.rid
            if not prop.nullable and key not in ds.field_mapping:
                raise SourceError("SCHEMA", f"Required property is unmapped: {key}")
            if key in ds.field_mapping and ds.kind == "pg_table":
                col = columns[ds.field_mapping[key]]
                if not prop.nullable and col.get("nullable"):
                    raise SourceError(
                        "SCHEMA", f"Nullable source cannot map to required property: {key}"
                    )
                target = str(prop.type_id).lower()
                src = col["type"].lower()
                if target in {"integer", "int", "number", "float", "decimal", "double"} and not any(
                    t in src for t in ("int", "numeric", "decimal", "real", "double")
                ):
                    raise SourceError("SCHEMA", f"Type conflict for property: {key}")
        if any(ds.field_mapping.get(key.rid) != ds.pk_column for key in ot.primary_key):
            raise SourceError(
                "SCHEMA", "Map the object primary key to the stable source primary key"
            )
    if ot is not None and ds.kind == "csv":
        _prepare_csv_rows(ot, ds)
    return schema


def _prepare_csv_rows(ot, ds):
    from mate_tech_data.services.source_connector import SourceError, csv_rows

    _, rows = csv_rows(_registered_source(ds))
    properties = {p.rid.rid: p for p in ot.properties}
    primary = [p for p in ot.properties if p.primary_key]
    if len(primary) != 1:
        raise SourceError("SCHEMA", "CSV requires one target primary key")
    # Convert each column once. The primary-key property's type defines target identity.
    conversions = {column: properties[key] for key, column in ds.field_mapping.items()}
    conversions[ds.pk_column] = primary[0]
    keys: set[str] = set()
    for row in rows:
        for column, prop in conversions.items():
            key = prop.rid.rid
            value = row[column]
            try:
                if value == "":
                    if not prop.nullable:
                        raise ValueError()
                    row[column] = None
                elif str(prop.type_id).lower() in {"integer", "int"}:
                    row[column] = int(value)
                elif str(prop.type_id).lower() in {"number", "float", "decimal", "double"}:
                    row[column] = float(value)
            except ValueError:
                raise SourceError("SCHEMA", f"CSV value conflicts with property: {key}") from None
        canonical = str(row[ds.pk_column]) if row[ds.pk_column] is not None else ""
        if not canonical.strip() or canonical in keys:
            raise SourceError(
                "SCHEMA", "CSV primary keys must be nonblank and unique after normalization"
            )
        keys.add(canonical)
    return rows


def _csv_batch(repo, ot, ds, overlay):
    rows = _prepare_csv_rows(ot, ds)
    result = apply_cdc_changes(
        repo,
        ot,
        [
            {
                "op": "upsert",
                "pk": row[ds.pk_column],
                "data": row,
                "source": ds.name,
                "priority": ds.priority,
            }
            for row in rows
        ],
        pk_column=ds.pk_column,
        field_mapping=ds.field_mapping,
        overlay_props=overlay,
        default_priority=ds.priority,
    )
    return {
        "synced": result["upserted"],
        "failed": result["failed"],
        "deleted": result["deleted"],
        "failures": result["failures"],
        "cursor": {"ts": None, "pk": None},
        "mode": "csv_batch",
    }


def _split_rid(ot: Any) -> tuple[str, str]:
    rid_parts = ot.rid.rid.split(".")
    tenant = rid_parts[1]
    cls_slug = rid_parts[4] if len(rid_parts) >= 6 else rid_parts[3]
    return tenant, cls_slug


def sync_backing_datasource(
    repo: Any,
    ot: Any,
    sources: list[BackingDatasource] | None = None,
    *,
    batch_limit: int = 5000,
    incremental: bool = False,
    overlay_props: dict[str, set[str]] | None = None,
    cursors: dict[str, dict[str, Any]] | None = None,
    ts_columns: dict[str, str] | None = None,
    watermarks: dict[str, str | None] | None = None,
    delete_missing: bool = False,
) -> dict[str, dict[str, Any]]:
    """批量/增量索引：源表 → Individual（MDO 字段级优先级合并）。

    keyset 分页（不漏行）+ 源端游标（不丢更新）+ 失败登记（不静默）：
    见模块 docstring §1–5。

    ``cursors``: ``{source_name: {"ts": iso|None, "pk": str|None}}`` —— 只推进到
    已可靠处理的源端边界。``watermarks`` 为旧签名别名（等价 ``{"ts": wm}``）。

    返回 ``{source_name: {synced, failed, deleted, failures[], cursor}}``；
    ``cursor`` 是该源**已可靠处理**的新边界（失败则不越过失败点）。
    """
    if sources is None:
        raw = getattr(ot, "backing_datasources", None) or []
        sources = [BackingDatasource(**dict(s)) for s in raw]
    if not sources:
        raise ValueError(f"no backing datasources declared on {ot.rid.rid}")
    tenant, cls_slug = _split_rid(ot)
    now = datetime.now(UTC)
    overlay = overlay_props or {}
    ts_columns = ts_columns or {}
    cursors = dict(cursors or {})
    for name, wm in (watermarks or {}).items():
        cursors.setdefault(name, {"ts": wm, "pk": None})

    out: dict[str, dict[str, Any]] = {}
    ordered = sorted((snapshot_source(ds) for ds in sources), key=lambda s: s.priority)
    for ds in ordered:
        if ds.source_id:
            if incremental and not ds.ts_column and ds.kind == "pg_table":
                raise ValueError("Incremental sync requires a configured non-null timestamp column")
            preflight(ds, ot)
    for ds in ordered:
        if ds.kind == "csv":
            if incremental or delete_missing:
                raise ValueError(
                    "CSV supports explicit batch upsert only; incremental/delete-missing is unavailable"
                )
            out[ds.name] = _csv_batch(repo, ot, ds, overlay)
            continue
        out[ds.name] = _sync_one_source(
            repo,
            ot,
            ds,
            tenant=tenant,
            cls_slug=cls_slug,
            batch_limit=batch_limit,
            incremental=incremental,
            overlay=overlay,
            cursor=dict(cursors.get(ds.name) or {}),
            ts_column=ds.ts_column or ts_columns.get(ds.name) or "updated_at",
            now=now,
            delete_missing=delete_missing and ds is ordered[0],
        )
    return out


def _sync_one_source(
    repo: Any,
    ot: Any,
    ds: BackingDatasource,
    *,
    tenant: str,
    cls_slug: str,
    batch_limit: int,
    incremental: bool,
    overlay: dict[str, set[str]],
    cursor: dict[str, Any],
    ts_column: str,
    now: datetime,
    delete_missing: bool,
) -> dict[str, Any]:
    import psycopg2.extras

    pk_col = ds.pk_column
    # 全量同步从头读（不受既有增量游标影响）；增量才从已处理边界续读
    done_ts = cursor.get("ts") if incremental else None
    done_pk = (cursor.get("pk") or "") if incremental else ""
    synced = failed = deleted = 0
    failures: list[dict[str, Any]] = []
    seen_pks: set[str] = set()
    boundary_ts = done_ts
    boundary_pk = cursor.get("pk")

    conn = None
    try:
        conn = _connect_source(ds)
        while True:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                from psycopg2 import sql

                table_ident = sql.Identifier(*_relation_parts(ds))
                pk_ident = sql.Identifier(pk_col)
                ts_ident = sql.Identifier(ts_column)
                if ds.ts_column:
                    if done_ts is not None:
                        cur.execute(
                            sql.SQL(
                                "SELECT * FROM {} WHERE ({},{}) > (%s,%s) ORDER BY {},{} LIMIT %s"
                            ).format(table_ident, ts_ident, pk_ident, ts_ident, pk_ident),
                            (done_ts, done_pk, batch_limit),
                        )
                    else:
                        cur.execute(
                            sql.SQL("SELECT * FROM {} ORDER BY {},{} LIMIT %s").format(
                                table_ident, ts_ident, pk_ident
                            ),
                            (batch_limit,),
                        )
                elif incremental and done_ts is not None:
                    cur.execute(
                        sql.SQL(
                            "SELECT * FROM {} WHERE ({},{}) > (%s,%s) ORDER BY {},{} LIMIT %s"
                        ).format(table_ident, ts_ident, pk_ident, ts_ident, pk_ident),
                        (done_ts, done_pk, batch_limit),
                    )
                elif done_pk != "":
                    cur.execute(
                        sql.SQL("SELECT * FROM {} WHERE {} > %s ORDER BY {} LIMIT %s").format(
                            table_ident, pk_ident, pk_ident
                        ),
                        (done_pk, batch_limit),
                    )
                else:
                    cur.execute(
                        sql.SQL("SELECT * FROM {} ORDER BY {} LIMIT %s").format(
                            table_ident, pk_ident
                        ),
                        (batch_limit,),
                    )
                rows = cur.fetchall()
            if not rows:
                break
            stop = False
            for start in range(0, len(rows), _FLUSH_CHUNK):
                chunk = rows[start : start + _FLUSH_CHUNK]
                res = _apply_chunk(
                    repo,
                    ot,
                    ds,
                    chunk,
                    tenant=tenant,
                    cls_slug=cls_slug,
                    overlay=overlay,
                    now=now,
                    ts_column=ts_column,
                )
                synced += res["synced"]
                seen_pks.update(res["seen"])
                if res["failures"]:
                    failed += len(res["failures"])
                    failures.extend(res["failures"])
                if res["boundary"] is not None:
                    b_ts, b_pk = res["boundary"]
                    if b_ts is not None:
                        boundary_ts = b_ts
                    boundary_pk = b_pk
                    done_ts, done_pk = boundary_ts, boundary_pk
                if res["stopped"]:
                    stop = True
                    break
            if stop or len(rows) < batch_limit:
                break
        if delete_missing and not failed:
            deleted = _delete_absent(repo, ot, tenant, cls_slug, seen_pks)
    except Exception as exc:
        from mate_tech_data.services.source_connector import safe_error

        error = safe_error(exc)
        failed += 1
        failures.append(
            {
                "pk": boundary_pk,
                "stage": "source_read",
                "error": str(error),
                "error_code": error.code,
                "trace_id": error.trace_id,
            }
        )
    finally:
        if conn is not None:
            conn.close()

    return {
        "synced": synced,
        "failed": failed,
        "deleted": deleted,
        "failures": failures,
        "cursor": {"ts": boundary_ts, "pk": boundary_pk},
    }


_FLUSH_CHUNK = 250


def _row_values(
    ds: BackingDatasource, row: Any, overlay: dict[str, set[str]], rid: str
) -> dict[str, Any]:
    """字段语义（模块 docstring §5）：覆盖层不写、列缺失保持、显式 NULL 带入。"""
    user_edited = overlay.get(rid, set())
    values: dict[str, Any] = {}
    for prop_rid, column in ds.field_mapping.items():
        if prop_rid in user_edited:
            continue
        if column not in row:
            continue
        values[prop_rid] = row[column]
    return values


def _apply_chunk(
    repo: Any,
    ot: Any,
    ds: BackingDatasource,
    chunk: list[Any],
    *,
    tenant: str,
    cls_slug: str,
    overlay: dict[str, set[str]],
    now: datetime,
    ts_column: str,
) -> dict[str, Any]:
    """写一批行。批量失败则降级逐行以**定位失败行**；失败即停止推进（可重试）。"""
    items: list[dict[str, Any]] = []
    for row in chunk:
        pk = str(row[ds.pk_column])
        rid = f"ont.{tenant}.ind.{cls_slug}.{pk}"
        items.append(
            {
                "pk": pk,
                "rid": rid,
                "ts": row.get(ts_column),
                "values": _row_values(ds, row, overlay, rid),
            }
        )

    batch = getattr(repo, "upsert_sourced_props_batch", None)
    if batch is not None and len(items) > 1:
        try:
            batch(
                [
                    {"rid": it["rid"], "primary_key": it["pk"], "values": it["values"]}
                    for it in items
                ],
                tenant_id=tenant,
                class_rid=ot.rid,
                source=ds.name,
                priority=ds.priority,
                ts=now,
            )
            last = items[-1]
            return {
                "synced": len(items),
                "seen": {it["pk"] for it in items},
                "failures": [],
                "stopped": False,
                "boundary": (last["ts"], last["pk"]),
            }
        except Exception as e:
            # 批量失败不静默：记日志后可逐行隔离（定位是哪个 pk 写失败）
            logger.warning(
                "sync.batch_write_failed_fallback_row",
                source=ds.name,
                table=ds.table,
                rows=len(items),
                error=str(e)[:200],
            )

    synced = 0
    seen: set[str] = set()
    failures: list[dict[str, Any]] = []
    boundary: tuple[Any, str] | None = None
    for it in items:
        try:
            if it["values"]:
                _write_row(repo, ot, ds, tenant=tenant, it=it, now=now)
        except Exception as e:
            failures.append({"pk": it["pk"], "error": f"{type(e).__name__}: {e}"[:200]})
            return {
                "synced": synced,
                "seen": seen,
                "failures": failures,
                "stopped": True,
                "boundary": boundary,
            }
        synced += 1
        seen.add(it["pk"])
        boundary = (it["ts"], it["pk"])
    return {"synced": synced, "seen": seen, "failures": [], "stopped": False, "boundary": boundary}


def _write_row(
    repo: Any, ot: Any, ds: BackingDatasource, *, tenant: str, it: dict[str, Any], now: datetime
) -> None:
    upsert = getattr(repo, "upsert_sourced_props", None)
    if upsert is not None:
        upsert(
            rid=it["rid"],
            tenant_id=tenant,
            class_rid=ot.rid,
            primary_key=it["pk"],
            values=it["values"],
            source=ds.name,
            priority=ds.priority,
            ts=now,
        )
        return
    # 兼容 duck-typed repo（无优先级归属列）：取非空值直接 upsert
    props = {k: v for k, v in it["values"].items() if v is not None}
    props.setdefault(ot.primary_key[0].rid, it["pk"])
    repo.create_individual(
        Individual(
            rid=it["rid"],
            class_rid=ot.rid,
            props=tuple((ClassRef(k), v) for k, v in props.items()),
            primary_key=it["pk"],
            created_at=now,
            updated_at=now,
            tenant_id=tenant,
        )
    )


def _delete_absent(repo: Any, ot: Any, tenant: str, cls_slug: str, seen: set[str]) -> int:
    """全量 tombstone：权威源中已不存在的实例删除（delete_missing=True 才启用）。"""
    try:
        current = repo.list_individuals(ot.rid, tenant_id=tenant)
    except TypeError:
        current = repo.list_individuals(ot.rid)
    deleted = 0
    for ind in current:
        if ind.primary_key not in seen:
            if repo.delete_individual(ind.rid):
                deleted += 1
    return deleted


def apply_cdc_changes(
    repo: Any,
    ot: Any,
    changes: list[dict[str, Any]],
    *,
    pk_column: str = "id",
    field_mapping: dict[str, str] | None = None,
    overlay_props: dict[str, set[str]] | None = None,
    default_priority: int = 100,
) -> dict[str, Any]:
    """CDC 流式绑定入口（debezium / mate-tech-etl 变更事件 → 对象平面）。

    changes 元素：``{op: "upsert"|"delete", pk: str, data?: {列: 值}}``。
    - upsert：按 field_mapping 落 props（缺列保持 / 显式 NULL 清空 / 覆盖层不写）；
    - delete：删实例（管道删除走真删）。
    **失败不吞**：逐条登记到 ``failures``；返回含 ``failed``。
    """
    tenant, cls_slug = _split_rid(ot)
    now = datetime.now(UTC)
    overlay = overlay_props or {}
    mapping = field_mapping or {}
    upserted = deleted = failed = 0
    failures: list[dict[str, Any]] = []
    for ch in changes:
        pk = str(ch.get("pk", ""))
        if not pk:
            continue
        rid_now = f"ont.{tenant}.ind.{cls_slug}.{pk}"
        try:
            if ch.get("op") == "delete":
                if repo.delete_individual(rid_now):
                    deleted += 1
                continue
            data = ch.get("data") or {}
            values: dict[str, Any] = {}
            user_edited = overlay.get(rid_now, set())
            for prop_rid, column in mapping.items():
                if prop_rid in user_edited or column not in data:
                    continue
                values[prop_rid] = data[column]
            upsert = getattr(repo, "upsert_sourced_props", None)
            if upsert is not None:
                upsert(
                    rid=rid_now,
                    tenant_id=tenant,
                    class_rid=ot.rid,
                    primary_key=pk,
                    values=values or {ot.primary_key[0].rid: pk},
                    source=str(ch.get("source") or "cdc"),
                    priority=int(ch.get("priority", default_priority)),
                    ts=now,
                )
            else:
                props = {k: v for k, v in values.items() if v is not None}
                props.setdefault(ot.primary_key[0].rid, pk)
                repo.create_individual(
                    Individual(
                        rid=rid_now,
                        class_rid=ot.rid,
                        props=tuple((ClassRef(k), v) for k, v in props.items()),
                        primary_key=pk,
                        created_at=now,
                        updated_at=now,
                        tenant_id=tenant,
                    )
                )
            upserted += 1
        except Exception as e:
            failed += 1
            failures.append(
                {
                    "pk": pk,
                    "op": str(ch.get("op") or "upsert"),
                    "error": f"{type(e).__name__}: {e}"[:200],
                }
            )
    return {
        "upserted": upserted,
        "deleted": deleted,
        "failed": failed,
        "failures": failures,
    }


def materialize_object_type(repo: Any, class_rid: str, *, limit: int = 10000) -> dict[str, Any]:
    """对象当前状态 → 行集（materialization 读端点形态）。

    行 = individual_to_row（slug 键）+ __rid__；schema = 属性清单。
    下游管道 / OSDK 消费方订阅此端点实现回流（写 dataset 由管道侧完成）。
    """
    from mate_kernel.objectset.compiler import individual_to_row

    ot = repo.get_object_type(ClassRef(class_rid))
    inds = repo.list_individuals(ClassRef(class_rid))[:limit]
    rows = [individual_to_row(i) for i in inds]
    schema = {
        p.rid.rid: {
            "slug": p.rid.rid.split(".")[3]
            if len(p.rid.rid.split(".")) >= 5
            else p.rid.rid.split(".")[-1],
            "type_id": p.type_id,
            "format": p.format.value,
        }
        for p in ot.properties
    }
    return {
        "class_rid": class_rid,
        "count": len(rows),
        "rows": rows,
        "schema": schema,
        "generated_at": datetime.now(UTC).isoformat(),
    }
