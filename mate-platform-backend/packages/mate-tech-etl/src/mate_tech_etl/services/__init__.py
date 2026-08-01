"""Engine adapters for the ETL task control plane.

This package holds the real engine integrations that
``AsyncEtlClient`` delegates to:

* ``SparkSubmitEngine`` — submits/kills/statuses Spark jobs via
  the ``spark-submit`` CLI (``asyncio.subprocess``).
* ``FlinkSubmitEngine`` — submits/cancels/statuses Flink jobs via
  the Flink JobManager REST API (``httpx.AsyncClient``).

Both engines read their configuration from environment variables
(ADR-0014 step 4) and follow the mate-clients ACL pattern for
outbound HTTP calls.
"""
from .flink_engine import FlinkSubmitEngine, FlinkSubmitError
from .spark_engine import SparkSubmitEngine, SparkSubmitError

__all__ = [
    "FlinkSubmitEngine",
    "FlinkSubmitError",
    "SparkSubmitEngine",
    "SparkSubmitError",
]
