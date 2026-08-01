"""Airflow engine adapter — manages DAGs via the Airflow REST API.

The Airflow Stable REST API (``/api/v1/``) exposes endpoints for
listing, pausing, triggering, and inspecting DAGs. This adapter uses
``httpx.AsyncClient`` for all calls and follows the mate-clients ACL
pattern (configurable auth, timeout, retry).

REST API reference (Airflow 2.x):

    GET    /api/v1/dags                    — list DAGs
    GET    /api/v1/dags/{dag_id}           — get DAG detail
    PATCH  /api/v1/dags/{dag_id}           — update DAG (pause/unpause)
    POST   /api/v1/dags/{dag_id}/dagRuns   — trigger a DAG run
    GET    /api/v1/dags/{dag_id}/dagRuns   — list DAG runs

Configuration (all from environment variables):

    AIRFLOW_URL          — base URL of the Airflow web server
                           (default: ``http://localhost:8081``)
    AIRFLOW_AUTH_TOKEN   — bearer token for the REST API
                           (default: empty)
    AIRFLOW_USERNAME     — basic auth username (alternative to token)
    AIRFLOW_PASSWORD     — basic auth password
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any

import httpx

# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------
class AirflowEngineError(Exception):
    """Raised when an Airflow REST API call fails."""

    def __init__(
        self, message: str, *,
        status_code: int = 0, response_body: str = "",
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.response_body = response_body


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class AirflowTaskResult:
    """Result of an Airflow DAG operation."""

    task_id: str
    dag_id: str
    status: str  # paused | active | running | succeeded | failed | unknown
    run_id: str = ""
    response: dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------
class AirflowEngine:
    """Real Airflow engine adapter using the REST API.

    The engine maintains a reusable ``httpx.AsyncClient`` for
    connection pooling. Auth is configurable: either a bearer token
    (``AIRFLOW_AUTH_TOKEN``) or basic auth (``AIRFLOW_USERNAME`` /
    ``AIRFLOW_PASSWORD``).
    """

    def __init__(
        self,
        *,
        base_url: str = "http://localhost:8081",
        auth_token: str = "",
        username: str = "",
        password: str = "",
        timeout_seconds: float = 30.0,
        max_retries: int = 2,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._auth_token = auth_token
        self._username = username
        self._password = password
        self._timeout = timeout_seconds
        self._max_retries = max_retries
        self._client = client
        self._owns_client = client is None

    @classmethod
    def from_env(cls, *, timeout_seconds: float = 30.0) -> AirflowEngine:
        """Build an engine from environment variables."""
        return cls(
            base_url=os.environ.get("AIRFLOW_URL", "http://localhost:8081"),
            auth_token=os.environ.get("AIRFLOW_AUTH_TOKEN", ""),
            username=os.environ.get("AIRFLOW_USERNAME", ""),
            password=os.environ.get("AIRFLOW_PASSWORD", ""),
            timeout_seconds=timeout_seconds,
        )

    # -----------------------------------------------------------------
    # Lifecycle
    # -----------------------------------------------------------------
    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            headers: dict[str, str] = {}
            if self._auth_token:
                headers["Authorization"] = f"Bearer {self._auth_token}"
            auth: httpx.BasicAuth | None = None
            if self._username and self._password:
                auth = httpx.BasicAuth(self._username, self._password)
            self._client = httpx.AsyncClient(
                base_url=self._base_url,
                timeout=self._timeout,
                headers=headers,
                auth=auth,
            )
        return self._client

    async def close(self) -> None:
        """Close the underlying HTTP client if owned by this engine."""
        if self._client is not None and self._owns_client:
            await self._client.aclose()
            self._client = None

    # -----------------------------------------------------------------
    # Public API
    # -----------------------------------------------------------------
    async def pause_task(
        self, task_id: str, dag_id: str,
    ) -> AirflowTaskResult:
        """Pause a DAG via PATCH /dags/{dag_id} with is_paused=true."""
        resp = await self._request(
            "PATCH", f"/api/v1/dags/{dag_id}",
            json={"is_paused": True},
        )
        is_paused = resp.get("is_paused", True)
        status = "paused" if is_paused else "active"
        return AirflowTaskResult(
            task_id=task_id,
            dag_id=dag_id,
            status=status,
            response=resp,
        )

    async def trigger_task(
        self,
        task_id: str,
        dag_id: str,
        *,
        conf: dict[str, Any] | None = None,
    ) -> AirflowTaskResult:
        """Trigger a DAG run via POST /dags/{dag_id}/dagRuns."""
        body: dict[str, Any] = {"conf": conf or {}}
        resp = await self._request(
            "POST", f"/api/v1/dags/{dag_id}/dagRuns", json=body,
        )
        run_id = resp.get("dag_run_id", "")
        state = str(resp.get("state", "running")).lower()
        return AirflowTaskResult(
            task_id=task_id,
            dag_id=dag_id,
            status=state,
            run_id=run_id,
            response=resp,
        )

    async def get_dag(
        self, task_id: str, dag_id: str,
    ) -> AirflowTaskResult:
        """Get DAG detail via GET /dags/{dag_id}."""
        resp = await self._request("GET", f"/api/v1/dags/{dag_id}")
        is_paused = resp.get("is_paused", False)
        is_active = resp.get("is_active", False)
        if is_paused:
            status = "paused"
        elif is_active:
            status = "active"
        else:
            status = "unknown"
        return AirflowTaskResult(
            task_id=task_id,
            dag_id=dag_id,
            status=status,
            response=resp,
        )

    async def get_dag_run_status(
        self, task_id: str, dag_id: str, run_id: str,
    ) -> AirflowTaskResult:
        """Get the status of a specific DAG run."""
        resp = await self._request(
            "GET", f"/api/v1/dags/{dag_id}/dagRuns/{run_id}",
        )
        state = str(resp.get("state", "unknown")).lower()
        return AirflowTaskResult(
            task_id=task_id,
            dag_id=dag_id,
            status=state,
            run_id=run_id,
            response=resp,
        )

    async def list_dags(self) -> list[dict[str, Any]]:
        """List all DAGs (GET /dags)."""
        resp = await self._request("GET", "/api/v1/dags")
        return resp.get("dags", [])

    # -----------------------------------------------------------------
    # Internals — HTTP with retry
    # -----------------------------------------------------------------
    async def _request(
        self,
        method: str,
        path: str,
        *,
        json: dict[str, Any] | None = None,
        params: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """Execute an HTTP request with simple retry logic."""
        client = await self._get_client()
        last_exc: Exception | None = None
        for attempt in range(self._max_retries + 1):
            try:
                resp = await client.request(
                    method, path, json=json, params=params,
                )
                if resp.status_code >= 500 and attempt < self._max_retries:
                    last_exc = AirflowEngineError(
                        f"Airflow REST {method} {path} returned {resp.status_code}",
                        status_code=resp.status_code,
                        response_body=resp.text[:500],
                    )
                    continue
                if resp.status_code >= 400:
                    raise AirflowEngineError(
                        f"Airflow REST {method} {path} returned {resp.status_code}: "
                        f"{resp.text[:300]}",
                        status_code=resp.status_code,
                        response_body=resp.text[:500],
                    )
                if resp.status_code == 204 or not resp.content:
                    return {}
                return resp.json()
            except httpx.TimeoutException as exc:
                last_exc = AirflowEngineError(
                    f"Airflow REST {method} {path} timed out after {self._timeout}s",
                )
                if attempt >= self._max_retries:
                    raise last_exc from exc
            except httpx.HTTPError as exc:
                last_exc = AirflowEngineError(
                    f"Airflow REST {method} {path} HTTP error: {exc}",
                )
                if attempt >= self._max_retries:
                    raise last_exc from exc
        if last_exc:
            raise last_exc
        raise AirflowEngineError("Airflow REST request failed without exception")
