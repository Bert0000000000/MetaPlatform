"""Connection testing & schema exploration for external data sources.

Defines abstract contracts (:class:`ConnectionTester`, :class:`SchemaExplorer`)
plus concrete implementations for PostgreSQL (asyncpg) and MySQL (aiomysql),
along with mock implementations used by tests.

The SQL statements are exposed as ``*_sql()`` static methods so they can be
unit-tested without a live database connection.
"""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from typing import Any, Optional

from app.models.schemas import (
    ColumnInfo,
    ConnectionTestResult,
    DataSourceType,
    TableInfo,
)


# =====================================================================
# Connection testing
# =====================================================================


class ConnectionTester(ABC):
    """Probe whether a data source is reachable."""

    @abstractmethod
    async def test(
        self, source_type: DataSourceType, config: dict[str, Any]
    ) -> ConnectionTestResult: ...


class MockConnectionTester(ConnectionTester):
    """Tester that succeeds for well-formed configs and fails otherwise.

    A config is considered well-formed when it has a non-empty ``host``.
    Tests may override ``force_success`` to simulate failures.
    """

    def __init__(self, force_success: Optional[bool] = None) -> None:
        self.force_success = force_success
        self.calls: list[tuple[DataSourceType, dict[str, Any]]] = []

    async def test(
        self, source_type: DataSourceType, config: dict[str, Any]
    ) -> ConnectionTestResult:
        self.calls.append((source_type, dict(config)))
        if self.force_success is True:
            return ConnectionTestResult(success=True, message="连接成功(mock)", latencyMs=1)
        if self.force_success is False:
            return ConnectionTestResult(success=False, message="连接失败(mock)", latencyMs=1)
        # Default heuristic: host present -> success.
        if config.get("host"):
            return ConnectionTestResult(success=True, message="连接成功(mock)", latencyMs=1)
        return ConnectionTestResult(success=False, message="缺少 host(mock)", latencyMs=0)


class _AsyncPgConnectionTester(ConnectionTester):
    """PostgreSQL connection test via asyncpg."""

    async def test(
        self, source_type: DataSourceType, config: dict[str, Any]
    ) -> ConnectionTestResult:
        import asyncpg  # local import keeps test startup fast

        start = time.monotonic()
        try:
            conn = await asyncpg.connect(
                host=config.get("host"),
                port=config.get("port") or 5432,
                database=config.get("database") or "postgres",
                user=config.get("username"),
                password=config.get("password"),
                timeout=5,
            )
            try:
                await conn.fetchval("SELECT 1")
            finally:
                await conn.close()
            latency = int((time.monotonic() - start) * 1000)
            return ConnectionTestResult(success=True, message="连接成功", latencyMs=latency)
        except Exception as exc:  # noqa: BLE001
            latency = int((time.monotonic() - start) * 1000)
            return ConnectionTestResult(
                success=False, message=f"连接失败: {exc}", latencyMs=latency
            )


class _AiomySqlConnectionTester(ConnectionTester):
    """MySQL connection test via aiomysql."""

    async def test(
        self, source_type: DataSourceType, config: dict[str, Any]
    ) -> ConnectionTestResult:
        import aiomysql  # local import keeps test startup fast

        start = time.monotonic()
        try:
            conn = await aiomysql.connect(
                host=config.get("host"),
                port=config.get("port") or 3306,
                db=config.get("database") or "mysql",
                user=config.get("username"),
                password=config.get("password"),
                connect_timeout=5,
            )
            try:
                async with conn.cursor() as cur:
                    await cur.execute("SELECT 1")
                    await cur.fetchone()
            finally:
                conn.close()
            latency = int((time.monotonic() - start) * 1000)
            return ConnectionTestResult(success=True, message="连接成功", latencyMs=latency)
        except Exception as exc:  # noqa: BLE001
            latency = int((time.monotonic() - start) * 1000)
            return ConnectionTestResult(
                success=False, message=f"连接失败: {exc}", latencyMs=latency
            )


def build_connection_tester(source_type: DataSourceType) -> ConnectionTester:
    """Factory picking the right tester for a source type."""

    if source_type == DataSourceType.POSTGRESQL:
        return _AsyncPgConnectionTester()
    if source_type == DataSourceType.MYSQL:
        return _AiomySqlConnectionTester()
    # CSV / API not probed at the DB level; return a mock that always succeeds.
    return MockConnectionTester(force_success=True)


# =====================================================================
# Schema exploration
# =====================================================================


class SchemaExplorer(ABC):
    """Discover databases, tables and columns of a data source."""

    @abstractmethod
    async def list_databases(self, config: dict[str, Any]) -> list[str]: ...

    @abstractmethod
    async def list_tables(
        self, config: dict[str, Any], db: str
    ) -> list[TableInfo]: ...

    @abstractmethod
    async def list_columns(
        self, config: dict[str, Any], db: str, table: str
    ) -> list[ColumnInfo]: ...


class MockSchemaExplorer(SchemaExplorer):
    """Explorer backed by an in-memory dictionary for tests."""

    def __init__(self) -> None:
        # structure: { "db": { "tables": { "table": [ColumnInfo, ...] } } }
        self.data: dict[str, dict[str, list[ColumnInfo]]] = {}
        self.list_databases_calls: list[dict] = []
        self.list_tables_calls: list[tuple[dict, str]] = []
        self.list_columns_calls: list[tuple[dict, str, str]] = []

    def add_database(self, db: str) -> None:
        self.data.setdefault(db, {})

    def add_table(self, db: str, table: str, columns: list[ColumnInfo]) -> None:
        self.add_database(db)
        self.data[db][table] = columns

    async def list_databases(self, config: dict[str, Any]) -> list[str]:
        self.list_databases_calls.append(dict(config))
        return sorted(self.data.keys())

    async def list_tables(
        self, config: dict[str, Any], db: str
    ) -> list[TableInfo]:
        self.list_tables_calls.append((dict(config), db))
        tables = self.data.get(db, {})
        return [TableInfo(name=t, schema=db) for t in sorted(tables.keys())]

    async def list_columns(
        self, config: dict[str, Any], db: str, table: str
    ) -> list[ColumnInfo]:
        self.list_columns_calls.append((dict(config), db, table))
        return list(self.data.get(db, {}).get(table, []))


# ----------------------------------------------------------- PostgreSQL


class PgSchemaExplorer(SchemaExplorer):
    """Schema exploration for PostgreSQL via asyncpg."""

    # -- SQL builders (tested without a live DB) ----------------------

    @staticmethod
    def list_databases_sql() -> str:
        return (
            "SELECT datname FROM pg_database "
            "WHERE datistemplate = false ORDER BY datname"
        )

    @staticmethod
    def list_tables_sql() -> str:
        return (
            "SELECT table_name, table_schema FROM information_schema.tables "
            "WHERE table_schema NOT IN ('pg_catalog', 'information_schema') "
            "ORDER BY table_name"
        )

    @staticmethod
    def list_columns_sql() -> str:
        return (
            "SELECT c.column_name, c.data_type, c.is_nullable, c.column_default, "
            "EXISTS ("
            "  SELECT 1 FROM information_schema.key_column_usage kcu "
            "  JOIN information_schema.table_constraints tc "
            "    ON kcu.constraint_name = tc.constraint_name "
            "    AND kcu.table_schema = tc.table_schema "
            "  WHERE tc.constraint_type = 'PRIMARY KEY' "
            "    AND kcu.table_name = c.table_name "
            "    AND kcu.column_name = c.column_name"
            ") AS is_pk "
            "FROM information_schema.columns c "
            "WHERE c.table_name = $1 "
            "  AND c.table_schema NOT IN ('pg_catalog', 'information_schema') "
            "ORDER BY c.ordinal_position"
        )

    # -- Live execution -----------------------------------------------

    async def _connect(self, config: dict[str, Any], db: Optional[str] = None):
        import asyncpg

        return await asyncpg.connect(
            host=config.get("host"),
            port=config.get("port") or 5432,
            database=db or config.get("database") or "postgres",
            user=config.get("username"),
            password=config.get("password"),
            timeout=10,
        )

    async def list_databases(self, config: dict[str, Any]) -> list[str]:
        conn = await self._connect(config)
        try:
            rows = await conn.fetch(self.list_databases_sql())
            return [r["datname"] for r in rows]
        finally:
            await conn.close()

    async def list_tables(
        self, config: dict[str, Any], db: str
    ) -> list[TableInfo]:
        conn = await self._connect(config, db=db)
        try:
            rows = await conn.fetch(self.list_tables_sql())
            return [
                TableInfo(name=r["table_name"], schema=r["table_schema"])
                for r in rows
            ]
        finally:
            await conn.close()

    async def list_columns(
        self, config: dict[str, Any], db: str, table: str
    ) -> list[ColumnInfo]:
        conn = await self._connect(config, db=db)
        try:
            rows = await conn.fetch(self.list_columns_sql(), table)
            return [
                ColumnInfo(
                    name=r["column_name"],
                    type=r["data_type"],
                    nullable=r["is_nullable"] == "YES",
                    defaultValue=r["column_default"],
                    isPrimaryKey=bool(r["is_pk"]),
                )
                for r in rows
            ]
        finally:
            await conn.close()


# --------------------------------------------------------------- MySQL


class MySqlSchemaExplorer(SchemaExplorer):
    """Schema exploration for MySQL via aiomysql."""

    @staticmethod
    def list_databases_sql() -> str:
        return "SHOW DATABASES"

    @staticmethod
    def list_tables_sql() -> str:
        return (
            "SELECT TABLE_NAME, TABLE_SCHEMA FROM information_schema.TABLES "
            "WHERE TABLE_SCHEMA = %s ORDER BY TABLE_NAME"
        )

    @staticmethod
    def list_columns_sql() -> str:
        return (
            "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY "
            "FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s "
            "ORDER BY ORDINAL_POSITION"
        )

    async def _connect(self, config: dict[str, Any], db: Optional[str] = None):
        import aiomysql

        return await aiomysql.connect(
            host=config.get("host"),
            port=config.get("port") or 3306,
            db=db or config.get("database") or "mysql",
            user=config.get("username"),
            password=config.get("password"),
            connect_timeout=10,
        )

    async def list_databases(self, config: dict[str, Any]) -> list[str]:
        conn = await self._connect(config)
        try:
            async with conn.cursor() as cur:
                await cur.execute(self.list_databases_sql())
                rows = await cur.fetchall()
                return [r[0] for r in rows]
        finally:
            conn.close()

    async def list_tables(
        self, config: dict[str, Any], db: str
    ) -> list[TableInfo]:
        conn = await self._connect(config, db=db)
        try:
            async with conn.cursor() as cur:
                await cur.execute(self.list_tables_sql(), (db,))
                rows = await cur.fetchall()
                return [
                    TableInfo(name=r[0], schema=r[1]) for r in rows
                ]
        finally:
            conn.close()

    async def list_columns(
        self, config: dict[str, Any], db: str, table: str
    ) -> list[ColumnInfo]:
        conn = await self._connect(config, db=db)
        try:
            async with conn.cursor() as cur:
                await cur.execute(self.list_columns_sql(), (db, table))
                rows = await cur.fetchall()
                return [
                    ColumnInfo(
                        name=r[0],
                        type=r[1],
                        nullable=r[2] == "YES",
                        defaultValue=r[3],
                        isPrimaryKey=r[4] == "PRI",
                    )
                    for r in rows
                ]
        finally:
            conn.close()


def build_schema_explorer(source_type: DataSourceType) -> SchemaExplorer:
    """Factory picking the right explorer for a source type."""

    if source_type == DataSourceType.POSTGRESQL:
        return PgSchemaExplorer()
    if source_type == DataSourceType.MYSQL:
        return MySqlSchemaExplorer()
    # CSV / API have no relational schema; return an empty mock.
    return MockSchemaExplorer()
