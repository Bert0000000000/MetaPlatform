"""Repository protocol and helpers for tenant-scoped data access.

The protocol is the contract every app-* package implements when it
needs to access tenant-owned data. The protocol guarantees:
  - require_tenant(ctx) is the first line of any access method.
  - filter_by_tenant(stmt) appends the tenant_id predicate to a
    SELECT statement (the DB filter event listener in db_filter.py
    also enforces this for safety, but the protocol is what the
    type checker sees).
  - assert_tenant_owned(row_id, ctx) is used after a fetch to
    double-check that the row's tenant matches the request's
    tenant. This catches the case where the row was inserted by
    another tenant after the query was issued.
"""
from __future__ import annotations

from typing import Any, Protocol, TypeVar

from sqlalchemy import Select

from .context import RequestContext

T_co = TypeVar("T_co", covariant=True)


class TenantScopedRepository(Protocol[T_co]):
    """Protocol for repositories whose data is partitioned by tenant.

    The protocol does not prescribe a specific ORM (SQLAlchemy,
    Tortoise, raw asyncpg) so it can be used as a contract for any
    data access pattern.
    """

    def require_tenant(self, ctx: RequestContext) -> None:
        """Raise TenantAccessError if ctx has no tenant binding."""
        ...

    def filter_by_tenant(self, stmt: Select, ctx: RequestContext) -> Select:
        """Append the tenant_id predicate to the given statement.

        Implementations must use the column declared on the model's
        tenant_id attribute. The DB filter event listener will
        independently inject the same predicate; this is the
        protocol-level declaration.
        """
        ...

    def assert_tenant_owned(self, row_id: Any, ctx: RequestContext) -> None:
        """Fetch the row and verify tenant ownership.

        Used after a single-row fetch to defend against a TOCTOU
        race where the row was deleted or reassigned to another
        tenant between the query and the post-processing.
        """
        ...
