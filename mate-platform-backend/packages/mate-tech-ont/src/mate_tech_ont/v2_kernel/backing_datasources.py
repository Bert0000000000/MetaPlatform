"""DATA-14/15 + CDC 腿：数据平面绑定 —— backing datasources + 索引管道 + materialization。

Palantir 语义（调研材料 06 §5 / 00 §L0）：
- ObjectType 由 datasets/streams **索引**成对象（Funnel）；本体坐在数据平面之上；
- MDO：一个类型多个数据源拼接，字段级优先级合并；
- materialization：对象最新状态回流数据平面供下游管道消费；
- 双流合并：管道数据 + 用户编辑（user edits）合并为最新表示。

Mate v1（D1 拍板全量纳入）：
- ``BackingDatasource``：{name, kind: pg_table, dsn_env, table, pk_column,
  field_mapping: prop_rid → 列名, priority}；
- ``sync_backing_datasource``：批量/增量读源表 → 按 mapping upsert Individual
  （多源按 priority 升序，先源非空值不被后源覆盖；用户编辑覆盖层不覆盖）；
- ``apply_cdc_changes``：debezium / mate-tech-etl 变更事件 → 对象平面
  （流式腿的集成入口）；
- ``materialize_object_type``：对象当前状态导出为行集（回流读端点形态）。

v1 边界：定时调度挂 Scheduler；debezium engine 的事件订阅接线在
mate-tech-etl 侧（本模块提供无状态入口）。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.instances.individual import Individual

__all__ = [
    "BackingDatasource",
    "sync_backing_datasource",
    "apply_cdc_changes",
    "materialize_object_type",
]


@dataclass(frozen=True, slots=True)
class BackingDatasource:
    """对象类型的背挂数据源（v1: 同实例 PG 表）。"""

    name: str
    kind: str = "pg_table"           # v1 仅 pg_table（csv/cdc 走 apply_cdc_changes）
    dsn_env: str = "ONT_SOURCE_DSN"  # 源库 DSN 环境变量名（secret 不进 git）
    table: str = ""
    pk_column: str = ""
    field_mapping: dict[str, str] = field(default_factory=dict)  # prop_rid → 列
    priority: int = 100              # 小 = 优先（MDO 字段合并序）

    def __post_init__(self) -> None:
        if self.kind != "pg_table":
            raise ValueError(f"BackingDatasource.kind v1 supports pg_table only: {self.kind!r}")
        if not self.table or not self.pk_column:
            raise ValueError("BackingDatasource requires table + pk_column")
        if not self.field_mapping:
            raise ValueError("BackingDatasource requires field_mapping (non-empty)")


def _connect_source(ds: BackingDatasource) -> Any:
    import os

    import psycopg2

    dsn = os.environ.get(ds.dsn_env, "")
    if not dsn:
        raise ValueError(f"env {ds.dsn_env} not set (backing datasource {ds.name})")
    return psycopg2.connect(dsn)


def sync_backing_datasource(
    repo: Any,
    ot: Any,
    sources: list[BackingDatasource] | None = None,
    *,
    batch_limit: int = 5000,
    incremental: bool = False,
    overlay_props: dict[str, set[str]] | None = None,
    watermarks: dict[str, str | None] | None = None,
    ts_columns: dict[str, str] | None = None,
) -> dict[str, Any]:
    """批量/增量索引：源表 → Individual upsert（MDO 多源按 priority 合并）。

    合并语义（字段级优先级）：按 priority 升序逐源同步；先源写入的非空
    值不被后源覆盖（先到先得）。

    writeback 双流合并：``overlay_props`` 是用户编辑覆盖层
    （individual_rid → {property_rid}）—— 在覆盖层中的属性**不被管道数据
    覆盖**（用户编辑赢；Palantir「管道数据 + 用户编辑」合并语义）。

    增量（CDC 流式腿的批量形态）：``incremental=True`` 时按各源
    ``ts_columns[name] > watermarks[name]`` 过滤（watermark 缺省 = 全量首同步）。

    返回 {source: synced} 统计。upsert 使用 create_individual（PG 侧
    ON CONFLICT merge props）。
    """
    if sources is None:
        raw = getattr(ot, "backing_datasources", None) or []
        sources = [BackingDatasource(**dict(s)) for s in raw]
    if not sources:
        raise ValueError(f"no backing datasources declared on {ot.rid.rid}")
    rid_parts = ot.rid.rid.split(".")
    tenant = rid_parts[1]
    cls_slug = rid_parts[4] if len(rid_parts) >= 6 else rid_parts[3]
    now = datetime.now(UTC)
    overlay = overlay_props or {}
    watermarks = watermarks or {}
    ts_columns = ts_columns or {}

    def _rid_of(pk: str) -> str:
        return f"ont.{tenant}.ind.{cls_slug}.{pk}"

    stats: dict[str, int] = {}
    # 已写入值缓存（pk → {prop_rid: value}）—— 多源合并不覆盖非空
    written: dict[str, dict[str, Any]] = {}
    for ds in sorted(sources, key=lambda s: s.priority):
        conn = _connect_source(ds)
        try:
            import psycopg2.extras

            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                if incremental:
                    ts_col = ts_columns.get(ds.name, "updated_at")
                    wm = watermarks.get(ds.name)
                    if wm:
                        cur.execute(
                            f"SELECT * FROM {ds.table} "  # noqa: S608
                            f"WHERE {ts_col} > %s ORDER BY {ts_col} LIMIT %s",
                            (wm, batch_limit,))
                    else:
                        cur.execute(
                            f"SELECT * FROM {ds.table} LIMIT %s", (batch_limit,))  # noqa: S608
                else:
                    cur.execute(f"SELECT * FROM {ds.table} LIMIT %s", (batch_limit,))  # noqa: S608
                rows = cur.fetchall()
        finally:
            conn.close()
        synced = 0
        for row in rows:
            pk = str(row[ds.pk_column])
            user_edited = overlay.get(_rid_of(pk), set())
            props: dict[str, Any] = {}
            for prop_rid, column in ds.field_mapping.items():
                if prop_rid in user_edited:
                    continue  # 双流合并：用户编辑过的属性管道不覆盖
                if column in row and row[column] is not None:
                    props[prop_rid] = row[column]
            merged = dict(written.get(pk, {}))
            for k, v in props.items():
                if k not in merged or merged[k] is None:
                    merged[k] = v
            written[pk] = merged
            # 主键属性必须存在
            pk_props = ot.primary_key[0].rid
            if pk_props not in merged:
                merged[pk_props] = pk
            try:
                repo.create_individual(Individual(
                    rid=f"ont.{tenant}.ind.{cls_slug}.{pk}",
                    class_rid=ot.rid,
                    props=tuple((ClassRef(k), v) for k, v in merged.items()),
                    primary_key=pk, created_at=now, updated_at=now,
                    tenant_id=tenant,
                ))
                synced += 1
            except Exception:
                # 主键冲突且 repo 无 upsert 语义 → 跳过（幂等重跑安全）
                continue
        stats[ds.name] = synced
    return stats


def apply_cdc_changes(
    repo: Any,
    ot: Any,
    changes: list[dict[str, Any]],
    *,
    pk_column: str = "id",
    field_mapping: dict[str, str] | None = None,
    overlay_props: dict[str, set[str]] | None = None,
) -> dict[str, int]:
    """CDC 流式绑定入口（debezium / mate-tech-etl 变更事件 → 对象平面）。

    changes 元素：{op: "upsert"|"delete", pk: str, data?: {列: 值}}。
    - upsert：按 field_mapping 落 props；**overlay 内属性不覆盖**（双流合并）；
    - delete：删实例（管道删除走真删 —— 与用户编辑无冲突维度）。
    返回 {upserted, deleted}。
    """
    rid_parts = ot.rid.rid.split(".")
    tenant = rid_parts[1]
    cls_slug = rid_parts[4] if len(rid_parts) >= 6 else rid_parts[3]
    now = datetime.now(UTC)
    overlay = overlay_props or {}
    mapping = field_mapping or {}
    upserted = 0
    deleted = 0
    for ch in changes:
        pk = str(ch.get("pk", ""))
        if not pk:
            continue
        rid_now = f"ont.{tenant}.ind.{cls_slug}.{pk}"
        if ch.get("op") == "delete":
            try:
                repo.delete_individual(rid_now)
                deleted += 1
            except Exception:
                continue
            continue
        data = ch.get("data") or {}
        user_edited = overlay.get(rid_now, set())
        props: dict[str, Any] = {ot.primary_key[0].rid: pk}
        for prop_rid, column in mapping.items():
            if prop_rid in user_edited:
                continue
            if column in data and data[column] is not None:
                props[prop_rid] = data[column]
        repo.create_individual(Individual(
            rid=rid_now, class_rid=ot.rid,
            props=tuple((ClassRef(k), v) for k, v in props.items()),
            primary_key=pk, created_at=now, updated_at=now, tenant_id=tenant,
        ))
        upserted += 1
    return {"upserted": upserted, "deleted": deleted}


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
        p.rid.rid: {"slug": p.rid.rid.split(".")[3] if len(p.rid.rid.split(".")) >= 5
                    else p.rid.rid.split(".")[-1],
                    "type_id": p.type_id, "format": p.format.value}
        for p in ot.properties
    }
    return {"class_rid": class_rid, "count": len(rows),
            "rows": rows, "schema": schema,
            "generated_at": datetime.now(UTC).isoformat()}
