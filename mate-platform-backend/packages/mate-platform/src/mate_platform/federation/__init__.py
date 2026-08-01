"""Public API for mate_platform.federation (DATA-D8)."""
from .client import (
    DataSourceAdapter,
    FederationClient,
    FederationResult,
    InMemoryDataSourceAdapter,
    TenantQueryResult,
)

__all__ = [
    "DataSourceAdapter",
    "FederationClient",
    "FederationResult",
    "InMemoryDataSourceAdapter",
    "TenantQueryResult",
]
