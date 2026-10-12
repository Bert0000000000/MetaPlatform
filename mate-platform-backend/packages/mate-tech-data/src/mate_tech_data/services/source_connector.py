"""Real PostgreSQL discovery and uploaded CSV parsing, with safe diagnostics."""

from __future__ import annotations

import csv
import io
import time
import uuid
from datetime import UTC, datetime
from typing import Any

SECRET_KEYS = {
    "password",
    "passwd",
    "secret",
    "token",
    "dsn",
    "url",
    "connection_string",
    "api_key",
}
PUBLIC_KEYS = {
    "host",
    "port",
    "database",
    "dbname",
    "schema",
    "username",
    "user",
    "sslmode",
    "table",
    "auth_type",
}


class SourceError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.trace_id = uuid.uuid4().hex

    def detail(self):
        return {"error_code": self.code, "message": str(self), "trace_id": self.trace_id}


def public_config(config: dict) -> dict:
    return {
        **{k: v for k, v in config.items() if k in PUBLIC_KEYS},
        "credentials_configured": any(config.get(k) for k in SECRET_KEYS),
        "csv_uploaded": bool(config.get("csv_content")),
    }


def merge_config(old: dict, changes: dict) -> dict:
    result = dict(old)
    for key, value in changes.items():
        if key in {"credentials_configured", "csv_uploaded"}:
            continue
        if key in SECRET_KEYS and (not value or str(value) in {"********", "***", "[REDACTED]"}):
            continue  # omitted/empty/display masks explicitly retain the stored secret
        result[key] = value
    return result


def connect_postgres(source: Any):
    import psycopg2

    cfg = source.connection_config
    try:
        if cfg.get("dsn"):
            from psycopg2.extensions import parse_dsn

            parsed = parse_dsn(cfg["dsn"])
            if not all(parsed.get(key) for key in ("host", "dbname", "user")):
                raise SourceError(
                    "SCHEMA", "Source DSN must explicitly specify host, database and user"
                )
            return psycopg2.connect(cfg["dsn"], connect_timeout=5)
        if (
            not cfg.get("host")
            or not (cfg.get("database") or cfg.get("dbname"))
            or not (cfg.get("username") or cfg.get("user"))
        ):
            raise SourceError("SCHEMA", "Configure host, database and username before testing")
        return psycopg2.connect(
            host=cfg.get("host"),
            port=int(cfg.get("port") or 5432),
            dbname=cfg.get("database") or cfg.get("dbname"),
            user=cfg.get("username") or cfg.get("user"),
            password=cfg.get("password"),
            sslmode=cfg.get("sslmode", "prefer"),
            connect_timeout=5,
        )
    except Exception as exc:
        raise safe_error(exc) from None


def safe_error(exc: Exception) -> SourceError:
    if isinstance(exc, SourceError):
        return exc
    code = getattr(exc, "pgcode", None)
    message = str(exc).lower()
    if code == "42501" or "permission denied" in message:
        return SourceError("PERMISSION", "Source schema/table permission denied")
    if (
        (code or "").startswith("28")
        or "authentication failed" in message
        or "no password supplied" in message
    ):
        return SourceError("AUTHENTICATION", "Source authentication failed")
    if code in {"42P01", "3F000", "42703"}:
        return SourceError("SCHEMA", "Source schema, table or column does not exist")
    return SourceError("NETWORK", "Source connection failed; check host, port and database")


def csv_rows(source: Any) -> tuple[list[str], list[dict]]:
    content = source.connection_config.get("csv_content", "")
    if not isinstance(content, str) or not content.strip():
        raise SourceError("SCHEMA", "Upload a UTF-8 CSV file with a header")
    if len(content.encode("utf-8")) > 10 * 1024 * 1024:
        raise SourceError("SCHEMA", "CSV exceeds the 10 MB batch limit")
    reader = csv.DictReader(io.StringIO(content.lstrip("\ufeff")), strict=True)
    columns = reader.fieldnames or []
    if not columns or any(not c for c in columns) or len(set(columns)) != len(columns):
        raise SourceError("SCHEMA", "CSV headers must be non-empty and unique")
    try:
        rows = list(reader)
    except csv.Error:
        raise SourceError("SCHEMA", "CSV format is invalid") from None
    if any(None in row or None in row.values() for row in rows):
        raise SourceError("SCHEMA", "CSV row width does not match headers")
    return columns, rows


def discover(source: Any) -> dict:
    kind = source.type.lower()
    cfg = source.connection_config
    if kind == "csv":
        columns, rows = csv_rows(source)
        tables = [
            {
                "name": cfg.get("table") or "upload",
                "columns": [
                    {
                        "name": c,
                        "type": "text",
                        "nullable": any(not r[c] for r in rows),
                        "primary_key": False,
                    }
                    for c in columns
                ],
            }
        ]
    elif kind in {"postgres", "postgresql", "pg_table"}:
        conn = connect_postgres(source)
        try:
            with conn.cursor() as cur:
                schema = cfg.get("schema") or "public"
                cur.execute(
                    "SELECT oid, has_schema_privilege(oid, 'USAGE') FROM pg_namespace WHERE nspname=%s",
                    (schema,),
                )
                ns = cur.fetchone()
                if not ns:
                    raise SourceError("SCHEMA", "Source schema does not exist")
                if not ns[1]:
                    raise SourceError("PERMISSION", "Source schema permission denied")
                cur.execute(
                    """SELECT c.relname, has_table_privilege(c.oid, 'SELECT')
                    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                    WHERE n.nspname=%s AND c.relkind IN ('r','p','v','m') ORDER BY c.relname""",
                    (schema,),
                )
                names = cur.fetchall()
                requested = cfg.get("table")
                if requested:
                    names = [r for r in names if r[0] == requested]
                    if not names:
                        raise SourceError("SCHEMA", "Source table does not exist")
                tables = []
                for name, allowed in names:
                    if not allowed:
                        raise SourceError("PERMISSION", "Source table permission denied")
                    cur.execute(
                        """SELECT a.attname, format_type(a.atttypid,a.atttypmod), NOT a.attnotnull,
                        EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid=c.oid AND i.indisprimary AND a.attnum=ANY(i.indkey))
                        FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
                        JOIN pg_namespace n ON n.oid=c.relnamespace
                        WHERE n.nspname=%s AND c.relname=%s AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum""",
                        (schema, name),
                    )
                    tables.append(
                        {
                            "name": name,
                            "schema": schema,
                            "columns": [
                                dict(zip(("name", "type", "nullable", "primary_key"), row, strict=True))
                                for row in cur.fetchall()
                            ],
                        }
                    )
        except Exception as exc:
            raise safe_error(exc) from None
        finally:
            conn.close()
    else:
        raise SourceError("UNSUPPORTED", "This source type does not support verified discovery")
    return {
        "source_id": source.id,
        "tables": tables,
        "discovered_at": datetime.now(UTC).isoformat(),
        "trace_id": uuid.uuid4().hex,
    }


def probe(source: Any) -> dict:
    started = time.monotonic()
    try:
        schema = discover(source)
        result = {"ok": True, "trace_id": schema["trace_id"], "message": "Source verified"}
    except SourceError as exc:
        result = {"ok": False, **exc.detail()}
    return {
        "error": "" if result["ok"] else result["message"],
        "source_id": source.id,
        "latency_ms": max(1, int((time.monotonic() - started) * 1000)),
        **result,
    }
