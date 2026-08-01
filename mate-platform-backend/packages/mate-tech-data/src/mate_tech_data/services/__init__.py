"""Engine adapters for the data platform control plane.

This package holds the real engine integration that
``AsyncDataClient`` delegates to:

* ``DebeziumEngine`` — manages CDC connectors via the Kafka Connect
  REST API (``httpx.AsyncClient``).

The engine reads its configuration from environment variables
(ADR-0014 step 4).
"""
from .debezium_engine import DebeziumEngine, DebeziumEngineError

__all__ = [
    "DebeziumEngine",
    "DebeziumEngineError",
]
