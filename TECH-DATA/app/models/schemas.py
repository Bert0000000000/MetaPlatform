"""Pydantic schemas for the Data Source & Schema Discovery domain."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class DataSourceType(str, Enum):
    MYSQL = "MYSQL"
    POSTGRESQL = "POSTGRESQL"
    CSV = "CSV"
    API = "API"


class DataSourceStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class ConnectionConfig(BaseModel):
    """Connection parameters stored (encrypted at rest) as JSONB."""

    host: Optional[str] = None
    port: Optional[int] = None
    database: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    url: Optional[str] = None
    filePath: Optional[str] = None

    model_config = {"extra": "allow"}


class DataSource(BaseModel):
    """Persisted data source record."""

    id: str
    tenant_id: str
    name: str
    source_type: DataSourceType
    connection_config: dict[str, Any]
    status: DataSourceStatus = DataSourceStatus.ACTIVE
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ----------------------------------------------------------- request schemas


class CreateDataSourceRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    source_type: DataSourceType
    connection_config: ConnectionConfig


class UpdateDataSourceRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=128)
    source_type: Optional[DataSourceType] = None
    connection_config: Optional[ConnectionConfig] = None
    status: Optional[DataSourceStatus] = None


# ------------------------------------------------------------ response schemas


def _mask_password(cfg: dict[str, Any]) -> dict[str, Any]:
    """Return a copy of ``cfg`` with the password field masked."""

    masked = dict(cfg)
    if "password" in masked and masked["password"]:
        masked["password"] = "********"
    return masked


def to_list_item(ds: DataSource) -> dict[str, Any]:
    return {
        "id": ds.id,
        "tenantId": ds.tenant_id,
        "name": ds.name,
        "sourceType": ds.source_type.value if isinstance(ds.source_type, DataSourceType) else ds.source_type,
        "connectionConfig": _mask_password(ds.connection_config),
        "status": ds.status.value if isinstance(ds.status, DataSourceStatus) else ds.status,
        "createdAt": ds.created_at,
        "updatedAt": ds.updated_at,
    }


def to_detail(ds: DataSource) -> dict[str, Any]:
    return to_list_item(ds)


class ConnectionTestResult(BaseModel):
    success: bool
    message: str
    latencyMs: Optional[int] = None


class ColumnInfo(BaseModel):
    """A single column discovered from a table."""

    name: str
    type: str
    nullable: bool
    defaultValue: Optional[str] = None
    isPrimaryKey: bool = False


class TableInfo(BaseModel):
    name: str
    schema: Optional[str] = None


class DatabaseInfo(BaseModel):
    name: str
