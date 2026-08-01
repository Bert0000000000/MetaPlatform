"""Flink engine adapter — submits Flink jobs via the JobManager REST API.

The Flink REST API (default port 8081) exposes endpoints for
uploading jars, starting jobs, cancelling jobs, and querying job
status. This adapter uses ``httpx.AsyncClient`` for all calls and
follows the mate-clients ACL pattern (configurable auth, timeout,
retry).

REST API reference (Flink 1.17+):

    POST   /jars/upload              — upload a JAR
    GET    /jars                     — list uploaded JARs
    POST   /jars/:jarid/run          — start a job
    PATCH  /jobs/:jobid              — cancel a job (mode=CANCEL)
    GET    /jobs/:jobid              — get job status
    GET    /jobs/overview            — list all jobs

Configuration (all from environment variables):

    FLINK_REST_URL      — base URL of the Flink JobManager REST API
                          (default: ``http://localhost:8081``)
    FLINK_AUTH_TOKEN    — optional bearer token for the REST API
                          (default: empty = no auth)
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any

import httpx

# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------
class FlinkSubmitError(Exception):
    """Raised when a Flink REST API call fails."""

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
class FlinkJobResult:
    """Result of a Flink job operation."""

    task_id: str
    job_id: str
    status: str  # submitted | running | canceled | finished | failed | unknown
    response: dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------
class FlinkSubmitEngine:
    """Real Flink engine adapter using the JobManager REST API.

    The engine maintains a reusable ``httpx.AsyncClient`` for
    connection pooling. Auth is configurable via env vars; for
    Keycloak-protected deployments, inject an
    ``OutgoingAuthMiddleware`` instance.
    """

    def __init__(
        self,
        *,
        rest_url: str = "http://localhost:8081",
        auth_token: str = "",
        timeout_seconds: float = 30.0,
        max_retries: int = 2,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._rest_url = rest_url.rstrip("/")
        self._auth_token = auth_token
        self._timeout = timeout_seconds
        self._max_retries = max_retries
        self._client = client  # injected for testing
        self._owns_client = client is None

    @classmethod
    def from_env(
        cls, *, timeout_seconds: float = 30.0,
    ) -> FlinkSubmitEngine:
        """Build an engine from environment variables."""
        return cls(
            rest_url=os.environ.get("FLINK_REST_URL", "http://localhost:8081"),
            auth_token=os.environ.get("FLINK_AUTH_TOKEN", ""),
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
            self._client = httpx.AsyncClient(
                base_url=self._rest_url,
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
    async def run_task(
        self,
        task_id: str,
        *,
        jar_id: str,
        entry_class: str | None = None,
        parallelism: int | None = None,
        program_args: list[str] | None = None,
        savepoint_path: str | None = None,
    ) -> FlinkJobResult:
        """Start a Flink job by running an already-uploaded JAR.

        POST /jars/:jarid/run
        """
        body: dict[str, Any] = {}
        if entry_class:
            body["entryClass"] = entry_class
        if parallelism is not None:
            body["parallelism"] = parallelism
        if program_args:
            body["programArgs"] = " ".join(program_args)
        if savepoint_path:
            body["savepointPath"] = savepoint_path

        resp = await self._request(
            "POST", f"/jars/{jar_id}/run", json=body,
        )
        job_id = resp.get("jobid", "")
        if not job_id:
            raise FlinkSubmitError(
                f"Flink run response missing 'jobid' for task {task_id}",
                status_code=200,
                response_body=str(resp),
            )
        return FlinkJobResult(
            task_id=task_id,
            job_id=job_id,
            status="submitted",
            response=resp,
        )

    async def stop_task(
        self, task_id: str, job_id: str,
    ) -> FlinkJobResult:
        """Cancel a running Flink job.

        PATCH /jobs/:jobid with mode=CANCEL
        """
        resp = await self._request(
            "PATCH", f"/jobs/{job_id}",
            params={"mode": "cancel"},
        )
        return FlinkJobResult(
            task_id=task_id,
            job_id=job_id,
            status="canceled",
            response=resp,
        )

    async def get_status(
        self, task_id: str, job_id: str,
    ) -> FlinkJobResult:
        """Query the status of a Flink job.

        GET /jobs/:jobid
        """
        resp = await self._request("GET", f"/jobs/{job_id}")
        raw_state = str(resp.get("state", "unknown")).lower()
        state_map = {
            "created": "submitted",
            "running": "running",
            "failing": "failed",
            "failed": "failed",
            "cancelling": "canceled",
            "canceled": "canceled",
            "finished": "finished",
            "restarting": "running",
            "suspended": "unknown",
            "recovering": "running",
        }
        status = state_map.get(raw_state, "unknown")
        return FlinkJobResult(
            task_id=task_id,
            job_id=job_id,
            status=status,
            response=resp,
        )

    async def list_jars(self) -> list[dict[str, Any]]:
        """List uploaded JARs (GET /jars)."""
        resp = await self._request("GET", "/jars")
        return resp.get("files", [])

    async def upload_jar(self, jar_path: str) -> str:
        """Upload a JAR file (POST /jars/upload). Returns the jar ID."""
        client = await self._get_client()
        with open(jar_path, "rb") as f:
            files = {"jarfile": (os.path.basename(jar_path), f)}
            resp = await self._request("POST", "/jars/upload", files=files)
        jar_id = resp.get("filename", "")
        if not jar_id:
            raise FlinkSubmitError(
                "Flink upload response missing 'filename'",
                status_code=200,
                response_body=str(resp),
            )
        return jar_id

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
        files: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Execute an HTTP request with simple retry logic."""
        client = await self._get_client()
        last_exc: Exception | None = None
        for attempt in range(self._max_retries + 1):
            try:
                resp = await client.request(
                    method, path, json=json, params=params, files=files,
                )
                if resp.status_code >= 500 and attempt < self._max_retries:
                    # Retry on server errors
                    last_exc = FlinkSubmitError(
                        f"Flink REST {method} {path} returned {resp.status_code}",
                        status_code=resp.status_code,
                        response_body=resp.text[:500],
                    )
                    continue
                if resp.status_code >= 400:
                    raise FlinkSubmitError(
                        f"Flink REST {method} {path} returned {resp.status_code}: "
                        f"{resp.text[:300]}",
                        status_code=resp.status_code,
                        response_body=resp.text[:500],
                    )
                # 200/201/202 — parse JSON body
                if resp.status_code == 202 and not resp.content:
                    return {"status": "accepted"}
                return resp.json()
            except httpx.TimeoutException as exc:
                last_exc = FlinkSubmitError(
                    f"Flink REST {method} {path} timed out after {self._timeout}s",
                )
                if attempt >= self._max_retries:
                    raise last_exc from exc
            except httpx.HTTPError as exc:
                last_exc = FlinkSubmitError(
                    f"Flink REST {method} {path} HTTP error: {exc}",
                )
                if attempt >= self._max_retries:
                    raise last_exc from exc
        # Should not reach here, but satisfy the type checker
        if last_exc:
            raise last_exc
        raise FlinkSubmitError("Flink REST request failed without exception")
