"""Engine adapters for the metrics control plane.

This package holds the real engine integration that
``AsyncMetricsClient`` delegates to:

* ``DbtMetricsEngine`` — runs dbt metrics/commands via the ``dbt``
  CLI (``asyncio.subprocess``).

The engine reads its configuration from environment variables
(ADR-0014 step 4).
"""
from .dbt_engine import DbtMetricsEngine, DbtMetricsError

__all__ = [
    "DbtMetricsEngine",
    "DbtMetricsError",
]
