"""Dagster engine adapter — manages runs via the Dagster GraphQL API.

Dagster exposes a GraphQL endpoint (typically at ``/graphql``) for
launching runs, querying run status, and inspecting pipelines. This
adapter uses ``httpx.AsyncClient`` for all calls.

GraphQL operations:

    - ``LaunchPipelineRun`` — start a run
    - ``PipelineRunStatus`` — query run status
    - ``CancelPipelineRun`` — cancel a running run
    - ``RepositoryLocations`` — list repositories

Configuration (all from environment variables):

    DAGSTER_URL        — base URL of the Dagster web server
                         (default: ``http://localhost:3000``)
    DAGSTER_AUTH_TOKEN — bearer token for the GraphQL API
                         (default: empty)
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any

import httpx

# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------
class DagsterEngineError(Exception):
    """Raised when a Dagster GraphQL call fails."""

    def __init__(
        self, message: str, *,
        status_code: int = 0, response_body: str = "",
        errors: list[dict[str, Any]] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.response_body = response_body
        self.errors = errors or []


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class DagsterRunResult:
    """Result of a Dagster run operation."""

    task_id: str
    run_id: str
    status: str  # launched | running | success | failure | canceled | unknown
    response: dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# GraphQL queries/mutations
# ---------------------------------------------------------------------------
_LAUNCH_RUN_MUTATION = """
mutation LaunchRun($runConfigData: RunConfigData, $selector: PipelineSelector!) {
    launchPipelineRun(executionParams: {
        runConfigData: $runConfigData
        selector: $selector
    }) {
        __typename
        ... on LaunchRunSuccess {
            run {
                runId
                status
            }
        }
        ... on PythonError {
            message
        }
        ... on InvalidStepError {
            invalidStepKey
        }
        ... on InvalidOutputError {
            invalidOutputName
        }
        ... on UnauthorizedError {
            message
        }
        ... on ConflictingExecutionParamsError {
            message
        }
        ... on PresetMismatchError {
            message
        }
    }
}
"""

_RUN_STATUS_QUERY = """
query RunStatus($runId: String!) {
    pipelineRunOrError(runId: $runId) {
        __typename
        ... on Run {
            runId
            status
        }
        ... on PythonError {
            message
        }
        ... on RunNotFoundError {
            message
        }
    }
}
"""

_CANCEL_RUN_MUTATION = """
mutation CancelRun($runId: String!) {
    terminatePipelineExecution(runId: $runId) {
        __typename
        ... on TerminateRunSuccess {
            run {
                runId
                status
            }
        }
        ... on PythonError {
            message
        }
        ... on RunNotFoundError {
            message
        }
    }
}
"""


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------
class DagsterEngine:
    """Real Dagster engine adapter using the GraphQL API.

    The engine maintains a reusable ``httpx.AsyncClient`` for
    connection pooling. Auth is configurable via env vars.
    """

    def __init__(
        self,
        *,
        base_url: str = "http://localhost:3000",
        auth_token: str = "",
        timeout_seconds: float = 30.0,
        max_retries: int = 2,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._auth_token = auth_token
        self._timeout = timeout_seconds
        self._max_retries = max_retries
        self._client = client
        self._owns_client = client is None

    @classmethod
    def from_env(cls, *, timeout_seconds: float = 30.0) -> DagsterEngine:
        """Build an engine from environment variables."""
        return cls(
            base_url=os.environ.get("DAGSTER_URL", "http://localhost:3000"),
            auth_token=os.environ.get("DAGSTER_AUTH_TOKEN", ""),
            timeout_seconds=timeout_seconds,
        )

    # -----------------------------------------------------------------
    # Lifecycle
    # -----------------------------------------------------------------
    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            headers: dict[str, str] = {"Content-Type": "application/json"}
            if self._auth_token:
                headers["Authorization"] = f"Bearer {self._auth_token}"
            self._client = httpx.AsyncClient(
                base_url=self._base_url,
                timeout=self._timeout,
                headers=headers,
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
    async def trigger_task(
        self,
        task_id: str,
        *,
        repository_location_name: str,
        repository_name: str,
        pipeline_name: str,
        run_config: dict[str, Any] | None = None,
    ) -> DagsterRunResult:
        """Launch a Dagster pipeline run via GraphQL mutation."""
        variables = {
            "selector": {
                "repositoryLocationName": repository_location_name,
                "repositoryName": repository_name,
                "pipelineName": pipeline_name,
            },
            "runConfigData": run_config or {},
        }
        resp = await self._graphql(_LAUNCH_RUN_MUTATION, variables)
        launch_data = resp.get("data", {}).get("launchPipelineRun", {})
        typename = launch_data.get("__typename", "")
        if typename != "LaunchRunSuccess":
            error_msg = launch_data.get("message", f"Launch failed: {typename}")
            raise DagsterEngineError(
                f"Dagster launch failed for task {task_id}: {error_msg}",
                errors=[launch_data],
            )
        run_data = launch_data.get("run", {})
        run_id = run_data.get("runId", "")
        raw_status = str(run_data.get("status", "LAUNCHED")).upper()
        status = self._map_status(raw_status)
        return DagsterRunResult(
            task_id=task_id,
            run_id=run_id,
            status=status,
            response=resp,
        )

    async def get_run_status(
        self, task_id: str, run_id: str,
    ) -> DagsterRunResult:
        """Query the status of a Dagster run via GraphQL query."""
        variables = {"runId": run_id}
        resp = await self._graphql(_RUN_STATUS_QUERY, variables)
        run_data = resp.get("data", {}).get("pipelineRunOrError", {})
        typename = run_data.get("__typename", "")
        if typename != "Run":
            error_msg = run_data.get("message", f"Run not found: {typename}")
            raise DagsterEngineError(
                f"Dagster run {run_id} not found for task {task_id}: {error_msg}",
                errors=[run_data],
            )
        raw_status = str(run_data.get("status", "UNKNOWN")).upper()
        status = self._map_status(raw_status)
        return DagsterRunResult(
            task_id=task_id,
            run_id=run_id,
            status=status,
            response=resp,
        )

    async def cancel_run(
        self, task_id: str, run_id: str,
    ) -> DagsterRunResult:
        """Cancel a Dagster run via GraphQL mutation."""
        variables = {"runId": run_id}
        resp = await self._graphql(_CANCEL_RUN_MUTATION, variables)
        cancel_data = resp.get("data", {}).get("terminatePipelineExecution", {})
        typename = cancel_data.get("__typename", "")
        if typename != "TerminateRunSuccess":
            error_msg = cancel_data.get("message", f"Cancel failed: {typename}")
            raise DagsterEngineError(
                f"Dagster cancel failed for run {run_id}: {error_msg}",
                errors=[cancel_data],
            )
        run_data = cancel_data.get("run", {})
        raw_status = str(run_data.get("status", "CANCELED")).upper()
        status = self._map_status(raw_status)
        return DagsterRunResult(
            task_id=task_id,
            run_id=run_id,
            status=status,
            response=resp,
        )

    # -----------------------------------------------------------------
    # Internals
    # -----------------------------------------------------------------
    async def _graphql(
        self,
        query: str,
        variables: dict[str, Any],
    ) -> dict[str, Any]:
        """Execute a GraphQL request with retry."""
        client = await self._get_client()
        payload = {"query": query, "variables": variables}
        last_exc: Exception | None = None
        for attempt in range(self._max_retries + 1):
            try:
                resp = await client.post("/graphql", json=payload)
                if resp.status_code >= 500 and attempt < self._max_retries:
                    last_exc = DagsterEngineError(
                        f"Dagster GraphQL returned {resp.status_code}",
                        status_code=resp.status_code,
                        response_body=resp.text[:500],
                    )
                    continue
                if resp.status_code >= 400:
                    raise DagsterEngineError(
                        f"Dagster GraphQL returned {resp.status_code}: "
                        f"{resp.text[:300]}",
                        status_code=resp.status_code,
                        response_body=resp.text[:500],
                    )
                body = resp.json()
                # GraphQL errors in the response body
                if "errors" in body:
                    raise DagsterEngineError(
                        f"Dagster GraphQL errors: {body['errors'][:300]}",
                        status_code=200,
                        response_body=str(body),
                        errors=body["errors"],
                    )
                return body
            except httpx.TimeoutException as exc:
                last_exc = DagsterEngineError(
                    f"Dagster GraphQL timed out after {self._timeout}s",
                )
                if attempt >= self._max_retries:
                    raise last_exc from exc
            except httpx.HTTPError as exc:
                last_exc = DagsterEngineError(
                    f"Dagster GraphQL HTTP error: {exc}",
                )
                if attempt >= self._max_retries:
                    raise last_exc from exc
        if last_exc:
            raise last_exc
        raise DagsterEngineError("Dagster GraphQL request failed without exception")

    def _map_status(self, raw: str) -> str:
        """Map Dagster status enum to our canonical status."""
        status_map = {
            "LAUNCHED": "launched",
            "STARTED": "running",
            "STARTING": "running",
            "CANCELING": "canceled",
            "CANCELED": "canceled",
            "SUCCESS": "success",
            "FAILURE": "failure",
            "MANAGED": "running",
            "QUEUED": "running",
        }
        return status_map.get(raw, "unknown")
