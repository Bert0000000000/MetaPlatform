"""DATA-14/15：数据平面绑定 —— backing datasources + 索引管道 + materialization。

Palantir 语义（调研材料 06 §5 / 00 §L0）：
- ObjectType 由 datasets/streams **索引**成对象（Funnel）；本体坐在数据平面之上；
- MDO：一个类型多个数据源拼接，字段级优先级合并；
- materialization：对象最新状态回流数据平面供下游管道消费。

Mate v1（D1 拍板全量纳入，最小可运行集）：
- ``BackingDatasource``：{name, kind: pg_table, dsn_env, table, pk_column,
  field_mapping: prop_rid → 列名, priority}；
- ``sync_backing_datasource``：读源表 → 按 mapping upsert Individual
  （多源按 priority 升序同步，后源不覆盖先源已写入的非空值 —— 字段级优先级）；
- ``materialize_object_type``：对象当前状态导出为行集（回流数据平面的
  读端点形态；写回 dataset 由下游管道订阅）。

v1 边界：定时调度挂 Scheduler、CDC 流式、writeback 双流合并（user edits 与
管道数据的 edited-overlay 合并）后续批次；本批先吃批量表数据。
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
    "materialize_object_type",
]


@dataclass(frozen=True, slots=True)
class BackingDatasource:
    """对象类型的背挂数据源（v1: 同实例 PG 表）。"""

    name: str
    kind: str = "pg_table"           # v1 仅 pg_table（csv/cdc 后续）
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
    ot: Any,  # ObjectType（携带 backing_datasources 元数据 —— dict 形态）
    sources: list[BackingDatasource] | None = None,
    *,
    batch_limit: int = 5000,
) -> dict[str, Any]:
    """批量索引：源表 → Individual upsert（MDO 多源按 priority 合并）。

    合并语义（字段级优先级）：按 priority 升序逐源同步；先源写入的非空
    值不被后源覆盖（Palantir 字段级冲突优先级的简化：先到先得）。
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
    stats: dict[str, int] = {}

    # 已写入值缓存（pk → {prop_rid: value}）—— 多源合并不覆盖非空
    written: dict[str, dict[str, Any]] = {}
    for ds in sorted(sources, key=lambda s: s.priority):
        conn = _connect_source(ds)
        try:
            import psycopg2.extras

            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(f"SELECT * FROM {ds.table} LIMIT %s", (batch_limit,))  # noqa: S608
                rows = cur.fetchall()
        finally:
            conn.close()
        synced = 0
        for row in rows:
            pk = str(row[ds.pk_column])
            props: dict[str, Any] = {}
            for prop_rid, column in ds.field_mapping.items():
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
