"""Engine adapters for the scheduler control plane.

This package holds the real engine integrations that
``AsyncSchedulerClient`` delegates to:

* ``AirflowEngine`` — manages DAGs via the Airflow REST API
  (``httpx.AsyncClient``).
* ``DagsterEngine`` — manages runs via the Dagster GraphQL API
  (``httpx.AsyncClient``).

Both engines read their configuration from environment variables
(ADR-0014 step 4).
"""
from .airflow_engine import AirflowEngine, AirflowEngineError
from .dagster_engine import DagsterEngine, DagsterEngineError

__all__ = [
    "AirflowEngine",
    "AirflowEngineError",
    "DagsterEngine",
    "DagsterEngineError",
]
