"""Debezium engine adapter — manages CDC connectors via the Kafka Connect REST API.

Debezium connectors are deployed as Kafka Connect connectors. The
Kafka Connect REST API (default port 8083) exposes endpoints for
creating, pausing, resuming, restarting, and deleting connectors,
as well as querying their status.

REST API reference (Kafka Connect 3.x):

    GET    /connectors                      — list connectors
    POST   /connectors                      — create a connector
    GET    /connectors/{name}               — get connector detail
    DELETE /connectors/{name}               — delete a connector
    PUT    /connectors/{name}/pause         — pause a connector
    PUT    /connectors/{name}/resume        — resume a connector
    POST   /connectors/{name}/restart       — restart a connector
    GET    /connectors/{name}/status        — get connector status

Configuration (all from environment variables):

    KAFKA_CONNECT_URL     — base URL of the Kafka Connect REST API
                            (default: ``http://localhost:8083``)
    KAFKA_CONNECT_USER    — basic auth username (optional)
    KAFKA_CONNECT_PASSWORD — basic auth password (optional)
"""
from __future__ import annotations

import contextlib
import os
from dataclasses import dataclass, field
from typing import Any

import httpx


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------
class DebeziumEngineError(Exception):
    """Raised when a Kafka Connect REST API call fails."""

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
class CdcTaskResult:
    """Result of a Debezium CDC operation."""

    task_id: str
    connector_name: str
    status: str  # running | paused | stopped | failed | unknown
    response: dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------
class DebeziumEngine:
    """Real Debezium engine adapter using the Kafka Connect REST API.

    The engine maintains a reusable ``httpx.AsyncClient`` for
    connection pooling. Auth is configurable: basic auth
    (``KAFKA_CONNECT_USER`` / ``KAFKA_CONNECT_PASSWORD``) or no auth
    for development deployments.
    """

    def __init__(
        self,
        *,
        base_url: str = "http://localhost:8083",
        username: str = "",
        password: str = "",
        timeout_seconds: float = 30.0,
        max_retries: int = 2,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._username = username
        self._password = password
        self._timeout = timeout_seconds
        self._max_retries = max_retries
        self._client = client
        self._owns_client = client is None

    @classmethod
    def from_env(cls, *, timeout_seconds: float = 30.0) -> DebeziumEngine:
        """Build an engine from environment variables."""
        return cls(
            base_url=os.environ.get(
                "KAFKA_CONNECT_URL", "http://localhost:8083",
            ),
            username=os.environ.get("KAFKA_CONNECT_USER", ""),
            password=os.environ.get("KAFKA_CONNECT_PASSWORD", ""),
            timeout_seconds=timeout_seconds,
        )

    # -----------------------------------------------------------------
    # Lifecycle
    # -----------------------------------------------------------------
    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            headers: dict[str, str] = {
                "Content-Type": "application/json",
                "Accept": "application/json",
            }
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
    # Public API — CDC task lifecycle
    # -----------------------------------------------------------------
    async def start_cdc_task(
        self,
        task_id: str,
        *,
        connector_name: str,
        connector_class: str,
        config: dict[str, Any],
    ) -> CdcTaskResult:
        """Create and start a Debezium connector.

        POST /connectors with a connector config payload:
        {
            "name": "<connector_name>",
            "config": {
                "connector.class": "<connector_class>",
                ...
            }
        }
        """
        body = {
            "name": connector_name,
            "config": {
                "connector.class": connector_class,
                **config,
            },
        }
        resp = await self._request("POST", "/connectors", json=body)
        status = self._parse_status_from_detail(resp)
        return CdcTaskResult(
            task_id=task_id,
            connector_name=connector_name,
            status=status,
            response=resp,
        )

    async def stop_cdc_task(
        self, task_id: str, connector_name: str,
    ) -> CdcTaskResult:
        """Delete (stop) a Debezium connector.

        DELETE /connectors/{name}
        """
        await self._request("DELETE", f"/connectors/{connector_name}")
        return CdcTaskResult(
            task_id=task_id,
            connector_name=connector_name,
            status="stopped",
            response={},
        )

    async def pause_cdc_task(
        self, task_id: str, connector_name: str,
    ) -> CdcTaskResult:
        """Pause a Debezium connector.

        PUT /connectors/{name}/pause
        """
        resp = await self._request(
            "PUT", f"/connectors/{connector_name}/pause",
        )
        return CdcTaskResult(
            task_id=task_id,
            connector_name=connector_name,
            status="paused",
            response=resp,
        )

    async def resume_cdc_task(
        self, task_id: str, connector_name: str,
    ) -> CdcTaskResult:
        """Resume a paused Debezium connector.

        PUT /connectors/{name}/resume
        """
        resp = await self._request(
            "PUT", f"/connectors/{connector_name}/resume",
        )
        return CdcTaskResult(
            task_id=task_id,
            connector_name=connector_name,
            status="running",
            response=resp,
        )

    async def restart_cdc_task(
        self, task_id: str, connector_name: str,
    ) -> CdcTaskResult:
        """Restart a Debezium connector.

        POST /connectors/{name}/restart
        """
        resp = await self._request(
            "POST", f"/connectors/{connector_name}/restart",
        )
        return CdcTaskResult(
            task_id=task_id,
            connector_name=connector_name,
            status="running",
            response=resp,
        )

    async def get_status(
        self, task_id: str, connector_name: str,
    ) -> CdcTaskResult:
        """Get the status of a Debezium connector.

        GET /connectors/{name}/status
        """
        resp = await self._request(
            "GET", f"/connectors/{connector_name}/status",
        )
        status = self._parse_status(resp)
        return CdcTaskResult(
            task_id=task_id,
            connector_name=connector_name,
            status=status,
            response=resp,
        )

    # -----------------------------------------------------------------
    # Public API — data source operations
    # -----------------------------------------------------------------
    async def test_connection(
        self,
        task_id: str,
        *,
        connector_class: str,
        config: dict[str, Any],
    ) -> dict[str, Any]:
        """Test a source connection by creating a temporary connector.

        This creates a connector with a limited lifecycle, checks its
        status, then deletes it. Returns the test result.
        """
        connector_name = f"test-{task_id}"
        try:
            await self.start_cdc_task(
                task_id,
                connector_name=connector_name,
                connector_class=connector_class,
                config=config,
            )
            result = await self.get_status(task_id, connector_name)
            return {
                "task_id": task_id,
                "ok": result.status == "running",
                "status": result.status,
                "connector_name": connector_name,
            }
        except DebeziumEngineError as exc:
            return {
                "task_id": task_id,
                "ok": False,
                "error": str(exc),
                "status_code": exc.status_code,
            }
        finally:
            with contextlib.suppress(DebeziumEngineError):
                await self.stop_cdc_task(task_id, connector_name)

    async def discover_source_schema(
        self, task_id: str, connector_name: str,
    ) -> dict[str, Any]:
        """Discover the schema of a source via the connector's config.

        GET /connectors/{name} returns the connector config, which
        includes the database/table whitelist. This is parsed into a
        schema-like structure.
        """
        resp = await self._request("GET", f"/connectors/{connector_name}")
        config = resp.get("config", {})
        tables = config.get("table.whitelist", config.get("table.include.list", ""))
        table_list = [
            t.strip() for t in tables.split(",") if t.strip()
        ] if tables else []
        return {
            "source_id": connector_name,
            "tables": [
                {"name": t, "columns": []}  # Column discovery requires a JDBC source
                for t in table_list
            ],
            "connector_class": config.get("connector.class", ""),
        }

    async def list_connectors(self) -> list[str]:
        """List all connector names (GET /connectors)."""
        resp = await self._request("GET", "/connectors")
        if isinstance(resp, list):
            return resp
        return []

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
                    last_exc = DebeziumEngineError(
                        f"Kafka Connect {method} {path} returned {resp.status_code}",
                        status_code=resp.status_code,
                        response_body=resp.text[:500],
                    )
                    continue
                if resp.status_code >= 400:
                    raise DebeziumEngineError(
                        f"Kafka Connect {method} {path} returned {resp.status_code}: "
                        f"{resp.text[:300]}",
                        status_code=resp.status_code,
                        response_body=resp.text[:500],
                    )
                if resp.status_code == 204 or not resp.content:
                    return {}
                body = resp.json()
                if isinstance(body, list):
                    return body  # type: ignore[return-value]
                return body
            except httpx.TimeoutException as exc:
                last_exc = DebeziumEngineError(
                    f"Kafka Connect {method} {path} timed out after {self._timeout}s",
                )
                if attempt >= self._max_retries:
                    raise last_exc from exc
            except httpx.HTTPError as exc:
                last_exc = DebeziumEngineError(
                    f"Kafka Connect {method} {path} HTTP error: {exc}",
                )
                if attempt >= self._max_retries:
                    raise last_exc from exc
        if last_exc:
            raise last_exc
        raise DebeziumEngineError("Kafka Connect request failed without exception")

    def _parse_status(self, resp: dict[str, Any]) -> str:
        """Parse the connector status from the status response."""
        connector_state = str(
            resp.get("connector", {}).get("state", "UNKNOWN")
        ).upper()
        tasks = resp.get("tasks", [])
        if not tasks:
            # No tasks yet — use connector state
            state_map = {
                "RUNNING": "running",
                "PAUSED": "paused",
                "UNASSIGNED": "stopped",
                "FAILED": "failed",
                "RESTARTING": "running",
            }
            return state_map.get(connector_state, "unknown")
        # Check all task states
        task_states = [
            str(t.get("state", "UNKNOWN")).upper() for t in tasks
        ]
        if all(s == "RUNNING" for s in task_states):
            return "running"
        if all(s == "PAUSED" for s in task_states):
            return "paused"
        if any(s == "FAILED" for s in task_states):
            return "failed"
        return "unknown"

    def _parse_status_from_detail(self, resp: dict[str, Any]) -> str:
        """Parse status from a connector detail response (POST /connectors)."""
        # The POST response includes a "status" sub-object
        status_obj = resp.get("status", {})
        if status_obj:
            return self._parse_status(status_obj)
        # No status in the response — assume running (just created)
        return "running"
