"""Controlled Excel staging -> existing backing-source merge and overlay pipeline."""

from __future__ import annotations

import json
import os
from contextlib import contextmanager

from psycopg2 import sql

from mate_kernel.ontology.identity import ClassRef

from ..v2_kernel import api as native
from .core import compile_graph, digest
from .publication import current_link, current_type
from .store import now


def entity_pk(cls, payload, source):
    if len(cls["identity"]) == 1:
        # Native pg_table indexing and migration derive single keys with str(value).
        return str(payload["properties"][cls["identity"][0]])
    if cls["identity"]:
        return json.dumps(
            [payload["properties"][p] for p in cls["identity"]],
            ensure_ascii=False,
            separators=(",", ":"),
        )
    return "record_" + digest([source["id"], payload.get("sources"), payload.get("identity")])[:40]


def stage(store, source, nodes):
    plan = source["plan"]
    draft = {c["id"]: c for c in source["draft"]["classes"]}
    result, identities = [], {}
    for item in plan["types"]:
        cls, rid = draft[item["classId"]], item["rid"]
        table = "ont_excel_" + digest([store.tenant, rid])[:24]
        if not any(n['objectType'] == item['classId'] for n in nodes):
            with store.connection() as cur:
                cur.execute('SELECT to_regclass(%s) AS relation', (table,))
                if cur.fetchone()['relation']:
                    cur.execute(sql.SQL('DELETE FROM {} WHERE tenant_id=%s').format(sql.Identifier(table)), (store.tenant,))
            result.append({'classId':item['classId'], 'rid':rid, 'count':0, 'skipped':True})
            continue  # Never trigger a backing-source sync for a wholly deferred/empty type.
        parts = rid.split(".")
        native_slug = parts[4] if len(parts) >= 6 else parts[3]
        existing_identity = {}
        if cls["identity"]:
            with store.repo.tenant_scope(store.tenant):
                for instance in store.repo.list_individuals(ClassRef(rid), tenant_id=store.tenant):
                    if instance.class_rid.rid != rid:
                        continue
                    key = digest(
                        [
                            instance.get(ClassRef(item["propertyMap"][pid]))
                            for pid in cls["identity"]
                        ]
                    )
                    if key in existing_identity:
                        raise ValueError("原生对象存在重复业务身份，需先审核合并")
                    expected_rid = f"ont.{store.tenant}.ind.{native_slug}.{instance.primary_key}"
                    if instance.rid != expected_rid:
                        raise ValueError(
                            "原生实例身份不符合背挂数据源规范，需通过原生迁移审核，不能自动复制"
                        )
                    existing_identity[key] = instance.primary_key
        # One stable source per tenant/type, so another file updates rather than shadows it.
        props = {p["rid"]: p for p in item["payload"]["properties"]}
        columns = {prop: "p_" + digest(prop)[:16] for prop in props}
        with store.connection() as cur:
            cur.execute(
                sql.SQL(
                    "CREATE TABLE IF NOT EXISTS {} (tenant_id text NOT NULL, business_key text PRIMARY KEY, source_id text NOT NULL, source_revision integer NOT NULL, provenance jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())"
                ).format(sql.Identifier(table))
            )
            for prop, col in columns.items():
                pg_type = {
                    "string": "text",
                    "double": "double precision",
                    "date": "date",
                    "integer": "bigint",
                    "boolean": "boolean",
                }.get(props[prop]["type_id"], "text")
                cur.execute(
                    sql.SQL("ALTER TABLE {} ADD COLUMN IF NOT EXISTS {} {}").format(
                        sql.Identifier(table), sql.Identifier(col), sql.SQL(pg_type)
                    )
                )
            cur.execute(
                sql.SQL("ALTER TABLE {} ENABLE ROW LEVEL SECURITY").format(sql.Identifier(table))
            )
            cur.execute(
                sql.SQL("ALTER TABLE {} FORCE ROW LEVEL SECURITY").format(sql.Identifier(table))
            )
            cur.execute(
                "SELECT 1 FROM pg_policies WHERE tablename=%s AND policyname='excel_tenant'",
                (table,),
            )
            if not cur.fetchone():
                cur.execute(
                    sql.SQL(
                        "CREATE POLICY excel_tenant ON {} USING (tenant_id=current_setting('app.tenant_id',true)) WITH CHECK (tenant_id=current_setting('app.tenant_id',true))"
                    ).format(sql.Identifier(table))
                )
            # This table is an execution snapshot, not the instance store. Remove
            # stale staging from earlier/failed runs so deferred rows cannot enter
            # through the native full scan. Native delete_missing remains false.
            cur.execute(sql.SQL('DELETE FROM {} WHERE tenant_id=%s').format(sql.Identifier(table)), (store.tenant,))
            count = 0
            for node in nodes:
                if node["objectType"] != item["classId"]:
                    continue
                payload = json.loads(node["payload"])
                pk = entity_pk(cls, payload, source)
                if cls["identity"]:
                    pk = existing_identity.get(
                        digest([payload["properties"][pid] for pid in cls["identity"]]), pk
                    )
                identities[node["key"]] = f"ont.{store.tenant}.ind.{native_slug}.{pk}"
                values = {
                    columns[native_prop]: payload["properties"].get(draft_prop)
                    for draft_prop, native_prop in item["propertyMap"].items()
                }
                if not cls["identity"]:
                    values[columns[item["payload"]["primary_key"][0]]] = pk
                fields = [
                    "tenant_id",
                    "business_key",
                    "source_id",
                    "source_revision",
                    "provenance",
                    *values,
                ]
                params = [
                    store.tenant,
                    pk,
                    source["id"],
                    source["revision"],
                    json.dumps(payload.get("sources", []), ensure_ascii=False),
                    *values.values(),
                ]
                updates = [
                    sql.SQL("{}=EXCLUDED.{}").format(sql.Identifier(f), sql.Identifier(f))
                    for f in fields
                    if f not in ("tenant_id", "business_key")
                ]
                cur.execute(
                    sql.SQL(
                        "INSERT INTO {} ({}) VALUES ({}) ON CONFLICT (business_key) DO UPDATE SET {},updated_at=now()"
                    ).format(
                        sql.Identifier(table),
                        sql.SQL(",").join(map(sql.Identifier, fields)),
                        sql.SQL(",").join([sql.Placeholder()] * len(fields)),
                        sql.SQL(",").join(updates),
                    ),
                    params,
                )
                count += 1
        result.append(
            {
                "classId": item["classId"],
                "rid": rid,
                "table": table,
                "count": count,
                "fieldMapping": {
                    p: columns[p]
                    for p in set(item["propertyMap"].values()) | set(item["payload"]["primary_key"])
                },
            }
        )
    return result, identities


async def verify_baseline(request, source):
    if not source.get("plan") or (source.get("publication") or {}).get("status") != "succeeded":
        raise ValueError("请先完成原生模型发布")
    if source["publication"].get("configHash") != source["plan"].get("configHash"):
        raise ValueError("候选变化后请重新验证发布")
    published = {r["rid"]: r.get("checksum") for r in source["publication"]["results"]}
    for item in source["plan"]["types"]:
        live = await current_type(request, item["rid"])
        if not live or live["checksum"] != published.get(item["rid"]):
            raise ValueError("原生模型发布后已变化，请通过版本或迁移流程核对后重新验证发布")
        table = "ont_excel_" + digest([native._ctx(request).tenant_id, item["rid"]])[:24]
        expected = {p: "p_" + digest(p)[:16] for p in set(item["propertyMap"].values()) | set(item["payload"]["primary_key"])}
        for declaration in await native.list_backing_datasources(item["rid"], request):
            if declaration["name"] != "excel-modeling":
                raise ValueError("该类型还绑定了其他数据来源，请在原生数据映射页核对并同步，避免本次操作触发其他来源")
            if declaration["name"] == "excel-modeling" and (
                declaration["table_name"] != table
                or declaration["dsn_env"] != "ONT_MODELING_SOURCE_DSN"
                or declaration["pk_column"] != "business_key"
                or any(expected.get(key) != value for key, value in declaration["field_mapping"].items())
            ):
                raise ValueError("原生来源映射已被修改，请先在数据映射页核对；本次同步不会覆盖该配置")
    for item in source["plan"]["relationships"]:
        if await current_link(request, item["rid"]) != item["payload"]:
            raise ValueError("原生关系发布后已变化，请重新验证发布")


async def _sync(request, source, rows, store, allow_partial=False, check_hash=None):
    if not os.environ.get("ONT_MODELING_SOURCE_DSN"):
        raise ValueError("Excel 数据源未配置 ONT_MODELING_SOURCE_DSN")
    # Staging and source reading must use the same controlled database.
    import psycopg2

    conn = psycopg2.connect(os.environ["ONT_MODELING_SOURCE_DSN"])
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT current_database(),inet_server_addr()::text,inet_server_port()")
            source_db = cur.fetchone()
        with store.connection() as cur:
            cur.execute("SELECT current_database(),inet_server_addr()::text,inet_server_port()")
            if tuple(cur.fetchone().values()) != source_db:
                raise ValueError("Excel 暂存数据源必须指向当前平台数据库")
    finally:
        conn.close()
    await verify_baseline(request, source)
    state = {
        "status": "running",
        "mode": "append-upsert",
        "deleteMissing": False,
        "types": [],
        "links": 0,
        "sourceRevision": source["revision"],
        "startedAt": now(),
        "stage": "preparing",
    }
    revision = source["revision"]
    store.update(source["id"], revision, {"sync": state}, increment=False)
    try:
        from .data_treatment import prepare
        report, nodes, edges, _ = prepare(source, rows, allow_partial)
        if not report['canSync'] or (allow_partial and check_hash != report['checkHash']):
            raise ValueError('数据范围校验未通过或确认已过期，请重新检查')
        state.update(allowPartial=allow_partial, checkHash=report['checkHash'], quarantine=report['quarantine'],
                     eligible={'nodes':len(nodes),'edges':len(edges)})
        staged, identities = stage(store, source, nodes)
        state.update(stage="objects", totalTypes=len(staged), totalLinks=len(edges))
        store.update(source["id"], revision, {"sync": state}, increment=False)
        for item in staged:
            if item.get('skipped'):
                state['types'].append({'classId':item['classId'],'rid':item['rid'],'total_synced':0,'total_failed':0,'skipped':True})
                store.update(source['id'], revision, {'sync':state}, increment=False)
                continue
            for declaration in await native.list_backing_datasources(item["rid"], request):
                if declaration["name"] == "excel-modeling" and (
                    declaration["table_name"] != item["table"]
                    or declaration["dsn_env"] != "ONT_MODELING_SOURCE_DSN"
                ):
                    raise ValueError("同名数据源已被其他流程占用，请在原生映射页审核")
            declaration = await native.upsert_backing_datasource(
                item["rid"],
                native.BackingDatasourceDTO(
                    class_rid=item["rid"],
                    name="excel-modeling",
                    dsn_env="ONT_MODELING_SOURCE_DSN",
                    table=item["table"],
                    pk_column="business_key",
                    field_mapping=item["fieldMapping"],
                ),
                request,
            )
            report = await native.sync_backing_datasources(item["rid"], request, incremental=False)
            state["types"].append({"classId": item["classId"], "rid": item["rid"], "sourceRef": declaration["rid"], **report})
            store.update(source["id"], revision, {"sync": state}, increment=False)
            if not report.get("ok"):
                raise ValueError("原生数据同步存在失败行，请检查批次报告")
        relations = {r["relationId"]: r for r in source["plan"]["relationships"]}
        state["stage"] = "relationships"
        store.update(source["id"], revision, {"sync": state}, increment=False)
        for edge in edges:
            rel = relations[edge["relationId"]]
            src, dst = identities[edge["source"]], identities[edge["target"]]
            link_rid = f"ont.{store.tenant}.lnk.data_{digest([rel['rid'], src, dst])[:32]}"
            # Native repo create_link_instance is idempotent for matching endpoints.
            await native.create_link_instance(
                native.LinkInstanceDTO(rid=link_rid, link_type_rid=rel["rid"], src=src, dst=dst),
                request,
            )
            state["links"] += 1
            if state["links"] % 100 == 0:
                store.update(source["id"], revision, {"sync": state}, increment=False)
        state["status"] = "succeeded"
    except Exception as exc:
        state.update(status="failed", error=str(getattr(exc, "detail", exc)))
    state["finishedAt"] = now()
    return store.update(source["id"], revision, {"sync": state}, increment=False)


@contextmanager
def ingestion_lock(store):
    # Different Excel sources share one native staging snapshot per tenant/type.
    # Serialize the complete stage + native objects + relationship run across workers.
    with store.repo.tenant_scope(store.tenant):
        connection, _ = store.repo._connect()
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT pg_try_advisory_lock(hashtextextended(%s,0))', (store.tenant + ':excel-ingestion',))
            if not cursor.fetchone()[0]:
                raise ValueError('该租户已有 Excel 数据同步正在执行，请稍后重试')
        yield
    finally:
        connection.close()


async def sync(request, source, rows, store, allow_partial=False, check_hash=None):
    with ingestion_lock(store):
        return await _sync(request, source, rows, store, allow_partial, check_hash)
