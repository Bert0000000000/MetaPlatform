"""DATA-D2 DataHub data product modeling.

This module provides:
  - ``DataProduct`` dataclass — per-tenant data product contract
    (datasets, owner, version, lineage reference).
  - ``DataHubClient`` protocol — emit DataProduct to DataHub GMS.
  - ``InMemoryDataHubClient`` — in-process implementation used by
    tests and local dev (no external DataHub dependency).

Design rationale:
  - D2 builds on the lineage infrastructure from D1 (P3-W6).
    Each DataProduct carries a lineage reference that connects
    DataHub catalog entries back to Marquez/OpenLineage jobs.
  - Per SEC-TENANT-01 hard rule 3: every DataProduct is scoped
    to a tenant; cross-tenant listing / mutation is rejected.
  - Versioning is SemVer; bumping version emits a new catalog
    entry rather than mutating the existing one.

Per ADR-0016 §3.2 (D2 scope).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Protocol

from ..lineage import LineageHints


class DataHubError(Exception):
    """Base error for DataHub client operations."""


class DataProductNotFoundError(DataHubError):
    """Raised when a DataProduct lookup fails."""


class TenantMismatchError(DataHubError):
    """Raised when a cross-tenant DataProduct access is attempted."""


@dataclass(frozen=True)
class Dataset:
    """A single dataset within a DataProduct.

    Mirrors the ``spec.datasets[*]`` entry of the DataProduct CRD
    (``infra/helm/charts/datahub/templates/dataproduct.yaml``).
    """

    name: str
    type: str = "table"  # table | view | stream | file
    schema_ref: str = ""
    sla: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class DataProduct:
    """A tenant-scoped data product contract.

    Fields mirror the DataProduct CRD spec so the same object can
    be rendered to YAML (helm template) or emitted to DataHub GMS
    (REST API). Idempotent on (tenant_id, id, version).
    """

    id: str
    tenant_id: str
    domain: str  # iam | msg | obs | rag | kb | agent | copilot | dw | data | ...
    owner: str
    version: str  # semver: "1.0.0"
    description: str = ""
    datasets: tuple[Dataset, ...] = field(default_factory=tuple)
    quality: dict[str, Any] = field(default_factory=dict)
    lineage_hints: LineageHints | None = None
    created_at: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


@dataclass(frozen=True)
class DataProductVersion:
    """A snapshot of a DataProduct at a specific version."""

    product: DataProduct
    recorded_at: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


class DataHubClient(Protocol):
    """Protocol for DataHub catalog operations (D2)."""

    def register(self, product: DataProduct) -> DataProductVersion:
        """Register (or upgrade) a DataProduct in the catalog."""
        ...

    def get(
        self, tenant_id: str, product_id: str, version: str | None = None
    ) -> DataProduct:
        """Look up a DataProduct by id (optionally pinned to version)."""
        ...

    def list_products(
        self, tenant_id: str, domain: str | None = None
    ) -> list[DataProduct]:
        """List DataProducts for a tenant, optionally filtered by domain."""
        ...

    def list_versions(
        self, tenant_id: str, product_id: str
    ) -> list[DataProductVersion]:
        """Return the full version history of a DataProduct."""
        ...

    def delete(self, tenant_id: str, product_id: str) -> int:
        """Delete a DataProduct; return number of versions removed."""
        ...


class InMemoryDataHubClient:
    """In-process DataHubClient implementation.

    Stores DataProducts in a dict keyed by (tenant_id, product_id, version).
    Enforces tenant isolation at every method boundary.

    Thread-safety: not thread-safe; intended for single-process tests
    and local dev. Production uses the HTTP DataHub GMS REST client.
    """

    def __init__(self) -> None:
        # (tenant_id, product_id, version) -> DataProductVersion
        self._store: dict[tuple[str, str, str], DataProductVersion] = {}

    # ------------------------------------------------------------------
    # helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _key(p: DataProduct) -> tuple[str, str, str]:
        return (p.tenant_id, p.id, p.version)

    def _tenant_check(self, tenant_id: str, product: DataProduct) -> None:
        if product.tenant_id != tenant_id:
            raise TenantMismatchError(
                f"DataProduct {product.id!r} belongs to tenant "
                f"{product.tenant_id!r}, not {tenant_id!r}"
            )

    # ------------------------------------------------------------------
    # public API
    # ------------------------------------------------------------------
    def register(self, product: DataProduct) -> DataProductVersion:
        # Validate version semver-ish format (X.Y.Z).
        parts = product.version.split(".")
        if len(parts) != 3 or not all(p.isdigit() for p in parts):
            raise DataHubError(
                f"invalid semver version: {product.version!r}"
            )
        version = DataProductVersion(product=product)
        self._store[self._key(product)] = version
        return version

    def get(
        self, tenant_id: str, product_id: str, version: str | None = None
    ) -> DataProduct:
        if version is not None:
            key = (tenant_id, product_id, version)
            entry = self._store.get(key)
            if entry is None:
                raise DataProductNotFoundError(
                    f"DataProduct {product_id!r} version {version!r} "
                    f"not found for tenant {tenant_id!r}"
                )
            return entry.product
        # Latest version = max semver for (tenant, id).
        matching = [
            v
            for (t, pid, _ver), v in self._store.items()
            if t == tenant_id and pid == product_id
        ]
        if not matching:
            raise DataProductNotFoundError(
                f"DataProduct {product_id!r} not found "
                f"for tenant {tenant_id!r}"
            )
        return max(matching, key=lambda v: _semver_tuple(v.product.version)).product

    def list_products(
        self, tenant_id: str, domain: str | None = None
    ) -> list[DataProduct]:
        # Deduplicate by product id, picking the latest version.
        by_id: dict[str, DataProduct] = {}
        for (t, pid, _ver), entry in self._store.items():
            if t != tenant_id:
                continue
            if domain is not None and entry.product.domain != domain:
                continue
            existing = by_id.get(pid)
            if (
                existing is None
                or _semver_tuple(entry.product.version)
                > _semver_tuple(existing.version)
            ):
                by_id[pid] = entry.product
        return sorted(by_id.values(), key=lambda p: p.id)

    def list_versions(
        self, tenant_id: str, product_id: str
    ) -> list[DataProductVersion]:
        versions = [
            v
            for (t, pid, _ver), v in self._store.items()
            if t == tenant_id and pid == product_id
        ]
        return sorted(
            versions, key=lambda v: _semver_tuple(v.product.version)
        )

    def delete(self, tenant_id: str, product_id: str) -> int:
        keys = [
            k
            for k in list(self._store.keys())
            if k[0] == tenant_id and k[1] == product_id
        ]
        for k in keys:
            del self._store[k]
        return len(keys)

    # ------------------------------------------------------------------
    # test helpers — DO NOT call from production code
    # ------------------------------------------------------------------
    def reset(self) -> None:
        self._store.clear()


def _semver_tuple(version: str) -> tuple[int, int, int]:
    """Parse 'X.Y.Z' into (X, Y, Z) tuple for comparison."""
    parts = version.split(".")
    try:
        return tuple(int(p) for p in parts)  # type: ignore[return-value]
    except ValueError:
        return (0, 0, 0)
