"""Durable tenant-scoped candidate storage. Formal ontology remains in kernel tables."""

from __future__ import annotations

import json
from contextlib import contextmanager
from datetime import UTC, datetime
from uuid import uuid4

from fastapi.encoders import jsonable_encoder


def now():
    return datetime.now(UTC).isoformat()


class RevisionConflict(ValueError):
    pass


class ModelingStore:
    def __init__(self, repo, tenant):
        if not hasattr(repo, "_connect") or not hasattr(repo, "tenant_scope"):
            raise RuntimeError("Data modeling requires the PostgreSQL kernel repository")
        if not tenant:
            raise ValueError("tenant required")
        self.repo, self.tenant = repo, str(tenant)

    @contextmanager
    def connection(self):
        with self.repo.tenant_scope(self.tenant):
            conn, cursor_factory = self.repo._connect()
            try:
                with conn.cursor(cursor_factory=cursor_factory) as cur:
                    yield cur
                conn.commit()
            except BaseException:
                conn.rollback()
                raise
            finally:
                conn.close()

    def ensure_schema(self):
        with self.connection() as cur:
            cur.execute("""CREATE TABLE IF NOT EXISTS ont_modeling_sources (
                tenant_id text NOT NULL, id text NOT NULL, revision integer NOT NULL,
                owner_id text NOT NULL, document jsonb NOT NULL, rows_data jsonb NOT NULL,
                headers jsonb NOT NULL, file_data bytea NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
                PRIMARY KEY(tenant_id,id))""")
            cur.execute("ALTER TABLE ont_modeling_sources ENABLE ROW LEVEL SECURITY")
            cur.execute("ALTER TABLE ont_modeling_sources FORCE ROW LEVEL SECURITY")
            cur.execute("""DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies
                WHERE tablename='ont_modeling_sources' AND policyname='modeling_tenant') THEN
                CREATE POLICY modeling_tenant ON ont_modeling_sources
                USING (tenant_id=current_setting('app.tenant_id',true))
                WITH CHECK (tenant_id=current_setting('app.tenant_id',true)); END IF; END $$""")
            cur.execute("""CREATE TABLE IF NOT EXISTS ont_modeling_revisions (
                tenant_id text NOT NULL, source_id text NOT NULL, revision integer NOT NULL,
                document jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
                PRIMARY KEY(tenant_id,source_id,revision))""")
            cur.execute("ALTER TABLE ont_modeling_revisions ENABLE ROW LEVEL SECURITY")
            cur.execute("ALTER TABLE ont_modeling_revisions FORCE ROW LEVEL SECURITY")
            cur.execute("""DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies
                WHERE tablename='ont_modeling_revisions' AND policyname='modeling_revision_tenant') THEN
                CREATE POLICY modeling_revision_tenant ON ont_modeling_revisions
                USING (tenant_id=current_setting('app.tenant_id',true))
                WITH CHECK (tenant_id=current_setting('app.tenant_id',true)); END IF; END $$""")

    def create(self, name, owner, profile, rows, headers, content):
        doc = {
            "id": str(uuid4()),
            "name": name,
            "revision": 1,
            "profile": profile,
            "draft": None,
            "context": "",
            "questions": [],
            "resolutions": {},
            "job": None,
            "validation": None,
            "review": None,
            "preview": None,
            "plan": None,
            "publication": None,
            "sync": None,
            "createdAt": now(),
        }
        with self.connection() as cur:
            cur.execute(
                """INSERT INTO ont_modeling_sources
                (tenant_id,id,revision,owner_id,document,rows_data,headers,file_data)
                VALUES (%s,%s,1,%s,%s::jsonb,%s::jsonb,%s::jsonb,%s)""",
                (
                    self.tenant,
                    doc["id"],
                    str(owner),
                    json.dumps(doc, ensure_ascii=False),
                    json.dumps(rows, ensure_ascii=False),
                    json.dumps(headers, ensure_ascii=False),
                    content,
                ),
            )
            cur.execute(
                "INSERT INTO ont_modeling_revisions(tenant_id,source_id,revision,document) VALUES (%s,%s,1,%s::jsonb)",
                (self.tenant, doc["id"], json.dumps(doc, ensure_ascii=False)),
            )
        return doc

    def get(self, ident, private=False):
        with self.connection() as cur:
            cur.execute(
                "SELECT document,rows_data,headers FROM ont_modeling_sources WHERE tenant_id=%s AND id=%s",
                (self.tenant, ident),
            )
            row = cur.fetchone()
        if not row:
            raise KeyError(ident)
        if private:
            return row["document"], (row["rows_data"], row["headers"])
        return row["document"]

    def list(self):
        with self.connection() as cur:
            cur.execute(
                "SELECT document FROM ont_modeling_sources WHERE tenant_id=%s ORDER BY updated_at DESC LIMIT 100",
                (self.tenant,),
            )
            return [r["document"] for r in cur.fetchall()]

    def ensure_generation_cache(self):
        with self.connection() as cur:
            cur.execute("""CREATE TABLE IF NOT EXISTS ont_modeling_generation_cache (
                tenant_id text NOT NULL, fingerprint text NOT NULL, document jsonb NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,fingerprint))""")
            cur.execute("ALTER TABLE ont_modeling_generation_cache ENABLE ROW LEVEL SECURITY")
            cur.execute("ALTER TABLE ont_modeling_generation_cache FORCE ROW LEVEL SECURITY")
            cur.execute("""DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE
                tablename='ont_modeling_generation_cache' AND policyname='modeling_generation_tenant') THEN
                CREATE POLICY modeling_generation_tenant ON ont_modeling_generation_cache
                USING (tenant_id=current_setting('app.tenant_id',true))
                WITH CHECK (tenant_id=current_setting('app.tenant_id',true)); END IF; END $$""")

    def generation_baseline(self, fingerprint, candidate=None):
        with self.connection() as cur:
            if candidate is not None:
                # Concurrent requests converge on the first complete baseline.
                cur.execute(
                    """INSERT INTO ont_modeling_generation_cache (tenant_id,fingerprint,document)
                    VALUES (%s,%s,%s::jsonb) ON CONFLICT DO NOTHING""",
                    (self.tenant, fingerprint, json.dumps(candidate, ensure_ascii=False)),
                )
            cur.execute(
                "SELECT document FROM ont_modeling_generation_cache WHERE tenant_id=%s AND fingerprint=%s",
                (self.tenant, fingerprint),
            )
            row = cur.fetchone()
            return row["document"] if row else None

    def update(self, ident, revision, changes, *, increment=True):
        with self.connection() as cur:
            cur.execute(
                "SELECT document,revision FROM ont_modeling_sources WHERE tenant_id=%s AND id=%s FOR UPDATE",
                (self.tenant, ident),
            )
            row = cur.fetchone()
            if not row:
                raise KeyError(ident)
            if row["revision"] != revision:
                raise RevisionConflict("候选已被修改，请刷新后重试")
            doc = jsonable_encoder(
                {
                    **row["document"],
                    **changes,
                    "revision": revision + int(increment),
                    "updatedAt": now(),
                }
            )
            if increment:
                cur.execute(
                    "INSERT INTO ont_modeling_revisions(tenant_id,source_id,revision,document) VALUES (%s,%s,%s,%s::jsonb)",
                    (self.tenant, ident, doc["revision"], json.dumps(doc, ensure_ascii=False)),
                )
            cur.execute(
                "UPDATE ont_modeling_sources SET document=%s::jsonb,revision=%s,updated_at=now() WHERE tenant_id=%s AND id=%s",
                (json.dumps(doc, ensure_ascii=False), doc["revision"], self.tenant, ident),
            )
        return doc

    def interrupt_jobs(self):
        with self.connection() as cur:
            cur.execute(
                "SELECT id,document FROM ont_modeling_sources WHERE tenant_id=%s", (self.tenant,)
            )
            for row in cur.fetchall():
                for field in ("job", "publication", "sync", "dataRepair"):
                    if (row["document"].get(field) or {}).get("status") != "running":
                        continue
                    kind = "modeling-job" if field in {"job", "dataRepair"} else "modeling"
                    key = self.tenant + ":" + kind + ":" + row["id"]
                    cur.execute(
                        "SELECT pg_try_advisory_lock(hashtextextended(%s,0)) AS acquired", (key,)
                    )
                    if not cur.fetchone()["acquired"]:
                        continue  # Another process owns a live task/session.
                    try:
                        state = {
                            **row["document"][field],
                            "status": "interrupted" if field == "job" else "failed",
                            "error": "服务已重启，请重试继续",
                        }
                        cur.execute(
                            "UPDATE ont_modeling_sources SET document=jsonb_set(document,ARRAY[%s],%s::jsonb) WHERE tenant_id=%s AND id=%s AND document->%s->>'status'='running'",
                            (
                                field,
                                json.dumps(state, ensure_ascii=False),
                                self.tenant,
                                row["id"],
                                field,
                            ),
                        )
                    finally:
                        cur.execute("SELECT pg_advisory_unlock(hashtextextended(%s,0))", (key,))

    def acquire_job(self, ident):
        with self.repo.tenant_scope(self.tenant):
            conn, _ = self.repo._connect()
        with conn.cursor() as cur:
            cur.execute(
                "SELECT pg_try_advisory_lock(hashtextextended(%s,0))",
                (self.tenant + ":modeling-job:" + ident,),
            )
            if not cur.fetchone()[0]:
                conn.close()
                raise RevisionConflict("该来源已有运行任务")
        return conn
