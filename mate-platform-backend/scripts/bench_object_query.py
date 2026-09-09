"""bench_object_query — ONT-G4 生产压测：1 万实例 object-query P95。

在 mate-tech-ont 容器内执行（有 psycopg2 + mate_kernel）。
流程：建 bench 类型 → SQL 批量插 10000 实例 → 补 composite 索引 →
object-query（filter+paging）N=50 次计时 → P50/P95 报告 → 清理。
"""
from __future__ import annotations

import json
import sys
import time

import psycopg2
import psycopg2.extras

DSN = "postgresql://meta:meta@postgres:5432/metaplatform_ont"
TENANT = "tenant-default"
CLS = f"ont.{TENANT}.obj.bench.v1"
N = 10000
QUERIES = 50

sys.path.insert(0, "/app/packages/mate-kernel/src")
sys.path.insert(0, "/app/packages/mate-tech-ont/src")
sys.path.insert(0, "/app/packages/mate-platform/src")

conn = psycopg2.connect(DSN)
conn.autocommit = True
cur = conn.cursor()

# 0) 类型 + PK 属性注册（rid 形制与 v2 一致）
cur.execute("DELETE FROM ont_individual WHERE class_rid=%s", (CLS,))
cur.execute("DELETE FROM ont_object_type WHERE rid=%s", (CLS,))
cur.execute(
    """INSERT INTO ont_object_type (rid, tenant_id, slug, primary_key, properties, display_name)
       VALUES (%s,%s,'bench',%s,%s::jsonb,'bench')""",
    (CLS, TENANT, [f"ont.{TENANT}.prop.bench-id.v1"],
     json.dumps([
         {"rid": f"ont.{TENANT}.prop.bench-id.v1", "type_id": "string",
          "nullable": False, "primary_key": True, "title": "id", "format": "string"},
         {"rid": f"ont.{TENANT}.prop.bench-region.v1", "type_id": "string",
          "nullable": False, "primary_key": False, "title": "region", "format": "string"},
         {"rid": f"ont.{TENANT}.prop.bench-amt.v1", "type_id": "integer",
          "nullable": True, "primary_key": False, "title": "amt", "format": "integer"},
     ])))

# 1) 1 万实例（COPY 级批量）
from datetime import datetime, timezone
now = datetime.now(timezone.utc)
rows = []
for i in range(N):
    rows.append((
        f"ont.{TENANT}.ind.bench.b{i}", TENANT, CLS,
        json.dumps({f"ont.{TENANT}.prop.bench-id.v1": f"b{i}",
                    f"ont.{TENANT}.prop.bench-region.v1": f"r{i % 20}",
                    f"ont.{TENANT}.prop.bench-amt.v1": i % 5000}),
        f"b{i}", now, now,
    ))
psycopg2.extras.execute_values(
    cur,
    """INSERT INTO ont_individual (rid, tenant_id, class_rid, props, primary_key, created_at, updated_at)
       VALUES %s""",
    rows,
    template="(%s,%s,%s,%s,%s,%s,%s)")
print(f"seeded {N} instances", flush=True)

# 2) composite 索引（class_rid + tenant 已有；补 class_rid+primary_key 组合）
cur.execute("""CREATE INDEX IF NOT EXISTS ix_ont_ind_class_pk
               ON ont_individual (class_rid, primary_key)""")

# 3) object-query 计时（经 repo SQL 编译路径）
from mate_kernel.objectset.ir import Condition, ObjectSetQuery, QueryOp  # noqa: E402
from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository  # noqa: E402

repo = PgOntologyRepository(dsn=DSN)
with repo.tenant_scope(TENANT):
    # 预热
    repo.execute_object_query(ObjectSetQuery(
        source=CLS, paging_limit=20))
    lat = []
    for i in range(QUERIES):
        q = ObjectSetQuery(
            source=CLS,
            filters=(Condition(field="bench-region", op=QueryOp.EQ,
                               value=f"r{i % 20}"),),
            paging_limit=50,
        )
        t0 = time.perf_counter()
        repo.execute_object_query(q)
        lat.append((time.perf_counter() - t0) * 1000)
    lat.sort()
    p50 = lat[len(lat) // 2]
    p95 = lat[int(len(lat) * 0.95)]
    print(f"object-query x{QUERIES} on {N} instances: "
          f"P50={p50:.1f}ms P95={p95:.1f}ms max={lat[-1]:.1f}ms", flush=True)

# 4) 清理
cur.execute("DELETE FROM ont_individual WHERE class_rid=%s", (CLS,))
cur.execute("DELETE FROM ont_object_type WHERE rid=%s", (CLS,))
print("bench cleaned", flush=True)
