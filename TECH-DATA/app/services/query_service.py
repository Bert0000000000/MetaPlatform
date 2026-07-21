"""SQL query execution, execution plan, export and history (V13-12).

The service enforces read-only safety checks before any SQL reaches a live
connection.  Concrete executors are provided for PostgreSQL (asyncpg) and
MySQL (aiomysql); tests use the mock implementation.
"""

from __future__ import annotations

import csv
import io
import json
import re
import time
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Optional

from pydantic import BaseModel, Field

from app.common.errors import InvalidParamError
from app.models.schemas import DataSourceType
from app.services.datasource_service import DataSourceService


# ---------------------------------------------------------------- read-only gate


_FORBIDDEN_KEYWORDS: set[str] = {
    "INSERT",
    "UPDATE",
    "DELETE",
    "DROP",
    "ALTER",
    "CREATE",
    "TRUNCATE",
    "GRANT",
    "REVOKE",
    "EXEC",
    "EXECUTE",
    "MERGE",
    "CALL",
    "LOAD",
}

_FORBIDDEN_PATTERN = re.compile(
    r"\b(" + "|".join(_FORBIDDEN_KEYWORDS) + r")\b",
    re.IGNORECASE,
)


def _strip_comments_and_strings(sql: str) -> str:
    """Remove SQL comments and single-quoted string literals."""

    s = re.sub(r"/\*.*?\*/", "", sql, flags=re.DOTALL)
    s = re.sub(r"--[^\n]*", "", s)
    s = re.sub(r"'[^']*'", "''", s)
    return s


def is_read_only_sql(sql: str) -> bool:
    """Return True when ``sql`` is a read-only SELECT / WITH statement."""

    cleaned = _strip_comments_and_strings(sql)
    cleaned = cleaned.strip().rstrip(";").strip()
    upper = cleaned.upper()
    if not (upper.startswith("SELECT") or upper.startswith("WITH")):
        return False
    if _FORBIDDEN_PATTERN.search(cleaned):
        return False
    # Reject multiple statements (any remaining semicolon).
    if cleaned.count(";") > 0:
        return False
    return True


# ---------------------------------------------------------------- result models


class QueryResult(BaseModel):
    """Result of a single SQL execution."""

    columns: list[str]
    rows: list[dict[str, Any]]
    row_count: int
    execution_time_ms: int


class QueryExecutionResponse(BaseModel):
    """Payload returned by POST /queries/execute."""

    query_id: str = Field(alias="queryId")
    columns: list[str]
    rows: list[dict[str, Any]]
    row_count: int = Field(alias="rowCount")
    execution_time: int = Field(alias="executionTime")

    model_config = {"populate_by_name": True}


class QueryHistory(BaseModel):
    """Persisted record of a query execution."""

    id: str
    tenant_id: str = Field(alias="tenantId")
    data_source_id: str = Field(alias="dataSourceId")
    sql: str
    status: str  # success | error
    columns: list[str]
    rows: list[dict[str, Any]]
    row_count: int = Field(alias="rowCount")
    execution_time_ms: int = Field(alias="executionTimeMs")
    plan: Optional[dict[str, Any]] = None
    error_message: Optional[str] = Field(default=None, alias="errorMessage")
    created_at: datetime = Field(alias="createdAt")

    model_config = {"populate_by_name": True}


# ---------------------------------------------------------------- executor


class QueryExecutor(ABC):
    """Run a read-only SQL statement against a data source."""

    @abstractmethod
    async def execute(
        self, source_type: DataSourceType, config: dict[str, Any], sql: str
    ) -> QueryResult: ...

    @abstractmethod
    async def execution_plan(
        self, source_type: DataSourceType, config: dict[str, Any], sql: str
    ) -> dict[str, Any]: ...


class MockQueryExecutor(QueryExecutor):
    """In-memory executor for tests and unsupported source types."""

    async def execute(
        self, source_type: DataSourceType, config: dict[str, Any], sql: str
    ) -> QueryResult:
        return QueryResult(
            columns=["id", "name"],
            rows=[
                {"id": 1, "name": "Alice"},
                {"id": 2, "name": "Bob"},
            ],
            row_count=2,
            execution_time_ms=1,
        )

    async def execution_plan(
        self, source_type: DataSourceType, config: dict[str, Any], sql: str
    ) -> dict[str, Any]:
        return {"plan": "mock"}


class PgQueryExecutor(QueryExecutor):
    """PostgreSQL executor via asyncpg."""

    async def execute(
        self, source_type: DataSourceType, config: dict[str, Any], sql: str
    ) -> QueryResult:
        import asyncpg  # local import keeps test startup fast

        conn = await self._connect(config)
        start = time.monotonic()
        try:
            rows = await conn.fetch(sql)
            columns = list(rows[0].keys()) if rows else []
            dict_rows = [dict(r) for r in rows]
        finally:
            await conn.close()
        elapsed = int((time.monotonic() - start) * 1000)
        return QueryResult(
            columns=columns,
            rows=dict_rows,
            row_count=len(dict_rows),
            execution_time_ms=elapsed,
        )

    async def execution_plan(
        self, source_type: DataSourceType, config: dict[str, Any], sql: str
    ) -> dict[str, Any]:
        import asyncpg

        conn = await self._connect(config)
        try:
            rows = await conn.fetch(f"EXPLAIN (FORMAT JSON) {sql}")
            plan = json.loads(rows[0]["QUERY PLAN"]) if rows else []
            return {"plan": plan}
        finally:
            await conn.close()

    async def _connect(self, config: dict[str, Any]):
        import asyncpg

        return await asyncpg.connect(
            host=config.get("host"),
            port=config.get("port") or 5432,
            database=config.get("database") or "postgres",
            user=config.get("username"),
            password=config.get("password"),
            timeout=10,
        )


class MySqlQueryExecutor(QueryExecutor):
    """MySQL executor via aiomysql."""

    async def execute(
        self, source_type: DataSourceType, config: dict[str, Any], sql: str
    ) -> QueryResult:
        import aiomysql

        conn = await self._connect(config)
        start = time.monotonic()
        try:
            async with conn.cursor() as cur:
                await cur.execute(sql)
                rows = await cur.fetchall()
                columns = [desc[0] for desc in cur.description] if cur.description else []
                dict_rows = [dict(zip(columns, r)) for r in rows]
        finally:
            conn.close()
        elapsed = int((time.monotonic() - start) * 1000)
        return QueryResult(
            columns=columns,
            rows=dict_rows,
            row_count=len(dict_rows),
            execution_time_ms=elapsed,
        )

    async def execution_plan(
        self, source_type: DataSourceType, config: dict[str, Any], sql: str
    ) -> dict[str, Any]:
        import aiomysql

        conn = await self._connect(config)
        try:
            async with conn.cursor() as cur:
                await cur.execute(f"EXPLAIN {sql}")
                rows = await cur.fetchall()
                columns = [desc[0] for desc in cur.description] if cur.description else []
                plan = [dict(zip(columns, r)) for r in rows]
                return {"plan": plan}
        finally:
            conn.close()

    async def _connect(self, config: dict[str, Any]):
        import aiomysql

        return await aiomysql.connect(
            host=config.get("host"),
            port=config.get("port") or 3306,
            db=config.get("database") or "mysql",
            user=config.get("username"),
            password=config.get("password"),
            connect_timeout=10,
        )


def build_query_executor(source_type: DataSourceType) -> QueryExecutor:
    """Factory picking the right executor for a source type."""

    if source_type == DataSourceType.POSTGRESQL:
        return PgQueryExecutor()
    if source_type == DataSourceType.MYSQL:
        return MySqlQueryExecutor()
    return MockQueryExecutor()


# ---------------------------------------------------------------- history repository


def _new_id() -> str:
    return f"q-{uuid.uuid4().hex[:24]}"


def _now() -> datetime:
    return datetime.now(timezone.utc)


class QueryHistoryRepository(ABC):
    """Abstract repository for query execution history."""

    @abstractmethod
    async def create(self, record: QueryHistory) -> QueryHistory: ...

    @abstractmethod
    async def get(self, query_id: str, tenant_id: str) -> Optional[QueryHistory]: ...

    @abstractmethod
    async def list(
        self,
        tenant_id: str,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[QueryHistory], int]: ...


class InMemoryQueryHistoryRepository(QueryHistoryRepository):
    """Thread-safe in-memory history store used by tests and default runtime."""

    def __init__(self) -> None:
        from threading import RLock

        self._lock = RLock()
        self._store: dict[tuple[str, str], QueryHistory] = {}

    async def create(self, record: QueryHistory) -> QueryHistory:
        with self._lock:
            if not record.id:
                record.id = _new_id()
            record.created_at = _now()
            self._store[(record.tenant_id, record.id)] = record
            return record

    async def get(self, query_id: str, tenant_id: str) -> Optional[QueryHistory]:
        with self._lock:
            return self._store.get((tenant_id, query_id))

    async def list(
        self,
        tenant_id: str,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[QueryHistory], int]:
        with self._lock:
            results = [
                r for (tid, _), r in self._store.items() if tid == tenant_id
            ]
        results.sort(key=lambda r: r.created_at, reverse=True)
        total = len(results)
        start = (page - 1) * page_size
        return results[start : start + page_size], total

    def clear(self) -> None:
        with self._lock:
            self._store.clear()


# ---------------------------------------------------------------- export helpers


def _serialize_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def _to_csv(columns: list[str], rows: list[dict[str, Any]]) -> bytes:
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow({c: _serialize_value(row.get(c)) for c in columns})
    return output.getvalue().encode("utf-8-sig")


def _to_excel(columns: list[str], rows: list[dict[str, Any]]) -> bytes:
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    if ws is None:
        ws = wb.create_sheet()
    ws.append(columns)
    for row in rows:
        ws.append([_serialize_value(row.get(c)) for c in columns])
    output = io.BytesIO()
    wb.save(output)
    return output.getvalue()


# ---------------------------------------------------------------- service


class QueryService:
    """Facade for executing read-only queries and managing their history."""

    def __init__(
        self,
        datasource_service: DataSourceService,
        executor: Optional[QueryExecutor] = None,
        history_repo: Optional[QueryHistoryRepository] = None,
    ) -> None:
        self._datasource_service = datasource_service
        self._executor = executor
        self._history_repo = history_repo or InMemoryQueryHistoryRepository()

    def _resolve_executor(self, source_type: DataSourceType) -> QueryExecutor:
        if self._executor is not None:
            return self._executor
        return build_query_executor(source_type)

    async def execute(
        self, tenant_id: str, ds_id: str, sql: str
    ) -> QueryExecutionResponse:
        if not is_read_only_sql(sql):
            raise InvalidParamError(
                "只允许执行只读 SELECT / WITH 查询",
                data={"sql": sql},
            )

        ds = await self._datasource_service.get(tenant_id, ds_id)
        config = DataSourceService._decrypt_config(ds.connection_config)
        executor = self._resolve_executor(ds.source_type)

        result = await executor.execute(ds.source_type, config, sql)
        plan = await executor.execution_plan(ds.source_type, config, sql)

        record = QueryHistory(
            id=_new_id(),
            tenant_id=tenant_id,
            data_source_id=ds_id,
            sql=sql,
            status="success",
            columns=result.columns,
            rows=result.rows,
            row_count=result.row_count,
            execution_time_ms=result.execution_time_ms,
            plan=plan,
            error_message=None,
            created_at=_now(),
        )
        await self._history_repo.create(record)

        return QueryExecutionResponse(
            query_id=record.id,
            columns=result.columns,
            rows=result.rows,
            row_count=result.row_count,
            execution_time=result.execution_time_ms,
        )

    async def execution_plan(self, tenant_id: str, query_id: str) -> dict[str, Any]:
        from app.common.errors import QueryNotFoundError

        record = await self._history_repo.get(query_id, tenant_id)
        if record is None:
            raise QueryNotFoundError(
                f"查询记录不存在: id={query_id}",
                data={"id": query_id},
            )
        return record.plan or {}

    async def export(
        self, tenant_id: str, query_id: str, format: str
    ) -> tuple[bytes, str, str]:
        from app.common.errors import QueryNotFoundError

        record = await self._history_repo.get(query_id, tenant_id)
        if record is None:
            raise QueryNotFoundError(
                f"查询记录不存在: id={query_id}",
                data={"id": query_id},
            )

        fmt = format.lower()
        if fmt == "csv":
            return (
                _to_csv(record.columns, record.rows),
                "text/csv; charset=utf-8",
                f"query-{query_id}.csv",
            )
        if fmt == "json":
            return (
                json.dumps(record.rows, ensure_ascii=False, default=str).encode(
                    "utf-8"
                ),
                "application/json; charset=utf-8",
                f"query-{query_id}.json",
            )
        if fmt == "excel":
            return (
                _to_excel(record.columns, record.rows),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                f"query-{query_id}.xlsx",
            )

        raise InvalidParamError(
            f"不支持的导出格式: {format}",
            data={"allowed": ["csv", "json", "excel"]},
        )

    async def history(
        self,
        tenant_id: str,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[QueryHistory], int]:
        return await self._history_repo.list(
            tenant_id, page=page, page_size=page_size
        )
