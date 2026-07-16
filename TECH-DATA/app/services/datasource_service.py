"""Data source CRUD service (S-DATA-02).

Handles create/list/get/update/delete plus connection testing. Passwords
inside ``connection_config`` are encrypted with AES-256-ECB at rest and
decrypted only when a live connection is needed.
"""

from __future__ import annotations

import copy
from typing import Any, Optional

from app.common.crypto import decrypt, encrypt
from app.common.errors import (
    DataSourceNameDuplicateError,
    DataSourceNotFoundError,
    InvalidParamError,
)
from app.models.repository import DataSourceRepository, _new_id
from app.models.schemas import (
    ConnectionTestResult,
    CreateDataSourceRequest,
    DataSource,
    DataSourceStatus,
    DataSourceType,
    UpdateDataSourceRequest,
)
from app.services.connectors import ConnectionTester, build_connection_tester


class DataSourceService:
    def __init__(
        self,
        repository: DataSourceRepository,
        tester: Optional[ConnectionTester] = None,
    ) -> None:
        self._repo = repository
        self._tester = tester

    # --------------------------------------------------------------- helpers

    @staticmethod
    def _encrypt_config(config: dict[str, Any]) -> dict[str, Any]:
        """Return a copy of ``config`` with the password encrypted."""

        out = copy.deepcopy(config)
        pw = out.get("password")
        if pw:
            out["password"] = encrypt(pw)
        return out

    @staticmethod
    def _decrypt_config(config: dict[str, Any]) -> dict[str, Any]:
        """Return a copy of ``config`` with the password decrypted."""

        out = copy.deepcopy(config)
        pw = out.get("password")
        if pw:
            try:
                out["password"] = decrypt(pw)
            except Exception:
                # If it was never encrypted (e.g. legacy data) keep as-is.
                pass
        return out

    def _resolve_tester(self, source_type: DataSourceType) -> ConnectionTester:
        if self._tester is not None:
            return self._tester
        return build_connection_tester(source_type)

    # ----------------------------------------------------------------- create

    async def create(
        self, tenant_id: str, req: CreateDataSourceRequest
    ) -> DataSource:
        # Enforce UNIQUE(tenant_id, name).
        existing = await self._repo.get_by_name(tenant_id, req.name)
        if existing is not None:
            raise DataSourceNameDuplicateError(
                f"数据源名称已存在: name={req.name}",
                data={"name": req.name},
            )

        raw_config = req.connection_config.model_dump(exclude_none=True)
        encrypted = self._encrypt_config(raw_config)

        ds = DataSource(
            id=_new_id(),
            tenant_id=tenant_id,
            name=req.name,
            source_type=req.source_type,
            connection_config=encrypted,
            status=DataSourceStatus.ACTIVE,
        )
        return await self._repo.create(ds)

    # ------------------------------------------------------------------- list

    async def list(
        self,
        tenant_id: str,
        *,
        source_type: Optional[DataSourceType] = None,
        status: Optional[DataSourceStatus] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[DataSource], int]:
        return await self._repo.list(
            tenant_id,
            source_type=source_type,
            status=status,
            page=page,
            page_size=page_size,
        )

    # ------------------------------------------------------------------- get

    async def get(self, tenant_id: str, ds_id: str) -> DataSource:
        ds = await self._repo.get(ds_id, tenant_id)
        if ds is None:
            raise DataSourceNotFoundError(
                f"数据源不存在: id={ds_id}",
                data={"id": ds_id},
            )
        return ds

    # ---------------------------------------------------------------- update

    async def update(
        self, tenant_id: str, ds_id: str, req: UpdateDataSourceRequest
    ) -> DataSource:
        ds = await self.get(tenant_id, ds_id)

        fields: dict[str, Any] = {}

        if req.name is not None and req.name != ds.name:
            dup = await self._repo.get_by_name(tenant_id, req.name)
            if dup is not None and dup.id != ds_id:
                raise DataSourceNameDuplicateError(
                    f"数据源名称已存在: name={req.name}",
                    data={"name": req.name},
                )
            fields["name"] = req.name

        if req.source_type is not None:
            fields["source_type"] = req.source_type

        if req.connection_config is not None:
            raw = req.connection_config.model_dump(exclude_none=True)
            fields["connection_config"] = self._encrypt_config(raw)

        if req.status is not None:
            fields["status"] = req.status

        if not fields:
            return ds

        updated = await self._repo.update(ds_id, tenant_id, fields)
        if updated is None:
            raise DataSourceNotFoundError(
                f"数据源不存在: id={ds_id}",
                data={"id": ds_id},
            )
        return updated

    # ---------------------------------------------------------------- delete

    async def delete(self, tenant_id: str, ds_id: str) -> bool:
        await self.get(tenant_id, ds_id)
        return await self._repo.delete(ds_id, tenant_id)

    # -------------------------------------------------------- connection test

    async def test_connection(
        self, tenant_id: str, ds_id: str
    ) -> ConnectionTestResult:
        ds = await self.get(tenant_id, ds_id)
        config = self._decrypt_config(ds.connection_config)
        tester = self._resolve_tester(ds.source_type)
        return await tester.test(ds.source_type, config)
