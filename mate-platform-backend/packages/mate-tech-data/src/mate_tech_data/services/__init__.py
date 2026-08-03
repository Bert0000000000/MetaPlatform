"""Engine adapters for the data platform control plane.

This package holds the real engine integration that
``AsyncDataClient`` delegates to:

* ``DebeziumEngine`` — manages CDC connectors via the Kafka Connect
  REST API (``httpx.AsyncClient``).
* ``IcebergRestAdapter`` — manages namespaces + tables in the
  Iceberg REST catalog (``httpx.AsyncClient``).

The engines read their configuration from environment variables
(ADR-0014 step 4).

The package also exposes the ``AdsPublisher`` service — the
orchestrator that drives the 4-step Paimon → Iceberg ADS publish
workflow.
"""
from .ads_publisher import AdsPublisher, AdsPublisherError, AdsPublishResult
from .debezium_engine import DebeziumEngine, DebeziumEngineError
from .iceberg_rest_adapter import IcebergRestAdapter, IcebergRestError

__all__ = [
    "AdsPublishResult",
    "AdsPublisher",
    "AdsPublisherError",
    "DebeziumEngine",
    "DebeziumEngineError",
    "IcebergRestAdapter",
    "IcebergRestError",
]
