"""seed_v3_legacy — 造 v3 旧版（OWL 风格）快照，供迁移演练。

创建 ont_ontologies / ont_classes / ont_instances / ont_relations 四张
v3 旧表并写入样例数据（2 类 3 实例 1 关系），模拟 ADR-0060 迁移前的
存量形态。幂等：先 DROP 再建。
"""

from __future__ import annotations

import asyncio
import sys

import asyncpg

DSN = sys.argv[1] if len(sys.argv) > 1 else "postgresql://meta:meta@127.0.0.1:5432/metaplatform_ont"

DDL = [
    """CREATE TABLE IF NOT EXISTS ont_ontologies (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, version TEXT NOT NULL DEFAULT 'v1')""",
    """CREATE TABLE IF NOT EXISTS ont_classes (
        id TEXT PRIMARY KEY, ontology_id TEXT NOT NULL,
        name TEXT NOT NULL, label TEXT NOT NULL DEFAULT '')""",
    """CREATE TABLE IF NOT EXISTS ont_instances (
        id TEXT PRIMARY KEY, class_id TEXT NOT NULL,
        props JSONB NOT NULL DEFAULT '{}'::jsonb)""",
    """CREATE TABLE IF NOT EXISTS ont_relations (
        id TEXT PRIMARY KEY, relation_type TEXT NOT NULL,
        src_id TEXT NOT NULL, dst_id TEXT NOT NULL)""",
]

DATA = [
    "INSERT INTO ont_ontologies VALUES ('ont-demo', 'Demo Ontology', 'v1')",
    "INSERT INTO ont_classes VALUES ('cls-customer', 'ont-demo', 'customer', '客户')",
    "INSERT INTO ont_classes VALUES ('cls-order', 'ont-demo', 'order', '订单')",
    'INSERT INTO ont_instances VALUES (\'inst-c1\', \'cls-customer\', \'{"name": "华信科技", "region": "华东"}\')',
    "INSERT INTO ont_instances VALUES ('inst-o1', 'cls-order', '{\"order_id\": \"SO-777\", \"amount\": 250000}')",
    "INSERT INTO ont_instances VALUES ('inst-o2', 'cls-order', '{\"order_id\": \"SO-778\", \"amount\": 99000}')",
    "INSERT INTO ont_relations VALUES ('rel-1', 'places', 'inst-c1', 'inst-o1')",
]


async def main() -> int:
    conn = await asyncpg.connect(DSN)
    try:
        for ddl in (
            "DROP TABLE IF EXISTS ont_relations",
            "DROP TABLE IF EXISTS ont_instances",
            "DROP TABLE IF EXISTS ont_classes",
            "DROP TABLE IF EXISTS ont_ontologies",
        ):
            await conn.execute(ddl)
        for ddl in DDL:
            await conn.execute(ddl)
        for d in DATA:
            await conn.execute(d)
        for t, want in (("ont_classes", 2), ("ont_instances", 3), ("ont_relations", 1)):
            got = await conn.fetchval(f"SELECT count(*) FROM {t}")
            assert got == want, f"{t}: {got} != {want}"
        print(f"v3 legacy seeded: classes=2 instances=3 relations=1 @ {DSN.split('@')[-1]}")
    finally:
        await conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
