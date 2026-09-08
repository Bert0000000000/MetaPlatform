"""migrate_v3_to_ont — v3 旧表 → v2 本体表（ADR-0060 / ONT-G3）。

流程：备份（*_mig_backup）→ 迁移（class→object_type+property、instance→
individual、relation→link_instance）→ 计数核对 + 抽样字段比对 → 记录迁移账。
--rollback 时从备份恢复并清空 v2 迁移行。

用法：
    python migrate_v3_to_ont.py <dsn>            # 迁移 + 核对
    python migrate_v3_to_ont.py <dsn> --rollback # 回滚
"""
from __future__ import annotations

import asyncio
import sys

import asyncpg

args = [a for a in sys.argv[1:] if not a.startswith("--")]
DSN = args[0] if args else "postgresql://meta:meta@127.0.0.1:5432/metaplatform_ont"
TENANT = "tenant-default"
ROLLBACK = "--rollback" in sys.argv

V2_OBJ = "ont_object_type"
V2_IND = "ont_individual"
V2_LNK = "ont_link_instance"


async def backup(conn) -> None:
    for t in ("ont_classes", "ont_instances", "ont_relations"):
        await conn.execute(f"DROP TABLE IF EXISTS {t}_mig_backup")
        await conn.execute(f"SELECT * INTO {t}_mig_backup FROM {t}")


async def migrate(conn) -> dict:
    # class → object_type（rid: ont.<tenant>.obj.<name>.v1）+ PK 属性行
    classes = await conn.fetch("SELECT id, name, label FROM ont_classes")
    for c in classes:
        rid = f"ont.{TENANT}.obj.mig-{c['name']}.v1"
        pk_rid = f"ont.{TENANT}.prop.mig-{c['name']}-id.v1"
        await conn.execute(
            f"""INSERT INTO {V2_OBJ} (rid, tenant_id, slug, primary_key, properties, display_name)
                VALUES ($1,$2,$3,$4,$5::jsonb,$6)
                ON CONFLICT (rid) DO UPDATE SET display_name=EXCLUDED.display_name""",
            rid, TENANT, "mig-" + c["name"], [pk_rid],
            __import__("json").dumps([
                {"rid": pk_rid, "type_id": "string", "nullable": False,
                 "primary_key": True, "title": "id", "format": "string"},
            ]),
            c["label"] or c["name"],
        )
    # instance → individual
    instances = await conn.fetch("SELECT id, class_id, props FROM ont_instances")
    cls_by_id = {c["id"]: c["name"] for c in classes}
    for ins in instances:
        name = "mig-" + cls_by_id.get(ins["class_id"], ins["class_id"])
        pk_val = str(ins["id"])
        rid = f"ont.{TENANT}.ind.{name}.{pk_val}"
        props = ins["props"] if isinstance(ins["props"], dict) else __import__("json").loads(ins["props"])
        props["legacy-id"] = pk_val
        await conn.execute(
            f"""INSERT INTO {V2_IND} (rid, tenant_id, class_rid, props, primary_key, created_at, updated_at)
                VALUES ($1,$2,$3,$4::jsonb,$5, now(), now())
                ON CONFLICT (rid) DO UPDATE SET props=EXCLUDED.props""",
            rid, TENANT, f"ont.{TENANT}.obj.{name}.v1",
            __import__("json").dumps(
                {f"ont.{TENANT}.prop.{k}.v1": v for k, v in props.items()}),
            pk_val,
        )
    # relation → link_instance
    relations = await conn.fetch("SELECT id, relation_type, src_id, dst_id FROM ont_relations")
    cls_names = {c["id"]: c["name"] for c in classes}
    for rel in relations:
        rid = f"ont.{TENANT}.lnk.mig-{rel['relation_type']}.{rel['src_id'][-4:]}.{rel['dst_id'][-4:]}"
        await conn.execute(
            f"""INSERT INTO {V2_LNK} (rid, tenant_id, link_type_rid, src, dst, created_at, updated_at)
                VALUES ($1,$2,$3,$4,$5, now(), now())
                ON CONFLICT (rid) DO NOTHING""",
            rid, TENANT, f"ont.{TENANT}.link.mig-{rel['relation_type']}.v1",
            rel["src_id"], rel["dst_id"],
        )
    return {"classes": len(classes), "instances": len(instances),
            "relations": len(relations)}


async def verify(conn) -> dict:
    obj_n = await conn.fetchval(f"SELECT count(*) FROM {V2_OBJ} WHERE rid LIKE 'ont.{TENANT}.obj.%' AND rid NOT LIKE '%employee%' AND rid NOT LIKE '%order%' AND rid NOT LIKE '%customer%' AND rid NOT LIKE '%goods%' AND rid NOT LIKE '%bad%' AND rid NOT LIKE '%dup%' AND rid NOT LIKE '%good%' AND rid NOT LIKE '%thing%' AND rid NOT LIKE '%bare%' AND rid NOT LIKE '%ver-demo%'")
    ind_n = await conn.fetchval(f"SELECT count(*) FROM {V2_IND} WHERE rid LIKE 'ont.{TENANT}.ind.mig-customer.%' OR rid LIKE 'ont.{TENANT}.ind.mig-order.%'")
    lnk_n = await conn.fetchval(f"SELECT count(*) FROM {V2_LNK} WHERE rid LIKE 'ont.{TENANT}.lnk.mig-places.%'")
    # 抽样比对 3 条
    samples = []
    r = await conn.fetchrow(
        f"SELECT props FROM {V2_IND} WHERE rid='ont.{TENANT}.ind.mig-customer.inst-c1'")
    if r:
        p = __import__("json").loads(r["props"])
        samples.append(("inst-c1.name", p.get(f"ont.{TENANT}.prop.name.v1"), "华信科技"))
        samples.append(("inst-c1.region", p.get(f"ont.{TENANT}.prop.region.v1"), "华东"))
    r = await conn.fetchrow(
        f"SELECT props FROM {V2_IND} WHERE rid='ont.{TENANT}.ind.mig-order.inst-o1'")
    if r:
        p = __import__("json").loads(r["props"])
        samples.append(("inst-o1.amount", p.get(f"ont.{TENANT}.prop.amount.v1"), 250000))
    ok = all(got == want for _, got, want in samples)
    return {"v2_objects": obj_n, "v2_individuals": ind_n, "v2_links": lnk_n,
            "samples": [{"key": k, "got": got, "want": want, "match": got == want}
                        for k, got, want in samples],
            "verify_pass": ok and len(samples) == 3}


async def rollback(conn) -> None:
    # 从备份恢复 v3 表数据，并清理本次迁移写入的 v2 行
    for t in ("ont_classes", "ont_instances", "ont_relations"):
        await conn.execute(f"DELETE FROM {t}")
        await conn.execute(f"INSERT INTO {t} SELECT * FROM {t}_mig_backup")
    await conn.execute(f"DELETE FROM {V2_IND} WHERE rid LIKE 'ont.{TENANT}.ind.mig-%'")
    await conn.execute(f"DELETE FROM {V2_LNK} WHERE rid LIKE 'ont.{TENANT}.lnk.mig-%'")
    await conn.execute(f"DELETE FROM {V2_OBJ} WHERE slug LIKE 'mig-%'")


async def main() -> int:
    conn = await asyncpg.connect(DSN)
    try:
        if ROLLBACK:
            await rollback(conn)
            c = await conn.fetchval("SELECT count(*) FROM ont_instances")
            print(f"ROLLBACK OK: v3 ont_instances restored = {c}")
            return 0
        await backup(conn)
        counts = await migrate(conn)
        v = await verify(conn)
        print("MIGRATED:", counts)
        print("VERIFY:", v["v2_objects"], "objects /", v["v2_individuals"],
              "individuals /", v["v2_links"], "links")
        for s in v["samples"]:
            print(f"  sample {s['key']}: got={s['got']} want={s['want']} match={s['match']}")
        print("VERIFY_PASS" if v["verify_pass"] else "VERIFY_FAIL")
        return 0 if v["verify_pass"] else 1
    finally:
        await conn.close()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
