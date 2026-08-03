"""ADS publish workflow — Paimon DWD → Iceberg ADS layer.

The publish workflow is the data platform's promotion gate from
DWD (Paimon, the streaming lakehouse) to ADS (Iceberg, the
analytical surface) — see architecture-implementation §6 step 4.
A Paimon DWD table is promoted to an Iceberg ADS table by
registering the same physical storage under the Iceberg REST
catalog; downstream readers (Trino, Spark, Flink) then resolve
the table via either catalog.

The workflow has 4 steps (matches architecture-implementation §6):

    1. Resolve the data product (must be ``published`` or
       ``certified``).
    2. Create the Iceberg namespace (idempotent — swallow 409
       ``namespace already exists``).
    3. Register the table in the Iceberg REST catalog pointing
       at the existing Paimon metadata.
    4. Bump the version on the data product + emit an
       ``data.ads.published`` outbox event.

The publisher mirrors ``DebeziumEngine``'s pattern: thin service
that owns its outbound adapter (``IcebergRestAdapter``) and an
optional outbox writer. Tests inject the adapter as a mock and
the outbox as an ``InMemoryOutboxWriter``.
"""
from __future__ import annotations

from dataclasses import dataclass

from mate_platform.messaging.events import Event
from mate_platform.messaging.outbox import InMemoryOutboxWriter

from ..repositories.in_memory import (
    get_data_product,
    set_data_product_status,
)
from .iceberg_rest_adapter import IcebergRestAdapter, IcebergRestError


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class AdsPublishResult:
    """Result of a publish operation."""

    product_id: str
    source_paimon_table: str
    target_iceberg_table: str
    version: int
    modality: str
    status: str  # "published" | "failed"
    rows_published: int  # 0 in mock (real impl would query Paimon snapshot)


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------
class AdsPublisherError(Exception):
    """Raised when the publish workflow cannot complete.

    Carries a ``status_code`` field so HTTP handlers can map to the
    right HTTP status (404 / 409 / 422).
    """

    def __init__(self, message: str, *, status_code: int = 500) -> None:
        super().__init__(message)
        self.status_code = status_code


# ---------------------------------------------------------------------------
# Publisher
# ---------------------------------------------------------------------------
class AdsPublisher:
    """Publishes a Paimon DWD table to the Iceberg ADS layer.

    The publisher is constructed with an
    ``IcebergRestAdapter`` (outbound HTTP) and an optional
    ``InMemoryOutboxWriter`` (event emission). For production the
    adapter is built from environment variables via
    ``IcebergRestAdapter.from_env()``; for tests the adapter is
    replaced with an ``AsyncMock``.
    """

    # Lifecycle states that are eligible for publish.
    PUBLISHABLE_STATUSES: tuple[str, ...] = ("published", "certified")

    def __init__(
        self,
        *,
        iceberg_adapter: IcebergRestAdapter,
        outbox_writer: InMemoryOutboxWriter | None = None,
    ) -> None:
        self._adapter = iceberg_adapter
        self._outbox = outbox_writer

    async def publish(
        self,
        tenant_id: str,
        product_id: str,
        *,
        trace_id: str = "",
    ) -> AdsPublishResult:
        """Run the 4-step publish workflow.

        Returns an ``AdsPublishResult`` with ``status="published"``
        on success or ``status="failed"`` if the adapter call fails
        with a transient (5xx) error.

        Raises ``AdsPublisherError`` for pre-flight validation
        failures:
          - ``status_code=404`` when the product is unknown.
          - ``status_code=422`` when the product's lifecycle status
            is not in ``("published", "certified")`` or when the
            ``target_iceberg_table`` is malformed.
          - ``status_code=400`` for 4xx errors from the Iceberg
            REST adapter (configuration / contract errors that
            retrying will not fix).
        """
        # 1. Resolve the data product — 404 if unknown.
        product = get_data_product(tenant_id, product_id)
        if product is None:
            raise AdsPublisherError(
                f"data product {product_id!r} not found for tenant {tenant_id!r}",
                status_code=404,
            )

        # 2. Validate lifecycle status.
        if product.status not in self.PUBLISHABLE_STATUSES:
            raise AdsPublisherError(
                f"data product {product_id!r} is in status {product.status!r}; "
                f"publish requires one of {self.PUBLISHABLE_STATUSES!r}",
                status_code=422,
            )

        namespace, name = _parse_iceberg_target(product.target_iceberg_table)

        # 3a. Create the namespace (idempotent — swallow 409).
        try:
            await self._create_namespace_idempotent(namespace)
        except IcebergRestError as exc:
            # Other 4xx errors (other than 409) are configuration
            # problems that retrying won't fix.
            if 400 <= exc.status_code < 500:
                raise AdsPublisherError(
                    f"Iceberg REST rejected namespace creation: {exc}",
                    status_code=400,
                ) from exc
            return self._failed_result(product, exc)

        # 3b. Register the table. On transient (5xx) failure we
        #     return a failed result without bumping the version;
        #     on client (4xx) errors we re-raise.
        try:
            await self._adapter.register_table(
                source_table=product.source_paimon_table,
                target_namespace=".".join(namespace),
                target_name=name,
            )
        except IcebergRestError as exc:
            if 400 <= exc.status_code < 500:
                raise AdsPublisherError(
                    f"Iceberg REST rejected the table registration for "
                    f"{product.target_iceberg_table!r}: {exc}",
                    status_code=400,
                ) from exc
            return self._failed_result(product, exc)

        # 4. Bump version on the data product (records the publish
        #    milestone in history). Use bump_version=True without
        #    changing status — the publish transition is recorded
        #    by the bumped version + the outbox event below.
        bumped = set_data_product_status(
            tenant_id, product.id, product.status, bump_version=True,
        )
        new_version = bumped.version if bumped is not None else product.version + 1

        # 5. Emit outbox event.
        if self._outbox is not None:
            self._outbox.append(
                Event.create(
                    type="data.ads.published",
                    tenant_id=tenant_id,
                    aggregate_id=product.id,
                    payload={
                        "product_id": product.id,
                        "source_paimon_table": product.source_paimon_table,
                        "target_iceberg_table": product.target_iceberg_table,
                        "namespace": ".".join(namespace),
                        "name": name,
                        "version": new_version,
                        "modality": product.modality,
                    },
                    trace_id=trace_id,
                ),
            )

        return AdsPublishResult(
            product_id=product.id,
            source_paimon_table=product.source_paimon_table,
            target_iceberg_table=product.target_iceberg_table,
            version=new_version,
            modality=product.modality,
            status="published",
            rows_published=0,  # real impl: query Paimon snapshot metadata
        )

    # -----------------------------------------------------------------
    # Internals
    # -----------------------------------------------------------------
    async def _create_namespace_idempotent(
        self, namespace: tuple[str, ...],
    ) -> None:
        """Create a namespace, treating 409 as success (idempotent)."""
        try:
            await self._adapter.create_namespace(namespace)
        except IcebergRestError as exc:
            if exc.status_code == 409:
                return  # already exists — idempotent success
            raise

    def _failed_result(self, product, exc: IcebergRestError) -> AdsPublishResult:
        """Build a ``status='failed'`` result without bumping version."""
        return AdsPublishResult(
            product_id=product.id,
            source_paimon_table=product.source_paimon_table,
            target_iceberg_table=product.target_iceberg_table,
            version=product.version,
            modality=product.modality,
            status="failed",
            rows_published=0,
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _parse_iceberg_target(target: str) -> tuple[tuple[str, ...], str]:
    """Parse a fully qualified Iceberg table name into (namespace, name).

    Accepts dotted notation with the last segment as the table name
    and the earlier segments as the (possibly multi-level) namespace,
    matching the Iceberg REST convention.

        "iceberg.ads.orders_summary" → (("iceberg", "ads"), "orders_summary")
        "dwd.orders"                  → (("dwd",), "orders")

    A bare segment (no dots) is rejected — Iceberg requires at
    least one namespace level.
    """
    parts = target.split(".")
    if len(parts) < 2:
        raise AdsPublisherError(
            f"target_iceberg_table {target!r} must have at least one dot "
            f"(namespace.name)",
            status_code=422,
        )
    return tuple(parts[:-1]), parts[-1]
